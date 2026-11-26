import { fromIsoDateStr, toIsoDateStr, todayIsoLocal } from "@/lib/date-utils";
import { prisma } from "@/lib/db";
import {
  createDefaultJobdeskPlanData,
  expandWorkingDateRange,
  extractAvailableProjectJobdesks,
  getEntryDateRange,
  parseJobdeskPlanJson,
  syncScheduleProyekToJobdeskPlan,
  type AvailableJobdeskItem,
  type JobdeskPlanData,
  type ProjectJobdeskSourceInput,
} from "@/lib/jobdesk-plan";

export interface LoadedJobdeskBundle {
  plan: JobdeskPlanData;
  availableJobdesks: AvailableJobdeskItem[];
  updatedAt: string | null;
  updatedByName: string | null;
  todayIso: string;
}

export interface LoadJobdeskOptions {
  /** Bila true (klik tombol Sinkron Schedule), ambil ulang jadwal WorkItem dari Schedule Proyek */
  forceSyncFromSchedule?: boolean;
}

async function queryActiveProjectInputs(): Promise<ProjectJobdeskSourceInput[]> {
  const projectsRaw = await prisma.project.findMany({
    where: { status: { not: "SELESAI" } },
    include: {
      components: {
        select: {
          statusPembelian: true,
          statusImport: true,
        },
      },
      lanes: {
        orderBy: { urutan: "asc" },
        include: {
          workItems: {
            orderBy: { urutan: "asc" },
            include: {
              scheduleCells: {
                orderBy: { tanggal: "asc" },
                select: {
                  tanggal: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ urutanManual: "asc" }, { deadline: "asc" }],
  });

  return projectsRaw.map((p) => ({
    id: p.id,
    kode: p.kode,
    nama: p.nama,
    client: p.client,
    status: p.status,
    prioritas: p.prioritas,
    deadline: toIsoDateStr(p.deadline),
    urutanManual: p.urutanManual,
    warna: p.warna,
    pic: p.pic,
    prStatus: p.prStatus,
    plcAddressesJson: p.plcAddressesJson,
    panelLayoutJson: p.panelLayoutJson,
    flowSequenceJson: p.flowSequenceJson,
    wiringDiagramPdfUrl: p.wiringDiagramPdfUrl,
    wiringDiagramPdfName: p.wiringDiagramPdfName,
    plcProgramFileUrl: p.plcProgramFileUrl,
    plcProgramFileName: p.plcProgramFileName,
    hmiProgramFileUrl: p.hmiProgramFileUrl,
    hmiProgramFileName: p.hmiProgramFileName,
    fileChecklistJson: p.fileChecklistJson,
    components: p.components.map((c) => ({
      statusPembelian: c.statusPembelian,
      statusImport: c.statusImport,
    })),
    lanes: p.lanes.map((l) => ({
      id: l.id,
      nama: l.nama,
      pic: l.pic,
      workItems: l.workItems.map((wi) => ({
        id: wi.id,
        jenis: wi.jenis,
        judul: wi.judul,
        pic: wi.pic,
        scheduleCells: wi.scheduleCells.map((sc) => ({
          tanggal: toIsoDateStr(sc.tanggal),
          status: sc.status,
        })),
      })),
    })),
  }));
}

/**
 * Memuat rencana pembagian jobdesk tersimpan tanpa menimpa pengaturan user saat refresh.
 * Sinkronisasi penuh dari Schedule Proyek hanya dijalankan saat data awal belum ada
 * atau ketika user secara eksplisit menekan "Sinkron Schedule" (`forceSyncFromSchedule = true`).
 */
export async function loadSyncedJobdeskBundle(
  options: LoadJobdeskOptions = {}
): Promise<LoadedJobdeskBundle> {
  const todayIso = todayIsoLocal();

  const [projectInputs, savedPlanRow] = await Promise.all([
    queryActiveProjectInputs(),
    prisma.jobdeskPlan
      .findUnique({
        where: { id: "default" },
      })
      .catch(() => null),
  ]);

  const availableJobdesks = extractAvailableProjectJobdesks(
    projectInputs,
    todayIso
  );

  const basePlan = savedPlanRow
    ? parseJobdeskPlanJson(savedPlanRow.dataJson, savedPlanRow.judul)
    : createDefaultJobdeskPlanData(todayIso, 5, true);

  const shouldSync = !savedPlanRow || Boolean(options.forceSyncFromSchedule);
  const finalPlan = shouldSync
    ? syncScheduleProyekToJobdeskPlan(basePlan, projectInputs)
    : basePlan;

  return {
    plan: finalPlan,
    availableJobdesks,
    updatedAt: savedPlanRow?.updatedAt.toISOString() ?? null,
    updatedByName: savedPlanRow?.updatedByName ?? null,
    todayIso,
  };
}

/**
 * Dipanggil oleh API Schedule Proyek saat WorkItem / ScheduleCell diubah (mis. menunjuk Apip tgl 27).
 * Memperbarui HANYA workItem yang disentuh di dalam `jobdesk_plans` tanpa mengganggu jobdesk lain.
 */
export async function pushScheduleWorkItemsToJobdeskPlan(
  workItemIds: string[]
): Promise<void> {
  const uniqueIds = Array.from(new Set(workItemIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const todayIso = todayIsoLocal();
  const [projectInputs, savedPlanRow] = await Promise.all([
    queryActiveProjectInputs(),
    prisma.jobdeskPlan
      .findUnique({
        where: { id: "default" },
      })
      .catch(() => null),
  ]);

  const basePlan = savedPlanRow
    ? parseJobdeskPlanJson(savedPlanRow.dataJson, savedPlanRow.judul)
    : createDefaultJobdeskPlanData(todayIso, 5, true);

  const updatedPlan = syncScheduleProyekToJobdeskPlan(basePlan, projectInputs, {
    onlyWorkItemIds: uniqueIds,
  });

  await prisma.jobdeskPlan.upsert({
    where: { id: "default" },
    update: {
      judul: updatedPlan.title,
      dataJson: JSON.stringify(updatedPlan),
    },
    create: {
      id: "default",
      judul: updatedPlan.title,
      dataJson: JSON.stringify(updatedPlan),
    },
  });
}

export async function pushLaneWorkItemsToJobdeskPlan(
  laneId: string
): Promise<void> {
  if (!laneId) return;
  const items = await prisma.workItem.findMany({
    where: { laneId },
    select: { id: true },
  });
  if (items.length > 0) {
    await pushScheduleWorkItemsToJobdeskPlan(items.map((w) => w.id));
  }
}

/**
 * Menyinkronkan perubahan PIC & rentang tanggal dari Pembagian Jobdesk
 * kembali ke WorkItem & ScheduleCell di Schedule Proyek (`/jadwal`).
 */
export async function syncJobdeskPlanBackToSchedule(
  plan: JobdeskPlanData
): Promise<number> {
  const dayDateById = new Map(plan.days.map((d) => [d.id, d.dateIso]));

  const workItemTargets = new Map<
    string,
    {
      pics: Set<string>;
      dateStatuses: Map<string, "DONE" | "ON_PROGRESS">;
    }
  >();

  for (const pic of plan.pics) {
    const row = plan.cells[pic];
    if (!row) continue;

    for (const [dayId, list] of Object.entries(row)) {
      const colDateIso =
        dayDateById.get(dayId) ??
        (dayId.startsWith("day-") ? dayId.slice(4, 14) : plan.startDateIso);

      for (const entry of list) {
        const wiId =
          entry.workItemId ||
          (entry.sourceKey?.startsWith("wi:") ? entry.sourceKey.slice(3) : null);
        if (!wiId) continue;

        let bucket = workItemTargets.get(wiId);
        if (!bucket) {
          bucket = { pics: new Set<string>(), dateStatuses: new Map() };
          workItemTargets.set(wiId, bucket);
        }
        bucket.pics.add(pic);

        const { startIso, endIso } = getEntryDateRange(entry, colDateIso);
        const dates = expandWorkingDateRange(
          startIso,
          endIso,
          Boolean(entry.urgent)
        );
        const nextStatus: "DONE" | "ON_PROGRESS" = entry.done
          ? "DONE"
          : "ON_PROGRESS";

        for (const dIso of dates) {
          const prev = bucket.dateStatuses.get(dIso);
          if (prev !== "DONE") {
            bucket.dateStatuses.set(dIso, nextStatus);
          }
        }
      }
    }
  }

  let syncedCount = 0;

  for (const [workItemId, info] of workItemTargets.entries()) {
    const existingWi = await prisma.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true },
    });
    if (!existingWi) continue;

    const picString = Array.from(info.pics).join(", ");
    await prisma.workItem.update({
      where: { id: workItemId },
      data: { pic: picString || null },
    });

    const desiredDates = Array.from(info.dateStatuses.keys()).sort();
    const desiredDateObjects = desiredDates
      .map((d) => fromIsoDateStr(d))
      .filter((d): d is Date => Boolean(d));

    await prisma.scheduleCell.deleteMany({
      where: {
        workItemId,
        subScopeId: null,
        taskDetailId: null,
        ...(desiredDateObjects.length > 0
          ? { tanggal: { notIn: desiredDateObjects } }
          : {}),
      },
    });

    for (const dIso of desiredDates) {
      const targetDate = fromIsoDateStr(dIso);
      if (!targetDate) continue;
      const desiredStatus = info.dateStatuses.get(dIso) ?? "ON_PROGRESS";

      const existingCell = await prisma.scheduleCell.findFirst({
        where: {
          workItemId,
          subScopeId: null,
          taskDetailId: null,
          tanggal: targetDate,
        },
        select: { id: true, status: true },
      });

      if (existingCell) {
        if (existingCell.status !== desiredStatus) {
          await prisma.scheduleCell.update({
            where: { id: existingCell.id },
            data: { status: desiredStatus },
          });
        }
      } else {
        await prisma.scheduleCell.create({
          data: {
            workItemId,
            subScopeId: null,
            taskDetailId: null,
            tanggal: targetDate,
            status: desiredStatus,
          },
        });
      }
    }

    syncedCount += 1;
  }

  return syncedCount;
}
