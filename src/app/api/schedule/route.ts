import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type {
  ComponentImportStatus,
  PurchaseStatus,
  WorkType,
} from "@/lib/constants";
import { fromIsoDateStr, toIsoDateStr } from "@/lib/date-utils";
import { getAllScheduledEntries, getAppSettings } from "@/lib/data-queries";
import {
  checkComponentReadinessWarning,
  checkScheduleConflict,
} from "@/lib/schedule";
import { scheduleCellUpsertSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = scheduleCellUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data jadwal tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const workItem = await prisma.workItem.findUnique({
      where: { id: d.workItemId },
      include: {
        components: true,
        scheduleCells: true,
        lane: {
          include: {
            project: {
              include: {
                components: true,
              },
            },
          },
        },
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

    // 1. Validasi Konflik Tanggal lintas SEMUA proyek & lane
    const conflict = checkScheduleConflict({
      targetDateIso: d.tanggal,
      moveFromDateIso: d.moveFromTanggal ?? undefined,
      candidate: {
        workItemId: workItem.id,
        judul: workItem.judul,
        jenis: workItem.jenis as WorkType,
        bolehParalel: workItem.bolehParalel,
        projectBolehParalel: workItem.lane.project.bolehParalel,
        projectId: workItem.lane.projectId,
        projectNama: workItem.lane.project.nama,
        laneId: workItem.laneId,
        laneNama: workItem.lane.nama,
      },
      allEntries,
      settings,
    });

    if (conflict.blocked && !d.allowParallelOverride) {
      return NextResponse.json(
        {
          blocked: true,
          error: conflict.message,
          conflict,
        },
        { status: 409 }
      );
    }

    // 2. Cek Warning Komponen Belum Lengkap (untuk Wiring / Instalasi di Site)
    const alreadyScheduledOnTarget = workItem.scheduleCells.some(
      (sc) => toIsoDateStr(sc.tanggal) === d.tanggal
    );

    const warning = checkComponentReadinessWarning({
      jenis: workItem.jenis as WorkType,
      linkedComponentIds: workItem.components.map((wc) => wc.componentId),
      projectComponents: workItem.lane.project.components.map((c) => ({
        id: c.id,
        kelompok: c.kelompok,
        partType: c.partType,
        partName: c.partName,
        qty: c.qty,
        unit: c.unit,
        statusPembelian: c.statusPembelian as PurchaseStatus,
        estimasiTiba: toIsoDateStr(c.estimasiTiba),
        statusImport: c.statusImport as ComponentImportStatus,
      })),
    });

    if (
      warning.hasWarning &&
      !alreadyScheduledOnTarget &&
      !d.acknowledgeComponentWarning
    ) {
      return NextResponse.json({
        requiresWarningConfirm: true,
        warning,
      });
    }

    const targetDate = fromIsoDateStr(d.tanggal)!;

    const saved = await prisma.$transaction(async (tx) => {
      if (d.moveFromTanggal && d.moveFromTanggal !== d.tanggal) {
        const oldDate = fromIsoDateStr(d.moveFromTanggal)!;
        await tx.scheduleCell.deleteMany({
          where: {
            workItemId: d.workItemId,
            subScopeId: d.subScopeId ?? null,
            ...(d.taskDetailId ? { taskDetailId: d.taskDetailId } : {}),
            tanggal: oldDate,
          },
        });
      }

      // Mode SHIFT + KLIK (Mengubah seluruh point / sub-scope sekaligus)
      if (d.isShiftClick || !d.taskDetailId) {
        // Hapus sel workItem-level lama jika ada dan operasi ini menargetkan sub-scope / detail tertentu
        if (d.subScopeId) {
          await tx.scheduleCell.deleteMany({
            where: {
              workItemId: d.workItemId,
              subScopeId: null,
              taskDetailId: null,
              tanggal: targetDate,
            },
          });
          await tx.scheduleCell.deleteMany({
            where: {
              workItemId: d.workItemId,
              subScopeId: d.subScopeId,
              tanggal: targetDate,
            },
          });
        } else {
          // Jika penjadwalan langsung level workItem (misal dari Jadwal & Kalender), bersihkan sel lama pada tanggal ini
          await tx.scheduleCell.deleteMany({
            where: {
              workItemId: d.workItemId,
              tanggal: targetDate,
            },
          });
        }

        const existing = await tx.scheduleCell.findFirst({
          where: {
            workItemId: d.workItemId,
            subScopeId: d.subScopeId ?? null,
            taskDetailId: null,
            tanggal: targetDate,
          },
        });

        if (existing) {
          return tx.scheduleCell.update({
            where: { id: existing.id },
            data: {
              status: d.status,
              ...(d.warnaCustom !== undefined
                ? { warnaCustom: d.warnaCustom }
                : {}),
              ...(d.catatan !== undefined ? { catatan: d.catatan || null } : {}),
              ...(d.status === "DELAY" || d.status === "DONE"
                ? { delayDikonfirmasi: true }
                : {}),
            },
          });
        }

        return tx.scheduleCell.create({
          data: {
            workItemId: d.workItemId,
            subScopeId: d.subScopeId ?? null,
            taskDetailId: null,
            tanggal: targetDate,
            status: d.status,
            warnaCustom: d.warnaCustom ?? null,
            catatan: d.catatan || null,
            delayDikonfirmasi: d.status === "DELAY" || d.status === "DONE",
          },
        });
      }

      // Mode KLIK BIASA (Hanya mengubah sub point tertentu det.id)
      // Cek apakah ada sel level workItem (subScopeId: null && taskDetailId: null) yang menaungi
      const workItemLevelCell = await tx.scheduleCell.findFirst({
        where: {
          workItemId: d.workItemId,
          subScopeId: null,
          taskDetailId: null,
          tanggal: targetDate,
        },
      });

      if (
        workItemLevelCell &&
        Array.isArray(d.allDetailIds) &&
        d.allDetailIds.length > 0
      ) {
        await tx.scheduleCell.delete({ where: { id: workItemLevelCell.id } });
        for (const detId of d.allDetailIds) {
          if (detId !== d.taskDetailId) {
            await tx.scheduleCell.create({
              data: {
                workItemId: d.workItemId,
                subScopeId: d.subScopeId || null,
                taskDetailId: detId,
                tanggal: targetDate,
                status: workItemLevelCell.status,
                warnaCustom: workItemLevelCell.warnaCustom,
                catatan: workItemLevelCell.catatan,
                delayDikonfirmasi: workItemLevelCell.delayDikonfirmasi,
              },
            });
          }
        }
      }

      const sharedSubScopeCell = d.subScopeId
        ? await tx.scheduleCell.findFirst({
            where: {
              workItemId: d.workItemId,
              subScopeId: d.subScopeId,
              taskDetailId: null,
              tanggal: targetDate,
            },
          })
        : null;

      if (
        sharedSubScopeCell &&
        Array.isArray(d.allDetailIds) &&
        d.allDetailIds.length > 0
      ) {
        await tx.scheduleCell.delete({ where: { id: sharedSubScopeCell.id } });
        for (const detId of d.allDetailIds) {
          if (detId !== d.taskDetailId) {
            await tx.scheduleCell.create({
              data: {
                workItemId: d.workItemId,
                subScopeId: d.subScopeId,
                taskDetailId: detId,
                tanggal: targetDate,
                status: sharedSubScopeCell.status,
                warnaCustom: sharedSubScopeCell.warnaCustom,
                catatan: sharedSubScopeCell.catatan,
                delayDikonfirmasi: sharedSubScopeCell.delayDikonfirmasi,
              },
            });
          }
        }
      }

      const existingDetailCell = await tx.scheduleCell.findFirst({
        where: {
          workItemId: d.workItemId,
          taskDetailId: d.taskDetailId,
          tanggal: targetDate,
        },
      });

      if (existingDetailCell) {
        return tx.scheduleCell.update({
          where: { id: existingDetailCell.id },
          data: {
            status: d.status,
            ...(d.warnaCustom !== undefined
              ? { warnaCustom: d.warnaCustom }
              : {}),
            ...(d.catatan !== undefined ? { catatan: d.catatan || null } : {}),
            ...(d.status === "DELAY" || d.status === "DONE"
              ? { delayDikonfirmasi: true }
              : {}),
          },
        });
      }

      return tx.scheduleCell.create({
        data: {
          workItemId: d.workItemId,
          subScopeId: d.subScopeId ?? null,
          taskDetailId: d.taskDetailId,
          tanggal: targetDate,
          status: d.status,
          warnaCustom: d.warnaCustom ?? null,
          catatan: d.catatan || null,
          delayDikonfirmasi: d.status === "DELAY" || d.status === "DONE",
        },
      });
    });

    return NextResponse.json({
      ok: true,
      cell: {
        id: saved.id,
        workItemId: saved.workItemId,
        subScopeId: saved.subScopeId,
        taskDetailId: saved.taskDetailId,
        tanggal: toIsoDateStr(saved.tanggal)!,
        status: saved.status,
        warnaCustom: saved.warnaCustom,
        catatan: saved.catatan,
      },
      warning: warning.hasWarning ? warning : null,
    });
  } catch (err) {
    console.error("POST /api/schedule error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan sel jadwal." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workItemId = searchParams.get("workItemId");
    const subScopeId = searchParams.get("subScopeId");
    const taskDetailId = searchParams.get("taskDetailId");
    const allDetailIdsRaw = searchParams.get("allDetailIds");
    const isShiftClick = searchParams.get("isShiftClick") === "true";
    const tanggal = searchParams.get("tanggal");
    const cellId = searchParams.get("cellId");

    if (cellId) {
      await prisma.scheduleCell.delete({ where: { id: cellId } });
      return NextResponse.json({ ok: true });
    }

    if (!workItemId || !tanggal) {
      return NextResponse.json(
        { error: "Parameter workItemId dan tanggal wajib diisi." },
        { status: 400 }
      );
    }

    const targetDate = fromIsoDateStr(tanggal)!;

    await prisma.$transaction(async (tx) => {
      // 1. Cek apakah ada sel level workItem (subScopeId: null & taskDetailId: null)
      // Sel seperti ini dibuat saat user menjadwalkan pekerjaan langsung dari menu Jadwal & Kalender
      const workItemLevelCell = await tx.scheduleCell.findFirst({
        where: {
          workItemId,
          subScopeId: null,
          taskDetailId: null,
          tanggal: targetDate,
        },
      });

      // Jika Shift Click atau tanpa taskDetailId: Hapus seluruh sel subScope / workItem pada tanggal ini
      if (isShiftClick || !taskDetailId) {
        await tx.scheduleCell.deleteMany({
          where: {
            workItemId,
            ...(subScopeId ? { subScopeId } : {}),
            tanggal: targetDate,
          },
        });
        if (workItemLevelCell) {
          await tx.scheduleCell.delete({ where: { id: workItemLevelCell.id } });
        }
        return;
      }

      // Mode Klik Biasa (1 sub-point):
      // A. Jika ada workItemLevelCell yang menaungi sel ini:
      if (workItemLevelCell) {
        await tx.scheduleCell.delete({ where: { id: workItemLevelCell.id } });
        // Jika ada detail lain pada grup ini, jadikan detail lainnya sel tersendiri
        if (allDetailIdsRaw) {
          let allDetailIds: string[] = [];
          try {
            allDetailIds = JSON.parse(allDetailIdsRaw);
          } catch {
            allDetailIds = allDetailIdsRaw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
          for (const detId of allDetailIds) {
            if (detId !== taskDetailId) {
              await tx.scheduleCell.create({
                data: {
                  workItemId,
                  subScopeId: subScopeId || null,
                  taskDetailId: detId,
                  tanggal: targetDate,
                  status: workItemLevelCell.status,
                  warnaCustom: workItemLevelCell.warnaCustom,
                  catatan: workItemLevelCell.catatan,
                  delayDikonfirmasi: workItemLevelCell.delayDikonfirmasi,
                },
              });
            }
          }
        }
      }

      // B. Jika ada shared cell level subScope, expand sisa detail lainnya
      if (subScopeId && allDetailIdsRaw) {
        let allDetailIds: string[] = [];
        try {
          allDetailIds = JSON.parse(allDetailIdsRaw);
        } catch {
          allDetailIds = allDetailIdsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        if (Array.isArray(allDetailIds) && allDetailIds.length > 0) {
          const shared = await tx.scheduleCell.findFirst({
            where: {
              workItemId,
              subScopeId,
              taskDetailId: null,
              tanggal: targetDate,
            },
          });
          if (shared) {
            await tx.scheduleCell.delete({ where: { id: shared.id } });
            for (const detId of allDetailIds) {
              if (detId !== taskDetailId) {
                await tx.scheduleCell.create({
                  data: {
                    workItemId,
                    subScopeId,
                    taskDetailId: detId,
                    tanggal: targetDate,
                    status: shared.status,
                    warnaCustom: shared.warnaCustom,
                    catatan: shared.catatan,
                    delayDikonfirmasi: shared.delayDikonfirmasi,
                  },
                });
              }
            }
          }
        }
      }

      // Hapus sel untuk taskDetailId spesifik
      await tx.scheduleCell.deleteMany({
        where: {
          workItemId,
          taskDetailId,
          tanggal: targetDate,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/schedule error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus jadwal." },
      { status: 500 }
    );
  }
}
