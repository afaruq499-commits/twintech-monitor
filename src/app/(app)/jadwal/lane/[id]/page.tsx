import { notFound } from "next/navigation";
import { LaneGridEditorClient } from "@/components/LaneGridEditorClient";
import type {
  PurchaseStatus,
  ScheduleCellStatus,
  WorkType,
} from "@/lib/constants";
import { toIsoDateStr } from "@/lib/date-utils";
import { getAllScheduledEntries, getAppSettings } from "@/lib/data-queries";
import { prisma } from "@/lib/db";
import { isWorkExemptFromCapacity } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function LaneGridEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [lane, allEntries, settings, templates] = await Promise.all([
    prisma.lane.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            components: {
              where: { statusImport: { not: "HILANG_DI_REVISI" } },
              orderBy: { urutan: "asc" },
            },
            lanes: {
              orderBy: { urutan: "asc" },
              select: { id: true, nama: true, jumlahHari: true },
            },
          },
        },
        workItems: {
          orderBy: { urutan: "asc" },
          include: {
            components: true,
            subScopes: {
              orderBy: { urutan: "asc" },
              include: {
                details: { orderBy: { urutan: "asc" } },
              },
            },
            scheduleCells: {
              orderBy: { tanggal: "asc" },
            },
          },
        },
      },
    }),
    getAllScheduledEntries(),
    getAppSettings(),
    prisma.workTemplate.findMany({
      include: { _count: { select: { subScopes: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!lane) notFound();

  const globalOccupantsByDate: Record<
    string,
    { workItemId: string; label: string }[]
  > = {};
  for (const e of allEntries) {
    if (isWorkExemptFromCapacity(e, settings)) continue;
    const list = globalOccupantsByDate[e.tanggal] ?? [];
    if (!list.some((x) => x.workItemId === e.workItemId)) {
      list.push({
        workItemId: e.workItemId,
        label: `${e.judul} (${e.projectNama})`,
      });
    }
    globalOccupantsByDate[e.tanggal] = list;
  }

  return (
    <LaneGridEditorClient
      lane={{
        id: lane.id,
        nama: lane.nama,
        subjudul: lane.subjudul,
        tanggalMulai: toIsoDateStr(lane.tanggalMulai)!,
        jumlahHari: lane.jumlahHari,
        deadline: toIsoDateStr(lane.deadline),
        pic: lane.pic,
        customDatesJson: lane.customDatesJson,
        workItems: lane.workItems.map((wi) => ({
          id: wi.id,
          urutan: wi.urutan,
          jenis: wi.jenis as WorkType,
          judul: wi.judul,
          bolehParalel: wi.bolehParalel,
          pic: wi.pic,
          deadline: toIsoDateStr(wi.deadline),
          componentIds: wi.components.map((c) => c.componentId),
          subScopes: wi.subScopes.map((ss) => ({
            id: ss.id,
            urutan: ss.urutan,
            judul: ss.judul,
            details: ss.details.map((d) => ({
              id: d.id,
              urutan: d.urutan,
              teks: d.teks,
            })),
          })),
          scheduleCells: wi.scheduleCells.map((sc) => ({
            id: sc.id,
            subScopeId: sc.subScopeId,
            taskDetailId: sc.taskDetailId,
            tanggal: toIsoDateStr(sc.tanggal)!,
            status: sc.status as ScheduleCellStatus,
            warnaCustom: sc.warnaCustom,
            catatan: sc.catatan,
          })),
        })),
      }}
      project={{
        id: lane.project.id,
        kode: lane.project.kode,
        nama: lane.project.nama,
        client: lane.project.client,
        warna: lane.project.warna,
        pic: lane.project.pic,
        deadline: toIsoDateStr(lane.project.deadline),
        bolehParalel: lane.project.bolehParalel,
        prioritas: lane.project.prioritas,
      }}
      projectComponents={lane.project.components.map((c) => ({
        id: c.id,
        kelompok: c.kelompok,
        partType: c.partType,
        partName: c.partName,
        statusPembelian: c.statusPembelian as PurchaseStatus,
        estimasiTiba: toIsoDateStr(c.estimasiTiba),
      }))}
      otherLanesInProject={lane.project.lanes}
      globalOccupantsByDate={globalOccupantsByDate}
      templates={templates.map((t) => ({
        id: t.id,
        nama: t.nama,
        jenis: t.jenis as WorkType,
        subScopesCount: t._count.subScopes,
      }))}
    />
  );
}
