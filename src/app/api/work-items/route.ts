import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr } from "@/lib/date-utils";
import { workItemSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = workItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data pekerjaan tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const count = await prisma.workItem.count({
      where: { laneId: d.laneId },
    });

    const created = await prisma.workItem.create({
      data: {
        laneId: d.laneId,
        urutan: count + 1,
        judul: d.judul,
        jenis: d.jenis,
        bolehParalel: d.bolehParalel,
        pic: d.pic || null,
        deadline: fromIsoDateStr(d.deadline),
        subScopes: {
          create: d.subScopes.map((ss, ssIdx) => ({
            urutan: ssIdx + 1,
            judul: ss.judul,
            details: {
              create: ss.details.map((teks, detIdx) => ({
                urutan: detIdx + 1,
                teks,
              })),
            },
          })),
        },
        ...(d.componentIds.length > 0
          ? {
              components: {
                create: d.componentIds.map((componentId) => ({ componentId })),
              },
            }
          : {}),
      },
    });
    return NextResponse.json({ workItem: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/work-items error:", err);
    return NextResponse.json(
      { error: "Gagal menambah pekerjaan." },
      { status: 500 }
    );
  }
}
