import { ProjectsClient } from "@/components/ProjectsClient";
import { getProjectsOverview } from "@/lib/data-queries";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getProjectsOverview();
  return <ProjectsClient projects={projects} />;
}
