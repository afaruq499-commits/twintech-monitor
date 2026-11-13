import { Suspense } from "react";
import { PrBuilderClient } from "@/components/PrBuilderClient";
import { getCatalogComponents } from "@/lib/catalog-queries";
import { getProjectsOverview } from "@/lib/data-queries";
import { todayIsoLocal } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function BuatPrPage() {
  const [catalog, projects] = await Promise.all([
    getCatalogComponents(),
    getProjectsOverview(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="p-6 text-base text-slate-600">
          Memuat penyusun komponen PR & katalog...
        </div>
      }
    >
      <PrBuilderClient
        initialCatalog={catalog}
        projects={projects.map((p) => ({
          id: p.id,
          kode: p.kode,
          nama: p.nama,
          client: p.client,
          pic: p.pic,
          totalComponents: p.totalComponents,
        }))}
        defaultTodayIso={todayIsoLocal()}
      />
    </Suspense>
  );
}
