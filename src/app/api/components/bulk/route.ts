import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr } from "@/lib/date-utils";
import { bulkComponentUpdateSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bulkComponentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data bulk update tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const updated = await prisma.component.updateMany({
      where: { id: { in: d.componentIds } },
      data: {
        ...(d.statusPembelian !== undefined
          ? { statusPembelian: d.statusPembelian }
          : {}),
        ...(d.estimasiTiba !== undefined
          ? { estimasiTiba: fromIsoDateStr(d.estimasiTiba) }
          : {}),
        ...(d.kelompok !== undefined ? { kelompok: d.kelompok } : {}),
      },
    });

    return NextResponse.json({ count: updated.count });
  } catch (err) {
    console.error("POST /api/components/bulk error:", err);
    return NextResponse.json(
      { error: "Gagal menjalankan bulk update komponen." },
      { status: 500 }
    );
  }
}
