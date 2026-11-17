import { DashboardClient } from "@/components/DashboardClient";
import { getDashboardSummary } from "@/lib/data-queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardSummary();

  return (
    <DashboardClient
      todayIso={data.todayIso}
      tomorrowIso={data.tomorrowIso}
      cards={data.cards}
      readinessStats={data.readinessStats}
      dailyScheduleStats={data.dailyScheduleStats}
      todayTasks={data.todayTasks}
      tomorrowTasks={data.tomorrowTasks}
      alerts={data.alerts}
      topPriorities={data.topPriorities}
      projectChecklists={data.projectChecklists}
    />
  );
}
