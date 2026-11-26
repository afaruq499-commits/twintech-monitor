import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/data-queries";
import { exportJobdeskPlanToExcelBuffer } from "@/lib/export/jobdesk-exporter";
import {
  jobdeskPlanDataSchema,
  type JobdeskPlanData,
} from "@/lib/jobdesk-plan";
import { loadSyncedJobdeskBundle } from "@/lib/jobdesk-server";

async function buildExcelResponse(plan: JobdeskPlanData) {
  const settings = await getAppSettings().catch(() => null);
  const buffer = await exportJobdeskPlanToExcelBuffer(plan, {
    namaPerusahaan: settings?.namaPerusahaan,
    alamatPerusahaan: settings?.alamatPerusahaan,
    telpPerusahaan: settings?.telpPerusahaan,
    faxPerusahaan: settings?.faxPerusahaan,
    logoBase64: settings?.logoBase64,
  });
  const filename = `Pembagian_Jobdesk_${plan.startDateIso}.xlsx`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  try {
    const bundle = await loadSyncedJobdeskBundle();
    return await buildExcelResponse(bundle.plan);
  } catch (err) {
    console.error("GET /api/export/jobdesk error:", err);
    return NextResponse.json(
      { error: "Gagal mengekspor Excel pembagian jobdesk." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let candidate: unknown = null;

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      const raw = formData.get("planJson");
      if (typeof raw === "string" && raw.trim()) {
        candidate = JSON.parse(raw);
      }
    } else {
      const body = await request.json();
      candidate = body?.plan ?? body;
    }

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

    return await buildExcelResponse(parsed.data);
  } catch (err) {
    console.error("POST /api/export/jobdesk error:", err);
    return NextResponse.json(
      { error: "Gagal mengekspor Excel pembagian jobdesk." },
      { status: 500 }
    );
  }
}
