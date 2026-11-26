import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr } from "@/lib/date-utils";
import { laneSchema } from "@/lib/validation/schemas";
import { pushLaneWorkItemsToJobdeskPlan } from "@/lib/jobdesk-server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = laneSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data lane tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Jika terjadi pergeseran tanggal spesifik untuk hari tertentu (oldDate -> newDate),
    // pindahkan seluruh sel jadwal yang terpasang pada lane ini ke tanggal baru
    if (body.oldDate && body.newDate && body.oldDate !== body.newDate) {
      const oldDt = fromIsoDateStr(body.oldDate);
      const newDt = fromIsoDateStr(body.newDate);
      if (oldDt && newDt) {
        await prisma.scheduleCell.updateMany({
          where: {
            workItem: { laneId: id },
            tanggal: oldDt,
          },
          data: {
            tanggal: newDt,
          },
        });
      }
    }

    const updated = await prisma.lane.update({
      where: { id },
      data: {
        ...(d.nama !== undefined ? { nama: d.nama } : {}),
        ...(d.subjudul !== undefined ? { subjudul: d.subjudul } : {}),
        ...(d.tanggalMulai !== undefined
          ? { tanggalMulai: fromIsoDateStr(d.tanggalMulai)! }
          : {}),
        ...(d.jumlahHari !== undefined ? { jumlahHari: d.jumlahHari } : {}),
        ...(d.deadline !== undefined
          ? { deadline: fromIsoDateStr(d.deadline) }
          : {}),
        ...(d.pic !== undefined ? { pic: d.pic || null } : {}),
        ...(d.customDatesJson !== undefined
          ? { customDatesJson: d.customDatesJson }
          : {}),
      },
    });
    await pushLaneWorkItemsToJobdeskPlan(id).catch(() => {});

    return NextResponse.json({ lane: updated });
  } catch (err) {
    console.error("PATCH /api/lanes/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui lane." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.lane.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/lanes/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus lane." },
      { status: 500 }
    );
  }
}
