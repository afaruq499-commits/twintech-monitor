"use client";

import { useRef, useState, useEffect } from "react";
import type {
  FlowchartNode,
  FlowchartEdge,
  PortPosition,
  ConnectionDraft,
  CanvasViewport,
  PaletteShapeDefinition,
} from "@/lib/flowchart-types";
import {
  getNodePortCoordinates,
  computeEdgePath,
  computeStraightPath,
} from "@/lib/flowchart-routing";

interface FlowchartCanvasProps {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onUpdateNodeLabel: (id: string, newLabel: string) => void;
  onDropNewShape: (def: PaletteShapeDefinition, x: number, y: number) => void;
  onCreateEdge: (newEdge: Omit<FlowchartEdge, "id">) => void;
  onDoubleClickEdgeLabel?: (edgeId: string) => void;
  viewport: CanvasViewport;
  onUpdateViewport: (updater: (prev: CanvasViewport) => CanvasViewport) => void;
  showGrid: boolean;
  snapToGrid: boolean;
}

const PORTS: PortPosition[] = ["top", "right", "bottom", "left"];

export function FlowchartCanvas({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onUpdateNodePosition,
  onUpdateNodeLabel,
  onDropNewShape,
  onCreateEdge,
  onDoubleClickEdgeLabel,
  viewport,
  onUpdateViewport,
  showGrid,
  snapToGrid,
}: FlowchartCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Dragging Canvas (Panning)
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging Node
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hovered node untuk menampilkan handle koneksi
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Dragging Garis Alur (Connection Draft)
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);

  // Double-click inline text editing untuk Node
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Focus input saat mulai edit teks node
  useEffect(() => {
    if (editingNodeId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingNodeId]);

  // Handle double click node
  const handleNodeDoubleClick = (node: FlowchartNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNodeId(node.id);
    setEditingText(node.label);
  };

  const handleFinishEditing = () => {
    if (editingNodeId) {
      if (editingText.trim().length > 0) {
        onUpdateNodeLabel(editingNodeId, editingText.trim());
      }
      setEditingNodeId(null);
    }
  };

  const handleKeyDownEdit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleFinishEditing();
    } else if (e.key === "Escape") {
      setEditingNodeId(null);
    }
  };

  // Konversi mouse event ke koordinat dunia (World Coordinate)
  const getWorldCoordinate = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const left = rect ? rect.left : 0;
    const top = rect ? rect.top : 0;
    return {
      x: (clientX - left - viewport.panX) / viewport.zoom,
      y: (clientY - top - viewport.panY) / viewport.zoom,
    };
  };

  // Drag over canvas untuk HTML5 Drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  // Drop shape dari palette
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const def = JSON.parse(dataStr) as PaletteShapeDefinition;

      const world = getWorldCoordinate(e.clientX, e.clientY);
      let worldX = world.x - def.defaultWidth / 2;
      let worldY = world.y - def.defaultHeight / 2;

      if (snapToGrid) {
        worldX = Math.round(worldX / 10) * 10;
        worldY = Math.round(worldY / 10) * 10;
      }

      onDropNewShape(def, worldX, worldY);
    } catch {
      // Ignored
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      onUpdateViewport((prev) => ({
        ...prev,
        zoom: Math.max(0.2, Math.min(3.0, prev.zoom * zoomFactor)),
      }));
    } else {
      // Dua jari trackpad / scroll pan
      onUpdateViewport((prev) => ({
        ...prev,
        panX: prev.panX - e.deltaX,
        panY: prev.panY - e.deltaY,
      }));
    }
  };

  // Mouse down pada Canvas Background (Start Panning)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editingNodeId) {
      handleFinishEditing();
    }

    // Jika klik kiri pada background (bukan pada node/garis)
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.panX, y: e.clientY - viewport.panY });
      onSelectNode(null);
      onSelectEdge(null);
    }
  };

  // Mouse down pada Node (Start Dragging Node)
  const handleNodeMouseDown = (node: FlowchartNode, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (editingNodeId) {
      handleFinishEditing();
    }

    onSelectNode(node.id);
    onSelectEdge(null);
    setDraggingNodeId(node.id);

    const clickWorld = getWorldCoordinate(e.clientX, e.clientY);
    setDragOffset({
      x: clickWorld.x - node.x,
      y: clickWorld.y - node.y,
    });
  };

  // Mouse Down pada Handle Port (Mulai Tarik Garis)
  const handlePortMouseDown = (
    nodeId: string,
    port: PortPosition,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const sourceNode = nodes.find((n) => n.id === nodeId);
    if (!sourceNode) return;

    const sourcePoint = getNodePortCoordinates(sourceNode, port);
    const clickWorld = getWorldCoordinate(e.clientX, e.clientY);

    setConnectionDraft({
      sourceNodeId: nodeId,
      sourcePort: port,
      sourcePoint,
      currentPoint: clickWorld,
    });
  };

  // Mouse Up pada Handle Port (Selesaikan Tarik Garis ke Node Lain)
  const handlePortMouseUp = (
    targetNodeId: string,
    targetPort: PortPosition,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (connectionDraft) {
      // Tidak boleh menghubungkan node ke dirinya sendiri
      if (connectionDraft.sourceNodeId !== targetNodeId) {
        onCreateEdge({
          sourceNodeId: connectionDraft.sourceNodeId,
          sourcePort: connectionDraft.sourcePort,
          targetNodeId,
          targetPort,
          routing: "orthogonal",
          style: "solid",
          marker: "arrow",
          label: "",
        });
      }
      setConnectionDraft(null);
    }
  };

  // Global Mouse Move (Panning, Drag Node, atau Drag Garis Alur)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      onUpdateViewport((prev) => ({
        ...prev,
        panX: e.clientX - panStart.x,
        panY: e.clientY - panStart.y,
      }));
      return;
    }

    if (connectionDraft) {
      const world = getWorldCoordinate(e.clientX, e.clientY);
      setConnectionDraft((prev) => (prev ? { ...prev, currentPoint: world } : null));
      return;
    }

    if (draggingNodeId) {
      const mouseWorld = getWorldCoordinate(e.clientX, e.clientY);
      let newX = mouseWorld.x - dragOffset.x;
      let newY = mouseWorld.y - dragOffset.y;

      if (snapToGrid) {
        newX = Math.round(newX / 10) * 10;
        newY = Math.round(newY / 10) * 10;
      }

      onUpdateNodePosition(draggingNodeId, newX, newY);
    }
  };

  // Mouse Up Global
  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    if (connectionDraft) {
      setConnectionDraft(null);
    }
  };

  // Render SVG Path/Geometry untuk masing-masing tipe shape
  const renderShapeGeometry = (node: FlowchartNode, isSelected: boolean) => {
    const { width: w, height: h, type } = node;

    const getThemeStyles = () => {
      switch (type) {
        case "start_end":
          return {
            fill: "#2563eb",
            stroke: isSelected ? "#93c5fd" : "#1d4ed8",
            textColor: "#ffffff",
          };
        case "decision":
          return {
            fill: "#4f46e5",
            stroke: isSelected ? "#c7d2fe" : "#3730a3",
            textColor: "#ffffff",
          };
        case "input_output":
          return {
            fill: "#059669",
            stroke: isSelected ? "#6ee7b7" : "#047857",
            textColor: "#ffffff",
          };
        case "subprocess":
          return {
            fill: "#d97706",
            stroke: isSelected ? "#fde68a" : "#b45309",
            textColor: "#ffffff",
          };
        case "database":
          return {
            fill: "#0d9488",
            stroke: isSelected ? "#99f6e4" : "#0f766e",
            textColor: "#ffffff",
          };
        case "document":
          return {
            fill: "#0284c7",
            stroke: isSelected ? "#bae6fd" : "#0369a1",
            textColor: "#ffffff",
          };
        case "connector":
          return {
            fill: "#7c3aed",
            stroke: isSelected ? "#ddd6fe" : "#6d28d9",
            textColor: "#ffffff",
          };
        case "note":
          return {
            fill: "#eab308",
            stroke: isSelected ? "#fef08a" : "#ca8a04",
            textColor: "#713f12",
          };
        case "process":
        default:
          return {
            fill: "#1e293b",
            stroke: isSelected ? "#818cf8" : "#475569",
            textColor: "#ffffff",
          };
      }
    };

    const styles = getThemeStyles();
    const strokeWidth = isSelected ? 3 : 1.5;

    switch (type) {
      case "start_end":
        return (
          <rect
            x="0"
            y="0"
            width={w}
            height={h}
            rx={h / 2}
            fill={styles.fill}
            stroke={styles.stroke}
            strokeWidth={strokeWidth}
          />
        );

      case "decision":
        return (
          <polygon
            points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`}
            fill={styles.fill}
            stroke={styles.stroke}
            strokeWidth={strokeWidth}
          />
        );

      case "input_output":
        return (
          <polygon
            points={`16,0 ${w},0 ${w - 16},${h} 0,${h}`}
            fill={styles.fill}
            stroke={styles.stroke}
            strokeWidth={strokeWidth}
          />
        );

      case "subprocess":
        return (
          <g>
            <rect
              x="0"
              y="0"
              width={w}
              height={h}
              rx="6"
              fill={styles.fill}
              stroke={styles.stroke}
              strokeWidth={strokeWidth}
            />
            <line x1="12" y1="0" x2="12" y2={h} stroke={styles.stroke} strokeWidth={strokeWidth} />
            <line x1={w - 12} y1="0" x2={w - 12} y2={h} stroke={styles.stroke} strokeWidth={strokeWidth} />
          </g>
        );

      case "database":
        return (
          <g>
            <path
              d={`M 0,10 L 0,${h - 10} A ${w / 2} 10 0 0 0 ${w} ${h - 10} L ${w},10 Z`}
              fill={styles.fill}
              stroke={styles.stroke}
              strokeWidth={strokeWidth}
            />
            <ellipse
              cx={w / 2}
              cy="10"
              rx={w / 2}
              ry="10"
              fill={styles.fill}
              stroke={styles.stroke}
              strokeWidth={strokeWidth}
            />
          </g>
        );

      case "document":
        return (
          <path
            d={`M 0,0 L ${w},0 L ${w},${h - 10} Q ${w * 0.75},${h} ${w * 0.5},${h - 8} Q ${w * 0.25},${h - 16} 0,${h - 8} Z`}
            fill={styles.fill}
            stroke={styles.stroke}
            strokeWidth={strokeWidth}
          />
        );

      case "connector":
        return (
          <circle
            cx={w / 2}
            cy={h / 2}
            r={w / 2}
            fill={styles.fill}
            stroke={styles.stroke}
            strokeWidth={strokeWidth}
          />
        );

      case "note":
        return (
          <g>
            <path
              d={`M 0,0 L ${w - 14},0 L ${w},14 L ${w},${h} L 0,${h} Z`}
              fill={styles.fill}
              stroke={styles.stroke}
              strokeWidth={strokeWidth}
            />
            <path
              d={`M ${w - 14},0 L ${w - 14},14 L ${w},14`}
              fill="rgba(0,0,0,0.15)"
              stroke={styles.stroke}
              strokeWidth="1"
            />
          </g>
        );

      case "process":
      default:
        return (
          <rect
            x="0"
            y="0"
            width={w}
            height={h}
            rx="8"
            fill={styles.fill}
            stroke={styles.stroke}
            strokeWidth={strokeWidth}
          />
        );
    }
  };

  // Node Map untuk pencarian O(1) saat render garis
  const nodeMap = new Map<string, FlowchartNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const editingNode = nodes.find((n) => n.id === editingNodeId);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`flex-1 relative overflow-hidden select-none bg-slate-50 dark:bg-[#0b0f19] ${
        isPanning ? "cursor-grabbing" : "cursor-default"
      }`}
    >
      {/* SVG Canvas Utama */}
      <svg
        width="100%"
        height="100%"
        className="block w-full h-full pointer-events-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Pola Grid Dinamis */}
          <pattern
            id="flowchart-grid-pattern"
            width={20 * viewport.zoom}
            height={20 * viewport.zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${viewport.panX % (20 * viewport.zoom)}, ${
              viewport.panY % (20 * viewport.zoom)
            })`}
          >
            <circle
              cx="1"
              cy="1"
              r="1"
              className="fill-slate-300 dark:fill-slate-800"
            />
          </pattern>

          {/* Filter Shadow untuk Node Terpilih */}
          <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#6366f1" floodOpacity="0.75" />
          </filter>

          {/* Marker Ujung Panah Default (Akhir) */}
          <marker
            id="flowchart-arrow-end"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
          </marker>

          {/* Marker Ujung Panah Terpilih (Akhir) */}
          <marker
            id="flowchart-arrow-end-selected"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#4f46e5" />
          </marker>

          {/* Marker Ujung Panah Default (Awal) */}
          <marker
            id="flowchart-arrow-start"
            viewBox="0 0 10 10"
            refX="2"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 9 1 L 0 5 L 9 9 z" fill="#64748b" />
          </marker>

          {/* Marker Ujung Panah Terpilih (Awal) */}
          <marker
            id="flowchart-arrow-start-selected"
            viewBox="0 0 10 10"
            refX="2"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 9 1 L 0 5 L 9 9 z" fill="#4f46e5" />
          </marker>
        </defs>

        {/* Latar Belakang Grid */}
        {showGrid && (
          <rect width="100%" height="100%" fill="url(#flowchart-grid-pattern)" className="pointer-events-none" />
        )}

        {/* Layer Dunia dengan Pan & Zoom Transform */}
        <g transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}>
          {/* ========================================================= */}
          {/* 1. LAYER GARIS ALUR (EDGES) - Render di bawah node */}
          {/* ========================================================= */}
          {edges.map((edge) => {
            const sourceNode = nodeMap.get(edge.sourceNodeId);
            const targetNode = nodeMap.get(edge.targetNodeId);
            if (!sourceNode || !targetNode) return null;

            const p1 = getNodePortCoordinates(sourceNode, edge.sourcePort);
            const p2 = getNodePortCoordinates(targetNode, edge.targetPort);
            const isSelected = selectedEdgeId === edge.id;

            const { path, labelPosition } = computeEdgePath(
              p1,
              edge.sourcePort,
              p2,
              edge.targetPort,
              edge.routing
            );

            // Tentukan marker berdasarkan setting dan status seleksi
            let markerEnd: string | undefined = undefined;
            if (edge.marker === "arrow" || edge.marker === "arrow-both") {
              markerEnd = isSelected ? "url(#flowchart-arrow-end-selected)" : "url(#flowchart-arrow-end)";
            }

            let markerStart: string | undefined = undefined;
            if (edge.marker === "arrow-start" || edge.marker === "arrow-both") {
              markerStart = isSelected ? "url(#flowchart-arrow-start-selected)" : "url(#flowchart-arrow-start)";
            }

            return (
              <g key={edge.id} className="group">
                {/* Efek Glow bila garis terpilih */}
                {isSelected && (
                  <path
                    d={path}
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.45"
                  />
                )}

                {/* Garis Tampak Nyata */}
                <path
                  d={path}
                  fill="none"
                  stroke={isSelected ? "#4f46e5" : edge.color || "#64748b"}
                  strokeWidth={isSelected ? 2.5 : 2}
                  strokeDasharray={edge.style === "dashed" ? "6,4" : undefined}
                  markerEnd={markerEnd}
                  markerStart={markerStart}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-colors pointer-events-none"
                />

                {/* Area Hit Transparan Lebih Tebal Agar Mudah Diklik */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="20"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEdge(edge.id);
                    onSelectNode(null);
                  }}
                />

                {/* Badge Label Garis (misal: "Ya", "Tidak") */}
                {edge.label && edge.label.trim().length > 0 && (
                  <g
                    transform={`translate(${labelPosition.x}, ${labelPosition.y})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEdge(edge.id);
                      onSelectNode(null);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (onDoubleClickEdgeLabel) {
                        onDoubleClickEdgeLabel(edge.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {/* Background badge pill */}
                    <rect
                      x={-(edge.label.length * 4.2 + 10)}
                      y="-11"
                      width={edge.label.length * 8.4 + 20}
                      height="22"
                      rx="11"
                      className={`${
                        isSelected
                          ? "fill-indigo-50 dark:fill-indigo-950 stroke-indigo-500"
                          : "fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700 hover:stroke-indigo-400"
                      } transition-colors`}
                      strokeWidth="1.5"
                    />
                    {/* Teks badge */}
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      className={`text-[11px] font-bold select-none ${
                        isSelected
                          ? "fill-indigo-600 dark:fill-indigo-400"
                          : "fill-slate-700 dark:fill-slate-200"
                      }`}
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ========================================================= */}
          {/* 2. DRAFT GARIS SEMENTARA SAAT SEDANG DITARIK DARI HANDLE  */}
          {/* ========================================================= */}
          {connectionDraft && (
            <g className="pointer-events-none">
              <path
                d={computeStraightPath(connectionDraft.sourcePoint, connectionDraft.currentPoint).path}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeDasharray="5,4"
                markerEnd="url(#flowchart-arrow-end-selected)"
              />
              <circle
                cx={connectionDraft.currentPoint.x}
                cy={connectionDraft.currentPoint.y}
                r="4"
                fill="#6366f1"
              />
            </g>
          )}

          {/* ========================================================= */}
          {/* 3. LAYER NODE / SIMBOL FLOWCHART                          */}
          {/* ========================================================= */}
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isEditing = editingNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const showHandles = isHovered || isSelected || connectionDraft !== null;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onMouseDown={(e) => handleNodeMouseDown(node, e)}
                onDoubleClick={(e) => handleNodeDoubleClick(node, e)}
                filter={isSelected ? "url(#node-glow)" : undefined}
                className="cursor-move group"
              >
                {/* Geometri Shape */}
                {renderShapeGeometry(node, isSelected)}

                {/* Teks Label Node */}
                {!isEditing && (
                  <text
                    x={node.width / 2}
                    y={node.height / 2 + 4}
                    textAnchor="middle"
                    fill={node.type === "note" ? "#713f12" : "#ffffff"}
                    fontSize={node.type === "connector" ? "14" : "11"}
                    fontWeight="bold"
                    className="pointer-events-none select-none tracking-wide"
                  >
                    {node.label}
                  </text>
                )}

                {/* Indikator Titik Sudut saat Terpilih */}
                {isSelected && (
                  <g className="pointer-events-none">
                    <rect x="-4" y="-4" width="8" height="8" fill="#ffffff" stroke="#6366f1" strokeWidth="1.5" />
                    <rect x={node.width - 4} y="-4" width="8" height="8" fill="#ffffff" stroke="#6366f1" strokeWidth="1.5" />
                    <rect x="-4" y={node.height - 4} width="8" height="8" fill="#ffffff" stroke="#6366f1" strokeWidth="1.5" />
                    <rect x={node.width - 4} y={node.height - 4} width="8" height="8" fill="#ffffff" stroke="#6366f1" strokeWidth="1.5" />
                  </g>
                )}

                {/* ===================================================== */}
                {/* HANDLE KONEKSI PORT (TOP, RIGHT, BOTTOM, LEFT)        */}
                {/* ===================================================== */}
                {showHandles &&
                  PORTS.map((port) => {
                    let px = 0;
                    let py = 0;
                    if (port === "top") {
                      px = node.width / 2;
                      py = 0;
                    } else if (port === "bottom") {
                      px = node.width / 2;
                      py = node.height;
                    } else if (port === "left") {
                      px = 0;
                      py = node.height / 2;
                    } else if (port === "right") {
                      px = node.width;
                      py = node.height / 2;
                    }

                    return (
                      <g key={port} className="transition-opacity duration-150">
                        {/* Lingkaran Handle Port Tampak Nyata */}
                        <circle
                          cx={px}
                          cy={py}
                          r="5"
                          fill="#ffffff"
                          stroke="#6366f1"
                          strokeWidth="2.5"
                          className="pointer-events-none drop-shadow-xs"
                        />
                        <circle
                          cx={px}
                          cy={py}
                          r="2.5"
                          fill="#4f46e5"
                          className="pointer-events-none"
                        />

                        {/* Area Hit Besar untuk Memulai atau Menyambungkan Garis */}
                        <circle
                          cx={px}
                          cy={py}
                          r="14"
                          fill="transparent"
                          className="cursor-crosshair pointer-events-auto"
                          onMouseDown={(e) => handlePortMouseDown(node.id, port, e)}
                          onMouseUp={(e) => handlePortMouseUp(node.id, port, e)}
                        />
                      </g>
                    );
                  })}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Input Overlay untuk Dobel Klik Edit Teks Node */}
      {editingNode && (
        <div
          style={{
            position: "absolute",
            left: `${editingNode.x * viewport.zoom + viewport.panX}px`,
            top: `${editingNode.y * viewport.zoom + viewport.panY}px`,
            width: `${editingNode.width * viewport.zoom}px`,
            height: `${editingNode.height * viewport.zoom}px`,
          }}
          className="flex items-center justify-center p-1 pointer-events-auto"
        >
          <input
            ref={editInputRef}
            type="text"
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={handleFinishEditing}
            onKeyDown={handleKeyDownEdit}
            className="w-full text-center font-bold text-xs px-2 py-1 bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-lg shadow-xl text-slate-800 dark:text-slate-100 focus:outline-hidden"
          />
        </div>
      )}

      {/* Watermark Petunjuk Penggunaan jika Kosong */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <div className="text-center p-6 rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs border border-slate-200/80 dark:border-slate-800/80 shadow-xl max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <span className="text-xl font-bold">✨</span>
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Canvas Flowchart Masih Kosong
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Tarik simbol dari palet di sebelah kiri atau klik simbol untuk menambahkannya ke kanvas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
