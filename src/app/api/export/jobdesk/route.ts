import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/data-queries";
import { exportJobdeskPlanToExcelBuffer } from "@/lib/export/jobdesk-exporter";
import { jobdeskPlanDataSchema } from "@/lib/jobdesk-plan";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const candidate = body?.plan ?? body;
    const parsed = jobdeskPlanDataSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Format data jobdesk untuk export tidak valid.",
        },
        { status: 400 }
      );
    }

    const settings = await getAppSettings().catch(() => null);
    const buffer = await exportJobdeskPlanToExcelBuffer(parsed.data, {
      namaPerusahaan: settings?.namaPerusahaan,
      alamatPerusahaan: settings?.alamatPerusahaan,
      telpPerusahaan: settings?.telpPerusahaan,
      faxPerusahaan: settings?.faxPerusahaan,
      logoBase64: settings?.logoBase64,
    });
    const filename = `Pembagian_Jobdesk_${parsed.data.startDateIso}.xlsx`;

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("POST /api/export/jobdesk error:", err);
    return NextResponse.json(
      { error: "Gagal mengekspor Excel pembagian jobdesk." },
      { status: 500 }
    );
  }
}
