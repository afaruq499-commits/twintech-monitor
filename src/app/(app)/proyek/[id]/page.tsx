import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProjectDetailClient } from "@/components/ProjectDetailClient";
import { getProjectDetail } from "@/lib/data-queries";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectDetail(id);
  if (!project) notFound();

  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Memuat proyek...</div>}>
      <ProjectDetailClient project={project} />
    </Suspense>
  );
}
