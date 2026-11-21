import type {
  FlowchartNode,
  PortPosition,
  EdgeRoutingType,
} from "./flowchart-types";

export interface Point {
  x: number;
  y: number;
}

/**
 * Menghitung koordinat titik jangkar (anchor point) dari sebuah port pada node
 */
export function getNodePortCoordinates(node: FlowchartNode, port: PortPosition): Point {
  const { x, y, width, height } = node;
  switch (port) {
    case "top":
      return { x: x + width / 2, y };
    case "bottom":
      return { x: x + width / 2, y: y + height };
    case "left":
      return { x, y: y + height / 2 };
    case "right":
      return { x: x + width, y: y + height / 2 };
  }
}

/**
 * Menghitung arah normal (vektor satuan) dari sebuah port
 */
export function getPortNormal(port: PortPosition): Point {
  switch (port) {
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
  }
}

export interface ComputedEdgeGeometry {
  path: string;
  labelPosition: Point;
}

/**
 * Menghitung lintasan garis lurus (Straight)
 */
export function computeStraightPath(p1: Point, p2: Point): ComputedEdgeGeometry {
  const path = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  const labelPosition = {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
  return { path, labelPosition };
}

/**
 * Menghitung lintasan garis melengkung (Curved / Cubic Bézier)
 */
export function computeCurvedPath(
  p1: Point,
  dir1: PortPosition,
  p2: Point,
  dir2: PortPosition
): ComputedEdgeGeometry {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const curvature = Math.max(35, Math.min(130, dist * 0.45));

  const n1 = getPortNormal(dir1);
  const n2 = getPortNormal(dir2);

  const cp1: Point = {
    x: p1.x + n1.x * curvature,
    y: p1.y + n1.y * curvature,
  };

  const cp2: Point = {
    x: p2.x + n2.x * curvature,
    y: p2.y + n2.y * curvature,
  };

  const path = `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;

  // Titik tengah kurva Bézier kubik pada t = 0.5
  // B(0.5) = (p1 + 3*cp1 + 3*cp2 + p2) / 8
  const labelPosition: Point = {
    x: (p1.x + 3 * cp1.x + 3 * cp2.x + p2.x) / 8,
    y: (p1.y + 3 * cp1.y + 3 * cp2.y + p2.y) / 8,
  };

  return { path, labelPosition };
}

/**
 * Menghitung lintasan garis siku (Orthogonal / Manhattan Routing)
 */
export function computeOrthogonalPath(
  p1: Point,
  dir1: PortPosition,
  p2: Point,
  dir2: PortPosition
): ComputedEdgeGeometry {
  const n1 = getPortNormal(dir1);
  const n2 = getPortNormal(dir2);
  const step = 22; // jarak stub keluar dari port sebelum membelok

  const s1: Point = { x: p1.x + n1.x * step, y: p1.y + n1.y * step };
  const s2: Point = { x: p2.x + n2.x * step, y: p2.y + n2.y * step };

  // 1. Aliran vertikal langsung (misal: bottom -> top)
  if (dir1 === "bottom" && dir2 === "top") {
    if (p2.y >= p1.y + 15) {
      const midY = (p1.y + p2.y) / 2;
      return {
        path: `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`,
        labelPosition: { x: (p1.x + p2.x) / 2, y: midY },
      };
    }
  }

  // 2. Aliran vertikal terbalik (top -> bottom)
  if (dir1 === "top" && dir2 === "bottom") {
    if (p1.y >= p2.y + 15) {
      const midY = (p1.y + p2.y) / 2;
      return {
        path: `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`,
        labelPosition: { x: (p1.x + p2.x) / 2, y: midY },
      };
    }
  }

  // 3. Aliran horizontal langsung (misal: right -> left)
  if (dir1 === "right" && dir2 === "left") {
    if (p2.x >= p1.x + 15) {
      const midX = (p1.x + p2.x) / 2;
      return {
        path: `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`,
        labelPosition: { x: midX, y: (p1.y + p2.y) / 2 },
      };
    }
  }

  // 4. Aliran horizontal terbalik (left -> right)
  if (dir1 === "left" && dir2 === "right") {
    if (p1.x >= p2.x + 15) {
      const midX = (p1.x + p2.x) / 2;
      return {
        path: `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`,
        labelPosition: { x: midX, y: (p1.y + p2.y) / 2 },
      };
    }
  }

  // 5. Belok satu sudut (vertikal ke horizontal)
  // misal: bottom -> left atau bottom -> right
  if ((dir1 === "top" || dir1 === "bottom") && (dir2 === "left" || dir2 === "right")) {
    // Jalur: p1 -> (p1.x, p2.y) -> p2 jika tidak bertabrakan dengan arah port target
    const okDirect = dir2 === "left" ? p1.x < p2.x : p1.x > p2.x;
    if (okDirect) {
      return {
        path: `M ${p1.x} ${p1.y} L ${p1.x} ${p2.y} L ${p2.x} ${p2.y}`,
        labelPosition: { x: (p1.x + p2.x) / 2, y: p2.y },
      };
    }
    // Jika tidak langsung, lewati stub target
    return {
      path: `M ${p1.x} ${p1.y} L ${p1.x} ${s2.y} L ${s2.x} ${s2.y} L ${p2.x} ${p2.y}`,
      labelPosition: { x: (p1.x + s2.x) / 2, y: s2.y },
    };
  }

  // 6. Belok satu sudut (horizontal ke vertikal)
  // misal: right -> top atau left -> top
  if ((dir1 === "left" || dir1 === "right") && (dir2 === "top" || dir2 === "bottom")) {
    const okDirect = dir2 === "top" ? p1.y < p2.y : p1.y > p2.y;
    if (okDirect) {
      return {
        path: `M ${p1.x} ${p1.y} L ${p2.x} ${p1.y} L ${p2.x} ${p2.y}`,
        labelPosition: { x: p2.x, y: (p1.y + p2.y) / 2 },
      };
    }
    return {
      path: `M ${p1.x} ${p1.y} L ${s2.x} ${p1.y} L ${s2.x} ${s2.y} L ${p2.x} ${p2.y}`,
      labelPosition: { x: s2.x, y: (p1.y + s2.y) / 2 },
    };
  }

  // 7. Arah yang sama atau loopback (misal right -> right, bottom -> bottom, atau loop balik ke atas)
  if (dir1 === "right" && dir2 === "right") {
    const maxX = Math.max(p1.x, p2.x) + 40;
    return {
      path: `M ${p1.x} ${p1.y} L ${maxX} ${p1.y} L ${maxX} ${p2.y} L ${p2.x} ${p2.y}`,
      labelPosition: { x: maxX, y: (p1.y + p2.y) / 2 },
    };
  }

  if (dir1 === "left" && dir2 === "left") {
    const minX = Math.min(p1.x, p2.x) - 40;
    return {
      path: `M ${p1.x} ${p1.y} L ${minX} ${p1.y} L ${minX} ${p2.y} L ${p2.x} ${p2.y}`,
      labelPosition: { x: minX, y: (p1.y + p2.y) / 2 },
    };
  }

  if (dir1 === "bottom" && dir2 === "bottom") {
    const maxY = Math.max(p1.y, p2.y) + 40;
    return {
      path: `M ${p1.x} ${p1.y} L ${p1.x} ${maxY} L ${p2.x} ${maxY} L ${p2.x} ${p2.y}`,
      labelPosition: { x: (p1.x + p2.x) / 2, y: maxY },
    };
  }

  if (dir1 === "top" && dir2 === "top") {
    const minY = Math.min(p1.y, p2.y) - 40;
    return {
      path: `M ${p1.x} ${p1.y} L ${p1.x} ${minY} L ${p2.x} ${minY} L ${p2.x} ${p2.y}`,
      labelPosition: { x: (p1.x + p2.x) / 2, y: minY },
    };
  }

  // 8. Loopback umum jika p2 berada di belakang p1 (misal bottom kembali ke top)
  if (dir1 === "bottom" && dir2 === "top") {
    // Keluar bawah -> belok ke samping melewati node -> belok ke atas -> masuk dari atas
    const lateralX = Math.max(p1.x, p2.x) + 70;
    return {
      path: `M ${p1.x} ${p1.y} L ${p1.x} ${s1.y} L ${lateralX} ${s1.y} L ${lateralX} ${s2.y} L ${p2.x} ${s2.y} L ${p2.x} ${p2.y}`,
      labelPosition: { x: lateralX, y: (s1.y + s2.y) / 2 },
    };
  }

  // Fallback serbaguna berbasis stub (Z / S shaped routing)
  const midX = (s1.x + s2.x) / 2;
  return {
    path: `M ${p1.x} ${p1.y} L ${s1.x} ${s1.y} L ${midX} ${s1.y} L ${midX} ${s2.y} L ${s2.x} ${s2.y} L ${p2.x} ${p2.y}`,
    labelPosition: { x: midX, y: (s1.y + s2.y) / 2 },
  };
}

/**
 * Fungsi utama untuk menghitung path & label posisi berdasarkan routing type
 */
export function computeEdgePath(
  p1: Point,
  dir1: PortPosition,
  p2: Point,
  dir2: PortPosition,
  routing: EdgeRoutingType
): ComputedEdgeGeometry {
  switch (routing) {
    case "straight":
      return computeStraightPath(p1, p2);
    case "curved":
      return computeCurvedPath(p1, dir1, p2, dir2);
    case "orthogonal":
    default:
      return computeOrthogonalPath(p1, dir1, p2, dir2);
  }
}
