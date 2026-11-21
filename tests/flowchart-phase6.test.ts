import { describe, it, expect } from "vitest";
import {
  calculateDiagramBoundingBox,
  generateStandaloneSvg,
  importDiagramFromJson,
  exportDiagramToMxGraphXml,
} from "../src/lib/flowchart-export";
import type { FlowchartNode, FlowchartEdge } from "../src/lib/flowchart-types";

describe("Flowchart Phase 6: Bounding Box & Framing (Tidak Terpotong)", () => {
  const sampleNodes: FlowchartNode[] = [
    {
      id: "node-1",
      type: "start_end",
      x: 100,
      y: 150,
      width: 140,
      height: 50,
      label: "START",
    },
    {
      id: "node-2",
      type: "process",
      x: 300,
      y: 350,
      width: 160,
      height: 60,
      label: "PROSES MESIN",
    },
  ];

  it("should calculate correct bounding box with padding to prevent clipping", () => {
    const padding = 50;
    const box = calculateDiagramBoundingBox(sampleNodes, padding);

    // Node 1: x: 100, y: 150
    // Node 2: x+w: 300+160 = 460, y+h: 350+60 = 410
    expect(box.minX).toBe(100 - padding); // 50
    expect(box.minY).toBe(150 - padding); // 100
    expect(box.maxX).toBe(460 + padding); // 510
    expect(box.maxY).toBe(410 + padding); // 460
    expect(box.width).toBe(460); // (460 - 100) + 100 = 460
    expect(box.height).toBe(360); // (410 - 150) + 100 = 360
    expect(box.viewBox).toBe("50 100 460 360");
  });

  it("should return safe fallback bounding box when nodes array is empty", () => {
    const box = calculateDiagramBoundingBox([]);
    expect(box.width).toBe(800);
    expect(box.height).toBe(600);
    expect(box.viewBox).toBe("0 0 800 600");
  });
});

describe("Flowchart Phase 6: Standalone SVG Generation & Themes", () => {
  const sampleNodes: FlowchartNode[] = [
    {
      id: "n-start",
      type: "start_end",
      x: 50,
      y: 50,
      width: 120,
      height: 50,
      label: "Power ON",
      fillColor: "#2563eb",
      strokeColor: "#1d4ed8",
      textColor: "#ffffff",
    },
  ];

  const sampleEdges: FlowchartEdge[] = [
    {
      id: "e-1",
      sourceNodeId: "n-start",
      sourcePort: "bottom",
      targetNodeId: "n-start",
      targetPort: "top",
      routing: "orthogonal",
      style: "dashed",
      marker: "arrow",
      label: "Siklus",
      color: "#64748b",
      strokeWidth: 2,
    },
  ];

  it("should generate valid standalone SVG markup with white background", () => {
    const { svgString } = generateStandaloneSvg(sampleNodes, sampleEdges, {
      background: "white",
    });

    expect(svgString).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svgString).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svgString).toContain('id="flowchart-background"');
    expect(svgString).toContain('fill="#ffffff"');
    expect(svgString).toContain("Power ON");
    expect(svgString).toContain("arrow-end");
  });

  it("should omit background rect for transparent background option", () => {
    const { svgString } = generateStandaloneSvg(sampleNodes, sampleEdges, {
      background: "transparent",
    });

    expect(svgString).not.toContain('id="flowchart-background"');
    expect(svgString).toContain("Power ON");
  });

  it("should use dark background rect for dark theme option", () => {
    const { svgString } = generateStandaloneSvg(sampleNodes, sampleEdges, {
      background: "dark",
    });

    expect(svgString).toContain('id="flowchart-background"');
    expect(svgString).toContain('fill="#0f172a"');
  });
});

describe("Flowchart Phase 6: JSON Import with Zod Validation", () => {
  const validPayload = JSON.stringify({
    nodes: [
      {
        id: "node-imported",
        type: "decision",
        x: 120,
        y: 80,
        width: 140,
        height: 70,
        label: "Interlock Sensor OK?",
      },
    ],
    edges: [],
    viewport: { zoom: 1.5, panX: 80, panY: 40 },
  });

  it("should successfully import valid flowchart JSON file", () => {
    const result = importDiagramFromJson(validPayload);
    expect(result.nodes.length).toBe(1);
    expect(result.nodes[0].id).toBe("node-imported");
    expect(result.nodes[0].type).toBe("decision");
    expect(result.viewport.zoom).toBe(1.5);
  });

  it("should reject corrupted or malformed JSON with descriptive error", () => {
    expect(() => importDiagramFromJson("{ not valid json !!!")).toThrow();
  });

  it("should reject JSON that violates node schema (e.g. invalid type or negative dimension)", () => {
    const invalidSchemaPayload = JSON.stringify({
      nodes: [
        {
          id: "bad-node",
          type: "unknown_shape", // Invalid type
          x: 10,
          y: 20,
          width: -100, // Invalid width
          height: 50,
          label: "Error",
        },
      ],
      edges: [],
    });

    expect(() => importDiagramFromJson(invalidSchemaPayload)).toThrow(
      /Validasi JSON gagal/
    );
  });
});

describe("Flowchart Phase 6: XML mxGraph Export (.drawio)", () => {
  const nodes: FlowchartNode[] = [
    {
      id: "node-p1",
      type: "process",
      x: 100,
      y: 100,
      width: 150,
      height: 60,
      label: "Assembly Rotary Station",
    },
    {
      id: "node-d1",
      type: "decision",
      x: 100,
      y: 220,
      width: 130,
      height: 80,
      label: "Vision Check OK?",
    },
  ];

  const edges: FlowchartEdge[] = [
    {
      id: "edge-p1-d1",
      sourceNodeId: "node-p1",
      sourcePort: "bottom",
      targetNodeId: "node-d1",
      targetPort: "top",
      routing: "orthogonal",
      style: "solid",
      marker: "arrow",
      label: "Next",
    },
  ];

  it("should generate valid mxGraph XML structure compatible with draw.io format", () => {
    const xml = exportDiagramToMxGraphXml(nodes, edges, "SPM Rotary Station");

    expect(xml).toContain('<mxfile host="Twintech Suite"');
    expect(xml).toContain('<diagram id="twintech-diagram" name="SPM Rotary Station">');
    expect(xml).toContain('<mxGraphModel');
    expect(xml).toContain('<mxCell id="0" />');
    expect(xml).toContain('<mxCell id="1" parent="0" />');

    // Cek keberadaan node
    expect(xml).toContain('id="node-p1"');
    expect(xml).toContain('value="Assembly Rotary Station"');
    expect(xml).toContain('id="node-d1"');
    expect(xml).toContain('value="Vision Check OK?"');

    // Cek keberadaan garis alur
    expect(xml).toContain('id="edge-p1-d1"');
    expect(xml).toContain('source="node-p1"');
    expect(xml).toContain('target="node-d1"');
    expect(xml).toContain('edge="1"');
  });
});
