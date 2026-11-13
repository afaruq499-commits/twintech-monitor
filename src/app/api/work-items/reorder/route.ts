import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { laneId, orderedIds, workItemId, newUrutan } = body;

    let finalOrderedIds: string[] = [];

    if (Array.isArray(orderedIds) && orderedIds.length > 0) {
      finalOrderedIds = orderedIds;
    } else if (laneId && workItemId && typeof newUrutan === "number") {
      const items = await prisma.workItem.findMany({
        where: { laneId },
        orderBy: { urutan: "asc" },
        select: { id: true },
      });
      const ids = items.map((x) => x.id);
      const currentIndex = ids.indexOf(workItemId);
      if (currentIndex !== -1) {
        ids.splice(currentIndex, 1);
        const targetPos = Math.max(0, Math.min(newUrutan - 1, ids.length));
        ids.splice(targetPos, 0, workItemId);
        finalOrderedIds = ids;
      }
    }

    if (finalOrderedIds.length === 0) {
      return NextResponse.json(
        { error: "Data pengurutan pekerjaan tidak valid." },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      finalOrderedIds.map((id, idx) =>
        prisma.workItem.update({
          where: { id },
          data: { urutan: idx + 1 },
        })
      )
    );

    return NextResponse.json({ ok: true, orderedIds: finalOrderedIds });
  } catch (err) {
    console.error("POST /api/work-items/reorder error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan urutan pekerjaan." },
      { status: 500 }
    );
  }
}
