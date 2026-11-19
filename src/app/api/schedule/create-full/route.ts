import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  addDaysIso,
  diffDaysIso,
  fromIsoDateStr,
  todayIsoLocal,
} from "@/lib/date-utils";
import { createFullScheduleSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createFullScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Data pembuatan schedule proyek tidak valid.",
        },
        { status: 400 }
      );
    }

    const d = parsed.data;

    if (d.projectMode === "NEW" && !d.namaProyek?.trim()) {
      return NextResponse.json(
        { error: "Nama proyek wajib diisi." },
        { status: 400 }
      );
    }

    if (d.projectMode === "EXISTING" && !d.existingProjectId) {
      return NextResponse.json(
        { error: "Pilih proyek yang sudah ada terlebih dahulu." },
        { status: 400 }
      );
    }

    // Tanggal acuan dasar lane (gunakan tanggalMulai jika diisi, atau default hari ini)
    const baseStartIso = d.tanggalMulai || todayIsoLocal();

    // Hitung durasi hari lane dari baseStartIso s/d tanggal terjauh (deadline / jadwalSelesai)
    let maxEndIso = baseStartIso;
    if (d.deadline && d.deadline > maxEndIso) {
      maxEndIso = d.deadline;
    }
    for (const p of d.pekerjaanList) {
      if (p.deadline && p.deadline > maxEndIso) maxEndIso = p.deadline;
      if (p.jadwalMulai && p.jadwalMulai > maxEndIso) maxEndIso = p.jadwalMulai;
      if (p.jadwalSelesai && p.jadwalSelesai > maxEndIso) {
        maxEndIso = p.jadwalSelesai;
      }
    }
    const spanDays = Math.max(0, diffDaysIso(baseStartIso, maxEndIso)) + 1;
    const jumlahHari = Math.min(90, Math.max(6, spanDays));

    let projectId = d.existingProjectId ?? "";

    if (d.projectMode === "NEW") {
      const createdProj = await prisma.project.create({
        data: {
          kode: d.kodeProyek?.trim() || null,
          nama: d.namaProyek!.trim(),
          client: d.client?.trim() || "Internal / Client",
          tanggalMulai: d.tanggalMulai ? fromIsoDateStr(d.tanggalMulai) : null,
          deadline: fromIsoDateStr(d.deadline),
          prioritas: d.prioritasProyek,
          tipeProyek: d.tipeProyek,
          status: "PLANNING",
          prStatus: "DRAFT",
          warna: d.warnaProyek,
          pic: d.picUtama || null,
          bolehParalel: d.proyekParalel,
        },
      });
      projectId = createdProj.id;
    } else {
      // Sinkronkan mode paralel / deadline / PIC jika diisi pada proyek existing
      await prisma.project.update({
        where: { id: projectId },
        data: {
          ...(d.proyekParalel ? { bolehParalel: true } : {}),
          ...(d.deadline ? { deadline: fromIsoDateStr(d.deadline) } : {}),
          ...(d.picUtama ? { pic: d.picUtama } : {}),
        },
      });
    }

    const existingLanesCount = await prisma.lane.count({ where: { projectId } });

    // Buat Lane beserta seluruh WorkItem dan SubScopes secara atomik
    const createdLane = await prisma.lane.create({
      data: {
        projectId,
        urutan: existingLanesCount + 1,
        nama: d.judulPengerjaan,
        subjudul: "(Schedule Pengerjaan Proyek)",
        tanggalMulai: fromIsoDateStr(baseStartIso)!,
        jumlahHari,
        deadline: fromIsoDateStr(d.deadline),
        pic: d.picUtama || null,
        workItems: {
          create: d.pekerjaanList.map((p, idx) => {
            // Bangun daftar sel tanggal jadwal hanya jika jadwalMulai diisi oleh user
            const cellDates: string[] = [];
            if (p.jadwalMulai) {
              const endIso =
                p.jadwalSelesai && p.jadwalSelesai >= p.jadwalMulai
                  ? p.jadwalSelesai
                  : p.jadwalMulai;
              const totalDays = Math.min(60, diffDaysIso(p.jadwalMulai, endIso));
              for (let offset = 0; offset <= totalDays; offset++) {
                cellDates.push(addDaysIso(p.jadwalMulai, offset));
              }
            }

            return {
              urutan: idx + 1,
              judul: p.judul,
              jenis: p.jenis,
              pic: p.pic || d.picUtama || null,
              deadline: fromIsoDateStr(p.deadline || d.deadline),
              bolehParalel: p.bolehParalel || d.proyekParalel,
              subScopes: {
                create: p.subPekerjaan.map((sp, spIdx) => ({
                  urutan: spIdx + 1,
                  judul: sp.judul,
                  details: {
                    create: sp.details.map((teks, detIdx) => ({
                      urutan: detIdx + 1,
                      teks,
                    })),
                  },
                })),
              },
              ...(cellDates.length > 0
                ? {
                    scheduleCells: {
                      create: cellDates.map((dtIso, cIdx) => ({
                        tanggal: fromIsoDateStr(dtIso)!,
                        status: p.statusJadwal,
                        warnaCustom: p.warnaKolom || null,
                        catatan:
                          cIdx === 0 && p.komentarAwal?.trim()
                            ? p.komentarAwal.trim()
                            : null,
                      })),
                    },
                  }
                : {}),
            };
          }),
        },
      },
    });

    return NextResponse.json(
      { ok: true, projectId, laneId: createdLane.id },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST /api/schedule/create-full error:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
        ? err
        : "Gagal membuat schedule proyek.";
    return NextResponse.json(
      { error: `Gagal membuat schedule: ${message}` },
      { status: 500 }
    );
  }
}
