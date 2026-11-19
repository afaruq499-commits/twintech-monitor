import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr } from "@/lib/date-utils";
import type { ScheduleCellStatus } from "@/lib/constants";

export interface ScheduleBatchChangeItem {
  action: "UPSERT" | "DELETE";
  workItemId: string;
  tanggal: string; // YYYY-MM-DD
  status?: ScheduleCellStatus;
  warnaCustom?: string | null;
  catatan?: string | null;
  subScopeId?: string | null;
  taskDetailId?: string | null;
  allDetailIds?: string[] | null;
  isShiftClick?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const changes: ScheduleBatchChangeItem[] = body.changes;

    if (!Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json(
        { error: "Daftar perubahan sel tidak boleh kosong." },
        { status: 400 }
      );
    }

    // Eksekusi semua perubahan dalam 1 transaksi Prisma
    await prisma.$transaction(async (tx) => {
      for (const item of changes) {
        const targetDate = fromIsoDateStr(item.tanggal);
        if (!targetDate) continue;

        if (item.action === "DELETE") {
          // ========================== ACTION: DELETE ==========================
          if (item.isShiftClick || !item.taskDetailId) {
            if (item.subScopeId) {
              await tx.scheduleCell.deleteMany({
                where: {
                  workItemId: item.workItemId,
                  subScopeId: item.subScopeId,
                  tanggal: targetDate,
                },
              });
            } else {
              await tx.scheduleCell.deleteMany({
                where: {
                  workItemId: item.workItemId,
                  tanggal: targetDate,
                },
              });
            }
          } else {
            // Hapus taskDetailId spesifik
            // Cek apakah ada shared cell level workItem
            const workItemLevel = await tx.scheduleCell.findFirst({
              where: {
                workItemId: item.workItemId,
                subScopeId: null,
                taskDetailId: null,
                tanggal: targetDate,
              },
            });

            if (workItemLevel && Array.isArray(item.allDetailIds) && item.allDetailIds.length > 0) {
              await tx.scheduleCell.delete({ where: { id: workItemLevel.id } });
              for (const detId of item.allDetailIds) {
                if (detId !== item.taskDetailId) {
                  await tx.scheduleCell.create({
                    data: {
                      workItemId: item.workItemId,
                      subScopeId: item.subScopeId || null,
                      taskDetailId: detId,
                      tanggal: targetDate,
                      status: workItemLevel.status,
                      warnaCustom: workItemLevel.warnaCustom,
                      catatan: workItemLevel.catatan,
                      delayDikonfirmasi: workItemLevel.delayDikonfirmasi,
                    },
                  });
                }
              }
            }

            // Cek apakah ada shared cell level subScope
            if (item.subScopeId && Array.isArray(item.allDetailIds) && item.allDetailIds.length > 0) {
              const shared = await tx.scheduleCell.findFirst({
                where: {
                  workItemId: item.workItemId,
                  subScopeId: item.subScopeId,
                  taskDetailId: null,
                  tanggal: targetDate,
                },
              });
              if (shared) {
                await tx.scheduleCell.delete({ where: { id: shared.id } });
                for (const detId of item.allDetailIds) {
                  if (detId !== item.taskDetailId) {
                    await tx.scheduleCell.create({
                      data: {
                        workItemId: item.workItemId,
                        subScopeId: item.subScopeId,
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

            // Hapus sel untuk taskDetailId spesifik
            await tx.scheduleCell.deleteMany({
              where: {
                workItemId: item.workItemId,
                taskDetailId: item.taskDetailId,
                tanggal: targetDate,
              },
            });
          }
        } else if (item.action === "UPSERT" && item.status) {
          // ========================== ACTION: UPSERT ==========================
          if (item.isShiftClick || !item.taskDetailId) {
            // Mode SHIFT + KLIK (Grup Sub-Pekerjaan)
            if (item.subScopeId) {
              await tx.scheduleCell.deleteMany({
                where: {
                  workItemId: item.workItemId,
                  subScopeId: null,
                  taskDetailId: null,
                  tanggal: targetDate,
                },
              });
              await tx.scheduleCell.deleteMany({
                where: {
                  workItemId: item.workItemId,
                  subScopeId: item.subScopeId,
                  tanggal: targetDate,
                },
              });
            } else {
              await tx.scheduleCell.deleteMany({
                where: {
                  workItemId: item.workItemId,
                  tanggal: targetDate,
                },
              });
            }

            const existing = await tx.scheduleCell.findFirst({
              where: {
                workItemId: item.workItemId,
                subScopeId: item.subScopeId ?? null,
                taskDetailId: null,
                tanggal: targetDate,
              },
            });

            if (existing) {
              await tx.scheduleCell.update({
                where: { id: existing.id },
                data: {
                  status: item.status,
                  ...(item.warnaCustom !== undefined ? { warnaCustom: item.warnaCustom } : {}),
                  ...(item.catatan !== undefined ? { catatan: item.catatan || null } : {}),
                  ...(item.status === "DELAY" || item.status === "DONE"
                    ? { delayDikonfirmasi: true }
                    : {}),
                },
              });
            } else {
              await tx.scheduleCell.create({
                data: {
                  workItemId: item.workItemId,
                  subScopeId: item.subScopeId ?? null,
                  taskDetailId: null,
                  tanggal: targetDate,
                  status: item.status,
                  warnaCustom: item.warnaCustom ?? null,
                  catatan: item.catatan || null,
                  delayDikonfirmasi: item.status === "DELAY" || item.status === "DONE",
                },
              });
            }
          } else {
            // Mode KLIK BIASA (Sub-Point Rincian det.id)
            const workItemLevelCell = await tx.scheduleCell.findFirst({
              where: {
                workItemId: item.workItemId,
                subScopeId: null,
                taskDetailId: null,
                tanggal: targetDate,
              },
            });

            if (workItemLevelCell && Array.isArray(item.allDetailIds) && item.allDetailIds.length > 0) {
              await tx.scheduleCell.delete({ where: { id: workItemLevelCell.id } });
              for (const detId of item.allDetailIds) {
                if (detId !== item.taskDetailId) {
                  await tx.scheduleCell.create({
                    data: {
                      workItemId: item.workItemId,
                      subScopeId: item.subScopeId || null,
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

            const sharedSubScopeCell = item.subScopeId
              ? await tx.scheduleCell.findFirst({
                  where: {
                    workItemId: item.workItemId,
                    subScopeId: item.subScopeId,
                    taskDetailId: null,
                    tanggal: targetDate,
                  },
                })
              : null;

            if (sharedSubScopeCell && Array.isArray(item.allDetailIds) && item.allDetailIds.length > 0) {
              await tx.scheduleCell.delete({ where: { id: sharedSubScopeCell.id } });
              for (const detId of item.allDetailIds) {
                if (detId !== item.taskDetailId) {
                  await tx.scheduleCell.create({
                    data: {
                      workItemId: item.workItemId,
                      subScopeId: item.subScopeId,
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

            const existing = await tx.scheduleCell.findFirst({
              where: {
                workItemId: item.workItemId,
                subScopeId: item.subScopeId ?? null,
                taskDetailId: item.taskDetailId ?? null,
                tanggal: targetDate,
              },
            });

            if (existing) {
              await tx.scheduleCell.update({
                where: { id: existing.id },
                data: {
                  status: item.status,
                  ...(item.warnaCustom !== undefined ? { warnaCustom: item.warnaCustom } : {}),
                  ...(item.catatan !== undefined ? { catatan: item.catatan || null } : {}),
                  ...(item.status === "DELAY" || item.status === "DONE"
                    ? { delayDikonfirmasi: true }
                    : {}),
                },
              });
            } else {
              await tx.scheduleCell.create({
                data: {
                  workItemId: item.workItemId,
                  subScopeId: item.subScopeId ?? null,
                  taskDetailId: item.taskDetailId ?? null,
                  tanggal: targetDate,
                  status: item.status,
                  warnaCustom: item.warnaCustom ?? null,
                  catatan: item.catatan || null,
                  delayDikonfirmasi: item.status === "DELAY" || item.status === "DONE",
                },
              });
            }
          }
        }
      }
    });

    return NextResponse.json({ ok: true, updatedCount: changes.length });
  } catch (err) {
    console.error("POST /api/schedule/batch error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan perubahan batch jadwal." },
      { status: 500 }
    );
  }
}
