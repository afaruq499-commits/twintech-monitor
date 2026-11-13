import type { ParsedComponent } from "./parse-workbook";

export type DuplicateResolution = "MERGE" | "KEEP";

export interface DuplicateGroup {
  key: string;
  partType: string;
  partName: string;
  tempIds: string[];
  rowNumbers: number[];
  kelompoks: string[];
  totalQty: number;
}

export function normalizeComponentKey(
  partType: string | null | undefined,
  partName: string | null | undefined
): string {
  const t = (partType ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const n = (partName ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!t && !n) return "";
  return `${t}||${n}`;
}

export function detectDuplicates(rows: ParsedComponent[]): DuplicateGroup[] {
  const map = new Map<string, ParsedComponent[]>();
  for (const row of rows) {
    const key = normalizeComponentKey(row.partType, row.partName);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, items] of map.entries()) {
    if (items.length < 2) continue;
    groups.push({
      key,
      partType: items[0].partType ?? "-",
      partName: items[0].partName ?? "-",
      tempIds: items.map((i) => i.tempId),
      rowNumbers: items.map((i) => i.rowNumber),
      kelompoks: items.map((i) => i.kelompok),
      totalQty: items.reduce((acc, i) => acc + (i.qty ?? 0), 0),
    });
  }
  return groups;
}

/**
 * Terapkan keputusan user untuk setiap pasangan/grup duplikat:
 * - "MERGE": gabungkan qty ke baris pertama, ambil harga satuan yang tersedia, hitung ulang total.
 * - "KEEP": biarkan terpisah apa adanya.
 */
export function applyDuplicateResolutions(
  rows: ParsedComponent[],
  resolutions: Record<string, DuplicateResolution>
): ParsedComponent[] {
  const groups = detectDuplicates(rows);
  const toMergeKeys = new Set(
    groups.filter((g) => resolutions[g.key] === "MERGE").map((g) => g.key)
  );
  if (toMergeKeys.size === 0) return rows;

  const groupedByKey = new Map<string, ParsedComponent[]>();
  for (const r of rows) {
    const k = normalizeComponentKey(r.partType, r.partName);
    if (toMergeKeys.has(k)) {
      const arr = groupedByKey.get(k) ?? [];
      arr.push(r);
      groupedByKey.set(k, arr);
    }
  }

  const consumedTempIds = new Set<string>();
  const result: ParsedComponent[] = [];

  for (const r of rows) {
    if (consumedTempIds.has(r.tempId)) continue;
    const k = normalizeComponentKey(r.partType, r.partName);
    if (!toMergeKeys.has(k)) {
      result.push(r);
      continue;
    }

    const items = groupedByKey.get(k)!;
    for (const item of items) consumedTempIds.add(item.tempId);

    const totalQty = items.reduce((sum, i) => sum + (i.qty ?? 0), 0);
    const priced = items.find((i) => i.hargaSatuan !== null);
    const hargaSatuan = priced?.hargaSatuan ?? null;
    const hargaRaw = priced?.hargaRaw ?? r.hargaRaw;
    const total = hargaSatuan !== null ? hargaSatuan * totalQty : null;

    const distinctNotes = Array.from(
      new Set(items.map((i) => i.catatanPr).filter(Boolean))
    );
    const distinctNos = Array.from(
      new Set(items.map((i) => i.noPr).filter(Boolean))
    );
    const reasons = Array.from(new Set(items.flatMap((i) => i.alasan)));

    result.push({
      ...r,
      noPr: distinctNos.length ? distinctNos.join(", ") : null,
      qty: totalQty,
      hargaSatuan,
      hargaRaw,
      total,
      catatanPr: distinctNotes.length ? distinctNotes.join(" | ") : null,
      alasan: reasons,
      perluDicek: reasons.length > 0,
      state: reasons.length > 0 ? "CHECK" : "OK",
    });
  }

  return result;
}
