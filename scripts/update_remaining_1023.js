const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.project.findFirst({
    where: { kode: '26-TBI-1023' },
    include: { components: true }
  });

  if (!p) {
    console.error('Project 26-TBI-1023 not found');
    return;
  }

  const updates = [
    { urutan: 11, hargaSatuan: 22000, unit: 'pcs' },
    { urutan: 12, hargaSatuan: 28000, unit: 'pcs' },
    { urutan: 13, hargaSatuan: 65000, unit: 'pcs' },
    { urutan: 24, hargaSatuan: 3059000, unit: 'pcs' },
    { urutan: 32, hargaSatuan: 22000, unit: 'pack' },
    { urutan: 34, hargaSatuan: 28000, unit: 'pcs' }
  ];

  for (const item of updates) {
    const comp = p.components.find(c => c.urutan === item.urutan);
    if (comp) {
      const total = comp.qty * item.hargaSatuan;
      await prisma.component.update({
        where: { id: comp.id },
        data: {
          hargaSatuan: item.hargaSatuan,
          hargaRaw: item.hargaSatuan.toLocaleString('id-ID'),
          total: total,
          unit: comp.unit || item.unit
        }
      });
      console.log(`Updated #${comp.urutan} ${comp.partName} (${comp.partType}): qty ${comp.qty} x Rp ${item.hargaSatuan} = Rp ${total}`);
    } else {
      console.log(`Component #${item.urutan} not found!`);
    }
  }

  // Check new total
  const updatedComponents = await prisma.component.findMany({
    where: { projectId: p.id }
  });
  const totalCost = updatedComponents.reduce((sum, c) => sum + (c.total || 0), 0);
  const unpricedLeft = updatedComponents.filter(c => !c.hargaSatuan).length;

  console.log('\n--- SUMMARY ---');
  console.log(`Total components: ${updatedComponents.length}`);
  console.log(`Unpriced left: ${unpricedLeft}`);
  console.log(`Total PR Cost: Rp ${totalCost.toLocaleString('id-ID')}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
