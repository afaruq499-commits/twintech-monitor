import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cellId = typeof body?.cellId === "string" ? body.cellId : "";
    const action = body?.action === "DISMISS" ? "DISMISS" : "CONFIRM_DELAY";

    if (!cellId) {
      return NextResponse.json(
        { error: "ID sel jadwal tidak ditemukan." },
        { status: 400 }
      );
    }

    if (action === "CONFIRM_DELAY") {
      await prisma.scheduleCell.update({
        where: { id: cellId },
        data: { status: "DELAY", delayDikonfirmasi: true },
      });
    } else {
      await prisma.scheduleCell.update({
        where: { id: cellId },
        data: { delayDikonfirmasi: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/schedule/delay-confirm error:", err);
    return NextResponse.json(
      { error: "Gagal memproses konfirmasi DELAY." },
      { status: 500 }
    );
  }
}
