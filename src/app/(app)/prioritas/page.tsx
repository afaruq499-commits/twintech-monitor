import { PriorityClient } from "@/components/PriorityClient";
import type {
  ComponentImportStatus,
  ProjectPriority,
  ProjectStatus,
  PurchaseStatus,
} from "@/lib/constants";
import { todayIsoLocal, toIsoDateStr } from "@/lib/date-utils";
import { prisma } from "@/lib/db";
import { rankProjectPriorities } from "@/lib/priority/score";

export const dynamic = "force-dynamic";

export default async function PriorityPage() {
  const todayIso = todayIsoLocal();
  const projects = await prisma.project.findMany({
    include: {
      components: {
        select: { statusPembelian: true, statusImport: true },
      },
      lanes: {
        include: {
          workItems: {
            include: {
              scheduleCells: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  const ranked = rankProjectPriorities(
    projects.map((p) => ({
      id: p.id,
      kode: p.kode,
      nama: p.nama,
      client: p.client,
      status: p.status as ProjectStatus,
      prioritas: p.prioritas as ProjectPriority,
      deadline: toIsoDateStr(p.deadline),
      urutanManual: p.urutanManual,
      warna: p.warna,
      scheduledCellsCount: p.lanes.reduce(
        (sum, l) =>
          sum + l.workItems.reduce((ws, w) => ws + w.scheduleCells.length, 0),
        0
      ),
      components: p.components.map((c) => ({
        statusPembelian: c.statusPembelian as PurchaseStatus,
        statusImport: c.statusImport as ComponentImportStatus,
      })),
    })),
    todayIso
  );

  return <PriorityClient initialRanked={ranked} />;
}
