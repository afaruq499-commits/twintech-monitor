import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { catalogComponentSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = catalogComponentSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Data pembaruan katalog tidak valid.",
        },
        { status: 400 }
      );
    }

    const updated = await prisma.catalogComponent.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error("PATCH /api/catalog/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui komponen katalog." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.catalogComponent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/catalog/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus komponen dari katalog." },
      { status: 500 }
    );
  }
}
