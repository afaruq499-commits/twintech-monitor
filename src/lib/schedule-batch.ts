import { fromIsoDateStr, toIsoDateStr } from "@/lib/date-utils";
import type { ScheduleCellStatus } from "@/lib/constants";

export interface ExistingScheduleCell {
  id: string;
  workItemId: string;
  subScopeId: string | null;
  taskDetailId: string | null;
  tanggal: Date;
  status: string;
  warnaCustom: string | null;
  catatan: string | null;
  delayDikonfirmasi: boolean;
}

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

export interface ScheduleCellCreateInput {
  workItemId: string;
  subScopeId: string | null;
  taskDetailId: string | null;
  tanggal: Date;
  status: string;
  warnaCustom: string | null;
  catatan: string | null;
  delayDikonfirmasi: boolean;
}

interface InMemoryCell {
  dbId?: string;
  workItemId: string;
  subScopeId: string | null;
  taskDetailId: string | null;
  tanggal: Date;
  status: string;
  warnaCustom: string | null;
  catatan: string | null;
  delayDikonfirmasi: boolean;
}

function makeKey(
  workItemId: string,
  dateIso: string,
  subScopeId: string | null,
  taskDetailId: string | null
): string {
  return `${workItemId}_${dateIso}_${subScopeId ?? "null"}_${taskDetailId ?? "null"}`;
}

/**
 * Resolusi perubahan batch jadwal secara in-memory.
 * Mereduksi ratusan query sekuensial (yang sering menyebabkan transaction timeout)
 * menjadi diff optimal: hanya cell yang berubah/dihapus yang dieksekusi.
 */
export function resolveScheduleBatchChanges(
  existingCells: ExistingScheduleCell[],
  changes: ScheduleBatchChangeItem[]
): {
  idsToDelete: string[];
  cellsToCreate: ScheduleCellCreateInput[];
  unchangedCount: number;
} {
  const activeCellsMap = new Map<string, InMemoryCell>();

  // 1. Muat sel yang ada di DB ke Map in-memory
  for (const c of existingCells) {
    const dIso = toIsoDateStr(c.tanggal);
    if (!dIso) continue;
    const k = makeKey(c.workItemId, dIso, c.subScopeId, c.taskDetailId);
    activeCellsMap.set(k, {
      dbId: c.id,
      workItemId: c.workItemId,
      subScopeId: c.subScopeId,
      taskDetailId: c.taskDetailId,
      tanggal: c.tanggal,
      status: c.status,
      warnaCustom: c.warnaCustom,
      catatan: c.catatan,
      delayDikonfirmasi: c.delayDikonfirmasi,
    });
  }

  // 2. Terapkan setiap perubahan batch secara berurutan pada in-memory state
  for (const item of changes) {
    const dateIso = item.tanggal ? item.tanggal.slice(0, 10) : "";
    if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) continue;

    const targetDate = fromIsoDateStr(dateIso);
    if (!targetDate) continue;

    const isShift = !!item.isShiftClick || !item.taskDetailId;

    if (item.action === "DELETE") {
      if (isShift) {
        if (item.subScopeId) {
          for (const [k, c] of activeCellsMap.entries()) {
            if (c.workItemId === item.workItemId && toIsoDateStr(c.tanggal) === dateIso) {
              if (c.subScopeId === item.subScopeId || (!c.subScopeId && !c.taskDetailId)) {
                activeCellsMap.delete(k);
              }
            }
          }
        } else {
          for (const [k, c] of activeCellsMap.entries()) {
            if (c.workItemId === item.workItemId && toIsoDateStr(c.tanggal) === dateIso) {
              activeCellsMap.delete(k);
            }
          }
        }
      } else {
        // Specific taskDetailId
        // a. Split workItemLevel jika ada
        const wiKey = makeKey(item.workItemId, dateIso, null, null);
        const wiLevel = activeCellsMap.get(wiKey);
        if (wiLevel && Array.isArray(item.allDetailIds) && item.allDetailIds.length > 0) {
          activeCellsMap.delete(wiKey);
          for (const detId of item.allDetailIds) {
            if (detId !== item.taskDetailId) {
              const k = makeKey(item.workItemId, dateIso, item.subScopeId ?? null, detId);
              if (!activeCellsMap.has(k)) {
                activeCellsMap.set(k, {
                  workItemId: item.workItemId,
                  subScopeId: item.subScopeId ?? null,
                  taskDetailId: detId,
                  tanggal: targetDate,
                  status: wiLevel.status,
                  warnaCustom: wiLevel.warnaCustom,
                  catatan: wiLevel.catatan,
                  delayDikonfirmasi: wiLevel.delayDikonfirmasi,
                });
              }
            }
          }
        }

        // b. Split sharedSubScope jika ada
        if (item.subScopeId && Array.isArray(item.allDetailIds) && item.allDetailIds.length > 0) {
          const ssKey = makeKey(item.workItemId, dateIso, item.subScopeId, null);
          const sharedSub = activeCellsMap.get(ssKey);
          if (sharedSub) {
            activeCellsMap.delete(ssKey);
            for (const detId of item.allDetailIds) {
              if (detId !== item.taskDetailId) {
                const k = makeKey(item.workItemId, dateIso, item.subScopeId, detId);
                if (!activeCellsMap.has(k)) {
                  activeCellsMap.set(k, {
                    workItemId: item.workItemId,
                    subScopeId: item.subScopeId,
                    taskDetailId: detId,
                    tanggal: targetDate,
                    status: sharedSub.status,
                    warnaCustom: sharedSub.warnaCustom,
                    catatan: sharedSub.catatan,
                    delayDikonfirmasi: sharedSub.delayDikonfirmasi,
                  });
                }
              }
            }
          }
        }

        // c. Hapus detail spesifik ini
        const myKey = makeKey(item.workItemId, dateIso, item.subScopeId ?? null, item.taskDetailId ?? null);
        activeCellsMap.delete(myKey);
      }
    } else if (item.action === "UPSERT" && item.status) {
      if (isShift) {
        if (item.subScopeId) {
          for (const [k, c] of activeCellsMap.entries()) {
            if (c.workItemId === item.workItemId && toIsoDateStr(c.tanggal) === dateIso) {
              if (c.subScopeId === item.subScopeId || (!c.subScopeId && !c.taskDetailId)) {
                activeCellsMap.delete(k);
              }
            }
          }
          const ssKey = makeKey(item.workItemId, dateIso, item.subScopeId, null);
          activeCellsMap.set(ssKey, {
            workItemId: item.workItemId,
            subScopeId: item.subScopeId,
            taskDetailId: null,
            tanggal: targetDate,
            status: item.status,
            warnaCustom: item.warnaCustom ?? null,
            catatan: item.catatan || null,
            delayDikonfirmasi: item.status === "DELAY" || item.status === "DONE",
          });
        } else {
          for (const [k, c] of activeCellsMap.entries()) {
            if (c.workItemId === item.workItemId && toIsoDateStr(c.tanggal) === dateIso) {
              activeCellsMap.delete(k);
            }
          }
          const wiKey = makeKey(item.workItemId, dateIso, null, null);
          activeCellsMap.set(wiKey, {
            workItemId: item.workItemId,
            subScopeId: null,
            taskDetailId: null,
            tanggal: targetDate,
            status: item.status,
            warnaCustom: item.warnaCustom ?? null,
            catatan: item.catatan || null,
            delayDikonfirmasi: item.status === "DELAY" || item.status === "DONE",
          });
        }
      } else {
        // Mode klik biasa (Sub-Point Rincian det.id)
        // a. Split workItemLevel jika ada
        const wiKey = makeKey(item.workItemId, dateIso, null, null);
        const wiLevel = activeCellsMap.get(wiKey);
        if (wiLevel && Array.isArray(item.allDetailIds) && item.allDetailIds.length > 0) {
          activeCellsMap.delete(wiKey);
          for (const detId of item.allDetailIds) {
            if (detId !== item.taskDetailId) {
              const k = makeKey(item.workItemId, dateIso, item.subScopeId ?? null, detId);
              if (!activeCellsMap.has(k)) {
                activeCellsMap.set(k, {
                  workItemId: item.workItemId,
                  subScopeId: item.subScopeId ?? null,
                  taskDetailId: detId,
                  tanggal: targetDate,
                  status: wiLevel.status,
                  warnaCustom: wiLevel.warnaCustom,
                  catatan: wiLevel.catatan,
                  delayDikonfirmasi: wiLevel.delayDikonfirmasi,
                });
              }
            }
          }
        }

        // b. Split sharedSubScope jika ada
        if (item.subScopeId && Array.isArray(item.allDetailIds) && item.allDetailIds.length > 0) {
          const ssKey = makeKey(item.workItemId, dateIso, item.subScopeId, null);
          const sharedSub = activeCellsMap.get(ssKey);
          if (sharedSub) {
            activeCellsMap.delete(ssKey);
            for (const detId of item.allDetailIds) {
              if (detId !== item.taskDetailId) {
                const k = makeKey(item.workItemId, dateIso, item.subScopeId, detId);
                if (!activeCellsMap.has(k)) {
                  activeCellsMap.set(k, {
                    workItemId: item.workItemId,
                    subScopeId: item.subScopeId,
                    taskDetailId: detId,
                    tanggal: targetDate,
                    status: sharedSub.status,
                    warnaCustom: sharedSub.warnaCustom,
                    catatan: sharedSub.catatan,
                    delayDikonfirmasi: sharedSub.delayDikonfirmasi,
                  });
                }
              }
            }
          }
        }

        // c. Upsert detail spesifik ini
        const myKey = makeKey(item.workItemId, dateIso, item.subScopeId ?? null, item.taskDetailId ?? null);
        const existingDet = activeCellsMap.get(myKey);
        activeCellsMap.set(myKey, {
          dbId: existingDet?.dbId,
          workItemId: item.workItemId,
          subScopeId: item.subScopeId ?? null,
          taskDetailId: item.taskDetailId ?? null,
          tanggal: targetDate,
          status: item.status,
          warnaCustom:
            item.warnaCustom !== undefined
              ? item.warnaCustom
              : existingDet?.warnaCustom ?? null,
          catatan:
            item.catatan !== undefined
              ? item.catatan || null
              : existingDet?.catatan ?? null,
          delayDikonfirmasi:
            item.status === "DELAY" ||
            item.status === "DONE" ||
            (existingDet?.delayDikonfirmasi ?? false),
        });
      }
    }
  }

  // 3. Bandingkan activeCellsMap dengan existingCells
  const existingCellMapById = new Map<string, ExistingScheduleCell>();
  for (const ec of existingCells) {
    existingCellMapById.set(ec.id, ec);
  }

  const idsToKeep = new Set<string>();
  const cellsToCreate: ScheduleCellCreateInput[] = [];
  let unchangedCount = 0;

  for (const cell of activeCellsMap.values()) {
    if (cell.dbId && existingCellMapById.has(cell.dbId)) {
      const orig = existingCellMapById.get(cell.dbId)!;
      const isUnchanged =
        orig.status === cell.status &&
        (orig.warnaCustom ?? null) === (cell.warnaCustom ?? null) &&
        (orig.catatan ?? null) === (cell.catatan ?? null) &&
        orig.delayDikonfirmasi === cell.delayDikonfirmasi;

      if (isUnchanged) {
        idsToKeep.add(cell.dbId);
        unchangedCount++;
        continue;
      }
    }

    // Sel baru atau sel yang telah diubah warnanya/statusnya
    cellsToCreate.push({
      workItemId: cell.workItemId,
      subScopeId: cell.subScopeId,
      taskDetailId: cell.taskDetailId,
      tanggal: cell.tanggal,
      status: cell.status,
      warnaCustom: cell.warnaCustom,
      catatan: cell.catatan,
      delayDikonfirmasi: cell.delayDikonfirmasi,
    });
  }

  const idsToDelete = existingCells
    .filter((ec) => !idsToKeep.has(ec.id))
    .map((ec) => ec.id);

  return {
    idsToDelete,
    cellsToCreate,
    unchangedCount,
  };
}
