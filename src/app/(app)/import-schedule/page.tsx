import { Suspense } from "react";
import { ScheduleImportClient } from "@/components/ScheduleImportClient";
import { getProjectsOverview } from "@/lib/data-queries";

export const dynamic = "force-dynamic";

export default async function ScheduleImportPage() {
  const projects = await getProjectsOverview();

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-500 font-bold">
          Memuat importer schedule...
        </div>
      }
    >
      <ScheduleImportClient
        projects={projects.map((p) => ({
          id: p.id,
          kode: p.kode,
          nama: p.nama,
          client: p.client,
          lanesCount: p.lanes.length,
        }))}
      />
    </Suspense>
  );
}
