import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  PR_STATUS_LABELS,
  type ComponentImportStatus,
  type PrStatus,
  type PurchaseStatus,
} from "@/lib/constants";
import { toIsoDateStr } from "@/lib/date-utils";
import { exportComponentsToBuffer } from "@/lib/export/component-exporter";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "Parameter projectId wajib diisi." },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        components: {
          orderBy: [{ urutan: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyek tidak ditemukan." },
        { status: 404 }
      );
    }

    const buffer = await exportComponentsToBuffer(
      {
        kode: project.kode,
        nama: project.nama,
        client: project.client,
        prStatus:
          PR_STATUS_LABELS[project.prStatus as PrStatus] ?? project.prStatus,
      },
      project.components.map((c) => ({
        noPr: c.noPr,
        kelompok: c.kelompok,
        partType: c.partType,
        partName: c.partName,
        supplier: c.supplier,
        qty: c.qty,
        unit: c.unit,
        statusPembelian: c.statusPembelian as PurchaseStatus,
        estimasiTiba: toIsoDateStr(c.estimasiTiba),
        tanggalPakai: toIsoDateStr(c.tanggalPakai),
        hargaSatuan: c.hargaSatuan,
        total: c.total,
        catatanPr: c.catatanPr,
        catatan: c.catatan,
        perluDicek: c.perluDicek,
        statusImport: c.statusImport as ComponentImportStatus,
      }))
    );

    const safeFilename = `Komponen_${(project.kode || project.nama).replace(/[^a-zA-Z0-9_-]+/g, "_")}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
      },
    });
  } catch (err) {
    console.error("GET /api/export/komponen error:", err);
    return NextResponse.json(
      { error: "Gagal mengekspor daftar komponen ke Excel." },
      { status: 500 }
    );
  }
}
