import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("Menghubungkan ke Supabase PostgreSQL...");
  console.log("Membuat tabel flowchart_diagrams jika belum ada...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "flowchart_diagrams" (
      "id" TEXT NOT NULL,
      "nama" VARCHAR(300) NOT NULL,
      "deskripsi" TEXT,
      "data_json" TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"zoom":1,"panX":40,"panY":20}}',
      "user_id" VARCHAR(100),
      "author_name" VARCHAR(200),
      "node_count" INTEGER NOT NULL DEFAULT 0,
      "edge_count" INTEGER NOT NULL DEFAULT 0,
      "project_id" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "flowchart_diagrams_pkey" PRIMARY KEY ("id")
    );
  `);

  console.log("Membuat index untuk flowchart_diagrams...");
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "flowchart_diagrams_user_id_idx" ON "flowchart_diagrams"("user_id");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "flowchart_diagrams_updated_at_idx" ON "flowchart_diagrams"("updated_at");
  `);

  console.log("Memverifikasi tabel dengan Prisma Client...");
  const count = await prisma.flowchartDiagram.count();
  console.log(`BERHASIL! Tabel 'flowchart_diagrams' aktif dan siap digunakan di Supabase. Total record: ${count}`);
}

main()
  .catch((e) => {
    console.error("Gagal membuat tabel flowchart_diagrams di Supabase:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
