const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });

async function check() {
  const lanes = await prisma.lane.findMany({
    select: {
      id: true,
      projectId: true,
      nama: true,
      _count: { select: { workItems: true } },
      project: { select: { kode: true, nama: true } }
    }
  });
  console.log('Lanes in Supabase:', JSON.stringify(lanes, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
