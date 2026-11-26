import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  addDaysIso,
  diffDaysIso,
  fromIsoDateStr,
  isTanggalMerah,
  todayIsoLocal,
} from "@/lib/date-utils";
import { createFullScheduleSchema } from "@/lib/validation/schemas";
import { pushLaneWorkItemsToJobdeskPlan } from "@/lib/jobdesk-server";

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

    // Kumpulkan tanggal yang diisi jadwal pekerjaan oleh user
    const scheduledDatesSet = new Set<string>();
    for (const p of d.pekerjaanList) {
      if (p.jadwalMulai) {
        const endIso =
          p.jadwalSelesai && p.jadwalSelesai >= p.jadwalMulai
            ? p.jadwalSelesai
            : p.jadwalMulai;
        const totalDays = Math.min(60, diffDaysIso(p.jadwalMulai, endIso));
        for (let offset = 0; offset <= totalDays; offset++) {
          scheduledDatesSet.add(addDaysIso(p.jadwalMulai, offset));
        }
      }
    }

    // Bangun rentang tanggal untuk lane:
    // Jika user sudah menentukan tanggal pengerjaan, gunakan HANYA tanggal-tanggal tersebut (tanpa kolom kosong)
    let laneDates: string[] = [];
    if (scheduledDatesSet.size > 0) {
      laneDates = Array.from(scheduledDatesSet).sort();
    } else {
      // Fallback jika belum ada tanggal pekerjaan spesifik:
      // Buat rentang kerja (Senin - Jumat) dari baseStartIso s/d maxEndIso
      let curIso = baseStartIso;
      let guard = 0;
      while (curIso <= maxEndIso && guard < 180) {
        guard++;
        const merah = isTanggalMerah(curIso);
        if (!merah.isWeekend) {
          laneDates.push(curIso);
        }
        curIso = addDaysIso(curIso, 1);
      }
      // Pastikan minimal ada 6 hari pengerjaan
      while (laneDates.length < 6 && guard < 180) {
        guard++;
        const merah = isTanggalMerah(curIso);
        if (!merah.isWeekend) {
          laneDates.push(curIso);
        }
        curIso = addDaysIso(curIso, 1);
      }
    }
    const jumlahHari = Math.min(90, Math.max(1, laneDates.length));
    const customDatesJson = JSON.stringify(laneDates.slice(0, jumlahHari));

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
        tanggalMulai: fromIsoDateStr(laneDates[0] || baseStartIso)!,
        jumlahHari,
        deadline: fromIsoDateStr(d.deadline),
        pic: d.picUtama || null,
        customDatesJson,
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

    await pushLaneWorkItemsToJobdeskPlan(createdLane.id).catch(() => {});

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
