"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  FlowchartNode,
  FlowchartEdge,
  CanvasViewport,
  PaletteShapeDefinition,
  EdgeRoutingType,
  EdgeStyle,
  EdgeMarker,
} from "@/lib/flowchart-types";
import { FlowchartToolbar } from "./FlowchartToolbar";
import { FlowchartShapePalette } from "./FlowchartShapePalette";
import { FlowchartCanvas } from "./FlowchartCanvas";
import { FlowchartMinimap } from "./FlowchartMinimap";
import { FlowchartPropertyPanel } from "./FlowchartPropertyPanel";

// Diagram starter awal dengan 4 simbol
const INITIAL_STARTER_NODES: FlowchartNode[] = [
  {
    id: "node-start",
    type: "start_end",
    x: 280,
    y: 80,
    width: 140,
    height: 52,
    label: "START / POWER ON",
  },
  {
    id: "node-process-1",
    type: "process",
    x: 275,
    y: 180,
    width: 150,
    height: 64,
    label: "HOME POSITION CHECK",
  },
  {
    id: "node-decision-1",
    type: "decision",
    x: 285,
    y: 300,
    width: 130,
    height: 80,
    label: "INTERLOCK OK?",
  },
  {
    id: "node-process-2",
    type: "process",
    x: 275,
    y: 440,
    width: 150,
    height: 64,
    label: "CYCLE RUNNING",
  },
];

// Garis alur starter yang menghubungkan simbol awal (Tahap 2)
const INITIAL_STARTER_EDGES: FlowchartEdge[] = [
  {
    id: "edge-1",
    sourceNodeId: "node-start",
    sourcePort: "bottom",
    targetNodeId: "node-process-1",
    targetPort: "top",
    routing: "orthogonal",
    style: "solid",
    marker: "arrow",
    label: "",
  },
  {
    id: "edge-2",
    sourceNodeId: "node-process-1",
    sourcePort: "bottom",
    targetNodeId: "node-decision-1",
    targetPort: "top",
    routing: "orthogonal",
    style: "solid",
    marker: "arrow",
    label: "",
  },
  {
    id: "edge-3",
    sourceNodeId: "node-decision-1",
    sourcePort: "bottom",
    targetNodeId: "node-process-2",
    targetPort: "top",
    routing: "orthogonal",
    style: "solid",
    marker: "arrow",
    label: "Ya",
  },
  {
    id: "edge-4",
    sourceNodeId: "node-decision-1",
    sourcePort: "right",
    targetNodeId: "node-process-1",
    targetPort: "right",
    routing: "orthogonal",
    style: "dashed",
    marker: "arrow",
    label: "Tidak",
  },
];

export function FlowchartEditor() {
  const [nodes, setNodes] = useState<FlowchartNode[]>(INITIAL_STARTER_NODES);
  const [edges, setEdges] = useState<FlowchartEdge[]>(INITIAL_STARTER_EDGES);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Viewport Kanvas: Zoom & Panning
  const [viewport, setViewport] = useState<CanvasViewport>({
    zoom: 1.0,
    panX: 40,
    panY: 20,
  });

  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [propertyPanelCollapsed, setPropertyPanelCollapsed] = useState<boolean>(false);

  // Container sizing untuk perhitungan minimap & fit to screen
  const mainCenterRef = useRef<HTMLDivElement | null>(null);
  const [centerDimensions, setCenterDimensions] = useState<{ width: number; height: number }>({
    width: 900,
    height: 650,
  });

  useEffect(() => {
    const updateSize = () => {
      if (mainCenterRef.current) {
        setCenterDimensions({
          width: mainCenterRef.current.clientWidth,
          height: mainCenterRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Zoom Handlers
  const handleZoomIn = () => {
    setViewport((prev) => ({
      ...prev,
      zoom: Math.min(prev.zoom + 0.15, 3.0),
    }));
  };

  const handleZoomOut = () => {
    setViewport((prev) => ({
      ...prev,
      zoom: Math.max(prev.zoom - 0.15, 0.2),
    }));
  };

  const handleZoomReset = () => {
    setViewport((prev) => ({
      ...prev,
      zoom: 1.0,
    }));
  };

  // Fit To Screen
  const handleFitToScreen = useCallback(() => {
    if (nodes.length === 0) {
      setViewport({ zoom: 1.0, panX: 40, panY: 20 });
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y < minY) minY = n.y;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }

    const pad = 80;
    const diagramWidth = maxX - minX + pad * 2;
    const diagramHeight = maxY - minY + pad * 2;

    const availableWidth = centerDimensions.width || 800;
    const availableHeight = centerDimensions.height || 600;

    const scaleX = availableWidth / diagramWidth;
    const scaleY = availableHeight / diagramHeight;
    const idealZoom = Math.max(0.25, Math.min(1.2, Math.min(scaleX, scaleY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const panX = availableWidth / 2 - centerX * idealZoom;
    const panY = availableHeight / 2 - centerY * idealZoom;

    setViewport({ zoom: idealZoom, panX, panY });
  }, [nodes, centerDimensions]);

  // Tambah shape dari palette (klik tombol)
  const handleAddShapeFromPalette = useCallback(
    (def: PaletteShapeDefinition) => {
      const centerX = (centerDimensions.width / 2 - viewport.panX) / viewport.zoom - def.defaultWidth / 2;
      const centerY = (centerDimensions.height / 2 - viewport.panY) / viewport.zoom - def.defaultHeight / 2;

      let targetX = centerX;
      let targetY = centerY;

      if (snapToGrid) {
        targetX = Math.round(targetX / 10) * 10;
        targetY = Math.round(targetY / 10) * 10;
      }

      const newNode: FlowchartNode = {
        id: `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        type: def.type,
        x: targetX,
        y: targetY,
        width: def.defaultWidth,
        height: def.defaultHeight,
        label: def.defaultLabel,
      };

      setNodes((prev) => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
    },
    [centerDimensions, viewport, snapToGrid]
  );

  // Drop shape dari palette (drag & drop koordinat)
  const handleDropNewShape = useCallback(
    (def: PaletteShapeDefinition, x: number, y: number) => {
      const newNode: FlowchartNode = {
        id: `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        type: def.type,
        x,
        y,
        width: def.defaultWidth,
        height: def.defaultHeight,
        label: def.defaultLabel,
      };

      setNodes((prev) => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
    },
    []
  );

  // Update posisi node
  const handleUpdateNodePosition = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x, y } : n))
    );
  }, []);

  // Update label node
  const handleUpdateNodeLabel = useCallback((id: string, newLabel: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, label: newLabel } : n))
    );
  }, []);

  // =====================================================================
  // OPERASI GARIS ALUR (EDGES) - TAHAP 2
  // =====================================================================

  // Buat garis alur baru saat user selesai menarik dari handle
  const handleCreateEdge = useCallback((newEdgeData: Omit<FlowchartEdge, "id">) => {
    const newEdge: FlowchartEdge = {
      ...newEdgeData,
      id: `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    };

    setEdges((prev) => [...prev, newEdge]);
    setSelectedEdgeId(newEdge.id);
    setSelectedNodeId(null);
    setPropertyPanelCollapsed(false); // Otomatis buka panel untuk mengatur garis
  }, []);

  // Ubah tipe routing garis (lurus, siku, lengkung)
  const handleUpdateEdgeRouting = useCallback((id: string, routing: EdgeRoutingType) => {
    setEdges((prev) =>
      prev.map((e) => (e.id === id ? { ...e, routing } : e))
    );
  }, []);

  // Ubah bentuk garis (solid vs putus-putus)
  const handleUpdateEdgeStyle = useCallback((id: string, style: EdgeStyle) => {
    setEdges((prev) =>
      prev.map((e) => (e.id === id ? { ...e, style } : e))
    );
  }, []);

  // Ubah ujung panah (arrow, arrow-start, arrow-both, none)
  const handleUpdateEdgeMarker = useCallback((id: string, marker: EdgeMarker) => {
    setEdges((prev) =>
      prev.map((e) => (e.id === id ? { ...e, marker } : e))
    );
  }, []);

  // Ubah label teks garis
  const handleUpdateEdgeLabel = useCallback((id: string, label: string) => {
    setEdges((prev) =>
      prev.map((e) => (e.id === id ? { ...e, label } : e))
    );
  }, []);

  // Hapus garis alur
  const handleDeleteEdge = useCallback((id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    if (selectedEdgeId === id) {
      setSelectedEdgeId(null);
    }
  }, [selectedEdgeId]);

  // Hapus elemen terpilih (baik Node maupun Garis)
  const handleDeleteSelected = useCallback(() => {
    if (selectedEdgeId) {
      handleDeleteEdge(selectedEdgeId);
      return;
    }

    if (selectedNodeId) {
      // Hapus node terpilih
      setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
      // Otomatis hapus semua garis yang terhubung ke node ini
      setEdges((prev) =>
        prev.filter((e) => e.sourceNodeId !== selectedNodeId && e.targetNodeId !== selectedNodeId)
      );
      setSelectedNodeId(null);
    }
  }, [selectedEdgeId, selectedNodeId, handleDeleteEdge]);

  // Hapus semua
  const handleClearAll = useCallback(() => {
    if (window.confirm("Apakah Anda yakin ingin mengosongkan seluruh kanvas flowchart dan semua garis?")) {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, []);

  // Keyboard shortcut (Delete / Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === "Delete" || e.key === "Backspace") && (selectedNodeId || selectedEdgeId)) {
        e.preventDefault();
        handleDeleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, handleDeleteSelected]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] min-h-[640px] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden transition-colors">
      {/* 1. Toolbar Atas */}
      <FlowchartToolbar
        viewport={viewport}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onFitToScreen={handleFitToScreen}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((prev) => !prev)}
        snapToGrid={snapToGrid}
        onToggleSnap={() => setSnapToGrid((prev) => !prev)}
        hasSelection={Boolean(selectedNodeId || selectedEdgeId)}
        onDeleteSelected={handleDeleteSelected}
        onClearAll={handleClearAll}
        nodeCount={nodes.length}
        edgeCount={edges.length}
      />

      {/* 2. Workspace: Sidebar Palet Kiri, Kanvas Tengah, Panel Kanan */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Palet Shape Kiri */}
        <FlowchartShapePalette onAddShape={handleAddShapeFromPalette} />

        {/* Kanvas Tengah */}
        <div ref={mainCenterRef} className="flex-1 relative flex overflow-hidden">
          <FlowchartCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              if (id) setSelectedEdgeId(null);
            }}
            onSelectEdge={(id) => {
              setSelectedEdgeId(id);
              if (id) setSelectedNodeId(null);
            }}
            onUpdateNodePosition={handleUpdateNodePosition}
            onUpdateNodeLabel={handleUpdateNodeLabel}
            onDropNewShape={handleDropNewShape}
            onCreateEdge={handleCreateEdge}
            onDoubleClickEdgeLabel={(id) => {
              setSelectedEdgeId(id);
              setSelectedNodeId(null);
              setPropertyPanelCollapsed(false);
            }}
            viewport={viewport}
            onUpdateViewport={setViewport}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
          />

          {/* Minimap di Pojok Kanan Bawah Kanvas */}
          <FlowchartMinimap
            nodes={nodes}
            viewport={viewport}
            containerWidth={centerDimensions.width}
            containerHeight={centerDimensions.height}
            onJumpPan={(newPanX, newPanY) =>
              setViewport((prev) => ({ ...prev, panX: newPanX, panY: newPanY }))
            }
          />
        </div>

        {/* Panel Properti Kanan */}
        <FlowchartPropertyPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          isCollapsed={propertyPanelCollapsed}
          onToggleCollapse={() => setPropertyPanelCollapsed((prev) => !prev)}
          onUpdateEdgeRouting={handleUpdateEdgeRouting}
          onUpdateEdgeStyle={handleUpdateEdgeStyle}
          onUpdateEdgeMarker={handleUpdateEdgeMarker}
          onUpdateEdgeLabel={handleUpdateEdgeLabel}
          onDeleteEdge={handleDeleteEdge}
        />
      </div>
    </div>
  );
}
