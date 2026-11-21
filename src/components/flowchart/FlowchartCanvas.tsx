"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { LayoutTemplate, ArrowRight } from "lucide-react";
import type {
  FlowchartNode,
  FlowchartEdge,
  PortPosition,
  ConnectionDraft,
  CanvasViewport,
  PaletteShapeDefinition,
  ResizeHandleType,
  AlignmentGuide,
  SelectionBox,
} from "@/lib/flowchart-types";
import {
  getNodePortCoordinates,
  computeEdgePath,
  computeStraightPath,
  calculateNodeAlignment,
} from "@/lib/flowchart-routing";
import { ALL_FLOWCHART_TEMPLATES, type FlowchartTemplate } from "@/lib/flowchart-templates";

interface FlowchartCanvasProps {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  onSelectNode: (id: string | null, isMulti?: boolean) => void;
  onSelectEdge: (id: string | null, isMulti?: boolean) => void;
  onSelectNodesInBox?: (box: SelectionBox, isAdditive?: boolean) => void;
  onStartDragAction?: () => void;
  onEndDragAction?: () => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onUpdateNodeGeometry: (id: string, x: number, y: number, width: number, height: number) => void;
  onUpdateNodeLabel: (id: string, newLabel: string) => void;
  onDropNewShape: (def: PaletteShapeDefinition, x: number, y: number) => void;
  onCreateEdge: (newEdge: Omit<FlowchartEdge, "id">) => void;
  onDoubleClickEdgeLabel?: (edgeId: string) => void;
  onApplyTemplate?: (template: FlowchartTemplate) => void;
  viewport: CanvasViewport;
  onUpdateViewport: (updater: (prev: CanvasViewport) => CanvasViewport) => void;
  showGrid: boolean;
  snapToGrid: boolean;
}

const PORTS: PortPosition[] = ["top", "right", "bottom", "left"];

export function FlowchartCanvas({
  nodes,
  edges,
  selectedNodeIds,
  selectedEdgeIds,
  onSelectNode,
  onSelectEdge,
  onSelectNodesInBox,
  onStartDragAction,
  onEndDragAction,
  onUpdateNodePosition,
  onUpdateNodeGeometry,
  onUpdateNodeLabel,
  onDropNewShape,
  onCreateEdge,
  onDoubleClickEdgeLabel,
  onApplyTemplate,
  viewport,
  onUpdateViewport,
  showGrid,
  snapToGrid,
}: FlowchartCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Dragging Canvas (Panning)
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selection Box Marquee (Tahap 4)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isMarquee, setIsMarquee] = useState(false);

  // Dragging Node
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pelacak apakah interaksi klik pada node berlanjut ke pergeseran (drag)
  const nodeDragRef = useRef<{
    nodeId: string;
    hasMoved: boolean;
    wasMultiSelected: boolean;
  } | null>(null);

  // Resizing Node (Tahap 3)
  const [resizing, setResizing] = useState<{
    nodeId: string;
    handle: ResizeHandleType;
    startWorld: { x: number; y: number };
    startRect: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // Alignment Guides saat Memindahkan Node (Tahap 3)
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);

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

  // Native Wheel Event Handler: Zoom dengan Ctrl + Scroll (Mouse wheel atau Pinch Trackpad)
  // Menggunakan listener DOM langsung dengan { passive: false } agar e.preventDefault() dapat
  // mencegah zoom bawaan seluruh halaman browser dan menjalankan zoom kanvas berpusat pada kursor mouse.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // 1. Zoom dengan Ctrl / Meta + Scroll
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        // Sensitivitas zoom:
        // Jika delta > 50 (mouse wheel standar berkisar 100-120): langkah zoom 12%
        // Jika delta <= 50 (gesture pinch trackpad halus): skala proporsional halus
        let zoomRatio: number;
        if (Math.abs(e.deltaY) > 50) {
          zoomRatio = e.deltaY < 0 ? 1.12 : 0.89;
        } else {
          zoomRatio = Math.max(0.92, Math.min(1.08, 1 - e.deltaY * 0.005));
        }

        onUpdateViewport((prev) => {
          const newZoom = Math.max(0.15, Math.min(3.5, Number((prev.zoom * zoomRatio).toFixed(3))));
          if (newZoom === prev.zoom) return prev;

          // Koordinat dunia di bawah titik mouse saat ini
          const worldX = (cursorX - prev.panX) / prev.zoom;
          const worldY = (cursorY - prev.panY) / prev.zoom;

          // Hitung panX & panY baru agar titik dunia di bawah kursor tetap tepat berada di posisi kursor
          const newPanX = cursorX - worldX * newZoom;
          const newPanY = cursorY - worldY * newZoom;

          return {
            zoom: newZoom,
            panX: Math.round(newPanX),
            panY: Math.round(newPanY),
          };
        });
      } else {
        // 2. Pan Kanvas dengan Scroll Dua Jari Trackpad atau Wheel Biasa
        e.preventDefault();
        onUpdateViewport((prev) => ({
          ...prev,
          panX: Math.round(prev.panX - (e.shiftKey ? e.deltaY : e.deltaX)),
          panY: Math.round(prev.panY - (e.shiftKey ? 0 : e.deltaY)),
        }));
      }
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleNativeWheel);
    };
  }, [onUpdateViewport]);

  // Mouse down pada Canvas Background (Start Panning atau Selection Box)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editingNodeId) {
      handleFinishEditing();
    }

    // Jika Shift ditekan: mulai Selection Box Marquee (Tahap 4)
    if (e.shiftKey && e.button === 0) {
      const world = getWorldCoordinate(e.clientX, e.clientY);
      setIsMarquee(true);
      setSelectionBox({
        startX: world.x,
        startY: world.y,
        currentX: world.x,
        currentY: world.y,
      });
      return;
    }

    // Klik kiri atau tengah pada background (Panning)
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.panX, y: e.clientY - viewport.panY });
      onSelectNode(null, false);
      onSelectEdge(null, false);
    }
  };

  // Mouse down pada Node (Start Dragging Node)
  const handleNodeMouseDown = (node: FlowchartNode, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (editingNodeId) {
      handleFinishEditing();
    }

    const isAlreadySelected = selectedNodeIds.includes(node.id);

    if (e.shiftKey) {
      // Dukung Shift+Klik untuk toggle multi-select (Tahap 4)
      onSelectNode(node.id, true);
    } else if (!isAlreadySelected) {
      // Jika node belum terpilih dan tanpa Shift -> pilih node ini saja
      onSelectNode(node.id, false);
    }
    // Jika node SUDAH terpilih sebelumnya (misalnya setelah 'Select All' atau box select):
    // JANGAN hapus seleksi node lainnya pada mousedown!
    // Pertahankan multi-seleksi saat ini agar saat digeser, SELURUH node yang terpilih ikut bergeser bersama!

    nodeDragRef.current = {
      nodeId: node.id,
      hasMoved: false,
      wasMultiSelected: isAlreadySelected && selectedNodeIds.length > 1,
    };

    onSelectEdge(null, false);
    setDraggingNodeId(node.id);

    // Tandai awal drag untuk history 1 langkah
    onStartDragAction?.();

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

  // Start Resizing Handle (Tahap 3 & 4)
  const handleResizeMouseDown = (
    node: FlowchartNode,
    handle: ResizeHandleType,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();

    onStartDragAction?.();

    const world = getWorldCoordinate(e.clientX, e.clientY);
    setResizing({
      nodeId: node.id,
      handle,
      startWorld: world,
      startRect: {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      },
    });
  };

  // Global Mouse Move (Panning, Selection Box, Drag Node, Resize Node, atau Garis Alur)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      onUpdateViewport((prev) => ({
        ...prev,
        panX: e.clientX - panStart.x,
        panY: e.clientY - panStart.y,
      }));
      return;
    }

    // Selection Box Marquee (Tahap 4)
    if (isMarquee && selectionBox) {
      const world = getWorldCoordinate(e.clientX, e.clientY);
      const updatedBox = { ...selectionBox, currentX: world.x, currentY: world.y };
      setSelectionBox(updatedBox);
      onSelectNodesInBox?.(updatedBox, e.shiftKey);
      return;
    }

    if (connectionDraft) {
      const world = getWorldCoordinate(e.clientX, e.clientY);
      setConnectionDraft((prev) => (prev ? { ...prev, currentPoint: world } : null));
      return;
    }

    // Resizing Node Logic
    if (resizing) {
      const world = getWorldCoordinate(e.clientX, e.clientY);
      const dx = world.x - resizing.startWorld.x;
      const dy = world.y - resizing.startWorld.y;
      const { startRect, handle, nodeId } = resizing;

      let newWidth = startRect.width;
      let newHeight = startRect.height;
      let newX = startRect.x;
      let newY = startRect.y;

      const minW = 40;
      const minH = 30;

      switch (handle) {
        case "se":
          newWidth = Math.max(minW, startRect.width + dx);
          newHeight = Math.max(minH, startRect.height + dy);
          break;
        case "sw":
          newWidth = Math.max(minW, startRect.width - dx);
          newX = startRect.x + (startRect.width - newWidth);
          newHeight = Math.max(minH, startRect.height + dy);
          break;
        case "ne":
          newWidth = Math.max(minW, startRect.width + dx);
          newHeight = Math.max(minH, startRect.height - dy);
          newY = startRect.y + (startRect.height - newHeight);
          break;
        case "nw":
          newWidth = Math.max(minW, startRect.width - dx);
          newX = startRect.x + (startRect.width - newWidth);
          newHeight = Math.max(minH, startRect.height - dy);
          newY = startRect.y + (startRect.height - newHeight);
          break;
        case "e":
          newWidth = Math.max(minW, startRect.width + dx);
          break;
        case "w":
          newWidth = Math.max(minW, startRect.width - dx);
          newX = startRect.x + (startRect.width - newWidth);
          break;
        case "s":
          newHeight = Math.max(minH, startRect.height + dy);
          break;
        case "n":
          newHeight = Math.max(minH, startRect.height - dy);
          newY = startRect.y + (startRect.height - newHeight);
          break;
      }

      if (snapToGrid) {
        newWidth = Math.round(newWidth / 10) * 10;
        newHeight = Math.round(newHeight / 10) * 10;
        newX = Math.round(newX / 10) * 10;
        newY = Math.round(newY / 10) * 10;
      }

      onUpdateNodeGeometry(nodeId, newX, newY, newWidth, newHeight);
      return;
    }

    // Dragging Node with Alignment Guides & Snap
    if (draggingNodeId) {
      if (nodeDragRef.current) {
        nodeDragRef.current.hasMoved = true;
      }

      const mouseWorld = getWorldCoordinate(e.clientX, e.clientY);
      let rawX = mouseWorld.x - dragOffset.x;
      let rawY = mouseWorld.y - dragOffset.y;

      const currentNode = nodes.find((n) => n.id === draggingNodeId);
      if (currentNode) {
        // Optimasi Performa 200+ node: Pre-filter spasial kandidat guide yang berada di dekat kursor
        // dan pastikan node lain yang ikut terpilih diabaikan agar tidak snap ke diri sendiri
        const otherNodes =
          nodes.length > 80
            ? nodes.filter(
                (n) =>
                  !selectedNodeIds.includes(n.id) &&
                  Math.abs(n.x - rawX) < 1400 &&
                  Math.abs(n.y - rawY) < 1400
              )
            : nodes.filter((n) => !selectedNodeIds.includes(n.id));
        const alignment = calculateNodeAlignment(
          { x: rawX, y: rawY, width: currentNode.width, height: currentNode.height },
          otherNodes,
          snapToGrid ? 8 : 6
        );

        if (alignment.guides.length > 0) {
          rawX = alignment.snappedX;
          rawY = alignment.snappedY;
          setActiveGuides(alignment.guides);
        } else {
          setActiveGuides([]);
          if (snapToGrid) {
            rawX = Math.round(rawX / 10) * 10;
            rawY = Math.round(rawY / 10) * 10;
          }
        }
      } else if (snapToGrid) {
        rawX = Math.round(rawX / 10) * 10;
        rawY = Math.round(rawY / 10) * 10;
      }

      onUpdateNodePosition(draggingNodeId, rawX, rawY);
    }
  };

  // Mouse Up Global (Satu drag = Satu langkah history)
  const handleMouseUp = (e?: React.MouseEvent) => {
    setIsPanning(false);

    if (nodeDragRef.current) {
      // Jika user mengklik node yang merupakan bagian dari multi-seleksi,
      // tetapi mouse dilepas TANPA digeser (hanya klik tunggal biasa):
      // Baru ciutkan seleksi menjadi hanya node yang diklik tersebut.
      if (
        nodeDragRef.current.wasMultiSelected &&
        !nodeDragRef.current.hasMoved &&
        !e?.shiftKey
      ) {
        onSelectNode(nodeDragRef.current.nodeId, false);
      }
      nodeDragRef.current = null;
    }

    if (isMarquee) {
      setIsMarquee(false);
      setSelectionBox(null);
    }

    if (draggingNodeId || resizing) {
      onEndDragAction?.();
    }

    setDraggingNodeId(null);
    setResizing(null);
    setActiveGuides([]);
    if (connectionDraft) {
      setConnectionDraft(null);
    }
  };

  // Render SVG Path/Geometry untuk masing-masing tipe shape
  const renderShapeGeometry = (node: FlowchartNode, isSelected: boolean) => {
    const { width: w, height: h, type } = node;

    const getDefaultThemeStyles = () => {
      switch (type) {
        case "start_end":
          return { fill: "#2563eb", stroke: "#1d4ed8", textColor: "#ffffff" };
        case "decision":
          return { fill: "#4f46e5", stroke: "#3730a3", textColor: "#ffffff" };
        case "input_output":
          return { fill: "#059669", stroke: "#047857", textColor: "#ffffff" };
        case "subprocess":
          return { fill: "#d97706", stroke: "#b45309", textColor: "#ffffff" };
        case "database":
          return { fill: "#0d9488", stroke: "#0f766e", textColor: "#ffffff" };
        case "document":
          return { fill: "#0284c7", stroke: "#0369a1", textColor: "#ffffff" };
        case "connector":
          return { fill: "#7c3aed", stroke: "#6d28d9", textColor: "#ffffff" };
        case "note":
          return { fill: "#eab308", stroke: "#ca8a04", textColor: "#713f12" };
        case "process":
        default:
          return { fill: "#1e293b", stroke: "#475569", textColor: "#ffffff" };
      }
    };

    const defaultStyles = getDefaultThemeStyles();
    const fill = node.fillColor || defaultStyles.fill;
    const stroke = node.strokeColor || (isSelected ? "#818cf8" : defaultStyles.stroke);
    const strokeWidth = node.strokeWidth || (isSelected ? 3 : 1.5);

    switch (type) {
      case "start_end":
        return (
          <rect
            x="0"
            y="0"
            width={w}
            height={h}
            rx={h / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case "decision":
        return (
          <polygon
            points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case "input_output":
        return (
          <polygon
            points={`16,0 ${w},0 ${w - 16},${h} 0,${h}`}
            fill={fill}
            stroke={stroke}
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
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <line x1="12" y1="0" x2="12" y2={h} stroke={stroke} strokeWidth={strokeWidth} />
            <line x1={w - 12} y1="0" x2={w - 12} y2={h} stroke={stroke} strokeWidth={strokeWidth} />
          </g>
        );

      case "database":
        return (
          <g>
            <path
              d={`M 0,10 L 0,${h - 10} A ${w / 2} 10 0 0 0 ${w} ${h - 10} L ${w},10 Z`}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <ellipse
              cx={w / 2}
              cy="10"
              rx={w / 2}
              ry="10"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </g>
        );

      case "document":
        return (
          <path
            d={`M 0,0 L ${w},0 L ${w},${h - 10} Q ${w * 0.75},${h} ${w * 0.5},${h - 8} Q ${w * 0.25},${h - 16} 0,${h - 8} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case "connector":
        return (
          <circle
            cx={w / 2}
            cy={h / 2}
            r={w / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );

      case "note":
        return (
          <g>
            <path
              d={`M 0,0 L ${w - 14},0 L ${w},14 L ${w},${h} L 0,${h} Z`}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <path
              d={`M ${w - 14},0 L ${w - 14},14 L ${w},14`}
              fill="rgba(0,0,0,0.15)"
              stroke={stroke}
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
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
    }
  };

  // Optimasi Performa 200+ node: Lookup node cepat O(1) termemoize
  const nodeMap = useMemo(() => {
    const map = new Map<string, FlowchartNode>();
    for (const n of nodes) {
      map.set(n.id, n);
    }
    return map;
  }, [nodes]);

  const editingNode = editingNodeId ? nodeMap.get(editingNodeId) : undefined;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`flex-1 relative overflow-hidden select-none bg-slate-50 dark:bg-[#0b0f19] ${
        isPanning ? "cursor-grabbing" : isMarquee ? "cursor-crosshair" : "cursor-default"
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
          {/* 1. LAYER GARIS ALUR (EDGES) - Render di bawah node        */}
          {/* ========================================================= */}
          {edges.map((edge) => {
            const sourceNode = nodeMap.get(edge.sourceNodeId);
            const targetNode = nodeMap.get(edge.targetNodeId);
            if (!sourceNode || !targetNode) return null;

            const p1 = getNodePortCoordinates(sourceNode, edge.sourcePort);
            const p2 = getNodePortCoordinates(targetNode, edge.targetPort);
            const isSelected = selectedEdgeIds.includes(edge.id);

            const { path, labelPosition } = computeEdgePath(
              p1,
              edge.sourcePort,
              p2,
              edge.targetPort,
              edge.routing
            );

            let markerEnd: string | undefined = undefined;
            if (edge.marker === "arrow" || edge.marker === "arrow-both") {
              markerEnd = isSelected ? "url(#flowchart-arrow-end-selected)" : "url(#flowchart-arrow-end)";
            }

            let markerStart: string | undefined = undefined;
            if (edge.marker === "arrow-start" || edge.marker === "arrow-both") {
              markerStart = isSelected ? "url(#flowchart-arrow-start-selected)" : "url(#flowchart-arrow-start)";
            }

            const strokeColor = isSelected ? "#4f46e5" : edge.color || "#64748b";
            const strokeWidth = isSelected
              ? (edge.strokeWidth ? edge.strokeWidth + 1 : 2.5)
              : (edge.strokeWidth || 2);

            return (
              <g key={edge.id} className="group">
                {/* Efek Glow bila garis terpilih */}
                {isSelected && (
                  <path
                    d={path}
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth={strokeWidth + 4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.45"
                  />
                )}

                {/* Garis Tampak Nyata */}
                <path
                  d={path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
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
                  strokeWidth="22"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEdge(edge.id, e.shiftKey);
                  }}
                />

                {/* Badge Label Garis */}
                {edge.label && edge.label.trim().length > 0 && (
                  <g
                    transform={`translate(${labelPosition.x}, ${labelPosition.y})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEdge(edge.id, e.shiftKey);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (onDoubleClickEdgeLabel) {
                        onDoubleClickEdgeLabel(edge.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
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
          {/* 3. ALIGNMENT GUIDES (SMART GUIDES)                        */}
          {/* ========================================================= */}
          {activeGuides.map((guide, idx) => {
            if (guide.type === "vertical") {
              return (
                <line
                  key={`guide-v-${idx}`}
                  x1={guide.position}
                  y1={guide.start}
                  x2={guide.position}
                  y2={guide.end}
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  className="pointer-events-none"
                />
              );
            } else {
              return (
                <line
                  key={`guide-h-${idx}`}
                  x1={guide.start}
                  y1={guide.position}
                  x2={guide.end}
                  y2={guide.position}
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  className="pointer-events-none"
                />
              );
            }
          })}

          {/* ========================================================= */}
          {/* 4. LAYER NODE / SIMBOL FLOWCHART                          */}
          {/* ========================================================= */}
          {nodes.map((node) => {
            const isSelected = selectedNodeIds.includes(node.id);
            const isEditing = editingNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const showHandles = isHovered || isSelected || connectionDraft !== null;

            const textAlign = node.textAlign || "center";
            let textAnchor: "middle" | "start" | "end" = "middle";
            let textX = node.width / 2;
            if (textAlign === "left") {
              textAnchor = "start";
              textX = 16;
            } else if (textAlign === "right") {
              textAnchor = "end";
              textX = node.width - 16;
            }

            const fontSize = node.fontSize || (node.type === "connector" ? 14 : 11);
            const defaultTextColor = node.type === "note" ? "#713f12" : "#ffffff";
            const textColor = node.textColor || defaultTextColor;

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
                    x={textX}
                    y={node.height / 2 + 4}
                    textAnchor={textAnchor}
                    fill={textColor}
                    fontSize={fontSize}
                    fontWeight="bold"
                    className="pointer-events-none select-none tracking-wide"
                  >
                    {node.label}
                  </text>
                )}

                {/* ===================================================== */}
                {/* RESIZE HANDLES PADA SUDUT & SISI (TAHAP 3)            */}
                {/* ===================================================== */}
                {isSelected && (
                  <g>
                    {/* Bounding box tipis seleksi */}
                    <rect
                      x="0"
                      y="0"
                      width={node.width}
                      height={node.height}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      className="pointer-events-none opacity-80"
                    />

                    {/* Sudut Barat Laut (NW) */}
                    <rect
                      x="-5"
                      y="-5"
                      width="10"
                      height="10"
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth="2"
                      className="cursor-nwse-resize pointer-events-auto shadow-xs"
                      onMouseDown={(e) => handleResizeMouseDown(node, "nw", e)}
                    />
                    {/* Sudut Timur Laut (NE) */}
                    <rect
                      x={node.width - 5}
                      y="-5"
                      width="10"
                      height="10"
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth="2"
                      className="cursor-nesw-resize pointer-events-auto shadow-xs"
                      onMouseDown={(e) => handleResizeMouseDown(node, "ne", e)}
                    />
                    {/* Sudut Barat Daya (SW) */}
                    <rect
                      x="-5"
                      y={node.height - 5}
                      width="10"
                      height="10"
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth="2"
                      className="cursor-nesw-resize pointer-events-auto shadow-xs"
                      onMouseDown={(e) => handleResizeMouseDown(node, "sw", e)}
                    />
                    {/* Sudut Tenggara (SE) */}
                    <rect
                      x={node.width - 5}
                      y={node.height - 5}
                      width="10"
                      height="10"
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth="2"
                      className="cursor-nwse-resize pointer-events-auto shadow-xs"
                      onMouseDown={(e) => handleResizeMouseDown(node, "se", e)}
                    />

                    {/* Sisi Kanan (E) - Ubah Lebar */}
                    <rect
                      x={node.width - 4}
                      y={node.height / 2 - 8}
                      width="8"
                      height="16"
                      rx="3"
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth="1.5"
                      className="cursor-ew-resize pointer-events-auto shadow-2xs"
                      onMouseDown={(e) => handleResizeMouseDown(node, "e", e)}
                    />
                    {/* Sisi Bawah (S) - Ubah Tinggi */}
                    <rect
                      x={node.width / 2 - 8}
                      y={node.height - 4}
                      width="16"
                      height="8"
                      rx="3"
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth="1.5"
                      className="cursor-ns-resize pointer-events-auto shadow-2xs"
                      onMouseDown={(e) => handleResizeMouseDown(node, "s", e)}
                    />
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

          {/* ========================================================= */}
          {/* 5. SELECTION BOX MARQUEE (TAHAP 4)                        */}
          {/* ========================================================= */}
          {selectionBox && (
            <rect
              x={Math.min(selectionBox.startX, selectionBox.currentX)}
              y={Math.min(selectionBox.startY, selectionBox.currentY)}
              width={Math.abs(selectionBox.currentX - selectionBox.startX)}
              height={Math.abs(selectionBox.currentY - selectionBox.startY)}
              fill="rgba(99, 102, 241, 0.15)"
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="4,3"
              className="pointer-events-none"
            />
          )}
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

      {/* 5. INTERACTIVE EMPTY STATE OVERLAY (Tahap 7: Saat belum ada node di kanvas) */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-10 select-none">
          <div className="max-w-md w-full p-6 sm:p-7 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl text-center pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <LayoutTemplate className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Kanvas Flowchart Masih Kosong
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Tarik simbol dari palet di sebelah kiri, atau mulai cepat dengan memilih template alur siap pakai:
            </p>

            {onApplyTemplate && (
              <div className="mt-4 flex flex-col gap-2">
                {ALL_FLOWCHART_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => onApplyTemplate(tmpl)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition group cursor-pointer text-left"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {tmpl.name}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {tmpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {tmpl.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
