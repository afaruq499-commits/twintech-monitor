import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDaysIso, fromIsoDateStr, isTanggalMerah } from "@/lib/date-utils";
import { laneSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = laneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data lane tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const count = await prisma.lane.count({
      where: { projectId: d.projectId },
    });

    // Generate tanggal hari kerja (lewati akhir pekan) jika customDatesJson belum diatur
    let customDatesJson = d.customDatesJson;
    if (!customDatesJson && d.tanggalMulai) {
      const workDays: string[] = [];
      let cur = d.tanggalMulai;
      let guard = 0;
      while (workDays.length < d.jumlahHari && guard < 180) {
        guard++;
        const merah = isTanggalMerah(cur);
        if (!merah.isWeekend) {
          workDays.push(cur);
        }
        cur = addDaysIso(cur, 1);
      }
      customDatesJson = JSON.stringify(workDays);
    }

    const created = await prisma.lane.create({
      data: {
        projectId: d.projectId,
        urutan: count + 1,
        nama: d.nama,
        subjudul: d.subjudul,
        tanggalMulai: fromIsoDateStr(d.tanggalMulai)!,
        jumlahHari: d.jumlahHari,
        deadline: fromIsoDateStr(d.deadline),
        pic: d.pic || null,
        customDatesJson,
      },
    });
    return NextResponse.json({ lane: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/lanes error:", err);
    return NextResponse.json(
      { error: "Gagal membuat lane baru." },
      { status: 500 }
    );
  }
}
