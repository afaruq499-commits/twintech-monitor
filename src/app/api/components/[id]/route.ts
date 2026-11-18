import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr } from "@/lib/date-utils";
import { syncAutoPanelLayoutForProject } from "@/lib/panel-layout-sync";
import { componentUpdateSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = componentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const existing = await prisma.component.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Komponen tidak ditemukan." },
        { status: 404 }
      );
    }

    const nextQty = d.qty ?? existing.qty;
    const nextHarga =
      d.hargaSatuan !== undefined ? d.hargaSatuan : existing.hargaSatuan;
    const nextTotal =
      nextHarga !== null && nextHarga !== undefined
        ? nextHarga * nextQty
        : null;

    const updated = await prisma.component.update({
      where: { id },
      data: {
        ...(d.kelompok !== undefined ? { kelompok: d.kelompok } : {}),
        ...(d.partType !== undefined ? { partType: d.partType } : {}),
        ...(d.partName !== undefined ? { partName: d.partName } : {}),
        ...(d.supplier !== undefined ? { supplier: d.supplier || null } : {}),
        ...(d.qty !== undefined ? { qty: d.qty } : {}),
        ...(d.unit !== undefined ? { unit: d.unit || null } : {}),
        ...(d.hargaSatuan !== undefined
          ? { hargaSatuan: d.hargaSatuan, total: nextTotal }
          : d.qty !== undefined
            ? { total: nextTotal }
            : {}),
        ...(d.statusPembelian !== undefined
          ? { statusPembelian: d.statusPembelian }
          : {}),
        ...(d.estimasiTiba !== undefined
          ? { estimasiTiba: fromIsoDateStr(d.estimasiTiba) }
          : {}),
        ...(d.tanggalPakai !== undefined
          ? { tanggalPakai: fromIsoDateStr(d.tanggalPakai) }
          : {}),
        ...(d.perluDicek !== undefined ? { perluDicek: d.perluDicek } : {}),
        ...(d.statusImport !== undefined ? { statusImport: d.statusImport } : {}),
        ...(d.catatanPr !== undefined ? { catatanPr: d.catatanPr || null } : {}),
        ...(d.catatan !== undefined ? { catatan: d.catatan || null } : {}),
      },
    });

    if (
      d.partType !== undefined ||
      d.partName !== undefined ||
      d.qty !== undefined ||
      d.kelompok !== undefined ||
      d.statusImport !== undefined
    ) {
      await syncAutoPanelLayoutForProject(prisma, existing.projectId);
    }

    return NextResponse.json({ component: updated });
  } catch (err) {
    console.error("PATCH /api/components/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui komponen." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const existing = await prisma.component.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Komponen tidak ditemukan." },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.workItemComponent.deleteMany({ where: { componentId: id } });
      await tx.component.delete({ where: { id } });
      await syncAutoPanelLayoutForProject(tx, existing.projectId);
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/components/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus komponen." },
      { status: 500 }
    );
  }
}
