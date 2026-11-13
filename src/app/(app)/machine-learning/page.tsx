import { MachineLearningClient } from "@/components/MachineLearningClient";
import { getCatalogComponents } from "@/lib/catalog-queries";
import {
  getHistoricalMlSamples,
  getProjectsOverview,
} from "@/lib/data-queries";

export const dynamic = "force-dynamic";

export default async function MachineLearningPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string }>;
}) {
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const [catalog, projects, historicalSamples] = await Promise.all([
    getCatalogComponents(),
    getProjectsOverview(),
    getHistoricalMlSamples(),
  ]);

  return (
    <MachineLearningClient
      initialCatalog={catalog}
      historicalSamples={historicalSamples}
      projects={projects.map((p) => ({
        id: p.id,
        kode: p.kode,
        nama: p.nama,
        client: p.client,
        komponenInti: p.komponenInti,
        totalComponents: p.totalComponents,
      }))}
      initialProjectId={resolvedSearch?.projectId ?? ""}
    />
  );
}
