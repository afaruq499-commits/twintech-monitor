import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/data-queries";
import { prisma } from "@/lib/db";
import {
  exportPlcAddressesToBuffer,
  exportPlcAddressesToCsvBuffer,
} from "@/lib/export/plc-address-exporter";
import {
  generatePlcAddressesFromComponents,
  type PlcAddressingSystem,
} from "@/lib/plc-address-allocator";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const system =
      (searchParams.get("system") as PlcAddressingSystem) ||
      "MITSUBISHI_FX5U_OCTAL";

    if (!projectId) {
      return NextResponse.json(
        { error: "Parameter projectId wajib disertakan." },
        { status: 400 }
      );
    }

    const [project, settings] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        include: {
          components: {
            where: { statusImport: { not: "HILANG_DI_REVISI" } },
            orderBy: { urutan: "asc" },
          },
        },
      }),
      getAppSettings(),
    ]);

    if (!project) {
      return NextResponse.json(
        { error: "Proyek tidak ditemukan." },
        { status: 404 }
      );
    }

    let allocationResult;
    if (project.plcAddressesJson) {
      try {
        const customEntries = JSON.parse(project.plcAddressesJson);
        if (Array.isArray(customEntries) && customEntries.length > 0) {
          let totalDi = 0;
          let totalDo = 0;
          let totalAi = 0;
          let totalAo = 0;
          let totalM = 0;
          let totalD = 0;
          for (const item of customEntries) {
            if (item.kind === "DI") totalDi++;
            else if (item.kind === "DO") totalDo++;
            else if (item.kind === "AI") totalAi++;
            else if (item.kind === "AO") totalAo++;
            else if (item.kind === "M") totalM++;
            else if (item.kind === "D") totalD++;
          }
          allocationResult = {
            system,
            entries: customEntries,
            summary: {
              totalDi,
              totalDo,
              totalAi,
              totalAo,
              totalM,
              totalD,
              cpuBuiltInDiCapacity: 40,
              cpuBuiltInDoCapacity: 40,
              expansionDiRequired: Math.max(0, totalDi - 40),
              expansionDoRequired: Math.max(0, totalDo - 40),
            },
            options: {
              system,
              startDi: 0,
              startDo: 0,
              startM: 0,
              startD: 0,
              startAiCh: 1,
              startAoCh: 1,
              cpuModel: "FX5U-80MT",
              includeStandardPanelSignals: true,
            },
          };
        }
      } catch {
        // Fallback to auto generation if invalid JSON
      }
    }

    if (!allocationResult) {
      allocationResult = generatePlcAddressesFromComponents(
        project.components.map((c) => ({
          id: c.id,
          partType: c.partType,
          partName: c.partName,
          kelompok: c.kelompok,
          qty: c.qty,
          catatanPr: c.catatanPr,
        })),
        { system }
      );
    }

    const safeProj = project.nama.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 30);
    const isCsvFormat = searchParams.get("format")?.toLowerCase() === "csv";

    if (isCsvFormat) {
      const csvBuffer = await exportPlcAddressesToCsvBuffer(
        allocationResult,
        {
          nama: project.nama,
          client: project.client,
          kode: project.kode,
        },
        {
          namaPerusahaan: settings.namaPerusahaan,
          alamatPerusahaan: settings.alamatPerusahaan,
          telpPerusahaan: settings.telpPerusahaan,
          faxPerusahaan: settings.faxPerusahaan,
        }
      );

      return new NextResponse(csvBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="Tabel_IO_PLC_${safeProj}.csv"`,
        },
      });
    }

    const buffer = await exportPlcAddressesToBuffer(
      allocationResult,
      {
        nama: project.nama,
        client: project.client,
        kode: project.kode,
      },
      {
        namaPerusahaan: settings.namaPerusahaan,
        alamatPerusahaan: settings.alamatPerusahaan,
        telpPerusahaan: settings.telpPerusahaan,
        faxPerusahaan: settings.faxPerusahaan,
      }
    );

    const filename = `Tabel_IO_PLC_${safeProj}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("GET /api/export/plc-addresses error:", err);
    return NextResponse.json(
      { error: "Gagal mengekspor tabel pengelamatan PLC." },
      { status: 500 }
    );
  }
}
