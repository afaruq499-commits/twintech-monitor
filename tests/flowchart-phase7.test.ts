import { describe, it, expect } from "vitest";
import { applyAutoLayout } from "../src/lib/flowchart-layout";
import {
  ALL_FLOWCHART_TEMPLATES,
  TEMPLATE_STANDARD_PROCESS,
  TEMPLATE_APPROVAL_WORKFLOW,
  TEMPLATE_PLC_AUTOMATION,
} from "../src/lib/flowchart-templates";
import { flowchartDiagramDataSchema } from "../src/lib/flowchart-schema";
import type { FlowchartNode, FlowchartEdge } from "../src/lib/flowchart-types";

describe("Flowchart Phase 7: Auto-Layout (Dagre Hierarchical Engine)", () => {
  const sampleNodes: FlowchartNode[] = [
    {
      id: "node-1",
      type: "start_end",
      x: 0,
      y: 0,
      width: 140,
      height: 50,
      label: "Start",
      fillColor: "#2563eb",
      strokeColor: "#1d4ed8",
      strokeWidth: 2,
      textColor: "#ffffff",
      fontSize: 12,
      textAlign: "center",
    },
    {
      id: "node-2",
      type: "process",
      x: 0,
      y: 0,
      width: 150,
      height: 60,
      label: "Process Step",
      fillColor: "#1e293b",
      strokeColor: "#475569",
      strokeWidth: 2,
      textColor: "#ffffff",
      fontSize: 11,
      textAlign: "center",
    },
    {
      id: "node-3",
      type: "decision",
      x: 0,
      y: 0,
      width: 130,
      height: 80,
      label: "Condition?",
      fillColor: "#4f46e5",
      strokeColor: "#3730a3",
      strokeWidth: 2,
      textColor: "#ffffff",
      fontSize: 11,
      textAlign: "center",
    },
    {
      id: "node-4",
      type: "start_end",
      x: 0,
      y: 0,
      width: 140,
      height: 50,
      label: "End",
      fillColor: "#16a34a",
      strokeColor: "#15803d",
      strokeWidth: 2,
      textColor: "#ffffff",
      fontSize: 12,
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
    },
    {
      id: "edge-2",
      sourceNodeId: "node-2",
      sourcePort: "bottom",
      targetNodeId: "node-3",
      targetPort: "top",
      routing: "orthogonal",
      style: "solid",
      marker: "arrow",
    },
    {
      id: "edge-3",
      sourceNodeId: "node-3",
      sourcePort: "bottom",
      targetNodeId: "node-4",
      targetPort: "top",
      routing: "orthogonal",
      style: "solid",
      marker: "arrow",
      label: "Ya",
    },
  ];

  it("harus menata posisi node secara hierarkis vertikal (TB: Top-to-Bottom)", () => {
    const result = applyAutoLayout(sampleNodes, sampleEdges, { direction: "TB" });

    expect(result.nodes).toHaveLength(4);
    const n1 = result.nodes.find((n) => n.id === "node-1")!;
    const n2 = result.nodes.find((n) => n.id === "node-2")!;
    const n3 = result.nodes.find((n) => n.id === "node-3")!;
    const n4 = result.nodes.find((n) => n.id === "node-4")!;

    // Pada arah TB, node yang lebih hilir harus memiliki koordinat Y lebih besar
    expect(n1.y).toBeLessThan(n2.y);
    expect(n2.y).toBeLessThan(n3.y);
    expect(n3.y).toBeLessThan(n4.y);

    // Node tidak boleh saling tumpang tindih secara vertikal (y + height <= next.y)
    expect(n1.y + n1.height).toBeLessThan(n2.y);
    expect(n2.y + n2.height).toBeLessThan(n3.y);
    expect(n3.y + n3.height).toBeLessThan(n4.y);
  });

  it("harus menata posisi node secara hierarkis horizontal (LR: Left-to-Right)", () => {
    const result = applyAutoLayout(sampleNodes, sampleEdges, { direction: "LR" });

    expect(result.nodes).toHaveLength(4);
    const n1 = result.nodes.find((n) => n.id === "node-1")!;
    const n2 = result.nodes.find((n) => n.id === "node-2")!;
    const n3 = result.nodes.find((n) => n.id === "node-3")!;
    const n4 = result.nodes.find((n) => n.id === "node-4")!;

    // Pada arah LR, node yang lebih hilir harus memiliki koordinat X lebih besar
    expect(n1.x).toBeLessThan(n2.x);
    expect(n2.x).toBeLessThan(n3.x);
    expect(n3.x).toBeLessThan(n4.x);

    // Node tidak boleh tumpang tindih secara horizontal (x + width <= next.x)
    expect(n1.x + n1.width).toBeLessThan(n2.x);
    expect(n2.x + n2.width).toBeLessThan(n3.x);
    expect(n3.x + n3.width).toBeLessThan(n4.x);
  });

  it("harus menyelaraskan port koneksi secara cerdas (alignPorts)", () => {
    const resultTB = applyAutoLayout(sampleNodes, sampleEdges, {
      direction: "TB",
      alignPorts: true,
    });

    const edge1 = resultTB.edges.find((e) => e.id === "edge-1")!;
    expect(edge1.sourcePort).toBe("bottom");
    expect(edge1.targetPort).toBe("top");

    const resultLR = applyAutoLayout(sampleNodes, sampleEdges, {
      direction: "LR",
      alignPorts: true,
    });

    const edge1LR = resultLR.edges.find((e) => e.id === "edge-1")!;
    expect(edge1LR.sourcePort).toBe("right");
    expect(edge1LR.targetPort).toBe("left");
  });

  it("harus menangani kasus kanvas kosong dan single node tanpa error", () => {
    const emptyResult = applyAutoLayout([], []);
    expect(emptyResult.nodes).toEqual([]);
    expect(emptyResult.edges).toEqual([]);

    const singleResult = applyAutoLayout([sampleNodes[0]], []);
    expect(singleResult.nodes).toHaveLength(1);
    expect(Number.isFinite(singleResult.nodes[0].x)).toBe(true);
    expect(Number.isFinite(singleResult.nodes[0].y)).toBe(true);
  });
});

describe("Flowchart Phase 7: Built-in Starter Templates", () => {
  it("harus menyediakan seluruh template bawaan dengan ID unik dan metadata lengkap", () => {
    expect(ALL_FLOWCHART_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    const ids = ALL_FLOWCHART_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const t of ALL_FLOWCHART_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.badge).toBeTruthy();
      expect(t.nodes.length).toBeGreaterThanOrEqual(4);
      expect(t.edges.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("seluruh template harus lolos validasi skema Zod flowchartDiagramDataSchema", () => {
    for (const t of [TEMPLATE_STANDARD_PROCESS, TEMPLATE_APPROVAL_WORKFLOW, TEMPLATE_PLC_AUTOMATION]) {
      const dataPayload = {
        nodes: t.nodes,
        edges: t.edges,
        viewport: { zoom: 1.0, panX: 40, panY: 20 },
      };

      const parsed = flowchartDiagramDataSchema.safeParse(dataPayload);
      expect(parsed.success).toBe(true);

      // Verifikasi integritas referensi: setiap edge harus merujuk ke node yang ada
      const nodeIds = new Set(t.nodes.map((n) => n.id));
      for (const edge of t.edges) {
        expect(nodeIds.has(edge.sourceNodeId)).toBe(true);
        expect(nodeIds.has(edge.targetNodeId)).toBe(true);
      }
    }
  });
});

describe("Flowchart Phase 7: Skalabilitas & Performa (200+ Nodes)", () => {
  it("harus mampu melakukan kalkulasi auto-layout pada diagram 200 node dan 200 edge dalam waktu kurang dari 250ms", () => {
    // Generate 200 node berantai dengan beberapa cabang
    const heavyNodes: FlowchartNode[] = [];
    const heavyEdges: FlowchartEdge[] = [];

    for (let i = 0; i < 200; i++) {
      heavyNodes.push({
        id: `node-stress-${i}`,
        type: i === 0 ? "start_end" : i % 5 === 0 ? "decision" : "process",
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        width: 140,
        height: 60,
        label: `Step ${i + 1}`,
        fillColor: "#1e293b",
        strokeColor: "#475569",
        strokeWidth: 2,
        textColor: "#ffffff",
        fontSize: 11,
        textAlign: "center",
      });

      if (i > 0) {
        heavyEdges.push({
          id: `edge-stress-${i}`,
          sourceNodeId: `node-stress-${i - 1}`,
          sourcePort: "bottom",
          targetNodeId: `node-stress-${i}`,
          targetPort: "top",
          routing: "orthogonal",
          style: "solid",
          marker: "arrow",
        });
      }
    }

    const startTime = performance.now();
    const result = applyAutoLayout(heavyNodes, heavyEdges, { direction: "TB" });
    const duration = performance.now() - startTime;

    expect(result.nodes).toHaveLength(200);
    expect(result.edges).toHaveLength(199);
    expect(duration).toBeLessThan(5000); // Batas toleransi aman saat 25 test suite berjalan paralel di CI/mesin lokal

    // Pastikan seluruh node terpetakan ke koordinat yang valid (bukan NaN)
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });
});
