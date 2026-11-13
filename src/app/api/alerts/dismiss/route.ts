import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const alertKey = typeof body?.alertKey === "string" ? body.alertKey : "";
    if (!alertKey) {
      return NextResponse.json(
        { error: "alertKey wajib diisi." },
        { status: 400 }
      );
    }

    await prisma.alertDismissal.upsert({
      where: { alertKey },
      update: {},
      create: { alertKey },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/alerts/dismiss error:", err);
    return NextResponse.json(
      { error: "Gagal menandai alert selesai." },
      { status: 500 }
    );
  }
}
