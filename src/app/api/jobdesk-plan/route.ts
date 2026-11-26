import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createDefaultJobdeskPlanData,
  jobdeskPlanDataSchema,
  parseJobdeskPlanJson,
} from "@/lib/jobdesk-plan";

export async function GET() {
  try {
    const existing = await prisma.jobdeskPlan.findUnique({
      where: { id: "default" },
    });

    if (!existing) {
      const fallback = createDefaultJobdeskPlanData();
      return NextResponse.json({
        plan: fallback,
        updatedAt: null,
        updatedByName: null,
      });
    }

    const plan = parseJobdeskPlanJson(existing.dataJson, existing.judul);
    return NextResponse.json({
      plan,
      updatedAt: existing.updatedAt.toISOString(),
      updatedByName: existing.updatedByName ?? null,
    });
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

    return NextResponse.json({
      plan: d,
      updatedAt: saved.updatedAt.toISOString(),
      updatedByName: saved.updatedByName ?? null,
    });
  } catch (err) {
    console.error("PUT /api/jobdesk-plan error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan pembagian jobdesk." },
      { status: 500 }
    );
  }
}
