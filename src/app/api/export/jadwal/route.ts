import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ScheduleCellStatus } from "@/lib/constants";
import { toIsoDateStr } from "@/lib/date-utils";
import { getAppSettings } from "@/lib/data-queries";
import {
  exportScheduleToBuffer,
  type ExportLaneInput,
} from "@/lib/export/schedule-exporter";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const laneId = searchParams.get("laneId");
    const projectId = searchParams.get("projectId");
    const includeCalendarDates = searchParams.get("includeDates") === "1";

    const whereClause = laneId
      ? { id: laneId }
      : projectId
        ? { projectId }
        : { project: { status: { not: "SELESAI" } } };

    const [lanes, settings] = await Promise.all([
      prisma.lane.findMany({
        where: whereClause,
        orderBy: [{ projectId: "asc" }, { urutan: "asc" }],
        include: {
          project: true,
          workItems: {
            orderBy: { urutan: "asc" },
            include: {
              subScopes: {
                orderBy: { urutan: "asc" },
                include: {
                  details: { orderBy: { urutan: "asc" } },
                },
              },
              scheduleCells: {
                orderBy: { tanggal: "asc" },
              },
            },
          },
        },
      }),
      getAppSettings(),
    ]);

    if (lanes.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada lane jadwal untuk diekspor." },
        { status: 404 }
      );
    }

    const exportLanes: ExportLaneInput[] = lanes.map((l) => ({
      client: l.project.client,
      laneNama: l.nama,
      subjudul: l.subjudul,
      tanggalMulai: toIsoDateStr(l.tanggalMulai)!,
      jumlahHari: l.jumlahHari,
      customDates: l.customDatesJson ? JSON.parse(l.customDatesJson) : undefined,
      workItems: l.workItems.map((wi) => ({
        urutan: wi.urutan,
        judul: wi.judul,
        pic: wi.pic ?? l.pic ?? l.project.pic,
        deadline: toIsoDateStr(wi.deadline) ?? toIsoDateStr(l.deadline),
        subScopes: wi.subScopes.map((ss) => ({
          urutan: ss.urutan,
          judul: ss.judul,
          details: ss.details.map((d) => ({
            urutan: d.urutan,
            teks: d.teks,
          })),
        })),
        scheduleCells: wi.scheduleCells.map((sc) => ({
          tanggal: toIsoDateStr(sc.tanggal)!,
          status: sc.status as ScheduleCellStatus,
          warnaCustom: sc.warnaCustom,
          catatan: sc.catatan,
        })),
      })),
    }));

    const buffer = await exportScheduleToBuffer(
      exportLanes,
      {
        namaPerusahaan: settings.namaPerusahaan,
        alamatPerusahaan: settings.alamatPerusahaan,
        telpPerusahaan: settings.telpPerusahaan,
        faxPerusahaan: settings.faxPerusahaan,
        logoBase64: settings.logoBase64,
      },
      { includeCalendarDates }
    );

    const filenameBase = laneId
      ? `Rencana_Jadwal_${lanes[0].project.client}_${lanes[0].nama}`
      : projectId
        ? `Rencana_Jadwal_Kerja_${lanes[0].project.client}`
        : `Rencana_Jadwal_Kerja_Semua_Lane`;
    const safeFilename = `${filenameBase.replace(/[^a-zA-Z0-9_-]+/g, "_")}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
      },
    });
  } catch (err) {
    console.error("GET /api/export/jadwal error:", err);
    return NextResponse.json(
      { error: "Gagal mengekspor jadwal ke Excel." },
      { status: 500 }
    );
  }
}
