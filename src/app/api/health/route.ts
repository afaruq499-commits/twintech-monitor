import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbHealth = await checkDatabaseHealth();

  const responsePayload = {
    status: dbHealth.healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    database: {
      connected: dbHealth.healthy,
      provider: dbHealth.provider,
      latencyMs: dbHealth.latencyMs,
      ...(dbHealth.error ? { message: "Gagal terhubung ke database" } : {}),
    },
  };

  return NextResponse.json(responsePayload, {
    status: dbHealth.healthy ? 200 : 503,
  });
}
