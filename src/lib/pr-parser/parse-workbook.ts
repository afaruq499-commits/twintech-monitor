import ExcelJS from "exceljs";
import { cellText, masterValue } from "@/lib/excel/cells";
import { parsePrice } from "./price";

export type RowState = "OK" | "CHECK" | "ERROR";

export interface ParsedComponent {
  tempId: string;
  rowNumber: number;
  kelompok: string;
  noPr: string | null;
  partType: string | null;
  partName: string | null;
  supplier: string | null;
  qty: number | null;
  unit: string | null;
  catatanPr: string | null;
  tanggalPakai: string | null; // ISO yyyy-mm-dd
  hargaSatuan: number | null;
  hargaRaw: string | null;
  total: number | null;
  perluDicek: boolean;
  alasan: string[];
  state: RowState;
}

export interface PrHeader {
  department: string | null;
  prepared: string | null;
  checked: string | null;
  purchasing: string | null;
  approved: string | null;
}

export interface PrFooter {
  partsName: string | null;
  partsNumber: string | null;
  jobNumber: string | null;
  customer: string | null;
}

export interface ParsedPr {
  header: PrHeader;
  footer: PrFooter;
  revisionDate: string | null;
  groups: string[];
  rows: ParsedComponent[];
  counts: { total: number; ok: number; check: number; error: number };
}

const COL = { NO: 1, TYPE: 2, NAME: 4, DESC: 7, QTY: 8, UNIT: 9, NOTE: 10, DATE: 12, HARGA: 13, TOTAL: 14 };

/** Ambil tanggal revisi dari nama file, mis. "... (10-21-26).xlsx" -> 2026-10-21 (MM-DD-YY). */
export function revisionDateFromFilename(name: string): string | null {
  const m = name.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{2,4})/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  let month = Number(mm);
  let day = Number(dd);
  if (month > 12 && day <= 12) [month, day] = [day, month]; // toleransi DD-MM-YY
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && v.trim() !== "" ? n : null;
  }
  return null;
}

function toIsoDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const m = trimmed.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
  }
  return null;
}

function findRow(ws: ExcelJS.Worksheet, from: number, to: number, pred: (txt: string) => boolean, col = 1) {
  for (let r = from; r <= to; r++) {
    for (let c = col; c <= Math.min(col + 3, 14); c++) {
      const t = cellText(ws, r, c);
      if (t && pred(t.toUpperCase())) return r;
    }
  }
  return -1;
}

export async function parsePrWorkbook(buffer: ArrayBuffer | Buffer, filename = ""): Promise<ParsedPr> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File Excel tidak memiliki sheet");
  return parsePrWorksheet(ws, filename);
}

export function parsePrWorksheet(ws: ExcelJS.Worksheet, filename = ""): ParsedPr {
  const last = ws.rowCount;
  let headerRow = findRow(ws, 1, Math.min(last, 30), (t) => t.includes("PART TYPE"), 2);
  if (headerRow < 0) headerRow = 8; // fallback sesuai template
  let footerRow = findRow(ws, headerRow + 1, last, (t) => t.trim() === "PARTS NAME");
  if (footerRow < 0) footerRow = last + 1;

  // Header blok tanda tangan (baris di atas tabel)
  const labelPos = (label: string) => {
    for (let r = 1; r < headerRow; r++)
      for (let c = 1; c <= 14; c++) if (cellText(ws, r, c)?.toUpperCase() === label) return { r, c };
    return null;
  };
  const below = (label: string) => {
    const p = labelPos(label);
    return p ? cellText(ws, p.r + 1, p.c) : null;
  };
  const header: PrHeader = {
    department: below("DEPARTMENT"),
    prepared: below("PREPARED"),
    checked: below("CHECKED"),
    purchasing: below("PURCHASING"),
    approved: below("APPROVED"),
  };

  const footerVal = (label: string) => {
    const r = findRow(ws, footerRow, last, (t) => t.trim() === label);
    if (r < 0) return null;
    for (let c = 2; c <= 14; c++) {
      const t = cellText(ws, r, c);
      if (t && t.toUpperCase().trim() !== label) return t;
    }
    return null;
  };
  const footer: PrFooter = {
    partsName: footerVal("PARTS NAME"),
    partsNumber: footerVal("PARTS NUMBER"),
    jobNumber: footerVal("JOB NUMBER"),
    customer: footerVal("CUSTOMER"),
  };

  const rows: ParsedComponent[] = [];
  const groups: string[] = [];
  let groupIdx = 0;
  let inGroup = false;
  let seq = 0;
  let lastRowNo: number | null = null;

  for (let r = headerRow + 1; r < footerRow; r++) {
    const partType = cellText(ws, r, COL.TYPE);
    const partName = cellText(ws, r, COL.NAME);
    const supplier = cellText(ws, r, COL.DESC);
    const qtyRaw = masterValue(ws, r, COL.QTY);
    const harga = masterValue(ws, r, COL.HARGA);
    const isBlank = !partType && !partName && !supplier && qtyRaw === null && harga === null;
    if (isBlank) {
      inGroup = false;
      lastRowNo = null;
      continue;
    }

    const noRaw = cellText(ws, r, COL.NO);
    const noNum = noRaw ? parseInt(noRaw.trim(), 10) : NaN;
    const isNumberReset =
      inGroup &&
      !isNaN(noNum) &&
      noNum === 1 &&
      lastRowNo !== null &&
      lastRowNo > 1;

    if (isNumberReset) {
      groupIdx++;
      groups.push(`Kelompok ${groupIdx}`);
    } else if (!inGroup) {
      groupIdx++;
      groups.push(`Kelompok ${groupIdx}`);
      inGroup = true;
    }
    if (!isNaN(noNum)) {
      lastRowNo = noNum;
    }

    const alasan: string[] = [];
    const qty = toNumber(qtyRaw);
    if (qtyRaw !== null && qty === null) alasan.push(`QTY "${qtyRaw}" bukan angka`);
    if (qtyRaw === null) alasan.push("QTY kosong");
    if (!partName) alasan.push("PARTS NAME kosong");
    if (!partType) alasan.push("PART TYPE kosong");

    const price = parsePrice(harga instanceof Date ? null : harga, qty);
    if (price.needsCheck && price.reason) alasan.push(price.reason);

    const totalCell = toNumber(masterValue(ws, r, COL.TOTAL));
    const total = totalCell ?? price.total;

    const state: RowState = !partType && !partName ? "ERROR" : alasan.length ? "CHECK" : "OK";
    rows.push({
      tempId: `r${++seq}`,
      rowNumber: r,
      kelompok: groups[groupIdx - 1],
      noPr: noRaw,
      partType,
      partName,
      supplier,
      qty,
      unit: cellText(ws, r, COL.UNIT),
      catatanPr: cellText(ws, r, COL.NOTE),
      tanggalPakai: toIsoDate(masterValue(ws, r, COL.DATE)),
      hargaSatuan: price.unit,
      hargaRaw: price.raw,
      total,
      perluDicek: state !== "OK",
      alasan,
      state,
    });
  }

  // Beri nama kelompok yang bermakna bila bisa dikenali dari note sel / isi kelompok, fallback "Kelompok N"
  const extractNoteText = (note: ExcelJS.Comment | string | undefined): string | null => {
    if (!note) return null;
    if (typeof note === "string") return note;
    if (Array.isArray(note.texts)) {
      return note.texts.map((t) => t.text).join("");
    }
    return null;
  };

  const groupRenameMap = new Map<string, string>();
  const usedNames = new Set<string>();
  groups.forEach((gName, idx) => {
    const gRows = rows.filter((r) => r.kelompok === gName);
    let explicitGroup: string | null = null;
    if (gRows.length > 0) {
      const rawNote = extractNoteText(ws.getCell(gRows[0].rowNumber, COL.NO).note);
      if (rawNote) {
        const m = rawNote.match(/Kelompok:\s*(.+)/i);
        if (m?.[1]?.trim()) {
          explicitGroup = m[1].trim();
        }
      }
    }

    const namesUpper = gRows.map((r) => (r.partName ?? "").toUpperCase());
    const typesUpper = gRows.map((r) => (r.partType ?? "").toUpperCase());
    let inferred: string | null = explicitGroup;
    if (!inferred) {
      const hasBoxPanel =
        namesUpper.some((n) => n.includes("BOX PANEL")) ||
        typesUpper.some((t) => t.includes("BOX PANEL"));
      const hasHmiOrOp =
        namesUpper.some(
          (n) =>
            n.includes("OP PANEL") ||
            n === "HMI" ||
            n.includes("TOUCHSCREEN") ||
            n.includes("GOT") ||
            n.includes("DISPLAY") ||
            n.includes("OPERATOR")
        ) ||
        typesUpper.some(
          (t) =>
            t.includes("OP PANEL") ||
            t.includes("GS2107") ||
            t.includes("GS2110") ||
            t.includes("HMI_") ||
            t.includes("GOT") ||
            t.includes("MT8071") ||
            t.includes("WEINTEK") ||
            t.includes("NB7W")
        );
      const hasSensor =
        namesUpper.some((n) => n.includes("SENSOR")) ||
        typesUpper.some(
          (t) =>
            t.includes("SENSOR") ||
            t.includes("E2E-") ||
            t.includes("TL-W") ||
            t.includes("PHOTO")
        );
      const hasPushOrSwitch = namesUpper.some(
        (n) =>
          n.includes("PUS") ||
          n.includes("PB") ||
          n.includes("SWITCH") ||
          n.includes("LAMP") ||
          n.includes("BUZZER")
      );

      if (hasBoxPanel) {
        inferred = "Panel Utama";
      } else if (hasHmiOrOp) {
        inferred = "OP Panel";
      } else if (hasSensor && hasPushOrSwitch) {
        inferred = "Sensor & Push Button";
      } else if (hasSensor) {
        inferred = "Sensor & Push Button";
      } else if (hasPushOrSwitch) {
        inferred = "OP Panel";
      }
    }
    const finalName =
      inferred && !usedNames.has(inferred) ? inferred : `Kelompok ${idx + 1}`;
    usedNames.add(finalName);
    groupRenameMap.set(gName, finalName);
  });

  const renamedGroups = groups.map((g) => groupRenameMap.get(g) ?? g);
  for (const r of rows) {
    r.kelompok = groupRenameMap.get(r.kelompok) ?? r.kelompok;
  }

  const counts = {
    total: rows.length,
    ok: rows.filter((r) => r.state === "OK").length,
    check: rows.filter((r) => r.state === "CHECK").length,
    error: rows.filter((r) => r.state === "ERROR").length,
  };
  return {
    header,
    footer,
    revisionDate: revisionDateFromFilename(filename),
    groups: renamedGroups,
    rows,
    counts,
  };
}
