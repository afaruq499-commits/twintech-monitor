const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
});

async function run() {
  const [
    projects,
    components,
    lanes,
    work_items,
    sub_scopes,
    task_details,
    schedule_cells,
    catalog,
    pr_imports,
    settings,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.component.count(),
    prisma.lane.count(),
    prisma.workItem.count(),
    prisma.subScope.count(),
    prisma.taskDetail.count(),
    prisma.scheduleCell.count(),
    prisma.catalogComponent.count(),
    prisma.prImport.count(),
    prisma.setting.count(),
  ]);

  console.log('SUPABASE_COUNTS:', JSON.stringify({
    projects,
    components,
    lanes,
    work_items,
    sub_scopes,
    task_details,
    schedule_cells,
    catalog,
    pr_imports,
    settings,
  }, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
