import { NextResponse } from "next/server";
import { prisma, withDbRetry, sanitizeDbError } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  updateDiagramInputSchema,
  renameDiagramInputSchema,
  serializeDiagramData,
  deserializeDiagramData,
} from "@/lib/flowchart-schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/flowchart/diagrams/[id]
 * Mengambil satu diagram lengkap beserta nodes, edges, dan viewport
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const diagram = await withDbRetry(async () => {
      return prisma.flowchartDiagram.findUnique({
        where: { id },
      });
    });

    if (!diagram) {
      return NextResponse.json(
        { success: false, error: "Diagram tidak ditemukan." },
        { status: 404 }
      );
    }

    const parsedData = deserializeDiagramData(diagram.dataJson);

    return NextResponse.json({
      success: true,
      diagram: {
        id: diagram.id,
        nama: diagram.nama,
        deskripsi: diagram.deskripsi,
        authorName: diagram.authorName,
        userId: diagram.userId,
        projectId: diagram.projectId,
        nodeCount: diagram.nodeCount,
        edgeCount: diagram.edgeCount,
        createdAt: diagram.createdAt,
        updatedAt: diagram.updatedAt,
        data: parsedData,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/flowchart/diagrams/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data diagram dari database Supabase.",
        details: sanitizeDbError(error),
        isRetryable: true,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/flowchart/diagrams/[id]
 * Menyimpan pembaruan diagram (auto-save atau update data/nama)
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const json = await request.json();

    const parsed = updateDiagramInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Payload simpan diagram tidak valid.",
        },
        { status: 400 }
      );
    }

    const { nama, deskripsi, nodes, edges, viewport } = parsed.data;

    // Ambil diagram eksisting untuk merge data jika parsial
    const existing = await withDbRetry(async () => {
      return prisma.flowchartDiagram.findUnique({
        where: { id },
      });
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Diagram tidak ditemukan." },
        { status: 404 }
      );
    }

    const currentData = deserializeDiagramData(existing.dataJson);

    const mergedData = {
      nodes: nodes !== undefined ? nodes : currentData.nodes,
      edges: edges !== undefined ? edges : currentData.edges,
      viewport: viewport !== undefined ? viewport : currentData.viewport,
    };

    const newDataJson = serializeDiagramData(mergedData);

    const updated = await withDbRetry(async () => {
      return prisma.flowchartDiagram.update({
        where: { id },
        data: {
          ...(nama ? { nama } : {}),
          ...(deskripsi !== undefined ? { deskripsi } : {}),
          dataJson: newDataJson,
          nodeCount: mergedData.nodes.length,
          edgeCount: mergedData.edges.length,
        },
      });
    });

    return NextResponse.json({
      success: true,
      diagram: {
        id: updated.id,
        nama: updated.nama,
        deskripsi: updated.deskripsi,
        nodeCount: updated.nodeCount,
        edgeCount: updated.edgeCount,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error("PUT /api/flowchart/diagrams/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menyimpan diagram ke database Supabase.",
        details: sanitizeDbError(error),
        isRetryable: true,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/flowchart/diagrams/[id]
 * Menghapus diagram dari database
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    await withDbRetry(async () => {
      return prisma.flowchartDiagram.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Diagram berhasil dihapus.",
    });
  } catch (error: unknown) {
    console.error("DELETE /api/flowchart/diagrams/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menghapus diagram dari database Supabase.",
        details: sanitizeDbError(error),
        isRetryable: true,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flowchart/diagrams/[id]
 * Duplikasi diagram yang sudah ada
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Cek apakah ada request rename spesifik
    if (body?.action === "rename") {
      const parsedRename = renameDiagramInputSchema.safeParse(body);
      if (!parsedRename.success) {
        return NextResponse.json(
          { success: false, error: parsedRename.error.issues[0]?.message },
          { status: 400 }
        );
      }

      const renamed = await withDbRetry(async () => {
        return prisma.flowchartDiagram.update({
          where: { id },
          data: { nama: parsedRename.data.nama },
        });
      });

      return NextResponse.json({ success: true, diagram: renamed });
    }

    // Default POST: Duplikat diagram
    const source = await withDbRetry(async () => {
      return prisma.flowchartDiagram.findUnique({
        where: { id },
      });
    });

    if (!source) {
      return NextResponse.json(
        { success: false, error: "Diagram sumber tidak ditemukan." },
        { status: 404 }
      );
    }

    const session = await getSessionUser();
    const clonedName = body?.nama || `${source.nama} (Salinan)`;

    const duplicated = await withDbRetry(async () => {
      return prisma.flowchartDiagram.create({
        data: {
          nama: clonedName,
          deskripsi: source.deskripsi,
          dataJson: source.dataJson,
          userId: session?.id || source.userId,
          authorName: session?.nama || session?.username || source.authorName,
          nodeCount: source.nodeCount,
          edgeCount: source.edgeCount,
          projectId: source.projectId,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        diagram: duplicated,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/flowchart/diagrams/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menduplikat diagram di database Supabase.",
        details: sanitizeDbError(error),
        isRetryable: true,
      },
      { status: 500 }
    );
  }
}
