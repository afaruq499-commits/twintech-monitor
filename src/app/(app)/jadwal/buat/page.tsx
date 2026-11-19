import { Suspense } from "react";
import { CreateProjectScheduleClient } from "@/components/CreateProjectScheduleClient";
import { todayIsoLocal, toIsoDateStr } from "@/lib/date-utils";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BuatScheduleProyekPage() {
  // Proyek aktif + Proyek After Sales (meski sudah selesai), kecuali berstatus "EXPIRED"
  const projects = await prisma.project.findMany({
    where: {
      status: { not: "EXPIRED" },
      OR: [
        { status: { not: "SELESAI" } },
        { tipeProyek: "AFTER_SALES" },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      kode: true,
      nama: true,
      client: true,
      deadline: true,
      pic: true,
      bolehParalel: true,
      tipeProyek: true,
      status: true,
    },
  });

  const existingProjects = projects.map((p) => ({
    id: p.id,
    kode: p.kode,
    nama: p.nama,
    client: p.client,
    deadline: toIsoDateStr(p.deadline),
    pic: p.pic,
    bolehParalel: p.bolehParalel,
    tipeProyek: p.tipeProyek,
    status: p.status,
  }));

  return (
    <Suspense fallback={<div className="p-6 text-base">Memuat formulir...</div>}>
      <CreateProjectScheduleClient
        existingProjects={existingProjects}
        defaultTodayIso={todayIsoLocal()}
      />
    </Suspense>
  );
}
