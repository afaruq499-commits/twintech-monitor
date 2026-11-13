/**
 * scripts/switch-db.js
 *
 * Utility untuk beralih antara database Microsoft SQL Server (Azure SQL / On-Premise)
 * dan PostgreSQL (Supabase / Neon / Railway) secara otomatis.
 *
 * Cara pakai:
 *   node scripts/switch-db.js postgres   -> Mengubah schema ke PostgreSQL (Supabase/Neon)
 *   node scripts/switch-db.js sqlserver  -> Mengubah schema ke Microsoft SQL Server (Azure SQL)
 */

const fs = require("fs");
const path = require("path");

const target = (process.argv[2] || "").toLowerCase();
const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");

if (!fs.existsSync(schemaPath)) {
  console.error("File prisma/schema.prisma tidak ditemukan!");
  process.exit(1);
}

const currentContent = fs.readFileSync(schemaPath, "utf-8");

if (target === "postgres" || target === "postgresql") {
  console.log("Mengonfigurasi prisma/schema.prisma untuk PostgreSQL (Supabase / Neon)...");
  
  let updated = currentContent
    .replace(/provider\s*=\s*"sqlserver"/g, 'provider  = "postgresql"')
    .replace(/@db\.NVarChar\(Max\)/g, "@db.Text")
    .replace(/@db\.NVarChar\(/g, "@db.VarChar(");

  if (!updated.includes("directUrl")) {
    updated = updated.replace(
      /url\s*=\s*env\("DATABASE_URL"\)/,
      'url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")'
    );
  }

  fs.writeFileSync(schemaPath, updated, "utf-8");
  console.log("Berhasil! Provider database diatur ke: postgresql (dengan dukungan directUrl untuk Supabase pooler)");
  console.log("Jalankan: npx prisma generate && npx prisma db push");
} else if (target === "sqlserver" || target === "mssql") {
  console.log("Mengonfigurasi prisma/schema.prisma untuk Microsoft SQL Server (Azure SQL / On-Premise)...");
  
  let updated = currentContent
    .replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlserver"')
    .replace(/\r?\n\s*directUrl\s*=\s*env\("DIRECT_URL"\)/g, "")
    .replace(/@db\.Text/g, "@db.NVarChar(Max)")
    .replace(/@db\.VarChar\((?!20\)|50\))/g, "@db.NVarChar(");

  fs.writeFileSync(schemaPath, updated, "utf-8");
  console.log("Berhasil! Provider database diatur ke: sqlserver");
  console.log("Jalankan: npx prisma generate && npx prisma db push");
} else {
  console.log("Gunakan: node scripts/switch-db.js [postgres | sqlserver]");
  process.exit(1);
}
