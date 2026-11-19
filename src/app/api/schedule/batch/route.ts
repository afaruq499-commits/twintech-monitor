import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr } from "@/lib/date-utils";
import {
  resolveScheduleBatchChanges,
  type ScheduleBatchChangeItem,
} from "@/lib/schedule-batch";

export type { ScheduleBatchChangeItem };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const changes: ScheduleBatchChangeItem[] = body.changes;

    if (!Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json(
        { error: "Daftar perubahan sel tidak boleh kosong." },
        { status: 400 }
      );
    }

    // 1. Kumpulkan workItemId dan tanggal unik yang disentuh oleh batch
    const workItemIds = Array.from(
      new Set(changes.map((c) => c.workItemId).filter(Boolean))
    );

    const targetDateMap = new Map<string, Date>();
    for (const item of changes) {
      const dIso = item.tanggal ? item.tanggal.slice(0, 10) : null;
      if (dIso && !targetDateMap.has(dIso)) {
        const d = fromIsoDateStr(dIso);
        if (d) targetDateMap.set(dIso, d);
      }
    }
    const targetDates = Array.from(targetDateMap.values());

    if (workItemIds.length === 0 || targetDates.length === 0) {
      return NextResponse.json(
        { error: "Data workItemId atau tanggal pada perubahan batch tidak valid." },
        { status: 400 }
      );
    }

    // 2. Eksekusi dalam transaksi Prisma dengan batas timeout 60 detik (bukan default 5 detik)
    // dan hanya maksimal 3 operasi query batch (findMany -> deleteMany -> createMany)
    // sehingga ratusan perubahan dapat disimpan dalam hitungan < 200ms tanpa timeout.
    const result = await prisma.$transaction(
      async (tx) => {
        // Ambil seluruh sel yang ada di DB untuk area yang disentuh dalam 1 query
        const existingCells = await tx.scheduleCell.findMany({
          where: {
            workItemId: { in: workItemIds },
            tanggal: { in: targetDates },
          },
        });

        // Hitung diff in-memory secara instan
        const { idsToDelete, cellsToCreate, unchangedCount } =
          resolveScheduleBatchChanges(existingCells, changes);

        // Hapus sel lama / sel yang berubah
        if (idsToDelete.length > 0) {
          await tx.scheduleCell.deleteMany({
            where: {
              id: { in: idsToDelete },
            },
          });
        }

        // Simpan sel baru dalam 1 batch insert
        if (cellsToCreate.length > 0) {
          await tx.scheduleCell.createMany({
            data: cellsToCreate,
          });
        }

        return {
          deletedCount: idsToDelete.length,
          createdCount: cellsToCreate.length,
          unchangedCount,
        };
      },
      {
        maxWait: 15000, // 15 detik waktu tunggu antrian pool koneksi DB
        timeout: 60000, // 60 detik batas timeout transaksi interaktif
      }
    );

    return NextResponse.json({
      ok: true,
      updatedCount: changes.length,
      ...result,
    });
  } catch (err) {
    console.error("POST /api/schedule/batch error:", err);
    const detailMsg =
      err instanceof Error ? err.message : "Terjadi kendala koneksi ke database.";
    return NextResponse.json(
      { error: `Gagal menyimpan perubahan batch jadwal: ${detailMsg}` },
      { status: 500 }
    );
  }
}
