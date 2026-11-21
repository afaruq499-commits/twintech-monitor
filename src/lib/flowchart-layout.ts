import dagre from "dagre";
import type {
  FlowchartNode,
  FlowchartEdge,
  PortPosition,
} from "@/lib/flowchart-types";

export interface AutoLayoutOptions {
  direction?: "TB" | "LR";
  nodeSep?: number;
  rankSep?: number;
  marginX?: number;
  marginY?: number;
  alignPorts?: boolean;
}

/**
 * Menerapkan auto-layout pada node & edge menggunakan algoritma hierarkis Dagre.
 * Mendukung arah Vertikal (TB: Top-to-Bottom) dan Horizontal (LR: Left-to-Right).
 * Mengembalikan array nodes dan edges baru dengan posisi yang terdistribusi rapi.
 */
export function applyAutoLayout(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  options?: AutoLayoutOptions
): { nodes: FlowchartNode[]; edges: FlowchartEdge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const direction = options?.direction || "TB";
  const nodeSep = options?.nodeSep ?? (direction === "TB" ? 50 : 60);
  const rankSep = options?.rankSep ?? (direction === "TB" ? 70 : 80);
  const marginX = options?.marginX ?? 60;
  const marginY = options?.marginY ?? 60;
  const alignPorts = options?.alignPorts ?? true;

  // Inisialisasi graph Dagre
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: marginX,
    marginy: marginY,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Daftarkan seluruh node ke graf
  for (const node of nodes) {
    g.setNode(node.id, {
      width: Math.max(80, node.width),
      height: Math.max(40, node.height),
    });
  }

  // Daftarkan edge yang valid (kedua node ujung harus ada di dalam nodes)
  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter(
    (e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
  );

  for (const edge of validEdges) {
    g.setEdge(edge.sourceNodeId, edge.targetNodeId);
  }

  // Eksekusi kalkulasi layout
  dagre.layout(g);

  // Petakan koordinat hasil layout ke nodes
  // Catatan: Dagre mengembalikan titik pusat (center x, y), kita ubah ke koordinat top-left (x, y)
  const newNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    if (!dagreNode) return node;

    const newX = Math.round(dagreNode.x - node.width / 2);
    const newY = Math.round(dagreNode.y - node.height / 2);

    return {
      ...node,
      x: newX,
      y: newY,
    };
  });

  // Map untuk lookup cepat O(1)
  const newNodeMap = new Map(newNodes.map((n) => [n.id, n]));

  // Opsi: Selaraskan port garis alur secara cerdas sesuai posisi relatif antar node
  const newEdges = edges.map((edge) => {
    if (!alignPorts) return edge;

    const src = newNodeMap.get(edge.sourceNodeId);
    const tgt = newNodeMap.get(edge.targetNodeId);
    if (!src || !tgt) return edge;

    let sourcePort: PortPosition = edge.sourcePort;
    let targetPort: PortPosition = edge.targetPort;

    if (direction === "TB") {
      // Alur Utama Vertikal (Atas ke Bawah)
      const isTargetBelow = tgt.y >= src.y + src.height * 0.4;
      const isLoopbackUp = tgt.y + tgt.height * 0.4 <= src.y;

      if (isTargetBelow) {
        // Alur maju normal: keluar dari bawah, masuk ke atas
        sourcePort = "bottom";
        targetPort = "top";
      } else if (isLoopbackUp) {
        // Alur balik ke atas (loopback): keluar dari kiri, masuk ke kiri
        // atau keluar dari kanan jika target berada di sebelah kanan
        if (tgt.x >= src.x) {
          sourcePort = "right";
          targetPort = "right";
        } else {
          sourcePort = "left";
          targetPort = "left";
        }
      } else {
        // Sejajar horizontal pada rank yang sama
        if (tgt.x > src.x) {
          sourcePort = "right";
          targetPort = "left";
        } else {
          sourcePort = "left";
          targetPort = "right";
        }
      }
    } else {
      // Alur Utama Horizontal (Kiri ke Kanan)
      const isTargetRight = tgt.x >= src.x + src.width * 0.4;
      const isLoopbackLeft = tgt.x + tgt.width * 0.4 <= src.x;

      if (isTargetRight) {
        // Alur maju normal: keluar dari kanan, masuk ke kiri
        sourcePort = "right";
        targetPort = "left";
      } else if (isLoopbackLeft) {
        // Alur balik ke kiri
        if (tgt.y >= src.y) {
          sourcePort = "bottom";
          targetPort = "bottom";
        } else {
          sourcePort = "top";
          targetPort = "top";
        }
      } else {
        // Sejajar vertikal pada rank yang sama
        if (tgt.y > src.y) {
          sourcePort = "bottom";
          targetPort = "top";
        } else {
          sourcePort = "top";
          targetPort = "bottom";
        }
      }
    }

    return {
      ...edge,
      sourcePort,
      targetPort,
    };
  });

  return { nodes: newNodes, edges: newEdges };
}
