import { describe, expect, it } from "vitest";
import {
  resolveScheduleBatchChanges,
  type ExistingScheduleCell,
  type ScheduleBatchChangeItem,
} from "@/lib/schedule-batch";
import { fromIsoDateStr } from "@/lib/date-utils";

describe("Batch Schedule Processor (Optimasi 24+ Perubahan Sekaligus)", () => {
  it("dapat memproses 24 sel sekaligus pada jadwal kosong dalam 1 createMany tanpa timeout", () => {
    const existingCells: ExistingScheduleCell[] = [];
    const changes: ScheduleBatchChangeItem[] = [];

    // Simulasi 24 perubahan warna seperti pada screenshot pengguna
    for (let day = 1; day <= 6; day++) {
      const tanggal = `2026-11-2${day}`;
      for (let detIdx = 1; detIdx <= 4; detIdx++) {
        changes.push({
          action: "UPSERT",
          workItemId: "wi-program-plc",
          tanggal,
          status: "TARGET",
          subScopeId: "ss-plc",
          taskDetailId: `det-plc-${detIdx}`,
          allDetailIds: ["det-plc-1", "det-plc-2", "det-plc-3", "det-plc-4"],
          isShiftClick: false,
        });
      }
    }

    expect(changes.length).toBe(24);

    const result = resolveScheduleBatchChanges(existingCells, changes);

    expect(result.idsToDelete).toEqual([]);
    expect(result.cellsToCreate.length).toBe(24);
    expect(result.unchangedCount).toBe(0);
  });

  it("dapat memecah (split) sel sharedSubScope jika user mewarnai salah satu sub-point", () => {
    const date = fromIsoDateStr("2026-11-20")!;
    const existingCells: ExistingScheduleCell[] = [
      {
        id: "shared-ss-1",
        workItemId: "wi-1",
        subScopeId: "ss-1",
        taskDetailId: null,
        tanggal: date,
        status: "TARGET",
        warnaCustom: null,
        catatan: null,
        delayDikonfirmasi: false,
      },
    ];

    const changes: ScheduleBatchChangeItem[] = [
      {
        action: "UPSERT",
        workItemId: "wi-1",
        tanggal: "2026-11-20",
        status: "DONE",
        subScopeId: "ss-1",
        taskDetailId: "det-a",
        allDetailIds: ["det-a", "det-b", "det-c"],
        isShiftClick: false,
      },
    ];

    const result = resolveScheduleBatchChanges(existingCells, changes);

    // Sel shared lama harus dihapus
    expect(result.idsToDelete).toEqual(["shared-ss-1"]);
    // Harus tercipta 3 sel detail: det-a (DONE), det-b (TARGET dari shared lama), det-c (TARGET dari shared lama)
    expect(result.cellsToCreate.length).toBe(3);

    const detA = result.cellsToCreate.find((c) => c.taskDetailId === "det-a");
    const detB = result.cellsToCreate.find((c) => c.taskDetailId === "det-b");
    const detC = result.cellsToCreate.find((c) => c.taskDetailId === "det-c");

    expect(detA?.status).toBe("DONE");
    expect(detB?.status).toBe("TARGET");
    expect(detC?.status).toBe("TARGET");
  });

  it("dapat memproses multi-drag beberapa sub-point pada subScope yang sama dalam 1 batch", () => {
    const date = fromIsoDateStr("2026-11-20")!;
    const existingCells: ExistingScheduleCell[] = [
      {
        id: "shared-ss-1",
        workItemId: "wi-1",
        subScopeId: "ss-1",
        taskDetailId: null,
        tanggal: date,
        status: "TARGET",
        warnaCustom: null,
        catatan: null,
        delayDikonfirmasi: false,
      },
    ];

    // User mendrag det-a dan det-b menjadi ON_PROGRESS
    const changes: ScheduleBatchChangeItem[] = [
      {
        action: "UPSERT",
        workItemId: "wi-1",
        tanggal: "2026-11-20",
        status: "ON_PROGRESS",
        subScopeId: "ss-1",
        taskDetailId: "det-a",
        allDetailIds: ["det-a", "det-b", "det-c"],
        isShiftClick: false,
      },
      {
        action: "UPSERT",
        workItemId: "wi-1",
        tanggal: "2026-11-20",
        status: "ON_PROGRESS",
        subScopeId: "ss-1",
        taskDetailId: "det-b",
        allDetailIds: ["det-a", "det-b", "det-c"],
        isShiftClick: false,
      },
    ];

    const result = resolveScheduleBatchChanges(existingCells, changes);

    expect(result.idsToDelete).toEqual(["shared-ss-1"]);
    expect(result.cellsToCreate.length).toBe(3);

    const detA = result.cellsToCreate.find((c) => c.taskDetailId === "det-a");
    const detB = result.cellsToCreate.find((c) => c.taskDetailId === "det-b");
    const detC = result.cellsToCreate.find((c) => c.taskDetailId === "det-c");

    expect(detA?.status).toBe("ON_PROGRESS");
    expect(detB?.status).toBe("ON_PROGRESS");
    expect(detC?.status).toBe("TARGET"); // Tetap mewarisi status shared
  });

  it("dapat menghapus (DELETE / ERASE) sebuah sel spesifik dan menandai ID lama untuk dihapus", () => {
    const date = fromIsoDateStr("2026-11-21")!;
    const existingCells: ExistingScheduleCell[] = [
      {
        id: "cell-det-a",
        workItemId: "wi-1",
        subScopeId: "ss-1",
        taskDetailId: "det-a",
        tanggal: date,
        status: "TARGET",
        warnaCustom: null,
        catatan: null,
        delayDikonfirmasi: false,
      },
    ];

    const changes: ScheduleBatchChangeItem[] = [
      {
        action: "DELETE",
        workItemId: "wi-1",
        tanggal: "2026-11-21",
        subScopeId: "ss-1",
        taskDetailId: "det-a",
        allDetailIds: ["det-a", "det-b"],
        isShiftClick: false,
      },
    ];

    const result = resolveScheduleBatchChanges(existingCells, changes);

    expect(result.idsToDelete).toEqual(["cell-det-a"]);
    expect(result.cellsToCreate.length).toBe(0);
  });

  it("dapat menangani Shift+Click untuk mewarnai seluruh grup subScope sekaligus", () => {
    const date = fromIsoDateStr("2026-11-22")!;
    const existingCells: ExistingScheduleCell[] = [
      {
        id: "old-det-a",
        workItemId: "wi-1",
        subScopeId: "ss-1",
        taskDetailId: "det-a",
        tanggal: date,
        status: "TARGET",
        warnaCustom: null,
        catatan: null,
        delayDikonfirmasi: false,
      },
    ];

    const changes: ScheduleBatchChangeItem[] = [
      {
        action: "UPSERT",
        workItemId: "wi-1",
        tanggal: "2026-11-22",
        status: "DONE",
        subScopeId: "ss-1",
        taskDetailId: null,
        isShiftClick: true,
      },
    ];

    const result = resolveScheduleBatchChanges(existingCells, changes);

    expect(result.idsToDelete).toEqual(["old-det-a"]);
    expect(result.cellsToCreate.length).toBe(1);
    expect(result.cellsToCreate[0].subScopeId).toBe("ss-1");
    expect(result.cellsToCreate[0].taskDetailId).toBeNull();
    expect(result.cellsToCreate[0].status).toBe("DONE");
  });
});
