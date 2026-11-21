import { z } from "zod";
import type { FlowchartNode, FlowchartEdge } from "./flowchart-types";

// 1. Skema Tipe Primitif Flowchart
export const flowchartNodeTypeSchema = z.enum([
  "start_end",
  "process",
  "decision",
  "input_output",
  "subprocess",
  "database",
  "document",
  "connector",
  "note",
]);

export const portPositionSchema = z.enum(["top", "right", "bottom", "left"]);
export const edgeRoutingTypeSchema = z.enum(["straight", "orthogonal", "curved"]);
export const edgeStyleSchema = z.enum(["solid", "dashed"]);
export const edgeMarkerSchema = z.enum(["arrow", "arrow-both", "arrow-start", "none"]);
export const textAlignSchema = z.enum(["left", "center", "right"]);

// 2. Skema Node / Simbol
export const flowchartNodeSchema = z.object({
  id: z.string().min(1, "Node ID wajib diisi"),
  type: flowchartNodeTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().positive("Lebar harus lebih dari 0"),
  height: z.number().positive("Tinggi harus lebih dari 0"),
  label: z.string(),
  fillColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().positive().optional(),
  textColor: z.string().optional(),
  fontSize: z.number().positive().optional(),
  textAlign: textAlignSchema.optional(),
});

// 3. Skema Garis Alur / Edge
export const flowchartEdgeSchema = z.object({
  id: z.string().min(1, "Edge ID wajib diisi"),
  sourceNodeId: z.string().min(1, "Source Node ID wajib diisi"),
  sourcePort: portPositionSchema,
  targetNodeId: z.string().min(1, "Target Node ID wajib diisi"),
  targetPort: portPositionSchema,
  routing: edgeRoutingTypeSchema.default("orthogonal"),
  style: edgeStyleSchema.default("solid"),
  marker: edgeMarkerSchema.default("arrow"),
  label: z.string().optional().default(""),
  color: z.string().optional(),
  strokeWidth: z.number().positive().optional(),
});

// 4. Skema Viewport Kanvas
export const flowchartViewportSchema = z.object({
  zoom: z.number().positive().default(1.0),
  panX: z.number().default(40),
  panY: z.number().default(20),
});

// 5. Skema Data Lengkap Diagram (Disimpan di kolom data_json)
export const flowchartDiagramDataSchema = z.object({
  nodes: z.array(flowchartNodeSchema).default([]),
  edges: z.array(flowchartEdgeSchema).default([]),
  viewport: flowchartViewportSchema.default({ zoom: 1.0, panX: 40, panY: 20 }),
});

export type FlowchartDiagramData = z.infer<typeof flowchartDiagramDataSchema>;

// 6. Skema Input Pembuatan Diagram Baru
export const createDiagramInputSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(1, "Nama diagram wajib diisi")
    .max(300, "Nama diagram maksimal 300 karakter"),
  deskripsi: z.string().max(2000, "Deskripsi maksimal 2000 karakter").optional(),
  projectId: z.string().optional(),
  initialData: flowchartDiagramDataSchema.optional(),
});

export type CreateDiagramInput = z.infer<typeof createDiagramInputSchema>;

// 7. Skema Input Update / Simpan Diagram
export const updateDiagramInputSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(1, "Nama diagram tidak boleh kosong")
    .max(300)
    .optional(),
  deskripsi: z.string().max(2000).nullable().optional(),
  nodes: z.array(flowchartNodeSchema).optional(),
  edges: z.array(flowchartEdgeSchema).optional(),
  viewport: flowchartViewportSchema.optional(),
});

export type UpdateDiagramInput = z.infer<typeof updateDiagramInputSchema>;

// 8. Skema Rename Diagram
export const renameDiagramInputSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(1, "Nama diagram wajib diisi")
    .max(300, "Nama diagram maksimal 300 karakter"),
});

export type RenameDiagramInput = z.infer<typeof renameDiagramInputSchema>;

// =====================================================================
// HELPER SERIALISASI & DESERIALISASI JSON DIAGRAM
// =====================================================================

/**
 * Menvalidasi dan menserialisasi objek diagram menjadi string JSON standar.
 */
export function serializeDiagramData(data: FlowchartDiagramData): string {
  const validated = flowchartDiagramDataSchema.parse(data);
  return JSON.stringify(validated);
}

/**
 * Membaca dan memvalidasi string JSON diagram kembali menjadi objek FlowchartDiagramData.
 * Aman dari data korup / null / string sembarang.
 */
export function deserializeDiagramData(jsonStr: string | null | undefined): FlowchartDiagramData {
  const fallback: FlowchartDiagramData = {
    nodes: [],
    edges: [],
    viewport: { zoom: 1.0, panX: 40, panY: 20 },
  };

  if (!jsonStr || typeof jsonStr !== "string") {
    return fallback;
  }

  try {
    const raw = JSON.parse(jsonStr);
    const parsed = flowchartDiagramDataSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }

    // Pemulihan sebagian jika struktur umum masih array
    return {
      nodes: Array.isArray(raw?.nodes) ? (raw.nodes as FlowchartNode[]) : [],
      edges: Array.isArray(raw?.edges)
        ? (raw.edges as FlowchartEdge[]).map((e) => ({
            ...e,
            label: e.label || "",
            routing: e.routing || "orthogonal",
            style: e.style || "solid",
            marker: e.marker || "arrow",
          }))
        : [],
      viewport:
        raw?.viewport && typeof raw.viewport === "object"
          ? {
              zoom: Number(raw.viewport.zoom) || 1.0,
              panX: Number(raw.viewport.panX) || 40,
              panY: Number(raw.viewport.panY) || 20,
            }
          : fallback.viewport,
    };
  } catch (error) {
    console.warn("Gagal mendeserialisasi JSON diagram, mengembalikan diagram kosong:", error);
    return fallback;
  }
}
