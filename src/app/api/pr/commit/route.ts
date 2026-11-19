import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr, toIsoDateStr } from "@/lib/date-utils";
import {
  applyDuplicateResolutions,
  mergePrComponents,
  type ExistingComponentRecord,
} from "@/lib/pr-parser";
import type { ComponentImportStatus, PurchaseStatus } from "@/lib/constants";
import { syncAutoPanelLayoutForProject } from "@/lib/panel-layout-sync";
import { prImportCommitSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = prImportCommitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data import PR tidak valid" },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const resolvedRows = applyDuplicateResolutions(
      d.rows,
      d.duplicateResolutions
    );

    const result = await prisma.$transaction(async (tx) => {
      let targetProjectId = d.projectId ?? null;

      if (d.targetMode === "NEW_PROJECT") {
        if (!d.newProject) {
          throw new Error("Data proyek baru belum diisi.");
        }
        const createdProj = await tx.project.create({
          data: {
            kode: d.newProject.kode || null,
            nama: d.newProject.nama,
            client: d.newProject.client,
            prioritas: d.newProject.prioritas,
            deadline: fromIsoDateStr(d.newProject.deadline),
            status: "MENUNGGU_KOMPONEN",
            prStatus: "PREPARED",
          },
        });
        targetProjectId = createdProj.id;
      }

      if (!targetProjectId) {
        throw new Error("Pilih proyek tujuan terlebih dahulu.");
      }

      const existingComponents = await tx.component.findMany({
        where: { projectId: targetProjectId },
        orderBy: { urutan: "asc" },
      });

      let summary = {
        mode:
          existingComponents.length > 0 && d.importMode === "MERGE"
            ? "MERGE"
            : existingComponents.length > 0 && d.importMode === "APPEND"
            ? "APPEND"
            : "INITIAL",
        totalSaved: 0,
        updated: 0,
        inserted: 0,
        missingInRevision: 0,
      };

      if (existingComponents.length > 0 && d.importMode === "APPEND") {
        const startUrutan = existingComponents.reduce(
          (max, c) => Math.max(max, c.urutan),
          0
        );

        for (let i = 0; i < resolvedRows.length; i++) {
          const r = resolvedRows[i];
          const hargaSatuan = r.hargaSatuan;
          const qty = r.qty ?? 1;
          const total =
            r.total ?? (hargaSatuan !== null ? hargaSatuan * qty : null);

          await tx.component.create({
            data: {
              projectId: targetProjectId,
              urutan: startUrutan + i + 1,
              kelompok: r.kelompok,
              noPr: r.noPr,
              partType: (r.partType ?? "-").trim() || "-",
              partName: (r.partName ?? "-").trim() || "-",
              supplier: r.supplier,
              qty,
              unit: r.unit,
              catatanPr: r.catatanPr,
              tanggalPakai: fromIsoDateStr(r.tanggalPakai),
              hargaSatuan,
              hargaRaw: r.hargaRaw,
              total,
              statusPembelian: "BELUM_PR",
              perluDicek: r.perluDicek,
              alasanDicek: r.alasan.length ? r.alasan.join("; ") : null,
              statusImport: "NORMAL",
            },
          });
        }

        summary = {
          mode: "APPEND",
          totalSaved: resolvedRows.length,
          updated: 0,
          inserted: resolvedRows.length,
          missingInRevision: 0,
        };
      } else if (existingComponents.length > 0 && d.importMode === "MERGE") {
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

        const mergePlan = mergePrComponents(existingRecords, resolvedRows);
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
                perluDicek: item.perluDicek,
                alasanDicek: item.alasanDicek,
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
                perluDicek: item.perluDicek,
                alasanDicek: item.alasanDicek,
                statusImport: item.statusImport,
              },
            });
          }
        }

        summary = {
          mode: "MERGE",
          totalSaved: mergePlan.items.length,
          updated: mergePlan.summary.updated,
          inserted: mergePlan.summary.inserted,
          missingInRevision: mergePlan.summary.missingInRevision,
        };
      } else {
        if (existingComponents.length > 0) {
          await tx.workItemComponent.deleteMany({
            where: { component: { projectId: targetProjectId } },
          });
          await tx.component.deleteMany({
            where: { projectId: targetProjectId },
          });
        }

        const componentsToCreate = resolvedRows.map((r, i) => {
          const hargaSatuan = r.hargaSatuan;
          const qty = r.qty ?? 1;
          const total =
            r.total ?? (hargaSatuan !== null ? hargaSatuan * qty : null);

          return {
            projectId: targetProjectId,
            urutan: i + 1,
            kelompok: r.kelompok,
            noPr: r.noPr,
            partType: (r.partType ?? "-").trim() || "-",
            partName: (r.partName ?? "-").trim() || "-",
            supplier: r.supplier,
            qty,
            unit: r.unit,
            catatanPr: r.catatanPr,
            tanggalPakai: fromIsoDateStr(r.tanggalPakai),
            hargaSatuan,
            hargaRaw: r.hargaRaw,
            total,
            statusPembelian: "BELUM_PR",
            perluDicek: r.perluDicek,
            alasanDicek: r.alasan.length ? r.alasan.join("; ") : null,
            statusImport: "NORMAL",
          };
        });

        if (componentsToCreate.length > 0) {
          await tx.component.createMany({
            data: componentsToCreate,
          });
        }

        summary = {
          mode: "INITIAL",
          totalSaved: resolvedRows.length,
          updated: 0,
          inserted: resolvedRows.length,
          missingInRevision: 0,
        };
      }

      await tx.prImport.create({
        data: {
          projectId: targetProjectId,
          namaFile: d.namaFile,
          tanggalRevisi: fromIsoDateStr(d.tanggalRevisi),
          mode: summary.mode,
          headerJson: d.header ? JSON.stringify(d.header) : null,
          ringkasanJson: JSON.stringify(summary),
        },
      });

      return { projectId: targetProjectId, summary };
    },
    {
      maxWait: 15000, // 15 detik waktu tunggu antrian pool koneksi DB
      timeout: 60000, // 60 detik batas timeout transaksi interaktif
    });

    // Sinkronkan layout panel 2D di luar transaksi agar tidak membebani batas waktu transaksi DB
    try {
      await syncAutoPanelLayoutForProject(prisma, result.projectId);
    } catch (layoutErr) {
      console.warn("Auto-sync panel layout non-critical warning:", layoutErr);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/pr/commit error:", err);
    let errorMsg = "Gagal menyimpan hasil import PR ke database.";
    if (err instanceof Error) {
      if (
        err.message.includes("Transaction already closed") ||
        err.message.includes("timeout")
      ) {
        errorMsg =
          "Waktu penyimpanan ke database habis karena kendala latensi server cloud. Silakan coba klik simpan sekali lagi.";
      } else {
        errorMsg = err.message;
      }
    }
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
