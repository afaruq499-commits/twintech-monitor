import { prisma } from "@/lib/db";
import { type WorkType } from "@/lib/constants";
import {
  TemplatesClient,
  type ProjectLaneOption,
  type TemplateDTO,
} from "@/components/TemplatesClient";

export const dynamic = "force-dynamic";

export default async function TemplatePage() {
  const [templates, lanes] = await Promise.all([
    prisma.workTemplate.findMany({
      include: {
        subScopes: {
          orderBy: { urutan: "asc" },
          include: {
            details: { orderBy: { urutan: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.lane.findMany({
      include: {
        project: {
          select: { id: true, nama: true, client: true, status: true },
        },
      },
      orderBy: [{ project: { updatedAt: "desc" } }, { urutan: "asc" }],
    }),
  ]);

  const initialTemplates: TemplateDTO[] = templates.map((t) => ({
    id: t.id,
    nama: t.nama,
    jenis: t.jenis as WorkType,
    bolehParalel: t.bolehParalel,
    deskripsi: t.deskripsi,
    subScopes: t.subScopes.map((ss) => ({
      id: ss.id,
      urutan: ss.urutan,
      judul: ss.judul,
      details: ss.details.map((d) => ({
        id: d.id,
        urutan: d.urutan,
        teks: d.teks,
      })),
    })),
  }));

  const laneOptions: ProjectLaneOption[] = lanes.map((l) => ({
    laneId: l.id,
    laneNama: l.nama,
    projectId: l.project.id,
    projectNama: l.project.nama,
    projectClient: l.project.client,
  }));

  return (
    <TemplatesClient
      initialTemplates={initialTemplates}
      laneOptions={laneOptions}
    />
  );
}
