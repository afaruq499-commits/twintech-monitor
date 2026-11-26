import { JobdeskPlannerClient } from "@/components/JobdeskPlannerClient";
import { loadSyncedJobdeskBundle } from "@/lib/jobdesk-server";

export const dynamic = "force-dynamic";

export default async function JobdeskPage() {
  const bundle = await loadSyncedJobdeskBundle();

  return (
    <JobdeskPlannerClient
      initialPlan={bundle.plan}
      availableJobdesks={bundle.availableJobdesks}
      initialUpdatedAt={bundle.updatedAt}
      initialUpdatedBy={bundle.updatedByName}
      todayIso={bundle.todayIso}
    />
  );
}
