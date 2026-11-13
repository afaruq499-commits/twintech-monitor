import { Suspense } from "react";
import { PrImportClient } from "@/components/PrImportClient";
import { getProjectsOverview } from "@/lib/data-queries";

export const dynamic = "force-dynamic";

export default async function PrImportPage() {
  const projects = await getProjectsOverview();
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Memuat importer PR...</div>}>
      <PrImportClient
        projects={projects.map((p) => ({
          id: p.id,
          kode: p.kode,
          nama: p.nama,
          client: p.client,
          totalComponents: p.totalComponents,
        }))}
      />
    </Suspense>
  );
}
