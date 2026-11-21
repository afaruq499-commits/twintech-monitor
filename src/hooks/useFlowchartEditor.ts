"use client";

import { useState, useRef, useCallback } from "react";
import type {
  FlowchartNode,
  FlowchartEdge,
  PaletteShapeDefinition,
  EdgeRoutingType,
  EdgeStyle,
  EdgeMarker,
  TextAlign,
  SelectionBox,
} from "@/lib/flowchart-types";
import {
  FlowchartHistoryManager,
  type FlowchartSnapshot,
  type FlowchartClipboard,
  createClipboardData,
  pasteClipboardData,
  isNodeInSelectionBox,
} from "@/lib/flowchart-history";

export interface UseFlowchartEditorProps {
  initialNodes: FlowchartNode[];
  initialEdges: FlowchartEdge[];
}

export function useFlowchartEditor({ initialNodes, initialEdges }: UseFlowchartEditorProps) {
  const [nodes, setNodes] = useState<FlowchartNode[]>(initialNodes);
  const [edges, setEdges] = useState<FlowchartEdge[]>(initialEdges);

  // Multi-Selection State (Tahap 4)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  // Clipboard State
  const [clipboard, setClipboard] = useState<FlowchartClipboard | null>(null);

  // History Manager
  const historyRef = useRef<FlowchartHistoryManager>(
    new FlowchartHistoryManager({ nodes: initialNodes, edges: initialEdges })
  );
  const [, setHistoryVersion] = useState(0);

  // Snapshot awal sebelum aksi drag/resize dimulai (untuk 1 drag = 1 history step)
  const dragStartSnapshotRef = useRef<FlowchartSnapshot | null>(null);

  // Komit perubahan diskrit ke history
  const commitChange = useCallback((newNodes: FlowchartNode[], newEdges: FlowchartEdge[]) => {
    historyRef.current.pushState({ nodes: newNodes, edges: newEdges });
    setNodes(newNodes);
    setEdges(newEdges);
    setHistoryVersion((v) => v + 1);
  }, []);

  // Mulai aksi interaktif drag/resize
  const startDragAction = useCallback(() => {
    dragStartSnapshotRef.current = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
  }, [nodes, edges]);

  // Akhiri aksi interaktif drag/resize (1 drag = 1 langkah)
  const endDragAction = useCallback(() => {
    if (!dragStartSnapshotRef.current) return;
    const startStr = JSON.stringify(dragStartSnapshotRef.current);
    const currentStr = JSON.stringify({ nodes, edges });

    if (startStr !== currentStr) {
      // Ada pergeseran nyata, catat snapshot awal ke history stack
      historyRef.current.commitTransaction(dragStartSnapshotRef.current, { nodes, edges });
      setHistoryVersion((v) => v + 1);
    }
    dragStartSnapshotRef.current = null;
  }, [nodes, edges]);

  // Undo (Ctrl+Z)
  const undo = useCallback(() => {
    const prev = historyRef.current.undo();
    if (prev) {
      setNodes(prev.nodes);
      setEdges(prev.edges);
      setSelectedNodeIds((old) => old.filter((id) => prev.nodes.some((n) => n.id === id)));
      setSelectedEdgeIds((old) => old.filter((id) => prev.edges.some((e) => e.id === id)));
      setHistoryVersion((v) => v + 1);
    }
  }, []);

  // Redo (Ctrl+Y / Ctrl+Shift+Z)
  const redo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next) {
      setNodes(next.nodes);
      setEdges(next.edges);
      setSelectedNodeIds((old) => old.filter((id) => next.nodes.some((n) => n.id === id)));
      setSelectedEdgeIds((old) => old.filter((id) => next.edges.some((e) => e.id === id)));
      setHistoryVersion((v) => v + 1);
    }
  }, []);

  // Seleksi Node (Single atau Multi-select Shift+Click)
  const selectNode = useCallback((id: string | null, isMulti = false) => {
    if (!id) {
      setSelectedNodeIds([]);
      return;
    }
    if (isMulti) {
      setSelectedNodeIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    } else {
      setSelectedNodeIds([id]);
      setSelectedEdgeIds([]);
    }
  }, []);

  // Seleksi Edge (Single atau Multi-select Shift+Click)
  const selectEdge = useCallback((id: string | null, isMulti = false) => {
    if (!id) {
      setSelectedEdgeIds([]);
      return;
    }
    if (isMulti) {
      setSelectedEdgeIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    } else {
      setSelectedEdgeIds([id]);
      setSelectedNodeIds([]);
    }
  }, []);

  // Seleksi Marquee Box (Selection Box)
  const selectNodesInBox = useCallback((box: SelectionBox, isAdditive = false) => {
    const matchedNodeIds = nodes
      .filter((n) => isNodeInSelectionBox(n, box))
      .map((n) => n.id);

    if (isAdditive) {
      setSelectedNodeIds((prev) => Array.from(new Set([...prev, ...matchedNodeIds])));
    } else {
      setSelectedNodeIds(matchedNodeIds);
      setSelectedEdgeIds([]);
    }
  }, [nodes]);

  // Select All (Ctrl+A)
  const selectAll = useCallback(() => {
    setSelectedNodeIds(nodes.map((n) => n.id));
    setSelectedEdgeIds(edges.map((e) => e.id));
  }, [nodes, edges]);

  // Clear Selection (Escape)
  const clearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, []);

  // Copy (Ctrl+C)
  const copy = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;
    const clip = createClipboardData(nodes, edges, selectedNodeIds, selectedEdgeIds);
    setClipboard(clip);
  }, [nodes, edges, selectedNodeIds, selectedEdgeIds]);

  // Cut (Ctrl+X)
  const cut = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;
    const clip = createClipboardData(nodes, edges, selectedNodeIds, selectedEdgeIds);
    setClipboard(clip);

    const newNodes = nodes.filter((n) => !selectedNodeIds.includes(n.id));
    const newEdges = edges.filter(
      (e) =>
        !selectedEdgeIds.includes(e.id) &&
        !selectedNodeIds.includes(e.sourceNodeId) &&
        !selectedNodeIds.includes(e.targetNodeId)
    );

    commitChange(newNodes, newEdges);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, [nodes, edges, selectedNodeIds, selectedEdgeIds, commitChange]);

  // Paste (Ctrl+V)
  const paste = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;
    const { newNodes, newEdges, newSelectedNodeIds } = pasteClipboardData(clipboard, {
      x: 30,
      y: 30,
    });

    const updatedNodes = [...nodes, ...newNodes];
    const updatedEdges = [...edges, ...newEdges];

    commitChange(updatedNodes, updatedEdges);
    setSelectedNodeIds(newSelectedNodeIds);
    setSelectedEdgeIds([]);
  }, [clipboard, nodes, edges, commitChange]);

  // Delete Terpilih (Delete / Backspace)
  const deleteSelection = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;

    const newNodes = nodes.filter((n) => !selectedNodeIds.includes(n.id));
    const newEdges = edges.filter(
      (e) =>
        !selectedEdgeIds.includes(e.id) &&
        !selectedNodeIds.includes(e.sourceNodeId) &&
        !selectedNodeIds.includes(e.targetNodeId)
    );

    commitChange(newNodes, newEdges);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, [nodes, edges, selectedNodeIds, selectedEdgeIds, commitChange]);

  // Duplikat Simbol Terpilih (Ctrl+D)
  const duplicateSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const clip = createClipboardData(nodes, edges, selectedNodeIds, selectedEdgeIds);
    const { newNodes, newEdges, newSelectedNodeIds } = pasteClipboardData(clip, {
      x: 30,
      y: 30,
    });

    const updatedNodes = [...nodes, ...newNodes];
    const updatedEdges = [...edges, ...newEdges];

    commitChange(updatedNodes, updatedEdges);
    setSelectedNodeIds(newSelectedNodeIds);
    setSelectedEdgeIds([]);
  }, [nodes, edges, selectedNodeIds, selectedEdgeIds, commitChange]);

  // Tambah Simbol Baru dari Palet
  const addNode = useCallback(
    (def: PaletteShapeDefinition, x: number, y: number) => {
      const newNode: FlowchartNode = {
        id: `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        type: def.type,
        x,
        y,
        width: def.defaultWidth,
        height: def.defaultHeight,
        label: def.defaultLabel,
        fillColor: "#1e293b",
        strokeColor: "#475569",
        strokeWidth: 2,
        textColor: "#ffffff",
        fontSize: 11,
        textAlign: "center",
      };

      const newNodes = [...nodes, newNode];
      commitChange(newNodes, edges);
      setSelectedNodeIds([newNode.id]);
      setSelectedEdgeIds([]);
    },
    [nodes, edges, commitChange]
  );

  // Update posisi node secara halus (real-time saat drag)
  const updateNodePosition = useCallback(
    (id: string, x: number, y: number) => {
      setNodes((prev) => {
        const target = prev.find((n) => n.id === id);
        if (!target) return prev;
        const dx = x - target.x;
        const dy = y - target.y;

        // Jika node adalah bagian dari multi-select, geser semua node terpilih bersamaan!
        if (selectedNodeIds.includes(id) && selectedNodeIds.length > 1) {
          return prev.map((n) => {
            if (selectedNodeIds.includes(n.id)) {
              return { ...n, x: n.x + dx, y: n.y + dy };
            }
            return n;
          });
        }

        return prev.map((n) => {
          if (n.id === id) return { ...n, x, y };
          return n;
        });
      });
    },
    [selectedNodeIds]
  );

  // Update geometri node (resize)
  const updateNodeGeometry = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, x, y, width, height } : n))
      );
    },
    []
  );

  // Update label node
  const updateNodeLabel = useCallback(
    (id: string, label: string) => {
      const newNodes = nodes.map((n) => (n.id === id ? { ...n, label } : n));
      commitChange(newNodes, edges);
    },
    [nodes, edges, commitChange]
  );

  // Kustomisasi Properti Node
  const updateNodeFillColor = useCallback(
    (id: string, color: string) => {
      const newNodes = nodes.map((n) => (n.id === id ? { ...n, fillColor: color } : n));
      commitChange(newNodes, edges);
    },
    [nodes, edges, commitChange]
  );

  const updateNodeStrokeColor = useCallback(
    (id: string, color: string) => {
      const newNodes = nodes.map((n) => (n.id === id ? { ...n, strokeColor: color } : n));
      commitChange(newNodes, edges);
    },
    [nodes, edges, commitChange]
  );

  const updateNodeStrokeWidth = useCallback(
    (id: string, width: number) => {
      const newNodes = nodes.map((n) => (n.id === id ? { ...n, strokeWidth: width } : n));
      commitChange(newNodes, edges);
    },
    [nodes, edges, commitChange]
  );

  const updateNodeFontSize = useCallback(
    (id: string, size: number) => {
      const newNodes = nodes.map((n) => (n.id === id ? { ...n, fontSize: size } : n));
      commitChange(newNodes, edges);
    },
    [nodes, edges, commitChange]
  );

  const updateNodeTextColor = useCallback(
    (id: string, color: string) => {
      const newNodes = nodes.map((n) => (n.id === id ? { ...n, textColor: color } : n));
      commitChange(newNodes, edges);
    },
    [nodes, edges, commitChange]
  );

  const updateNodeTextAlign = useCallback(
    (id: string, align: TextAlign) => {
      const newNodes = nodes.map((n) => (n.id === id ? { ...n, textAlign: align } : n));
      commitChange(newNodes, edges);
    },
    [nodes, edges, commitChange]
  );

  // Batch Update Fill Color untuk Multi-seleksi (Tahap 4)
  const batchUpdateFillColor = useCallback(
    (color: string) => {
      if (selectedNodeIds.length === 0) return;
      const newNodes = nodes.map((n) =>
        selectedNodeIds.includes(n.id) ? { ...n, fillColor: color } : n
      );
      commitChange(newNodes, edges);
    },
    [nodes, edges, selectedNodeIds, commitChange]
  );

  // Z-Order: Bring to Front
  const bringToFront = useCallback(
    (id: string) => {
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx === -1 || idx === nodes.length - 1) return;
      const item = nodes[idx];
      const rest = nodes.filter((_, i) => i !== idx);
      commitChange([...rest, item], edges);
    },
    [nodes, edges, commitChange]
  );

  // Z-Order: Send to Back
  const sendToBack = useCallback(
    (id: string) => {
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx <= 0) return;
      const item = nodes[idx];
      const rest = nodes.filter((_, i) => i !== idx);
      commitChange([item, ...rest], edges);
    },
    [nodes, edges, commitChange]
  );

  // Buat Garis Alur Baru
  const createEdge = useCallback(
    (newEdgeData: Omit<FlowchartEdge, "id">) => {
      const newEdge: FlowchartEdge = {
        ...newEdgeData,
        id: `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        color: "#64748b",
        strokeWidth: 2,
      };
      const newEdges = [...edges, newEdge];
      commitChange(nodes, newEdges);
      setSelectedEdgeIds([newEdge.id]);
      setSelectedNodeIds([]);
    },
    [nodes, edges, commitChange]
  );

  // Update Properti Garis Alur
  const updateEdgeRouting = useCallback(
    (id: string, routing: EdgeRoutingType) => {
      const newEdges = edges.map((e) => (e.id === id ? { ...e, routing } : e));
      commitChange(nodes, newEdges);
    },
    [nodes, edges, commitChange]
  );

  const updateEdgeStyle = useCallback(
    (id: string, style: EdgeStyle) => {
      const newEdges = edges.map((e) => (e.id === id ? { ...e, style } : e));
      commitChange(nodes, newEdges);
    },
    [nodes, edges, commitChange]
  );

  const updateEdgeMarker = useCallback(
    (id: string, marker: EdgeMarker) => {
      const newEdges = edges.map((e) => (e.id === id ? { ...e, marker } : e));
      commitChange(nodes, newEdges);
    },
    [nodes, edges, commitChange]
  );

  const updateEdgeLabel = useCallback(
    (id: string, label: string) => {
      const newEdges = edges.map((e) => (e.id === id ? { ...e, label } : e));
      commitChange(nodes, newEdges);
    },
    [nodes, edges, commitChange]
  );

  const updateEdgeColor = useCallback(
    (id: string, color: string) => {
      const newEdges = edges.map((e) => (e.id === id ? { ...e, color } : e));
      commitChange(nodes, newEdges);
    },
    [nodes, edges, commitChange]
  );

  const updateEdgeStrokeWidth = useCallback(
    (id: string, strokeWidth: number) => {
      const newEdges = edges.map((e) => (e.id === id ? { ...e, strokeWidth } : e));
      commitChange(nodes, newEdges);
    },
    [nodes, edges, commitChange]
  );

  // Clear All
  const clearAll = useCallback(() => {
    commitChange([], []);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, [commitChange]);

  // Helper getters
  const selectedNode =
    selectedNodeIds.length === 1 ? nodes.find((n) => n.id === selectedNodeIds[0]) || null : null;
  const selectedEdge =
    selectedEdgeIds.length === 1 ? edges.find((e) => e.id === selectedEdgeIds[0]) || null : null;

  return {
    nodes,
    edges,
    selectedNodeIds,
    selectedEdgeIds,
    selectedNode,
    selectedEdge,
    hasSelection: selectedNodeIds.length > 0 || selectedEdgeIds.length > 0,
    canUndo: historyRef.current.canUndo(),
    canRedo: historyRef.current.canRedo(),
    canPaste: Boolean(clipboard && clipboard.nodes.length > 0),
    // Actions
    undo,
    redo,
    selectNode,
    selectEdge,
    selectNodesInBox,
    selectAll,
    clearSelection,
    copy,
    cut,
    paste,
    deleteSelection,
    duplicateSelection,
    addNode,
    startDragAction,
    endDragAction,
    updateNodePosition,
    updateNodeGeometry,
    updateNodeLabel,
    updateNodeFillColor,
    updateNodeStrokeColor,
    updateNodeStrokeWidth,
    updateNodeFontSize,
    updateNodeTextColor,
    updateNodeTextAlign,
    batchUpdateFillColor,
    bringToFront,
    sendToBack,
    createEdge,
    updateEdgeRouting,
    updateEdgeStyle,
    updateEdgeMarker,
    updateEdgeLabel,
    updateEdgeColor,
    updateEdgeStrokeWidth,
    clearAll,
  };
}
