import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.workTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/templates/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus template." },
      { status: 500 }
    );
  }
}
