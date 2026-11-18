import type { ComponentImportStatus, PurchaseStatus } from "@/lib/constants";
import type { ParsedComponent } from "./parse-workbook";
import { normalizeComponentKey } from "./duplicates";

export interface ExistingComponentRecord {
  id: string;
  urutan: number;
  kelompok: string;
  noPr: string | null;
  partType: string;
  partName: string;
  supplier: string | null;
  qty: number;
  unit: string | null;
  catatanPr: string | null;
  tanggalPakai: string | null;
  hargaSatuan: number | null;
  hargaRaw: string | null;
  total: number | null;
  statusPembelian: PurchaseStatus;
  estimasiTiba: string | null;
  perluDicek: boolean;
  alasanDicek: string | null;
  statusImport: ComponentImportStatus;
  catatan: string | null;
}

export interface MergedComponentPlan {
  action: "UPDATE" | "INSERT" | "MARK_MISSING";
  existingId?: string;
  urutan: number;
  kelompok: string;
  noPr: string | null;
  partType: string;
  partName: string;
  supplier: string | null;
  qty: number;
  unit: string | null;
  catatanPr: string | null;
  tanggalPakai: string | null;
  hargaSatuan: number | null;
  hargaRaw: string | null;
  total: number | null;
  statusPembelian: PurchaseStatus;
  estimasiTiba: string | null;
  perluDicek: boolean;
  alasanDicek: string | null;
  statusImport: ComponentImportStatus;
  catatan: string | null;
}

export interface MergeImportResult {
  items: MergedComponentPlan[];
  summary: {
    updated: number;
    inserted: number;
    missingInRevision: number;
  };
}

/**
 * Mode MERGE untuk import ulang PR revisi:
 * - Cocokkan berdasarkan tipe + nama (prioritaskan kelompok yang sama bila ada item kembar).
 * - Pertahankan statusPembelian, estimasiTiba, dan catatan user pada item yang cocok.
 * - Tandai baris baru dengan statusImport = "BARU".
 * - Tandai baris lama yang tidak ada di file revisi dengan statusImport = "HILANG_DI_REVISI" (tidak dihapus).
 */
export function mergePrComponents(
  existing: ExistingComponentRecord[],
  incoming: ParsedComponent[]
): MergeImportResult {
  const matchedExistingIds = new Set<string>();
  const items: MergedComponentPlan[] = [];
  let updated = 0;
  let inserted = 0;
  let urutan = 0;

  for (const row of incoming) {
    urutan++;
    const pType = (row.partType ?? "-").trim() || "-";
    const pName = (row.partName ?? "-").trim() || "-";
    const key = normalizeComponentKey(pType, pName);

    // 1. Cari yang tipe+nama DAN kelompok sama dulu (untuk kasus duplikat beda panel)
    let match = existing.find(
      (e) =>
        !matchedExistingIds.has(e.id) &&
        normalizeComponentKey(e.partType, e.partName) === key &&
        e.kelompok.toLowerCase().trim() === row.kelompok.toLowerCase().trim()
    );
    // 2. Fallback: tipe+nama sama
    if (!match) {
      match = existing.find(
        (e) =>
          !matchedExistingIds.has(e.id) &&
          normalizeComponentKey(e.partType, e.partName) === key
      );
    }

    if (match) {
      matchedExistingIds.add(match.id);
      updated++;
      items.push({
        action: "UPDATE",
        existingId: match.id,
        urutan,
        kelompok: row.kelompok,
        noPr: row.noPr,
        partType: pType,
        partName: pName,
        supplier: row.supplier,
        qty: row.qty ?? 1,
        unit: row.unit,
        catatanPr: row.catatanPr,
        tanggalPakai: row.tanggalPakai,
        hargaSatuan: row.hargaSatuan,
        hargaRaw: row.hargaRaw,
        total: row.total,
        // Pertahankan tracking user!
        statusPembelian: match.statusPembelian,
        estimasiTiba: match.estimasiTiba,
        catatan: match.catatan,
        perluDicek: row.perluDicek,
        alasanDicek: row.alasan.length ? row.alasan.join("; ") : null,
        statusImport: "NORMAL",
      });
    } else {
      inserted++;
      items.push({
        action: "INSERT",
        urutan,
        kelompok: row.kelompok,
        noPr: row.noPr,
        partType: pType,
        partName: pName,
        supplier: row.supplier,
        qty: row.qty ?? 1,
        unit: row.unit,
        catatanPr: row.catatanPr,
        tanggalPakai: row.tanggalPakai,
        hargaSatuan: row.hargaSatuan,
        hargaRaw: row.hargaRaw,
        total: row.total,
        statusPembelian: "BELUM_PR",
        estimasiTiba: null,
        catatan: null,
        perluDicek: row.perluDicek,
        alasanDicek: row.alasan.length ? row.alasan.join("; ") : null,
        statusImport: "BARU",
      });
    }
  }

  let missingInRevision = 0;
  for (const oldItem of existing) {
    if (matchedExistingIds.has(oldItem.id)) continue;
    urutan++;
    missingInRevision++;
    items.push({
      action: "MARK_MISSING",
      existingId: oldItem.id,
      urutan,
      kelompok: oldItem.kelompok,
      noPr: oldItem.noPr,
      partType: oldItem.partType,
      partName: oldItem.partName,
      supplier: oldItem.supplier,
      qty: oldItem.qty,
      unit: oldItem.unit,
      catatanPr: oldItem.catatanPr,
      tanggalPakai: oldItem.tanggalPakai,
      hargaSatuan: oldItem.hargaSatuan,
      hargaRaw: oldItem.hargaRaw,
      total: oldItem.total,
      statusPembelian: oldItem.statusPembelian,
      estimasiTiba: oldItem.estimasiTiba,
      perluDicek: oldItem.perluDicek,
      alasanDicek: oldItem.alasanDicek,
      statusImport: "HILANG_DI_REVISI",
      catatan: oldItem.catatan,
    });
  }

  return {
    items,
    summary: { updated, inserted, missingInRevision },
  };
}

/**
 * Mode APPEND untuk menambahkan komponen dari file Excel yang berbeda:
 * - Mempertahankan seluruh komponen lama proyek 100% tanpa menandai HILANG.
 * - Memasukkan semua baris dari file Excel baru sebagai komponen baru (NORMAL).
 */
export function appendPrComponents(
  existing: ExistingComponentRecord[],
  incoming: ParsedComponent[]
): MergeImportResult {
  const items: MergedComponentPlan[] = [];
  const startUrutan = existing.reduce((max, c) => Math.max(max, c.urutan), 0);
  let urutan = startUrutan;

  for (const row of incoming) {
    urutan++;
    const pType = (row.partType ?? "-").trim() || "-";
    const pName = (row.partName ?? "-").trim() || "-";

    items.push({
      action: "INSERT",
      urutan,
      kelompok: row.kelompok,
      noPr: row.noPr,
      partType: pType,
      partName: pName,
      supplier: row.supplier,
      qty: row.qty ?? 1,
      unit: row.unit,
      catatanPr: row.catatanPr,
      tanggalPakai: row.tanggalPakai,
      hargaSatuan: row.hargaSatuan,
      hargaRaw: row.hargaRaw,
      total: row.total,
      statusPembelian: "BELUM_PR",
      estimasiTiba: null,
      catatan: null,
      perluDicek: row.perluDicek,
      alasanDicek: row.alasan.length ? row.alasan.join("; ") : null,
      statusImport: "NORMAL",
    });
  }

  return {
    items,
    summary: {
      updated: 0,
      inserted: incoming.length,
      missingInRevision: 0,
    },
  };
}

