import { NextResponse } from "next/server";
import type { ComponentImportStatus, PurchaseStatus } from "@/lib/constants";
import { fromIsoDateStr, todayIsoLocal, toIsoDateStr } from "@/lib/date-utils";
import { prisma } from "@/lib/db";
import { buildPrExportFilename } from "@/lib/export/pr-exporter";
import {
  mergePrComponents,
  type ExistingComponentRecord,
  type ParsedComponent,
} from "@/lib/pr-parser";
import { syncAutoPanelLayoutForProject } from "@/lib/panel-layout-sync";
import { prWebSaveSchema } from "@/lib/validation/schemas";

function makeMatchKey(partType: string, partName: string): string {
  return `${partType.trim().toLowerCase().replace(/\s+/g, " ")}||${partName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")}`;
}

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

    let header: Record<string, unknown> | null = null;
    let footer: Record<string, unknown> | null = null;
    const latestPr = project.prImports[0];
    if (latestPr?.headerJson) {
      try {
        const parsed = JSON.parse(latestPr.headerJson) as Record<
          string,
          unknown
        >;
        if (parsed && typeof parsed === "object") {
          header = (parsed.header as Record<string, unknown>) ?? parsed;
          footer = (parsed.footer as Record<string, unknown>) ?? null;
        }
      } catch {
        // abaikan
      }
    }

    return NextResponse.json({
      project: {
        id: project.id,
        kode: project.kode,
        nama: project.nama,
        client: project.client,
        pic: project.pic,
        komponenInti: project.komponenInti,
      },
      header,
      footer,
      items: project.components.map((c, idx) => ({
        id: c.id,
        kelompok: c.kelompok,
        noPr: c.noPr ?? String(idx + 1),
        partType: c.partType,
        partName: c.partName,
        supplier: c.supplier ?? "",
        qty: c.qty,
        unit: c.unit ?? "pcs",
        catatanPr: c.catatanPr ?? "",
        tanggalPakai: toIsoDateStr(c.tanggalPakai) ?? "",
        hargaSatuan: c.hargaSatuan,
        statusPembelian: c.statusPembelian,
      })),
    });
  } catch (err) {
    console.error("GET /api/pr/save-web error:", err);
    return NextResponse.json(
      { error: "Gagal memuat daftar komponen PR proyek." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = prWebSaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Data komponen PR tidak valid.",
        },
        { status: 400 }
      );
    }

    const d = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      let targetProjectId = d.projectId ?? null;
      let projectNameForFile = d.footer?.partsName || "PROYEK";

      if (d.targetMode === "NEW_PROJECT") {
        if (!d.newProject) {
          throw new Error("Data proyek baru belum diisi.");
        }
        const createdProj = await tx.project.create({
          data: {
            kode: d.newProject.kode || d.footer?.jobNumber || null,
            nama: d.newProject.nama,
            client: d.newProject.client,
            komponenInti:
              d.komponenInti || d.newProject.komponenInti || null,
            prioritas: d.newProject.prioritas,
            deadline: fromIsoDateStr(d.newProject.deadline),
            status: "MENUNGGU_KOMPONEN",
            prStatus: "PREPARED",
            pic: d.header?.prepared || null,
          },
        });
        targetProjectId = createdProj.id;
        projectNameForFile = createdProj.nama;
      } else {
        if (!targetProjectId) {
          throw new Error("Pilih proyek tujuan terlebih dahulu.");
        }
        const existingProj = await tx.project.findUnique({
          where: { id: targetProjectId },
        });
        if (!existingProj) {
          throw new Error("Proyek tujuan tidak ditemukan.");
        }
        projectNameForFile = existingProj.nama;
        if (d.komponenInti !== undefined && d.komponenInti !== null) {
          await tx.project.update({
            where: { id: targetProjectId },
            data: {
              komponenInti: d.komponenInti.trim() || null,
            },
          });
        }
      }

      const existingComponents = await tx.component.findMany({
        where: { projectId: targetProjectId },
        orderBy: { urutan: "asc" },
      });

      let summary = {
        mode:
          existingComponents.length > 0 && d.saveMode === "MERGE"
            ? "WEB_MERGE"
            : "WEB_SYNC",
        totalSaved: d.items.length,
        updated: 0,
        inserted: 0,
        missingInRevision: 0,
      };

      if (existingComponents.length > 0 && d.saveMode === "MERGE") {
        const existingRecords: ExistingComponentRecord[] =
          existingComponents.map((c) => ({
            id: c.id,
            urutan: c.urutan,
            kelompok: c.kelompok,
            noPr: c.noPr,
            partType: c.partType,
            partName: c.partName,
            supplier: c.supplier,
            qty: c.qty,
            unit: c.unit,
            catatanPr: c.catatanPr,
            tanggalPakai: toIsoDateStr(c.tanggalPakai),
            hargaSatuan: c.hargaSatuan,
            hargaRaw: c.hargaRaw,
            total: c.total,
            statusPembelian: c.statusPembelian as PurchaseStatus,
            estimasiTiba: toIsoDateStr(c.estimasiTiba),
            perluDicek: c.perluDicek,
            alasanDicek: c.alasanDicek,
            statusImport: c.statusImport as ComponentImportStatus,
            catatan: c.catatan,
          }));

        const incomingRows: ParsedComponent[] = d.items.map((item, idx) => ({
          tempId: `web-${idx + 1}`,
          rowNumber: 9 + idx,
          kelompok: item.kelompok,
          noPr: item.noPr ?? String(idx + 1),
          partType: item.partType,
          partName: item.partName,
          supplier: item.supplier ?? null,
          qty: item.qty,
          unit: item.unit,
          catatanPr: item.catatanPr ?? null,
          tanggalPakai: item.tanggalPakai ?? null,
          hargaSatuan: item.hargaSatuan,
          hargaRaw:
            item.hargaSatuan !== null ? String(item.hargaSatuan) : null,
          total:
            item.hargaSatuan !== null
              ? Math.round(item.qty * item.hargaSatuan)
              : null,
          perluDicek: false,
          alasan: [],
          state: "OK",
        }));

        const mergePlan = mergePrComponents(existingRecords, incomingRows);
        for (const item of mergePlan.items) {
          if (
            (item.action === "UPDATE" || item.action === "MARK_MISSING") &&
            item.existingId
          ) {
            await tx.component.update({
              where: { id: item.existingId },
              data: {
                urutan: item.urutan,
                kelompok: item.kelompok,
                noPr: item.noPr,
                partType: item.partType,
                partName: item.partName,
                supplier: item.supplier,
                qty: item.qty,
                unit: item.unit,
                catatanPr: item.catatanPr,
                tanggalPakai: fromIsoDateStr(item.tanggalPakai),
                hargaSatuan: item.hargaSatuan,
                hargaRaw: item.hargaRaw,
                total: item.total,
                perluDicek: false,
                alasanDicek: null,
                statusImport: item.statusImport,
              },
            });
          } else if (item.action === "INSERT") {
            await tx.component.create({
              data: {
                projectId: targetProjectId,
                urutan: item.urutan,
                kelompok: item.kelompok,
                noPr: item.noPr,
                partType: item.partType,
                partName: item.partName,
                supplier: item.supplier,
                qty: item.qty,
                unit: item.unit,
                catatanPr: item.catatanPr,
                tanggalPakai: fromIsoDateStr(item.tanggalPakai),
                hargaSatuan: item.hargaSatuan,
                hargaRaw: item.hargaRaw,
                total: item.total,
                statusPembelian: item.statusPembelian,
                perluDicek: false,
                alasanDicek: null,
                statusImport: item.statusImport,
              },
            });
          }
        }

        summary = {
          mode: "WEB_MERGE",
          totalSaved: mergePlan.items.length,
          updated: mergePlan.summary.updated,
          inserted: mergePlan.summary.inserted,
          missingInRevision: mergePlan.summary.missingInRevision,
        };
      } else {
        // Mode REPLACE / SYNC: pertahankan statusPembelian, estimasiTiba, dan catatan untuk komponen yang cocok
        const prevMap = new Map<
          string,
          {
            statusPembelian: string;
            estimasiTiba: Date | null;
            catatan: string | null;
          }[]
        >();
        for (const c of existingComponents) {
          const k = makeMatchKey(c.partType, c.partName);
          const list = prevMap.get(k) ?? [];
          list.push({
            statusPembelian: c.statusPembelian,
            estimasiTiba: c.estimasiTiba,
            catatan: c.catatan,
          });
          prevMap.set(k, list);
        }

        if (existingComponents.length > 0) {
          await tx.workItemComponent.deleteMany({
            where: { component: { projectId: targetProjectId } },
          });
          await tx.component.deleteMany({
            where: { projectId: targetProjectId },
          });
        }

        let preservedCount = 0;
        for (let i = 0; i < d.items.length; i++) {
          const item = d.items[i];
          const k = makeMatchKey(item.partType, item.partName);
          const matchedPrev = prevMap.get(k)?.shift();
          if (matchedPrev) preservedCount++;

          const total =
            item.hargaSatuan !== null
              ? Math.round(item.qty * item.hargaSatuan)
              : null;

          await tx.component.create({
            data: {
              projectId: targetProjectId,
              urutan: i + 1,
              kelompok: item.kelompok,
              noPr: item.noPr ?? String(i + 1),
              partType: item.partType,
              partName: item.partName,
              supplier: item.supplier ?? null,
              qty: item.qty,
              unit: item.unit || "pcs",
              catatanPr: item.catatanPr ?? null,
              tanggalPakai: fromIsoDateStr(item.tanggalPakai),
              hargaSatuan: item.hargaSatuan,
              hargaRaw:
                item.hargaSatuan !== null ? String(item.hargaSatuan) : null,
              total,
              statusPembelian: matchedPrev?.statusPembelian ?? "BELUM_PR",
              estimasiTiba: matchedPrev?.estimasiTiba ?? null,
              catatan: matchedPrev?.catatan ?? null,
              perluDicek: false,
              alasanDicek: null,
              statusImport: "NORMAL",
            },
          });
        }

        summary = {
          mode: "WEB_SYNC",
          totalSaved: d.items.length,
          updated: preservedCount,
          inserted: d.items.length - preservedCount,
          missingInRevision: 0,
        };
      }

      const prDate = d.header?.tanggalPr || todayIsoLocal();
      await tx.prImport.create({
        data: {
          projectId: targetProjectId,
          namaFile: `[Web PR] ${buildPrExportFilename(projectNameForFile, prDate)}`,
          tanggalRevisi: fromIsoDateStr(prDate),
          mode: summary.mode,
          headerJson: JSON.stringify({
            header: d.header ?? null,
            footer: d.footer ?? null,
          }),
          ringkasanJson: JSON.stringify(summary),
        },
      });

      await syncAutoPanelLayoutForProject(tx, targetProjectId);

      return { projectId: targetProjectId, summary };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/pr/save-web error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan daftar komponen PR.",
      },
      { status: 500 }
    );
  }
}
