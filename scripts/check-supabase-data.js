const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      kode: true,
      nama: true,
      panelLayoutJson: true,
      flowSequenceJson: true,
      fileChecklistJson: true,
      gambarUrl: true,
      _count: { select: { components: true, lanes: true } }
    }
  });
  console.log('PROJECTS IN SUPABASE:');
  for (const p of projects) {
    console.log(`- [${p.kode}] ${p.nama} (Components: ${p._count.components}, Lanes: ${p._count.lanes})`);
    console.log(`  panelLayoutJson: ${p.panelLayoutJson ? 'YES (' + p.panelLayoutJson.length + ' chars)' : 'NULL'}`);
    console.log(`  flowSequenceJson: ${p.flowSequenceJson ? 'YES (' + p.flowSequenceJson.length + ' chars)' : 'NULL'}`);
    console.log(`  fileChecklistJson: ${p.fileChecklistJson ? 'YES (' + p.fileChecklistJson.length + ' chars)' : 'NULL'}`);
    console.log(`  gambarUrl: ${p.gambarUrl || 'NULL'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
