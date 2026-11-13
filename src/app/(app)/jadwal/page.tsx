import { ScheduleCalendarClient } from "@/components/ScheduleCalendarClient";
import type { ScheduleCellStatus, WorkType } from "@/lib/constants";
import { todayIsoLocal, toIsoDateStr } from "@/lib/date-utils";
import { prisma } from "@/lib/db";
import { findProposedDelays } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function ScheduleCalendarPage() {
  const todayIso = todayIsoLocal();

  const lanes = await prisma.lane.findMany({
    where: { project: { status: { not: "SELESAI" } } },
    orderBy: [{ projectId: "asc" }, { urutan: "asc" }],
    include: {
      project: true,
      workItems: {
        orderBy: { urutan: "asc" },
        include: {
          scheduleCells: {
            orderBy: { tanggal: "asc" },
            include: {
              subScope: true,
              taskDetail: true,
            },
          },
        },
      },
    },
  });

  const cells = lanes.flatMap((l) =>
    l.workItems.flatMap((wi) =>
      wi.scheduleCells.map((sc) => ({
        id: sc.id,
        workItemId: wi.id,
        workItemJudul: wi.judul,
        workItemPic: wi.pic ?? l.pic ?? l.project.pic,
        workItemUrutan: wi.urutan,
        subScopeId: sc.subScopeId,
        subScopeJudul: sc.subScope?.judul ?? null,
        subScopeUrutan: sc.subScope?.urutan ?? null,
        taskDetailId: sc.taskDetailId,
        taskDetailTeks: sc.taskDetail?.teks ?? null,
        taskDetailUrutan: sc.taskDetail?.urutan ?? null,
        jenis: wi.jenis as WorkType,
        bolehParalel: wi.bolehParalel || l.project.bolehParalel,
        laneId: l.id,
        laneNama: l.nama,
        projectId: l.projectId,
        projectNama: l.project.nama,
        projectClient: l.project.client,
        projectWarna: l.project.warna,
        projectParalel: l.project.bolehParalel,
        tanggal: toIsoDateStr(sc.tanggal)!,
        status: sc.status as ScheduleCellStatus,
        warnaCustom: sc.warnaCustom,
        catatan: sc.catatan,
        delayDikonfirmasi: sc.delayDikonfirmasi,
      }))
    )
  );

  const workItemOptions = lanes.flatMap((l) =>
    l.workItems.map((wi) => ({
      id: wi.id,
      judul: wi.judul,
      pic: wi.pic ?? l.pic ?? l.project.pic,
      jenis: wi.jenis as WorkType,
      laneId: l.id,
      laneNama: l.nama,
      projectId: l.projectId,
      projectNama: l.project.nama,
      projectClient: l.project.client,
    }))
  );

  const proposedDelays = findProposedDelays(cells, todayIso);

  return (
    <ScheduleCalendarClient
      cells={cells}
      workItemOptions={workItemOptions}
      lanes={lanes.map((l) => ({
        id: l.id,
        nama: l.nama,
        tanggalMulai: toIsoDateStr(l.tanggalMulai)!,
        jumlahHari: l.jumlahHari,
        workItemsCount: l.workItems.length,
        projectId: l.projectId,
        projectNama: l.project.nama,
        projectClient: l.project.client,
        projectWarna: l.project.warna,
        projectParalel: l.project.bolehParalel,
        pic: l.pic ?? l.project.pic,
      }))}
      proposedDelays={proposedDelays}
    />
  );
}
