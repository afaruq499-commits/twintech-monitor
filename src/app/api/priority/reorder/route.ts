import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body?.reset === true) {
      await prisma.project.updateMany({
        data: { urutanManual: null },
      });
      return NextResponse.json({ ok: true, reset: true });
    }

    const orderedIds: string[] = Array.isArray(body?.orderedIds)
      ? body.orderedIds
      : [];
    if (orderedIds.length === 0) {
      return NextResponse.json(
        { error: "Daftar urutan proyek kosong." },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      orderedIds.map((id, idx) =>
        prisma.project.update({
          where: { id },
          data: { urutanManual: idx + 1 },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/priority/reorder error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan urutan prioritas manual." },
      { status: 500 }
    );
  }
}
