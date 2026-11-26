import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  jobdeskPlanDataSchema,
  parseJobdeskPlanJson,
} from "@/lib/jobdesk-plan";
import {
  loadSyncedJobdeskBundle,
  syncJobdeskPlanBackToSchedule,
} from "@/lib/jobdesk-server";

export async function GET(request: Request) {
  try {
    const syncParam = new URL(request.url).searchParams.get("sync");
    const bundle = await loadSyncedJobdeskBundle({
      forceSyncFromSchedule: syncParam === "1",
    });
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const entryId = typeof body?.entryId === "string" ? body.entryId : "";
    const pic = typeof body?.pic === "string" ? body.pic : "";
    const done = Boolean(body?.done);

    if (!entryId) {
      return NextResponse.json(
        { error: "Parameter entryId wajib diisi." },
        { status: 400 }
      );
    }

    const existing = await prisma.jobdeskPlan.findUnique({
      where: { id: "default" },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Data pembagian jobdesk belum ditemukan." },
        { status: 404 }
      );
    }

    const plan = parseJobdeskPlanJson(existing.dataJson, existing.judul);
    let found = false;

    const picKeys = pic && plan.cells[pic] ? [pic] : Object.keys(plan.cells);
    for (const pKey of picKeys) {
      const row = plan.cells[pKey];
      if (!row) continue;
      for (const [dayId, list] of Object.entries(row)) {
        row[dayId] = list.map((e) => {
          if (e.id === entryId) {
            found = true;
            return { ...e, done };
          }
          return e;
        });
      }
    }

    if (!found) {
      return NextResponse.json(
        { error: "Item tugas pembagian jobdesk tidak ditemukan." },
        { status: 404 }
      );
    }

    const sessionUser = await getSessionUser();
    await prisma.jobdeskPlan.update({
      where: { id: "default" },
      data: {
        dataJson: JSON.stringify(plan),
        updatedByName: sessionUser?.nama ?? existing.updatedByName,
      },
    });

    await syncJobdeskPlanBackToSchedule(plan).catch(() => {});

    return NextResponse.json({ ok: true, entryId, done });
  } catch (err) {
    console.error("PATCH /api/jobdesk-plan error:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui status tugas pembagian jobdesk." },
      { status: 500 }
    );
  }
}
