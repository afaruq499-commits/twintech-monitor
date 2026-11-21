import type {
  FlowchartNode,
  FlowchartEdge,
} from "./flowchart-types";

export interface FlowchartSnapshot {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
}

export interface FlowchartClipboard {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
}

/**
 * Manajer Riwayat Undo/Redo untuk Flowchart Studio (Tahap 4)
 * Mendukung pembatasan stack agar memori tidak membengkak dan
 * operasi drag-commit satu langkah (satu drag = satu langkah).
 */
export class FlowchartHistoryManager {
  private past: FlowchartSnapshot[] = [];
  private future: FlowchartSnapshot[] = [];
  private current: FlowchartSnapshot;
  private maxHistory: number;

  constructor(initial: FlowchartSnapshot, maxHistory = 40) {
    this.current = {
      nodes: [...initial.nodes],
      edges: [...initial.edges],
    };
    this.maxHistory = maxHistory;
  }

  getCurrent(): FlowchartSnapshot {
    return this.current;
  }

  getPastCount(): number {
    return this.past.length;
  }

  getFutureCount(): number {
    return this.future.length;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Menyimpan snapshot perubahan baru ke history stack dari state saat ini
   */
  pushState(newSnapshot: FlowchartSnapshot) {
    this.commitTransaction(this.current, newSnapshot);
  }

  /**
   * Mencatat transaksi dengan snapshot sebelum dan sesudah (misal: aksi drag/resize 1 langkah)
   */
  commitTransaction(beforeSnapshot: FlowchartSnapshot, afterSnapshot: FlowchartSnapshot) {
    this.past.push({
      nodes: JSON.parse(JSON.stringify(beforeSnapshot.nodes)),
      edges: JSON.parse(JSON.stringify(beforeSnapshot.edges)),
    });
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    this.current = {
      nodes: JSON.parse(JSON.stringify(afterSnapshot.nodes)),
      edges: JSON.parse(JSON.stringify(afterSnapshot.edges)),
    };
    this.future = []; // Hapus redo stack bila ada aksi baru
  }

  /**
   * Membatalkan langkah terakhir (Undo)
   */
  undo(): FlowchartSnapshot | null {
    if (!this.canUndo()) return null;
    const previous = this.past.pop()!;
    this.future.push(this.current);
    this.current = previous;
    return this.current;
  }

  /**
   * Mengulangi langkah yang dibatalkan (Redo)
   */
  redo(): FlowchartSnapshot | null {
    if (!this.canRedo()) return null;
    const next = this.future.pop()!;
    this.past.push(this.current);
    this.current = next;
    return this.current;
  }

  /**
   * Mengganti current state tanpa mencatat ke history
   * Digunakan saat frame drag/resize masih berlangsung
   */
  replaceCurrent(snapshot: FlowchartSnapshot) {
    this.current = {
      nodes: [...snapshot.nodes],
      edges: [...snapshot.edges],
    };
  }

  /**
   * Mengosongkan seluruh riwayat
   */
  clear(newInitial: FlowchartSnapshot) {
    this.past = [];
    this.future = [];
    this.current = {
      nodes: [...newInitial.nodes],
      edges: [...newInitial.edges],
    };
  }
}

/**
 * Membuat paket clipboard dari node dan garis yang dipilih
 */
export function createClipboardData(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  selectedNodeIds: string[],
  selectedEdgeIds: string[]
): FlowchartClipboard {
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
  // Sertakan garis yang dipilih atau garis yang kedua ujungnya berada dalam node yang dipilih
  const selectedEdges = edges.filter(
    (e) =>
      selectedEdgeIds.includes(e.id) ||
      (selectedNodeIds.includes(e.sourceNodeId) && selectedNodeIds.includes(e.targetNodeId))
  );

  return {
    nodes: JSON.parse(JSON.stringify(selectedNodes)),
    edges: JSON.parse(JSON.stringify(selectedEdges)),
  };
}

/**
 * Menempel (Paste) data dari clipboard ke diagram dengan offset posisi dan ID baru
 */
export function pasteClipboardData(
  clipboard: FlowchartClipboard,
  offset = { x: 30, y: 30 }
): { newNodes: FlowchartNode[]; newEdges: FlowchartEdge[]; newSelectedNodeIds: string[] } {
  if (clipboard.nodes.length === 0) {
    return { newNodes: [], newEdges: [], newSelectedNodeIds: [] };
  }

  // Peta ID lama ke ID baru agar garis antar node yang di-copy tetap terhubung
  const idMap = new Map<string, string>();

  const newNodes: FlowchartNode[] = clipboard.nodes.map((node) => {
    const newId = `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    idMap.set(node.id, newId);
    return {
      ...node,
      id: newId,
      x: node.x + offset.x,
      y: node.y + offset.y,
    };
  });

  const newEdges: FlowchartEdge[] = clipboard.edges.map((edge) => {
    const newId = `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      ...edge,
      id: newId,
      sourceNodeId: idMap.get(edge.sourceNodeId) || edge.sourceNodeId,
      targetNodeId: idMap.get(edge.targetNodeId) || edge.targetNodeId,
    };
  });

  const newSelectedNodeIds = newNodes.map((n) => n.id);

  return { newNodes, newEdges, newSelectedNodeIds };
}

/**
 * Memeriksa apakah suatu node berpotongan (intersect) dengan selection box marquee
 */
export function isNodeInSelectionBox(
  node: FlowchartNode,
  box: { startX: number; startY: number; currentX: number; currentY: number }
): boolean {
  const boxLeft = Math.min(box.startX, box.currentX);
  const boxRight = Math.max(box.startX, box.currentX);
  const boxTop = Math.min(box.startY, box.currentY);
  const boxBottom = Math.max(box.startY, box.currentY);

  const nodeLeft = node.x;
  const nodeRight = node.x + node.width;
  const nodeTop = node.y;
  const nodeBottom = node.y + node.height;

  // Cek apakah tidak saling lepas
  const separated =
    nodeLeft > boxRight ||
    nodeRight < boxLeft ||
    nodeTop > boxBottom ||
    nodeBottom < boxTop;

  return !separated;
}
