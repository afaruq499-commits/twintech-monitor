import { JobdeskPlannerClient } from "@/components/JobdeskPlannerClient";
import { prisma } from "@/lib/db";
import { toIsoDateStr, todayIsoLocal } from "@/lib/date-utils";
import {
  createDefaultJobdeskPlanData,
  extractAvailableProjectJobdesks,
  parseJobdeskPlanJson,
  type ProjectJobdeskSourceInput,
} from "@/lib/jobdesk-plan";

export const dynamic = "force-dynamic";

export default async function JobdeskPage() {
  const todayIso = todayIsoLocal();

  const [projectsRaw, savedPlanRow] = await Promise.all([
    prisma.project.findMany({
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
                  select: { status: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ urutanManual: "asc" }, { deadline: "asc" }],
    }),
    prisma.jobdeskPlan
      .findUnique({
        where: { id: "default" },
      })
      .catch(() => null),
  ]);

  const projectInputs: ProjectJobdeskSourceInput[] = projectsRaw.map((p) => ({
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
          status: sc.status,
        })),
      })),
    })),
  }));

  const availableJobdesks = extractAvailableProjectJobdesks(
    projectInputs,
    todayIso
  );

  const initialPlan = savedPlanRow
    ? parseJobdeskPlanJson(savedPlanRow.dataJson, savedPlanRow.judul)
    : createDefaultJobdeskPlanData(todayIso, 5);

  return (
    <JobdeskPlannerClient
      initialPlan={initialPlan}
      availableJobdesks={availableJobdesks}
      initialUpdatedAt={savedPlanRow?.updatedAt.toISOString() ?? null}
      initialUpdatedBy={savedPlanRow?.updatedByName ?? null}
      todayIso={todayIso}
    />
  );
}
