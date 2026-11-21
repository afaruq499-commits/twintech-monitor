import { NextResponse } from "next/server";
import { prisma, withDbRetry, sanitizeDbError } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  createDiagramInputSchema,
  serializeDiagramData,
  type FlowchartDiagramData,
} from "@/lib/flowchart-schema";

const DEFAULT_STARTER_DATA: FlowchartDiagramData = {
  nodes: [
    {
      id: "node-start",
      type: "start_end",
      x: 280,
      y: 80,
      width: 140,
      height: 52,
      label: "START / POWER ON",
      fillColor: "#2563eb",
      strokeColor: "#1d4ed8",
      strokeWidth: 2,
      textColor: "#ffffff",
      fontSize: 11,
      textAlign: "center",
    },
    {
      id: "node-process-1",
      type: "process",
      x: 275,
      y: 180,
      width: 150,
      height: 64,
      label: "HOME POSITION CHECK",
      fillColor: "#1e293b",
      strokeColor: "#475569",
      strokeWidth: 2,
      textColor: "#ffffff",
      fontSize: 11,
      textAlign: "center",
    },
    {
      id: "node-decision-1",
      type: "decision",
      x: 285,
      y: 300,
      width: 130,
      height: 80,
      label: "INTERLOCK OK?",
      fillColor: "#4f46e5",
      strokeColor: "#3730a3",
      strokeWidth: 2,
      textColor: "#ffffff",
      fontSize: 11,
      textAlign: "center",
    },
    {
      id: "node-process-2",
      type: "process",
      x: 275,
      y: 440,
      width: 150,
      height: 64,
      label: "CYCLE RUNNING",
      fillColor: "#1e293b",
      strokeColor: "#475569",
      strokeWidth: 2,
      textColor: "#ffffff",
      fontSize: 11,
      textAlign: "center",
    },
  ],
  edges: [
    {
      id: "edge-1",
      sourceNodeId: "node-start",
      sourcePort: "bottom",
      targetNodeId: "node-process-1",
      targetPort: "top",
      routing: "orthogonal",
      style: "solid",
      marker: "arrow",
      label: "",
      color: "#64748b",
      strokeWidth: 2,
    },
    {
      id: "edge-2",
      sourceNodeId: "node-process-1",
      sourcePort: "bottom",
      targetNodeId: "node-decision-1",
      targetPort: "top",
      routing: "orthogonal",
      style: "solid",
      marker: "arrow",
      label: "",
      color: "#64748b",
      strokeWidth: 2,
    },
    {
      id: "edge-3",
      sourceNodeId: "node-decision-1",
      sourcePort: "bottom",
      targetNodeId: "node-process-2",
      targetPort: "top",
      routing: "orthogonal",
      style: "solid",
      marker: "arrow",
      label: "Ya",
      color: "#64748b",
      strokeWidth: 2,
    },
    {
      id: "edge-4",
      sourceNodeId: "node-decision-1",
      sourcePort: "right",
      targetNodeId: "node-process-1",
      targetPort: "right",
      routing: "orthogonal",
      style: "dashed",
      marker: "arrow",
      label: "Tidak",
      color: "#64748b",
      strokeWidth: 2,
    },
  ],
  viewport: {
    zoom: 1.0,
    panX: 40,
    panY: 20,
  },
};

/**
 * GET /api/flowchart/diagrams
 * Mendapatkan daftar semua diagram yang tersimpan
 */
export async function GET() {
  try {
    const diagrams = await withDbRetry(async () => {
      return prisma.flowchartDiagram.findMany({
        select: {
          id: true,
          nama: true,
          deskripsi: true,
          authorName: true,
          userId: true,
          nodeCount: true,
          edgeCount: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });
    });

    return NextResponse.json({
      success: true,
      diagrams,
    });
  } catch (error: unknown) {
    console.error("GET /api/flowchart/diagrams error:", error);
    const errMessage = error instanceof Error ? error.message : String(error);
    const isTableMissing =
      errMessage.includes("flowchart_diagrams") ||
      (error as { code?: string })?.code === "P2021";

    return NextResponse.json(
      {
        success: false,
        error: isTableMissing
          ? "Tabel database 'flowchart_diagrams' belum dibuat di Supabase. Silakan jalankan migrasi database."
          : "Gagal memuat daftar diagram dari database Supabase.",
        details: sanitizeDbError(error),
        isTableMissing,
        isRetryable: true,
      },
      { status: isTableMissing ? 503 : 500 }
    );
  }
}

/**
 * POST /api/flowchart/diagrams
 * Membuat diagram baru
 */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = createDiagramInputSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Input diagram tidak valid.",
        },
        { status: 400 }
      );
    }

    const { nama, deskripsi, projectId, initialData } = parsed.data;
    const session = await getSessionUser();

    const diagramData = initialData || DEFAULT_STARTER_DATA;
    const dataJson = serializeDiagramData(diagramData);

    const created = await withDbRetry(async () => {
      return prisma.flowchartDiagram.create({
        data: {
          nama,
          deskripsi: deskripsi || null,
          dataJson,
          userId: session?.id || null,
          authorName: session?.nama || session?.username || "Engineering Team",
          nodeCount: diagramData.nodes.length,
          edgeCount: diagramData.edges.length,
          projectId: projectId || null,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        diagram: created,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/flowchart/diagrams error:", error);
    const errMessage = error instanceof Error ? error.message : String(error);
    const isTableMissing =
      errMessage.includes("flowchart_diagrams") ||
      (error as { code?: string })?.code === "P2021";

    return NextResponse.json(
      {
        success: false,
        error: isTableMissing
          ? "Tabel database 'flowchart_diagrams' belum dibuat di Supabase."
          : "Gagal membuat diagram baru di database Supabase.",
        details: sanitizeDbError(error),
        isTableMissing,
        isRetryable: true,
      },
      { status: isTableMissing ? 503 : 500 }
    );
  }
}
