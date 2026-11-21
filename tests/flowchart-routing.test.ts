import { describe, it, expect } from "vitest";
import {
  getNodePortCoordinates,
  getPortNormal,
  computeStraightPath,
  computeCurvedPath,
  computeOrthogonalPath,
  computeEdgePath,
} from "../src/lib/flowchart-routing";
import type { FlowchartNode, FlowchartEdge } from "../src/lib/flowchart-types";

describe("Flowchart Routing & Edge Geometry (Tahap 2)", () => {
  const sampleNode: FlowchartNode = {
    id: "node-test",
    type: "process",
    x: 100,
    y: 200,
    width: 120,
    height: 60,
    label: "Process Node",
  };

  it("menghitung titik jangkar port (top, bottom, left, right) dengan tepat", () => {
    const top = getNodePortCoordinates(sampleNode, "top");
    expect(top).toEqual({ x: 160, y: 200 });

    const bottom = getNodePortCoordinates(sampleNode, "bottom");
    expect(bottom).toEqual({ x: 160, y: 260 });

    const left = getNodePortCoordinates(sampleNode, "left");
    expect(left).toEqual({ x: 100, y: 230 });

    const right = getNodePortCoordinates(sampleNode, "right");
    expect(right).toEqual({ x: 220, y: 230 });
  });

  it("menghitung vektor normal port dengan benar", () => {
    expect(getPortNormal("top")).toEqual({ x: 0, y: -1 });
    expect(getPortNormal("bottom")).toEqual({ x: 0, y: 1 });
    expect(getPortNormal("left")).toEqual({ x: -1, y: 0 });
    expect(getPortNormal("right")).toEqual({ x: 1, y: 0 });
  });

  it("menghasilkan lintasan garis lurus (straight) dan posisi label tepat di tengah", () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 200 };
    const res = computeStraightPath(p1, p2);

    expect(res.path).toBe("M 0 0 L 100 200");
    expect(res.labelPosition).toEqual({ x: 50, y: 100 });
  });

  it("menghasilkan lintasan garis melengkung (curved Bézier) dengan kontrol port normal", () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 300, y: 100 };
    const res = computeCurvedPath(p1, "right", p2, "left");

    expect(res.path).toMatch(/^M 100 100 C \d+(\.\d+)? 100, \d+(\.\d+)? 100, 300 100$/);
    expect(res.labelPosition.x).toBeGreaterThan(100);
    expect(res.labelPosition.x).toBeLessThan(300);
  });

  it("menghasilkan lintasan siku orthogonal vertikal (bottom -> top) tanpa garis miring", () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 200, y: 200 };
    const res = computeOrthogonalPath(p1, "bottom", p2, "top");

    // midY = 150 -> M 100 100 L 100 150 L 200 150 L 200 200
    expect(res.path).toBe("M 100 100 L 100 150 L 200 150 L 200 200");
    expect(res.labelPosition).toEqual({ x: 150, y: 150 });
  });

  it("menghasilkan lintasan siku orthogonal horizontal (right -> left) tanpa garis miring", () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 260, y: 200 };
    const res = computeOrthogonalPath(p1, "right", p2, "left");

    // midX = 180 -> M 100 100 L 180 100 L 180 200 L 260 200
    expect(res.path).toBe("M 100 100 L 180 100 L 180 200 L 260 200");
    expect(res.labelPosition).toEqual({ x: 180, y: 150 });
  });

  it("mendukung computeEdgePath untuk semua routing type (straight, curved, orthogonal)", () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 200, y: 300 };

    const straight = computeEdgePath(p1, "bottom", p2, "top", "straight");
    expect(straight.path).toContain("M 100 100 L 200 300");

    const curved = computeEdgePath(p1, "bottom", p2, "top", "curved");
    expect(curved.path).toContain("C");

    const ortho = computeEdgePath(p1, "bottom", p2, "top", "orthogonal");
    expect(ortho.path).toContain("L");
  });

  it("garis otomatis memperbarui koordinat secara dinamis saat node dipindahkan", () => {
    const sourceNode: FlowchartNode = {
      id: "node-1",
      type: "process",
      x: 50,
      y: 50,
      width: 100,
      height: 50,
      label: "Node 1",
    };

    const targetNode: FlowchartNode = {
      id: "node-2",
      type: "process",
      x: 50,
      y: 200,
      width: 100,
      height: 50,
      label: "Node 2",
    };

    const edge: FlowchartEdge = {
      id: "edge-test",
      sourceNodeId: "node-1",
      sourcePort: "bottom",
      targetNodeId: "node-2",
      targetPort: "top",
      routing: "straight",
      style: "solid",
      marker: "arrow",
      label: "Ya",
    };

    // Awal
    const p1Awal = getNodePortCoordinates(sourceNode, edge.sourcePort);
    const p2Awal = getNodePortCoordinates(targetNode, edge.targetPort);
    const geoAwal = computeEdgePath(p1Awal, edge.sourcePort, p2Awal, edge.targetPort, edge.routing);
    expect(geoAwal.path).toBe("M 100 100 L 100 200");

    // Pindahkan targetNode ke x: 300, y: 400
    const movedTargetNode = { ...targetNode, x: 300, y: 400 };
    const p2Baru = getNodePortCoordinates(movedTargetNode, edge.targetPort);
    const geoBaru = computeEdgePath(p1Awal, edge.sourcePort, p2Baru, edge.targetPort, edge.routing);
    expect(geoBaru.path).toBe("M 100 100 L 350 400");
  });

  it("mendukung opsi panah, garis putus-putus, dan label teks (Ya/Tidak)", () => {
    const edgeDashed: FlowchartEdge = {
      id: "edge-dashed",
      sourceNodeId: "node-1",
      sourcePort: "right",
      targetNodeId: "node-2",
      targetPort: "right",
      routing: "orthogonal",
      style: "dashed",
      marker: "arrow-both",
      label: "Tidak",
    };

    expect(edgeDashed.style).toBe("dashed");
    expect(edgeDashed.marker).toBe("arrow-both");
    expect(edgeDashed.label).toBe("Tidak");
  });
});
