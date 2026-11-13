import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr } from "@/lib/date-utils";
import { syncAutoPanelLayoutForProject } from "@/lib/panel-layout-sync";
import { componentCreateSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = componentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data komponen tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const count = await prisma.component.count({
      where: { projectId: d.projectId },
    });
    const total =
      d.hargaSatuan !== null && d.hargaSatuan !== undefined
        ? d.hargaSatuan * d.qty
        : null;

    const created = await prisma.component.create({
      data: {
        projectId: d.projectId,
        urutan: count + 1,
        kelompok: d.kelompok,
        noPr: d.noPr || null,
        partType: d.partType,
        partName: d.partName,
        supplier: d.supplier || null,
        qty: d.qty,
        unit: d.unit || "pcs",
        hargaSatuan: d.hargaSatuan ?? null,
        total,
        statusPembelian: d.statusPembelian,
        estimasiTiba: fromIsoDateStr(d.estimasiTiba),
        catatanPr: d.catatanPr || null,
        catatan: d.catatan || null,
      },
    });
    await syncAutoPanelLayoutForProject(prisma, d.projectId);
    return NextResponse.json({ component: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/components error:", err);
    return NextResponse.json(
      { error: "Gagal menambah komponen." },
      { status: 500 }
    );
  }
}
