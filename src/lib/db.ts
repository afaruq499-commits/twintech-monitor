import { PrismaClient } from "@prisma/client";

/**
 * Mengurai atau merakit URL koneksi database secara dinamis.
 * Mendukung:
 * 1. DATABASE_URL langsung (standar Prisma, Supabase, Neon, Azure SQL connection string)
 * 2. Atau variabel komponen terpisah (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT, DB_TYPE)
 */
export function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return process.env.DATABASE_URL.trim();
  }

  const host = process.env.DB_HOST?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME?.trim();
  const port = process.env.DB_PORT?.trim();
  const dbType = (process.env.DB_TYPE || "sqlserver").toLowerCase().trim();

  if (!host || !user || !database) {
    return undefined; // Gunakan fallback dari schema.prisma / env("DATABASE_URL")
  }

  if (dbType === "postgres" || dbType === "postgresql") {
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);
    const dbPort = port || "5432";
    const ssl = process.env.DB_SSL === "false" ? "disable" : "prefer";
    return `postgresql://${encodedUser}:${encodedPassword}@${host}:${dbPort}/${database}?schema=public&sslmode=${ssl}`;
  }

  // Default: Microsoft SQL Server (Azure SQL / On-Premise)
  const dbPort = port || "1433";
  const encrypt = process.env.DB_ENCRYPT ?? "true";
  const trustCert = process.env.DB_TRUST_SERVER_CERTIFICATE ?? "true";
  return `sqlserver://${host}:${dbPort};database=${database};user=${user};password=${password};encrypt=${encrypt};trustServerCertificate=${trustCert}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const resolvedUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: resolvedUrl ? { db: { url: resolvedUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Singleton instance agar koneksi pool terkontrol di serverless / hot reload
globalForPrisma.prisma = prisma;

/**
 * Mekanisme Retry Otomatis untuk menangani Cold Start & Putus Koneksi Sementara.
 * Berguna saat database di cloud (Supabase, Neon, Azure) sedang bangun (sleep/idle state).
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const isTransient =
        error?.code === "P1001" || // Can't reach database server
        error?.code === "P1002" || // Database server timed out
        error?.code === "P1008" || // Operations timed out
        error?.code === "P1017" || // Server closed the connection
        error?.message?.includes("ETIMEDOUT") ||
        error?.message?.includes("ECONNRESET") ||
        error?.message?.includes("connection closed");

      if (!isTransient || attempt === maxRetries) {
        throw error;
      }

      const backoff = delayMs * Math.pow(2, attempt - 1);
      console.warn(`[DB Retry] Percobaan ke-${attempt} gagal (Cold Start / Network Timeout). Mencoba ulang dalam ${backoff}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw lastError;
}

/**
 * Helper untuk sanitasi error database agar tidak mengekspos kredensial ke client/API.
 */
export function sanitizeDbError(error: unknown): string {
  if (error instanceof Error) {
    // Sembunyikan credential dari connection string jika ada di pesan error
    return error.message
      .replace(/:\/\/([^:@]+):([^@]+)@/g, "://$1:***@")
      .replace(/password=[^;]+/gi, "password=***");
  }
  return "Terjadi kesalahan pada database.";
}

/**
 * Pemeriksaan kesehatan koneksi database (Health Check)
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  provider: string;
  error?: string;
}> {
  const start = Date.now();
  try {
    // Jalankan query ringan
    await withDbRetry(() => prisma.$queryRawUnsafe("SELECT 1"), 2, 300);
    const latencyMs = Date.now() - start;
    return {
      healthy: true,
      latencyMs,
      provider: resolvedUrl?.startsWith("postgres") ? "PostgreSQL" : "SQL Server",
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      healthy: false,
      latencyMs,
      provider: resolvedUrl?.startsWith("postgres") ? "PostgreSQL" : "SQL Server",
      error: sanitizeDbError(err),
    };
  }
}
