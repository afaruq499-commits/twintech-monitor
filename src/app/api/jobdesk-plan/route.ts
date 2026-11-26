import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jobdeskPlanDataSchema } from "@/lib/jobdesk-plan";
import {
  loadSyncedJobdeskBundle,
  syncJobdeskPlanBackToSchedule,
} from "@/lib/jobdesk-server";

export async function GET() {
  try {
    const bundle = await loadSyncedJobdeskBundle();
    return NextResponse.json(bundle);
  } catch (err) {
    console.error("GET /api/jobdesk-plan error:", err);
    return NextResponse.json(
      { error: "Gagal memuat data pembagian jobdesk." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const candidate = body?.plan ?? body;
    const parsed = jobdeskPlanDataSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Format pembagian jobdesk tidak valid.",
        },
        { status: 400 }
      );
    }

    const sessionUser = await getSessionUser();
    const d = parsed.data;
    const serialized = JSON.stringify(d);

    const saved = await prisma.jobdeskPlan.upsert({
      where: { id: "default" },
      update: {
        judul: d.title,
        dataJson: serialized,
        updatedByName: sessionUser?.nama ?? null,
      },
      create: {
        id: "default",
        judul: d.title,
        dataJson: serialized,
        updatedByName: sessionUser?.nama ?? null,
      },
    });

    // Sinkronkan balik pekerjaan yang terhubung dengan WorkItem ke Schedule Proyek
    const syncedWorkItemsCount = await syncJobdeskPlanBackToSchedule(d).catch(
      (syncErr) => {
        console.error("syncJobdeskPlanBackToSchedule warning:", syncErr);
        return 0;
      }
    );

    return NextResponse.json({
      plan: d,
      updatedAt: saved.updatedAt.toISOString(),
      updatedByName: saved.updatedByName ?? null,
      syncedWorkItemsCount,
    });
  } catch (err) {
    console.error("PUT /api/jobdesk-plan error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan pembagian jobdesk." },
      { status: 500 }
    );
  }
}
