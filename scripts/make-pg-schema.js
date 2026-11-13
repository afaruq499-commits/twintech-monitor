const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "prisma", "schema.prisma");
const dest = path.join(__dirname, "..", "prisma", "schema.postgresql.prisma");

const content = fs.readFileSync(src, "utf-8");
const pgContent = content
  .replace(/provider\s*=\s*"sqlserver"/g, 'provider = "postgresql"')
  .replace(/@db\.NVarChar\(Max\)/g, "@db.Text")
  .replace(/@db\.NVarChar\(/g, "@db.VarChar(");

fs.writeFileSync(dest, pgContent, "utf-8");
console.log("Created prisma/schema.postgresql.prisma");
