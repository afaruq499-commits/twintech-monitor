import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("Menambahkan kolom HMI di Supabase PostgreSQL...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "projects"
    ADD COLUMN IF NOT EXISTS "hmi_program_file_url" text,
    ADD COLUMN IF NOT EXISTS "hmi_program_file_name" varchar(300),
    ADD COLUMN IF NOT EXISTS "hmi_program_file_size" integer;
  `);
  console.log("Kolom HMI di Supabase berhasil dipastikan ada!");
}

main()
  .catch((e) => {
    console.error("Gagal menambahkan kolom di Supabase:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
