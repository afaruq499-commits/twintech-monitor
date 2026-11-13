import { NextResponse } from "next/server";
import { filterExportablePrItems } from "@/lib/constants";
import { todayIsoLocal, toIsoDateStr } from "@/lib/date-utils";
import { prisma } from "@/lib/db";
import {
  buildPrExportFilename,
  exportPrToBuffer,
  type ExportPrFooterInfo,
  type ExportPrHeaderInfo,
  type PrNoteCategory,
} from "@/lib/export/pr-exporter";
import { prExportPayloadSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "Parameter projectId wajib diisi." },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        components: {
          where: { statusImport: { not: "HILANG_DI_REVISI" } },
          orderBy: [{ urutan: "asc" }, { createdAt: "asc" }],
        },
        prImports: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyek tidak ditemukan." },
        { status: 404 }
      );
    }

    const savedHeader: ExportPrHeaderInfo = {
      department: "ENGINEERING",
      noteCategory: "NEW PROJECT",
      prepared: project.pic || "FARUQ",
      checked: "IVAN",
      purchasing: "TETI NURBAETI",
      approved: null,
      tanggalPr: todayIsoLocal(),
    };
    let savedFooter: ExportPrFooterInfo = {
      partsName: project.nama,
      partsNumber: "SPM",
      jobNumber: project.kode,
      customer: project.client,
    };

    const latestPr = project.prImports[0];
    if (latestPr?.headerJson) {
      try {
        const parsedMeta = JSON.parse(latestPr.headerJson) as Record<
          string,
          unknown
        >;
        if (parsedMeta && typeof parsedMeta === "object") {
          const hdrSrc = (parsedMeta.header ?? parsedMeta) as Record<
            string,
            unknown
          >;
          if (typeof hdrSrc.department === "string" && hdrSrc.department) {
            savedHeader.department = hdrSrc.department;
          }
          if (typeof hdrSrc.noteCategory === "string" && hdrSrc.noteCategory) {
            savedHeader.noteCategory = hdrSrc.noteCategory as PrNoteCategory;
          }
          if (typeof hdrSrc.prepared === "string") {
            savedHeader.prepared = hdrSrc.prepared;
          }
          if (typeof hdrSrc.checked === "string") {
            savedHeader.checked = hdrSrc.checked;
          }
          if (typeof hdrSrc.purchasing === "string") {
            savedHeader.purchasing = hdrSrc.purchasing;
          }
          if (typeof hdrSrc.approved === "string") {
            savedHeader.approved = hdrSrc.approved;
          }

          if (parsedMeta.footer && typeof parsedMeta.footer === "object") {
            const ftrSrc = parsedMeta.footer as Record<string, unknown>;
            savedFooter = {
              partsName:
                (typeof ftrSrc.partsName === "string" && ftrSrc.partsName) ||
                project.nama,
              partsNumber:
                (typeof ftrSrc.partsNumber === "string" &&
                  ftrSrc.partsNumber) ||
                "SPM",
              jobNumber:
                (typeof ftrSrc.jobNumber === "string" && ftrSrc.jobNumber) ||
                project.kode,
              customer:
                (typeof ftrSrc.customer === "string" && ftrSrc.customer) ||
                project.client,
            };
          }
        }
      } catch {
        // abaikan bila format JSON lama berbeda
      }
    }

    const exportableComponents = filterExportablePrItems(project.components);
    if (exportableComponents.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada komponen yang perlu di-export ke PR karena seluruh part berstatus Sudah Ada / Sudah Datang / Terpasang.",
        },
        { status: 400 }
      );
    }

    const buffer = await exportPrToBuffer({
      header: savedHeader,
      footer: savedFooter,
      items: exportableComponents.map((c, idx) => ({
        kelompok: c.kelompok,
        noPr: String(idx + 1),
        partType: c.partType,
        partName: c.partName,
        supplier: c.supplier,
        qty: c.qty,
        unit: c.unit ?? "pcs",
        catatanPr: c.catatanPr,
        tanggalPakai: toIsoDateStr(c.tanggalPakai),
        hargaSatuan: c.hargaSatuan,
        total: c.total,
      })),
    });

    const filename = buildPrExportFilename(project.nama, todayIsoLocal());

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("GET /api/export/pr error:", err);
    return NextResponse.json(
      { error: "Gagal mengekspor dokumen Purchase Requisition ke Excel." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = prExportPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Data export PR tidak valid.",
        },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const exportableItems = filterExportablePrItems(d.items);
    if (exportableItems.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada item yang perlu di-export ke PR karena seluruh komponen berstatus Sudah Ada / Sudah Datang / Terpasang.",
        },
        { status: 400 }
      );
    }

    const buffer = await exportPrToBuffer({
      header: d.header,
      footer: d.footer,
      items: exportableItems.map((item, idx) => ({
        kelompok: item.kelompok,
        noPr: String(idx + 1),
        partType: item.partType,
        partName: item.partName,
        supplier: item.supplier,
        qty: item.qty,
        unit: item.unit,
        catatanPr: item.catatanPr,
        tanggalPakai: item.tanggalPakai,
        hargaSatuan: item.hargaSatuan,
        total:
          item.hargaSatuan !== null ? Math.round(item.qty * item.hargaSatuan) : null,
      })),
    });

    const filename = buildPrExportFilename(
      d.footer?.partsName || "DAFTAR KOMPONEN PR",
      d.header?.tanggalPr || todayIsoLocal()
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("POST /api/export/pr error:", err);
    return NextResponse.json(
      { error: "Gagal membuat file Excel Purchase Requisition." },
      { status: 500 }
    );
  }
}
