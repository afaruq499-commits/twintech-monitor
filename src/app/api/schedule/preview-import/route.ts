import { NextResponse } from "next/server";
import { parseScheduleWorkbookBuffer } from "@/lib/export/schedule-importer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    // Dukung unggahan satu file maupun multiple file sekaligus
    const rawFiles = formData.getAll("files").concat(formData.getAll("file"));
    const files = rawFiles.filter(
      (f): f is File => typeof f !== "string" && typeof f.arrayBuffer === "function"
    );

    if (files.length === 0) {
      return NextResponse.json(
        { error: "File Excel (.xlsx/.xls) jadwal tidak ditemukan." },
        { status: 400 }
      );
    }

    const allLanes = [];
    let combinedLogoBase64: string | null = null;
    let combinedCompanyName: string | null = null;
    let combinedCompanyAddress: string | null = null;
    const filenames: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename =
        (file as File).name || (files.length > 1 ? `schedule_${i + 1}.xlsx` : "schedule.xlsx");

      if (!/\.(xlsx|xls)$/i.test(filename)) {
        continue;
      }
      filenames.push(filename);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parsed = await parseScheduleWorkbookBuffer(buffer, filename);

      if (!combinedLogoBase64 && parsed.logoBase64) {
        combinedLogoBase64 = parsed.logoBase64;
      }
      if (!combinedCompanyName && parsed.companyName) {
        combinedCompanyName = parsed.companyName;
      }
      if (!combinedCompanyAddress && parsed.companyAddress) {
        combinedCompanyAddress = parsed.companyAddress;
      }

      // Pastikan index sheet berurutan jika ada multi-file
      for (const lane of parsed.lanes) {
        allLanes.push({
          ...lane,
          sheetIndex: allLanes.length + 1,
        });
      }
    }

    if (allLanes.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ditemukan sheet/tabel jadwal yang valid di dalam file Excel yang diunggah. Pastikan format tabel memiliki baris NO, DESCRIPTION, SCOPE of WORK, dan kolom DAY.",
        },
        { status: 400 }
      );
    }

    const combinedResult = {
      filename: filenames.join(" + ") || "schedule.xlsx",
      lanes: allLanes,
      companyName: combinedCompanyName,
      companyAddress: combinedCompanyAddress,
      logoBase64: combinedLogoBase64,
    };

    return NextResponse.json(
      { ok: true, result: combinedResult },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/schedule/preview-import error:", err);
    return NextResponse.json(
      {
        error:
          "Gagal membaca file Excel schedule. Pastikan file tidak rusak dan formatnya sesuai.",
      },
      { status: 500 }
    );
  }
}
