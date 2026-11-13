import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settingSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = settingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Pengaturan tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const updated = await prisma.setting.upsert({
      where: { id: "default" },
      update: {
        kapasitasPerHari: d.kapasitasPerHari,
        jenisDikecualikan: JSON.stringify(d.jenisDikecualikan),
        namaPerusahaan: d.namaPerusahaan,
        alamatPerusahaan: d.alamatPerusahaan,
        telpPerusahaan: d.telpPerusahaan,
        faxPerusahaan: d.faxPerusahaan,
        ...(d.logoBase64 !== undefined ? { logoBase64: d.logoBase64 } : {}),
      },
      create: {
        id: "default",
        kapasitasPerHari: d.kapasitasPerHari,
        jenisDikecualikan: JSON.stringify(d.jenisDikecualikan),
        namaPerusahaan: d.namaPerusahaan,
        alamatPerusahaan: d.alamatPerusahaan,
        telpPerusahaan: d.telpPerusahaan,
        faxPerusahaan: d.faxPerusahaan,
        logoBase64: d.logoBase64 ?? null,
      },
    });

    return NextResponse.json({ setting: updated });
  } catch (err) {
    console.error("POST /api/settings error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan pengaturan." },
      { status: 500 }
    );
  }
}
