"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  CanvasViewport,
  PaletteShapeDefinition,
} from "@/lib/flowchart-types";
import { useFlowchartEditor } from "@/hooks/useFlowchartEditor";
import { FlowchartToolbar } from "./FlowchartToolbar";
import { FlowchartShapePalette } from "./FlowchartShapePalette";
import { FlowchartCanvas } from "./FlowchartCanvas";
import { FlowchartMinimap } from "./FlowchartMinimap";
import { FlowchartPropertyPanel } from "./FlowchartPropertyPanel";

// Diagram starter awal dengan 4 simbol
const INITIAL_STARTER_NODES = [
  {
    id: "node-start",
    type: "start_end" as const,
    x: 280,
    y: 80,
    width: 140,
    height: 52,
    label: "START / POWER ON",
    fillColor: "#2563eb",
    strokeColor: "#1d4ed8",
    strokeWidth: 2,
    textColor: "#ffffff",
    fontSize: 11,
    textAlign: "center" as const,
  },
  {
    id: "node-process-1",
    type: "process" as const,
    x: 275,
    y: 180,
    width: 150,
    height: 64,
    label: "HOME POSITION CHECK",
    fillColor: "#1e293b",
    strokeColor: "#475569",
    strokeWidth: 2,
    textColor: "#ffffff",
    fontSize: 11,
    textAlign: "center" as const,
  },
  {
    id: "node-decision-1",
    type: "decision" as const,
    x: 285,
    y: 300,
    width: 130,
    height: 80,
    label: "INTERLOCK OK?",
    fillColor: "#4f46e5",
    strokeColor: "#3730a3",
    strokeWidth: 2,
    textColor: "#ffffff",
    fontSize: 11,
    textAlign: "center" as const,
  },
  {
    id: "node-process-2",
    type: "process" as const,
    x: 275,
    y: 440,
    width: 150,
    height: 64,
    label: "CYCLE RUNNING",
    fillColor: "#1e293b",
    strokeColor: "#475569",
    strokeWidth: 2,
    textColor: "#ffffff",
    fontSize: 11,
    textAlign: "center" as const,
  },
];

// Garis alur starter yang menghubungkan simbol awal (Tahap 2 & 3)
const INITIAL_STARTER_EDGES = [
  {
    id: "edge-1",
    sourceNodeId: "node-start",
    sourcePort: "bottom" as const,
    targetNodeId: "node-process-1",
    targetPort: "top" as const,
    routing: "orthogonal" as const,
    style: "solid" as const,
    marker: "arrow" as const,
    label: "",
    color: "#64748b",
    strokeWidth: 2,
  },
  {
    id: "edge-2",
    sourceNodeId: "node-process-1",
    sourcePort: "bottom" as const,
    targetNodeId: "node-decision-1",
    targetPort: "top" as const,
    routing: "orthogonal" as const,
    style: "solid" as const,
    marker: "arrow" as const,
    label: "",
    color: "#64748b",
    strokeWidth: 2,
  },
  {
    id: "edge-3",
    sourceNodeId: "node-decision-1",
    sourcePort: "bottom" as const,
    targetNodeId: "node-process-2",
    targetPort: "top" as const,
    routing: "orthogonal" as const,
    style: "solid" as const,
    marker: "arrow" as const,
    label: "Ya",
    color: "#64748b",
    strokeWidth: 2,
  },
  {
    id: "edge-4",
    sourceNodeId: "node-decision-1",
    sourcePort: "right" as const,
    targetNodeId: "node-process-1",
    targetPort: "right" as const,
    routing: "orthogonal" as const,
    style: "dashed" as const,
    marker: "arrow" as const,
    label: "Tidak",
    color: "#64748b",
    strokeWidth: 2,
  },
];

export function FlowchartEditor() {
  const editor = useFlowchartEditor({
    initialNodes: INITIAL_STARTER_NODES,
    initialEdges: INITIAL_STARTER_EDGES,
  });

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
    if (editor.nodes.length === 0) {
      setViewport({ zoom: 1.0, panX: 40, panY: 20 });
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of editor.nodes) {
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
  }, [editor.nodes, centerDimensions]);

  // Tambah shape dari palette (klik tombol di sidebar palet)
  const handleAddShapeFromPalette = useCallback(
    (def: PaletteShapeDefinition) => {
      const centerX =
        (centerDimensions.width / 2 - viewport.panX) / viewport.zoom - def.defaultWidth / 2;
      const centerY =
        (centerDimensions.height / 2 - viewport.panY) / viewport.zoom - def.defaultHeight / 2;

      let targetX = centerX;
      let targetY = centerY;

      if (snapToGrid) {
        targetX = Math.round(targetX / 10) * 10;
        targetY = Math.round(targetY / 10) * 10;
      }

      editor.addNode(def, targetX, targetY);
    },
    [centerDimensions, viewport, snapToGrid, editor]
  );

  // Drop shape dari palette (drag & drop koordinat kanvas)
  const handleDropNewShape = useCallback(
    (def: PaletteShapeDefinition, x: number, y: number) => {
      editor.addNode(def, x, y);
    },
    [editor]
  );

  // Hapus semua (Clear All)
  const handleClearAll = useCallback(() => {
    if (
      window.confirm(
        "Apakah Anda yakin ingin mengosongkan seluruh kanvas flowchart dan semua garis?"
      )
    ) {
      editor.clearAll();
    }
  }, [editor]);

  // Keyboard Shortcuts Lengkap (Tahap 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isInput) return;

      const isCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Undo / Redo
      if (isCtrl && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          editor.redo();
        } else {
          editor.undo();
        }
        return;
      }

      if (isCtrl && key === "y") {
        e.preventDefault();
        editor.redo();
        return;
      }

      // Copy / Cut / Paste
      if (isCtrl && key === "c") {
        e.preventDefault();
        editor.copy();
        return;
      }

      if (isCtrl && key === "x") {
        e.preventDefault();
        editor.cut();
        return;
      }

      if (isCtrl && key === "v") {
        e.preventDefault();
        editor.paste();
        return;
      }

      // Select All
      if (isCtrl && key === "a") {
        e.preventDefault();
        editor.selectAll();
        return;
      }

      // Duplicate (Ctrl+D)
      if (isCtrl && key === "d") {
        e.preventDefault();
        editor.duplicateSelection();
        return;
      }

      // Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        editor.deleteSelection();
        return;
      }

      // Escape -> Bersihkan Seleksi
      if (e.key === "Escape") {
        e.preventDefault();
        editor.clearSelection();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  const selectedCount = editor.selectedNodeIds.length + editor.selectedEdgeIds.length;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] min-h-[640px] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden transition-colors">
      {/* 1. Toolbar Atas (Tahap 4: Undo, Redo, Copy, Cut, Paste, Select All) */}
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
        hasSelection={editor.hasSelection}
        hasSelectedNode={editor.selectedNodeIds.length > 0}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        canPaste={editor.canPaste}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onCopy={editor.copy}
        onCut={editor.cut}
        onPaste={editor.paste}
        onSelectAll={editor.selectAll}
        onDuplicateSelected={editor.duplicateSelection}
        onBringToFront={() => editor.selectedNode && editor.bringToFront(editor.selectedNode.id)}
        onSendToBack={() => editor.selectedNode && editor.sendToBack(editor.selectedNode.id)}
        onDeleteSelected={editor.deleteSelection}
        onClearAll={handleClearAll}
        nodeCount={editor.nodes.length}
        edgeCount={editor.edges.length}
      />

      {/* 2. Workspace: Sidebar Palet Kiri, Kanvas Tengah, Panel Kanan */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Palet Shape Kiri */}
        <FlowchartShapePalette onAddShape={handleAddShapeFromPalette} />

        {/* Kanvas Tengah */}
        <div ref={mainCenterRef} className="flex-1 relative flex overflow-hidden">
          <FlowchartCanvas
            nodes={editor.nodes}
            edges={editor.edges}
            selectedNodeIds={editor.selectedNodeIds}
            selectedEdgeIds={editor.selectedEdgeIds}
            onSelectNode={editor.selectNode}
            onSelectEdge={editor.selectEdge}
            onSelectNodesInBox={editor.selectNodesInBox}
            onStartDragAction={editor.startDragAction}
            onEndDragAction={editor.endDragAction}
            onUpdateNodePosition={editor.updateNodePosition}
            onUpdateNodeGeometry={editor.updateNodeGeometry}
            onUpdateNodeLabel={editor.updateNodeLabel}
            onDropNewShape={handleDropNewShape}
            onCreateEdge={editor.createEdge}
            onDoubleClickEdgeLabel={(id) => {
              editor.selectEdge(id);
              setPropertyPanelCollapsed(false);
            }}
            viewport={viewport}
            onUpdateViewport={setViewport}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
          />

          {/* Minimap di Pojok Kanan Bawah Kanvas */}
          <FlowchartMinimap
            nodes={editor.nodes}
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
          selectedNode={editor.selectedNode}
          selectedEdge={editor.selectedEdge}
          selectedCount={selectedCount}
          isCollapsed={propertyPanelCollapsed}
          onToggleCollapse={() => setPropertyPanelCollapsed((prev) => !prev)}
          onUpdateNodeFillColor={editor.updateNodeFillColor}
          onUpdateNodeStrokeColor={editor.updateNodeStrokeColor}
          onUpdateNodeStrokeWidth={editor.updateNodeStrokeWidth}
          onUpdateNodeFontSize={editor.updateNodeFontSize}
          onUpdateNodeTextColor={editor.updateNodeTextColor}
          onUpdateNodeTextAlign={editor.updateNodeTextAlign}
          onDuplicateNode={editor.duplicateSelection}
          onBringToFront={editor.bringToFront}
          onSendToBack={editor.sendToBack}
          onDeleteNode={() => editor.deleteSelection()}
          onBatchUpdateFillColor={editor.batchUpdateFillColor}
          onBatchDelete={editor.deleteSelection}
          onUpdateEdgeRouting={editor.updateEdgeRouting}
          onUpdateEdgeStyle={editor.updateEdgeStyle}
          onUpdateEdgeMarker={editor.updateEdgeMarker}
          onUpdateEdgeLabel={editor.updateEdgeLabel}
          onUpdateEdgeColor={editor.updateEdgeColor}
          onUpdateEdgeStrokeWidth={editor.updateEdgeStrokeWidth}
          onDeleteEdge={() => editor.deleteSelection()}
        />
      </div>
    </div>
  );
}
