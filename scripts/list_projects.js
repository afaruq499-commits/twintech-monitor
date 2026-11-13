const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, kode: true, nama: true, client: true }
  });
  console.log('Projects:', projects);
}

main().catch(console.error).finally(() => prisma.$disconnect());
