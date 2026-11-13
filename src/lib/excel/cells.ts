import type { CellValue, Worksheet } from "exceljs";

/** Ambil nilai sel ExcelJS sebagai primitive (richText, formula, hyperlink, date). */
export function cellToPrimitive(v: CellValue | undefined): string | number | Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() === "" ? null : v;
  if (typeof v === "number" || v instanceof Date) return v;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      const t = (o.richText as { text: string }[]).map((r) => r.text).join("");
      return t.trim() === "" ? null : t;
    }
    if ("result" in o) return cellToPrimitive(o.result as CellValue);
    if ("text" in o) return cellToPrimitive(o.text as CellValue);
    if ("error" in o) return null;
  }
  return String(v);
}

export function cellText(ws: Worksheet, row: number, col: number): string | null {
  const v = masterValue(ws, row, col);
  if (v === null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

/** Nilai sel dengan memperhitungkan merged cell (ambil master / kiri atas). */
export function masterValue(ws: Worksheet, row: number, col: number) {
  const cell = ws.getCell(row, col);
  const master = cell.isMerged ? cell.master : cell;
  return cellToPrimitive(master.value);
}
