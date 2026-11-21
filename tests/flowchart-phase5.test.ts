import { describe, it, expect } from "vitest";
import {
  createDiagramInputSchema,
  updateDiagramInputSchema,
  renameDiagramInputSchema,
  flowchartNodeSchema,
  flowchartEdgeSchema,
  flowchartDiagramDataSchema,
  serializeDiagramData,
  deserializeDiagramData,
  type FlowchartDiagramData,
} from "../src/lib/flowchart-schema";
import type { FlowchartNode, FlowchartEdge } from "../src/lib/flowchart-types";

describe("Flowchart Phase 5: Zod Schema Validation", () => {
  const validNode: FlowchartNode = {
    id: "node-test-1",
    type: "process",
    x: 100,
    y: 120,
    width: 140,
    height: 60,
    label: "Validasi Sensor",
    fillColor: "#1e293b",
    strokeColor: "#475569",
    strokeWidth: 2,
    textColor: "#ffffff",
    fontSize: 12,
    textAlign: "center",
  };

  const validEdge: FlowchartEdge = {
    id: "edge-test-1",
    sourceNodeId: "node-test-1",
    sourcePort: "bottom",
    targetNodeId: "node-test-2",
    targetPort: "top",
    routing: "orthogonal",
    style: "solid",
    marker: "arrow",
    label: "OK",
    color: "#64748b",
    strokeWidth: 2,
  };

  it("should validate a correct flowchart node", () => {
    const res = flowchartNodeSchema.safeParse(validNode);
    expect(res.success).toBe(true);
  });

  it("should reject a node with invalid type or negative dimensions", () => {
    const invalidType = flowchartNodeSchema.safeParse({
      ...validNode,
      type: "invalid_type",
    });
    expect(invalidType.success).toBe(false);

    const negativeWidth = flowchartNodeSchema.safeParse({
      ...validNode,
      width: -50,
    });
    expect(negativeWidth.success).toBe(false);
  });

  it("should validate a correct flowchart edge and set defaults", () => {
    const res = flowchartEdgeSchema.safeParse({
      id: "edge-min",
      sourceNodeId: "n1",
      sourcePort: "left",
      targetNodeId: "n2",
      targetPort: "right",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.routing).toBe("orthogonal");
      expect(res.data.style).toBe("solid");
      expect(res.data.marker).toBe("arrow");
      expect(res.data.label).toBe("");
    }
  });

  it("should reject an edge missing targetPort or invalid marker", () => {
    const invalidEdge = flowchartEdgeSchema.safeParse({
      id: "edge-invalid",
      sourceNodeId: "n1",
      sourcePort: "top",
      targetNodeId: "n2",
      targetPort: "diagonal", // invalid port
    });
    expect(invalidEdge.success).toBe(false);
  });

  it("should validate full flowchart diagram data with nodes and edges", () => {
    const diagramData = {
      nodes: [validNode],
      edges: [validEdge],
      viewport: { zoom: 1, panX: 40, panY: 20 },
    };
    const res = flowchartDiagramDataSchema.safeParse(diagramData);
    expect(res.success).toBe(true);
  });

  it("should validate create diagram input schema", () => {
    const valid = createDiagramInputSchema.safeParse({
      nama: "Alur Proses SPM Rotary",
      deskripsi: "Diagram sequence stasiun 1 s/d 4",
    });
    expect(valid.success).toBe(true);

    const emptyName = createDiagramInputSchema.safeParse({
      nama: "   ",
    });
    expect(emptyName.success).toBe(false);
  });

  it("should validate update diagram input schema with partial fields", () => {
    const valid = updateDiagramInputSchema.safeParse({
      nama: "Nama Baru",
      nodes: [validNode],
    });
    expect(valid.success).toBe(true);
  });

  it("should validate rename diagram input schema", () => {
    const valid = renameDiagramInputSchema.safeParse({
      nama: "Judul Baru Diagram",
    });
    expect(valid.success).toBe(true);

    const empty = renameDiagramInputSchema.safeParse({
      nama: "",
    });
    expect(empty.success).toBe(false);
  });
});

describe("Flowchart Phase 5: Serialization & Deserialization", () => {
  const sampleData: FlowchartDiagramData = {
    nodes: [
      {
        id: "node-1",
        type: "start_end",
        x: 50,
        y: 50,
        width: 120,
        height: 50,
        label: "START",
      },
    ],
    edges: [],
    viewport: { zoom: 1.25, panX: 100, panY: 80 },
  };

  it("should serialize valid diagram data into a valid JSON string", () => {
    const jsonStr = serializeDiagramData(sampleData);
    expect(typeof jsonStr).toBe("string");
    const parsed = JSON.parse(jsonStr);
    expect(parsed.nodes.length).toBe(1);
    expect(parsed.viewport.zoom).toBe(1.25);
  });

  it("should deserialize valid JSON string back into diagram object", () => {
    const jsonStr = JSON.stringify(sampleData);
    const restored = deserializeDiagramData(jsonStr);
    expect(restored.nodes.length).toBe(1);
    expect(restored.nodes[0].id).toBe("node-1");
    expect(restored.viewport.zoom).toBe(1.25);
  });

  it("should safely handle null, undefined, or empty string with fallback", () => {
    const fromNull = deserializeDiagramData(null);
    expect(fromNull.nodes).toEqual([]);
    expect(fromNull.edges).toEqual([]);
    expect(fromNull.viewport.zoom).toBe(1.0);

    const fromEmpty = deserializeDiagramData("");
    expect(fromEmpty.nodes).toEqual([]);
  });

  it("should safely handle corrupt JSON without throwing an error", () => {
    const corrupt = deserializeDiagramData("{ corrupt json not valid !!!");
    expect(corrupt.nodes).toEqual([]);
    expect(corrupt.edges).toEqual([]);
    expect(corrupt.viewport.zoom).toBe(1.0);
  });

  it("should normalize partial raw objects if some fields are missing", () => {
    const partialRaw = JSON.stringify({
      nodes: [
        {
          id: "partial-1",
          type: "note",
          x: 10,
          y: 20,
          width: 80,
          height: 40,
          label: "Catatan",
        },
      ],
      // missing edges & viewport
    });

    const restored = deserializeDiagramData(partialRaw);
    expect(restored.nodes.length).toBe(1);
    expect(restored.edges).toEqual([]);
    expect(restored.viewport.zoom).toBe(1.0);
  });
});
