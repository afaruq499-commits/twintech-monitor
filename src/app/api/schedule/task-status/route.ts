import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { ScheduleCellStatus } from "@/lib/constants";
import { fromIsoDateStr } from "@/lib/date-utils";

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: "Sesi telah berakhir. Silakan login kembali." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      cellId,
      workItemId,
      tanggal,
      subScopeId,
      status,
      catatan,
    } = body;

    const validStatuses: ScheduleCellStatus[] = [
      "TARGET",
      "ON_PROGRESS",
      "DONE",
      "DELAY",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Status pengerjaan tidak valid." },
        { status: 400 }
      );
    }

    // Update by cellId jika tersedia
    if (cellId) {
      const updated = await prisma.scheduleCell.update({
        where: { id: cellId },
        data: {
          status,
          ...(catatan !== undefined ? { catatan: catatan || null } : {}),
          delayDikonfirmasi: status === "DONE" || status === "DELAY",
        },
      });

      return NextResponse.json({ ok: true, cell: updated });
    }

    // Jika cellId tidak ada, update berdasarkan (workItemId, tanggal, subScopeId)
    if (!workItemId || !tanggal) {
      return NextResponse.json(
        { error: "Parameter workItemId dan tanggal diperlukan." },
        { status: 400 }
      );
    }

    const targetDate = fromIsoDateStr(tanggal);
    if (!targetDate) {
      return NextResponse.json(
        { error: "Format tanggal tidak valid." },
        { status: 400 }
      );
    }

    // Cari sel yang cocok
    const matchingCells = await prisma.scheduleCell.findMany({
      where: {
        workItemId,
        tanggal: targetDate,
        ...(subScopeId ? { subScopeId } : {}),
      },
    });

    if (matchingCells.length === 0) {
      // Buat sel baru jika belum ada
      const created = await prisma.scheduleCell.create({
        data: {
          workItemId,
          subScopeId: subScopeId || null,
          tanggal: targetDate,
          status,
          catatan: catatan || null,
          delayDikonfirmasi: status === "DONE" || status === "DELAY",
        },
      });
      return NextResponse.json({ ok: true, cell: created });
    }

    // Update semua sel yang cocok dalam grup sub-scope
    await prisma.scheduleCell.updateMany({
      where: {
        workItemId,
        tanggal: targetDate,
        ...(subScopeId ? { subScopeId } : {}),
      },
      data: {
        status,
        ...(catatan !== undefined ? { catatan: catatan || null } : {}),
        delayDikonfirmasi: status === "DONE" || status === "DELAY",
      },
    });

    return NextResponse.json({ ok: true, updatedCount: matchingCells.length });
  } catch (err) {
    console.error("POST /api/schedule/task-status error:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui status pekerjaan." },
      { status: 500 }
    );
  }
}
