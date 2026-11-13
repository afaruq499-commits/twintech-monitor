import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveDatabaseUrl, sanitizeDbError, withDbRetry } from "@/lib/db";

describe("Cloud Database Readiness & Retry Mechanism", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DB_PORT;
    delete process.env.DB_TYPE;
  });

  it("memprioritaskan DATABASE_URL jika didefinisikan", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require";
    const url = resolveDatabaseUrl();
    expect(url).toBe("postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require");
  });

  it("dapat merakit PostgreSQL URL dari variabel komponen terpisah", () => {
    process.env.DB_TYPE = "postgres";
    process.env.DB_HOST = "db.supabase.co";
    process.env.DB_USER = "postgres";
    process.env.DB_PASSWORD = "secret@password#123";
    process.env.DB_NAME = "postgres";
    process.env.DB_PORT = "5432";

    const url = resolveDatabaseUrl();
    expect(url).toBe(
      "postgresql://postgres:secret%40password%23123@db.supabase.co:5432/postgres?schema=public&sslmode=prefer"
    );
  });

  it("dapat merakit SQL Server URL dari variabel komponen terpisah", () => {
    process.env.DB_TYPE = "sqlserver";
    process.env.DB_HOST = "myserver.database.windows.net";
    process.env.DB_USER = "sqladmin";
    process.env.DB_PASSWORD = "AzurePassword123#";
    process.env.DB_NAME = "twintech_db";
    process.env.DB_PORT = "1433";

    const url = resolveDatabaseUrl();
    expect(url).toBe(
      "sqlserver://myserver.database.windows.net:1433;database=twintech_db;user=sqladmin;password=AzurePassword123#;encrypt=true;trustServerCertificate=true"
    );
  });

  it("menyembunyikan kredensial sensitif saat sanitizeDbError dijalankan", () => {
    const rawError = new Error(
      "Connection failed to postgresql://postgres:SuperSecret123@db.supabase.co:5432/postgres"
    );
    const sanitized = sanitizeDbError(rawError);
    expect(sanitized).not.toContain("SuperSecret123");
    expect(sanitized).toContain("postgresql://postgres:***@db.supabase.co:5432/postgres");

    const sqlServerError = new Error(
      "Login failed for user 'sa'. Details: user=sa;password=SecretAdminKey;encrypt=true"
    );
    const sanitizedSqlServer = sanitizeDbError(sqlServerError);
    expect(sanitizedSqlServer).not.toContain("SecretAdminKey");
    expect(sanitizedSqlServer).toContain("password=***");
  });

  it("mencoba ulang operasi database jika terjadi transient error (P1001 cold start)", async () => {
    let callCount = 0;
    const transientOperation = async () => {
      callCount++;
      if (callCount < 3) {
        const err: any = new Error("Can't reach database server at localhost:5432");
        err.code = "P1001";
        throw err;
      }
      return "SUCCESS_AFTER_COLD_START";
    };

    const result = await withDbRetry(transientOperation, 3, 10);
    expect(result).toBe("SUCCESS_AFTER_COLD_START");
    expect(callCount).toBe(3);
  });

  it("langsung melempar error non-transient tanpa retry berulang", async () => {
    let callCount = 0;
    const fatalOperation = async () => {
      callCount++;
      const err: any = new Error("Table 'non_existent_table' does not exist");
      err.code = "P2021"; // Non-transient
      throw err;
    };

    await expect(withDbRetry(fatalOperation, 3, 10)).rejects.toThrow("Table 'non_existent_table' does not exist");
    expect(callCount).toBe(1);
  });
});
