import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr, addDaysIso, todayIsoLocal } from "@/lib/date-utils";
import { getAllScheduledEntries, getAppSettings } from "@/lib/data-queries";
import { checkScheduleConflict } from "@/lib/schedule";
import { pushScheduleWorkItemsToJobdeskPlan } from "@/lib/jobdesk-server";
import type { ScheduleCellStatus, WorkType } from "@/lib/constants";

export const dynamic = "force-dynamic";

const PRIORITY_SCORES: Record<string, number> = {
  TINGGI: 3,
  SEDANG: 2,
  RENDAH: 1,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      workItemId,
      subScopeId,
      newStartDate,
      durationDays = 1,
      status = "TARGET",
      warnaCustom = null,
      mode = "MANUAL", // "MANUAL" | "AUTO_FREE_SLOT" | "BY_PRIORITY"
      allowParallelOverride = false,
    } = body;

    if (!workItemId || !newStartDate) {
      return NextResponse.json(
        { error: "Parameter workItemId dan newStartDate wajib diisi." },
        { status: 400 }
      );
    }

    const duration = Math.max(1, Math.min(60, Number(durationDays) || 1));

    const workItem = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: {
        lane: {
          include: {
            project: true,
          },
        },
        subScopes: true,
        scheduleCells: true,
      },
    });

    if (!workItem) {
      return NextResponse.json(
        { error: "Pekerjaan tidak ditemukan." },
        { status: 404 }
      );
    }

    const [settings, allEntries] = await Promise.all([
      getAppSettings(),
      getAllScheduledEntries(),
    ]);

    const candidate = {
      workItemId: workItem.id,
      judul: workItem.judul,
      jenis: workItem.jenis as WorkType,
      bolehParalel: workItem.bolehParalel,
      projectBolehParalel: workItem.lane.project.bolehParalel,
      projectId: workItem.lane.projectId,
      projectNama: workItem.lane.project.nama,
      laneId: workItem.laneId,
      laneNama: workItem.lane.nama,
    };

    const currentProjectPriority = workItem.lane.project.prioritas || "SEDANG";
    const currentScore = PRIORITY_SCORES[currentProjectPriority] ?? 2;

    let targetDates: string[] = [];
    const startIso = newStartDate || todayIsoLocal();

    if (mode === "AUTO_FREE_SLOT") {
      // Cari rentang tanggal berurutan yang bebas bentrok kapasitas
      let searchDate = startIso;
      let attempts = 0;
      while (attempts < 60) {
        attempts++;
        const testRange = Array.from({ length: duration }, (_, i) =>
          addDaysIso(searchDate, i)
        );
        const hasConflict = testRange.some((dIso) => {
          const res = checkScheduleConflict({
            targetDateIso: dIso,
            candidate,
            allEntries,
            settings,
          });
          return res.blocked;
        });

        if (!hasConflict) {
          targetDates = testRange;
          break;
        }
        searchDate = addDaysIso(searchDate, 1);
      }

      if (targetDates.length === 0) {
        targetDates = Array.from({ length: duration }, (_, i) =>
          addDaysIso(startIso, i)
        );
      }
    } else if (mode === "BY_PRIORITY") {
      // Mode Penyesuaian Berdasarkan Prioritas:
      // Proyek prioritas tinggi (TINGGI) berhak diprioritaskan.
      // Proyek prioritas lebih rendah (SEDANG / RENDAH) akan mencari slot kosong setelahnya agar tidak bentrok.
      let searchDate = startIso;
      let attempts = 0;
      while (attempts < 60) {
        attempts++;
        const testRange = Array.from({ length: duration }, (_, i) =>
          addDaysIso(searchDate, i)
        );

        let blockedByHigher = false;
        for (const dIso of testRange) {
          const res = checkScheduleConflict({
            targetDateIso: dIso,
            candidate,
            allEntries,
            settings,
          });

          if (res.blocked) {
            // Jika proyek kandidat adalah TINGGI, kita izinkan berjalan paralel / mengambil slot
            if (currentScore >= 3) {
              // Prioritas tinggi menang
            } else {
              // Prioritas sedang/rendah harus mengalah dan mencari hari kosong
              blockedByHigher = true;
              break;
            }
          }
        }

        if (!blockedByHigher) {
          targetDates = testRange;
          break;
        }
        searchDate = addDaysIso(searchDate, 1);
      }

      if (targetDates.length === 0) {
        targetDates = Array.from({ length: duration }, (_, i) =>
          addDaysIso(startIso, i)
        );
      }
    } else {
      // MANUAL
      targetDates = Array.from({ length: duration }, (_, i) =>
        addDaysIso(startIso, i)
      );

      if (!allowParallelOverride) {
        for (const dIso of targetDates) {
          const conflict = checkScheduleConflict({
            targetDateIso: dIso,
            candidate,
            allEntries,
            settings,
          });
          if (conflict.blocked) {
            return NextResponse.json(
              {
                blocked: true,
                error: conflict.message,
                conflictDate: dIso,
                suggestions: conflict.suggestions,
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // Eksekusi pemindahan tanggal di database
    await prisma.$transaction(async (tx) => {
      // 1. Hapus sel jadwal lama untuk workItem / subScope yang dipilih
      if (subScopeId) {
        await tx.scheduleCell.deleteMany({
          where: {
            workItemId,
            subScopeId,
          },
        });
      } else {
        await tx.scheduleCell.deleteMany({
          where: {
            workItemId,
          },
        });
      }

      // 2. Buat sel jadwal baru pada rentang tanggal hasil penyesuaian
      for (const dIso of targetDates) {
        await tx.scheduleCell.create({
          data: {
            workItemId,
            subScopeId: subScopeId || null,
            tanggal: fromIsoDateStr(dIso)!,
            status: status as ScheduleCellStatus,
            warnaCustom: warnaCustom || null,
          },
        });
      }
    });

    await pushScheduleWorkItemsToJobdeskPlan([workItemId]).catch(() => {});

    return NextResponse.json({
      ok: true,
      scheduledDates: targetDates,
      message: `Jadwal berhasil disesuaikan ke ${targetDates[0]} s/d ${targetDates[targetDates.length - 1]} (${targetDates.length} hari).`,
    });
  } catch (err: unknown) {
    console.error("POST /api/schedule/reschedule error:", err);
    const msg =
      err instanceof Error
        ? err.message
        : "Gagal menyesuaikan tanggal jadwal.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
