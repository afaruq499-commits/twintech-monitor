import { describe, it, expect, beforeEach } from "vitest";
import {
  FlowchartHistoryManager,
  createClipboardData,
  pasteClipboardData,
  isNodeInSelectionBox,
  type FlowchartSnapshot,
} from "../src/lib/flowchart-history";
import type { FlowchartNode, FlowchartEdge } from "../src/lib/flowchart-types";

describe("Flowchart Phase 4: Undo / Redo & Drag History Stability", () => {
  const sampleNodes: FlowchartNode[] = [
    {
      id: "node-1",
      type: "start_end",
      x: 100,
      y: 100,
      width: 120,
      height: 50,
      label: "Start",
      fillColor: "#2563eb",
      strokeColor: "#1d4ed8",
      strokeWidth: 2,
      textColor: "#ffffff",
      fontSize: 11,
      textAlign: "center",
    },
    {
      id: "node-2",
      type: "process",
      x: 100,
      y: 200,
      width: 140,
      height: 60,
      label: "Process A",
      fillColor: "#1e293b",
      strokeColor: "#475569",
      strokeWidth: 2,
      textColor: "#ffffff",
      fontSize: 11,
      textAlign: "center",
    },
  ];

  const sampleEdges: FlowchartEdge[] = [
    {
      id: "edge-1",
      sourceNodeId: "node-1",
      sourcePort: "bottom",
      targetNodeId: "node-2",
      targetPort: "top",
      routing: "orthogonal",
      style: "solid",
      marker: "arrow",
      label: "Step 1",
      color: "#64748b",
      strokeWidth: 2,
    },
  ];

  let history: FlowchartHistoryManager;

  beforeEach(() => {
    history = new FlowchartHistoryManager({
      nodes: sampleNodes,
      edges: sampleEdges,
    });
  });

  it("should have initial state with canUndo = false and canRedo = false", () => {
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.getPastCount()).toBe(0);
    expect(history.getFutureCount()).toBe(0);
    expect(history.getCurrent().nodes.length).toBe(2);
    expect(history.getCurrent().edges.length).toBe(1);
  });

  it("should push discrete state and allow undo/redo", () => {
    const updatedNodes: FlowchartNode[] = [
      ...sampleNodes,
      {
        id: "node-3",
        type: "decision",
        x: 100,
        y: 320,
        width: 120,
        height: 70,
        label: "Check OK?",
        fillColor: "#4f46e5",
        strokeColor: "#3730a3",
        strokeWidth: 2,
        textColor: "#ffffff",
        fontSize: 11,
        textAlign: "center",
      },
    ];

    history.pushState({ nodes: updatedNodes, edges: sampleEdges });

    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
    expect(history.getCurrent().nodes.length).toBe(3);

    // Lakukan Undo
    const undoneState = history.undo();
    expect(undoneState).not.toBeNull();
    expect(undoneState?.nodes.length).toBe(2);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    // Lakukan Redo
    const redoneState = history.redo();
    expect(redoneState).not.toBeNull();
    expect(redoneState?.nodes.length).toBe(3);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it("should clear redo stack when a new state is pushed after undo", () => {
    const step1: FlowchartSnapshot = {
      nodes: [...sampleNodes, { ...sampleNodes[0], id: "node-step1" }],
      edges: sampleEdges,
    };
    const step2: FlowchartSnapshot = {
      nodes: [...step1.nodes, { ...sampleNodes[0], id: "node-step2" }],
      edges: sampleEdges,
    };

    history.pushState(step1);
    history.pushState(step2);

    expect(history.getCurrent().nodes.length).toBe(4);

    // Undo 1 kali
    history.undo();
    expect(history.canRedo()).toBe(true);

    // Lakukan aksi baru (branching history)
    const step3: FlowchartSnapshot = {
      nodes: [...sampleNodes, { ...sampleNodes[0], id: "node-step3" }],
      edges: sampleEdges,
    };
    history.pushState(step3);

    // Redo harus hangus
    expect(history.canRedo()).toBe(false);
    expect(history.getCurrent().nodes.some((n) => n.id === "node-step3")).toBe(true);
  });

  it("should ensure 1 drag operation equals exactly 1 undo step (tidak membengkak saat mousemove)", () => {
    // Simulasi aksi Drag:
    // 1. Simpan snapshot awal sebelum mousemove
    const startSnapshot = history.getCurrent();

    // 2. Selama mousemove (bisa puluhan/ratusan frame): panggil replaceCurrent tanpa menambah history stack
    for (let frame = 1; frame <= 100; frame++) {
      const movedNodes = sampleNodes.map((n) =>
        n.id === "node-1" ? { ...n, x: 100 + frame, y: 100 + frame } : n
      );
      history.replaceCurrent({ nodes: movedNodes, edges: sampleEdges });
    }

    // Pastikan selama drag berlangsung, history stack tidak bertambah sama sekali
    expect(history.getPastCount()).toBe(0);
    expect(history.canUndo()).toBe(false);

    // 3. Pada mouseup (drag selesai), panggil commitTransaction 1 kali dengan startSnapshot
    const finalNodes = sampleNodes.map((n) =>
      n.id === "node-1" ? { ...n, x: 200, y: 200 } : n
    );
    history.commitTransaction(startSnapshot, { nodes: finalNodes, edges: sampleEdges });

    // History stack HANYA bertambah 1 langkah!
    expect(history.getPastCount()).toBe(1);
    expect(history.canUndo()).toBe(true);

    // Saat di-undo, langsung kembali ke posisi awal sebelum drag (x: 100, y: 100)
    const reverted = history.undo();
    expect(reverted).not.toBeNull();
    const revertedNode = reverted?.nodes.find((n) => n.id === "node-1");
    expect(revertedNode?.x).toBe(100);
    expect(revertedNode?.y).toBe(100);

    // Dan tidak ada sisa frame drag perantara
    expect(history.canUndo()).toBe(false);

    // Saat di-redo, langsung kembali ke posisi akhir drag (x: 200, y: 200)
    const redone = history.redo();
    expect(redone).not.toBeNull();
    const redoneNode = redone?.nodes.find((n) => n.id === "node-1");
    expect(redoneNode?.x).toBe(200);
    expect(redoneNode?.y).toBe(200);
  });

  it("should strictly cap history stack at maxHistory", () => {
    const limitedHistory = new FlowchartHistoryManager(
      { nodes: sampleNodes, edges: sampleEdges },
      5 // batas maks 5 langkah
    );

    for (let i = 1; i <= 20; i++) {
      limitedHistory.pushState({
        nodes: [{ ...sampleNodes[0], id: `node-seq-${i}` }],
        edges: [],
      });
    }

    expect(limitedHistory.getPastCount()).toBe(5);
  });
});

describe("Flowchart Phase 4: Clipboard (Copy, Cut, Paste) with Edge Remapping", () => {
  const nodeA: FlowchartNode = {
    id: "node-A",
    type: "process",
    x: 50,
    y: 50,
    width: 100,
    height: 50,
    label: "A",
  };
  const nodeB: FlowchartNode = {
    id: "node-B",
    type: "process",
    x: 200,
    y: 50,
    width: 100,
    height: 50,
    label: "B",
  };
  const nodeC: FlowchartNode = {
    id: "node-C",
    type: "process",
    x: 350,
    y: 50,
    width: 100,
    height: 50,
    label: "C",
  };

  const edgeAB: FlowchartEdge = {
    id: "edge-A-B",
    sourceNodeId: "node-A",
    sourcePort: "right",
    targetNodeId: "node-B",
    targetPort: "left",
    routing: "orthogonal",
    style: "solid",
    marker: "arrow",
    label: "A ke B",
  };

  const edgeBC: FlowchartEdge = {
    id: "edge-B-C",
    sourceNodeId: "node-B",
    sourcePort: "right",
    targetNodeId: "node-C",
    targetPort: "left",
    routing: "orthogonal",
    style: "solid",
    marker: "arrow",
    label: "B ke C",
  };

  const allNodes = [nodeA, nodeB, nodeC];
  const allEdges = [edgeAB, edgeBC];

  it("should copy selected nodes and automatically include internal connecting edges", () => {
    // Copy node A dan B (dan garis edgeAB secara otomatis)
    const clip = createClipboardData(allNodes, allEdges, ["node-A", "node-B"], []);

    expect(clip.nodes.length).toBe(2);
    expect(clip.nodes.map((n) => n.id)).toEqual(["node-A", "node-B"]);
    // Garis AB harus ikut tersalin karena kedua ujungnya dipilih
    expect(clip.edges.length).toBe(1);
    expect(clip.edges[0].id).toBe("edge-A-B");
    // Garis BC tidak boleh ikut karena node C tidak dipilih
    expect(clip.edges.some((e) => e.id === "edge-B-C")).toBe(false);
  });

  it("should paste clipboard data with coordinate offset, new IDs, and remapped edge connections", () => {
    const clip = createClipboardData(allNodes, allEdges, ["node-A", "node-B"], []);
    const { newNodes, newEdges, newSelectedNodeIds } = pasteClipboardData(clip, {
      x: 40,
      y: 60,
    });

    expect(newNodes.length).toBe(2);
    expect(newEdges.length).toBe(1);

    const pastedA = newNodes.find((n) => n.label === "A");
    const pastedB = newNodes.find((n) => n.label === "B");

    expect(pastedA).toBeDefined();
    expect(pastedB).toBeDefined();

    // ID baru harus unik dan berbeda dari ID asli
    expect(pastedA?.id).not.toBe("node-A");
    expect(pastedB?.id).not.toBe("node-B");

    // Koordinat harus tergeser sesuai offset (x + 40, y + 60)
    expect(pastedA?.x).toBe(90);
    expect(pastedA?.y).toBe(110);
    expect(pastedB?.x).toBe(240);
    expect(pastedB?.y).toBe(110);

    // Garis baru yang dipaste harus menyambungkan node-node baru hasil clone!
    const pastedEdge = newEdges[0];
    expect(pastedEdge.id).not.toBe("edge-A-B");
    expect(pastedEdge.sourceNodeId).toBe(pastedA?.id);
    expect(pastedEdge.targetNodeId).toBe(pastedB?.id);

    // Seleksi baru harus langsung memilih kedua node yang baru dipaste
    expect(newSelectedNodeIds).toEqual([pastedA?.id, pastedB?.id]);
  });
});

describe("Flowchart Phase 4: Marquee Selection Box Intersections", () => {
  const node: FlowchartNode = {
    id: "test-node",
    type: "process",
    x: 100,
    y: 100,
    width: 80,
    height: 60,
    label: "Target",
  };

  it("should detect node when fully inside selection box", () => {
    const box = { startX: 50, startY: 50, currentX: 250, currentY: 200 };
    expect(isNodeInSelectionBox(node, box)).toBe(true);
  });

  it("should detect node when intersecting edges of selection box", () => {
    // Kotak hanya mengenai sebagian kanan bawah node
    const box = { startX: 150, startY: 130, currentX: 300, currentY: 300 };
    expect(isNodeInSelectionBox(node, box)).toBe(true);
  });

  it("should return false when node is completely outside selection box", () => {
    const box = { startX: 250, startY: 250, currentX: 400, currentY: 400 };
    expect(isNodeInSelectionBox(node, box)).toBe(false);
  });

  it("should handle reverse drag direction (kanan-ke-kiri / bawah-ke-atas)", () => {
    // User mendrag dari sudut kanan-bawah ke kiri-atas
    const reverseBox = { startX: 250, startY: 200, currentX: 50, currentY: 50 };
    expect(isNodeInSelectionBox(node, reverseBox)).toBe(true);
  });
});
