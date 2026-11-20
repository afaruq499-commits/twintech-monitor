import { Metadata } from "next";
import { prisma } from "@/lib/db";
import { FlowchartStudioClient } from "@/components/FlowchartStudioClient";

export const metadata: Metadata = {
  title: "Studio & Editor Flowchart Mesin | PT Twintech Precision",
  description:
    "Rancang diagram alur sekuens mesin otomasi secara visual, 100% independen di dalam aplikasi, langsung tersinkronkan ke proyek, dan dapat diunduh sebagai gambar PNG resolusi tinggi.",
};

export default async function ConvertFlowchartPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const initialProjectId = resolvedParams.projectId || "";

  // Ambil seluruh proyek dari database untuk pilihan target flowchart
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      kode: true,
      nama: true,
      client: true,
      status: true,
      flowSequenceJson: true,
      deadline: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const formattedProjects = projects.map((p) => ({
    id: p.id,
    kode: p.kode,
    nama: p.nama,
    client: p.client,
    status: p.status,
    flowSequenceJson: p.flowSequenceJson,
    deadline: p.deadline ? p.deadline.toISOString().split("T")[0] : null,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <FlowchartStudioClient
        projects={formattedProjects}
        initialProjectId={initialProjectId}
      />
    </div>
  );
}
