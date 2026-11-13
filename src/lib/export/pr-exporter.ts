import ExcelJS from "exceljs";

export type PrNoteCategory =
  | "NEW PROJECT"
  | "INVENTORY"
  | "EXPENSES"
  | "NON INVENTORY";

export interface ExportPrHeaderInfo {
  department?: string | null;
  noteCategory?: PrNoteCategory | null;
  prepared?: string | null;
  checked?: string | null;
  purchasing?: string | null;
  approved?: string | null;
  tanggalPr?: string | null; // YYYY-MM-DD opsional
}

export interface ExportPrFooterInfo {
  partsName?: string | null;
  partsNumber?: string | null;
  jobNumber?: string | null;
  customer?: string | null;
}

export interface ExportPrItemInput {
  kelompok: string;
  noPr?: string | null;
  partType: string;
  partName: string;
  supplier?: string | null;
  qty: number;
  unit?: string | null;
  catatanPr?: string | null;
  tanggalPakai?: string | null; // YYYY-MM-DD
  hargaSatuan?: number | null;
  total?: number | null;
}

export interface ExportPrWorkbookInput {
  header?: ExportPrHeaderInfo;
  footer?: ExportPrFooterInfo;
  items: ExportPrItemInput[];
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

function applyBoxBorder(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number
) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = {
        top: r === r1 ? { style: "thin" } : undefined,
        bottom: r === r2 ? { style: "thin" } : undefined,
        left: c === c1 ? { style: "thin" } : undefined,
        right: c === c2 ? { style: "thin" } : undefined,
      };
    }
  }
}

function applyAllThinBorders(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number
) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = THIN_BORDER;
    }
  }
}

/**
 * Membangun nama file PR standar sesuai konvensi File 1:
 * PURCHASE REQUISITION - <NAMA PROYEK> (<MM-DD-YY>).xlsx
 */
export function buildPrExportFilename(
  projectName: string,
  isoDate?: string | null
): string {
  const cleanName =
    projectName
      .trim()
      .toUpperCase()
      .replace(/[\\/*?:[\]"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "PROJECT";

  let datePart = "";
  if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [yyyy, mm, dd] = isoDate.split("-");
    datePart = ` (${mm}-${dd}-${yyyy.slice(2)})`;
  } else {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(2);
    datePart = ` (${mm}-${dd}-${yy})`;
  }

  return `PURCHASE REQUISITION - ${cleanName}${datePart}.xlsx`;
}

/**
 * Mengekspor daftar komponen ke buffer Excel (.xlsx) yang mereplikasi penuh
 * struktur File 1 (PURCHASE REQUISITION) dan 100% kompatibel untuk di-import kembali.
 */
export async function exportPrToBuffer(
  input: ExportPrWorkbookInput
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      },
    },
  });

  // Lebar kolom A..N mereplikasi File 1
  const colWidths = [
    4.5, // A: NO.
    34.66, // B: PART TYPE (1)
    17.33, // C: PART TYPE (2)
    12.66, // D: PARTS NAME (1)
    4.44, // E: PARTS NAME (2)
    21.33, // F: PARTS NAME (3)
    15, // G: DESCRIPTION (Supplier)
    8, // H: QTY
    8, // I: Unit
    11, // J: NOTE (1)
    35, // K: NOTE (2)
    14, // L: DATE OF USE
    17.5, // M: HARGA
    18.5, // N: TOTAL
  ];
  colWidths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  for (let r = 1; r <= 8; r++) {
    ws.getRow(r).height = r === 8 ? 18 : 16;
  }

  // ==================== BARIS 1-2: JUDUL UTAMA ====================
  ws.mergeCells("A1:L2");
  applyBoxBorder(ws, 1, 1, 2, 12);
  const titleCell = ws.getCell("A1");
  titleCell.value = "PURCHASE REQUISITION";
  titleCell.font = { name: "Arial", size: 18, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // ==================== BARIS 3: HEADER KOTAK TANDA TANGAN ====================
  ws.mergeCells("A3:B3");
  ws.mergeCells("C3:F3");
  ws.mergeCells("H3:J3");

  const headerBoxes: { addr: string; label: string; r1: number; c1: number; r2: number; c2: number }[] = [
    { addr: "A3", label: "DEPARTMENT", r1: 3, c1: 1, r2: 3, c2: 2 },
    { addr: "C3", label: "NOTE", r1: 3, c1: 3, r2: 3, c2: 6 },
    { addr: "G3", label: "PREPARED", r1: 3, c1: 7, r2: 3, c2: 7 },
    { addr: "H3", label: "CHECKED", r1: 3, c1: 8, r2: 3, c2: 10 },
    { addr: "K3", label: "PURCHASING", r1: 3, c1: 11, r2: 3, c2: 11 },
    { addr: "L3", label: "APPROVED", r1: 3, c1: 12, r2: 3, c2: 12 },
  ];

  for (const hb of headerBoxes) {
    applyBoxBorder(ws, hb.r1, hb.c1, hb.r2, hb.c2);
    const cell = ws.getCell(hb.addr);
    cell.value = hb.label;
    cell.font = { name: "Arial", size: 10, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }

  // ==================== BARIS 4-7: ISI DEPARTMENT, NOTE, TANDA TANGAN ====================
  const hdr = input.header ?? {};
  const activeNoteCategory = hdr.noteCategory ?? "NEW PROJECT";

  // DEPARTMENT (A4:B7)
  ws.mergeCells("A4:B7");
  applyBoxBorder(ws, 4, 1, 7, 2);
  const deptCell = ws.getCell("A4");
  deptCell.value = (hdr.department ?? "ENGINEERING").trim() || "ENGINEERING";
  deptCell.font = { name: "Roboto", size: 10, bold: true };
  deptCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  // 4 Kotak Kategori NOTE
  const noteBoxes: {
    merge: string;
    addr: string;
    label: PrNoteCategory;
    r1: number;
    c1: number;
    r2: number;
    c2: number;
  }[] = [
    { merge: "C4:E5", addr: "C4", label: "NEW PROJECT", r1: 4, c1: 3, r2: 5, c2: 5 },
    { merge: "F4:F5", addr: "F4", label: "INVENTORY", r1: 4, c1: 6, r2: 5, c2: 6 },
    { merge: "C6:E7", addr: "C6", label: "EXPENSES", r1: 6, c1: 3, r2: 7, c2: 5 },
    { merge: "F6:F7", addr: "F6", label: "NON INVENTORY", r1: 6, c1: 6, r2: 7, c2: 6 },
  ];

  for (const nb of noteBoxes) {
    ws.mergeCells(nb.merge);
    applyBoxBorder(ws, nb.r1, nb.c1, nb.r2, nb.c2);
    const c = ws.getCell(nb.addr);
    c.value = nb.label;
    c.font = { name: "Arial", size: 10, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle" };
    if (activeNoteCategory === nb.label) {
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF2CC" },
      };
    }
  }

  // Kotak Tanda Tangan (Baris 4-6) & Sub-kotak Tanggal (Baris 7)
  ws.mergeCells("G4:G6");
  applyBoxBorder(ws, 4, 7, 6, 7);
  ws.getCell("G4").value = hdr.prepared?.trim() || null;
  ws.getCell("G4").font = { name: "Arial", size: 10, bold: true };
  ws.getCell("G4").alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  ws.mergeCells("H4:J6");
  applyBoxBorder(ws, 4, 8, 6, 10);
  ws.getCell("H4").value = hdr.checked?.trim() || null;
  ws.getCell("H4").font = { name: "Arial", size: 10, bold: true };
  ws.getCell("H4").alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  ws.mergeCells("K4:K6");
  applyBoxBorder(ws, 4, 11, 6, 11);
  ws.getCell("K4").value = hdr.purchasing?.trim() || null;
  ws.getCell("K4").font = { name: "Arial", size: 10, bold: true };
  ws.getCell("K4").alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  ws.mergeCells("L4:L6");
  applyBoxBorder(ws, 4, 12, 6, 12);
  ws.getCell("L4").value = hdr.approved?.trim() || null;
  ws.getCell("L4").font = { name: "Arial", size: 10, bold: true };
  ws.getCell("L4").alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  // Baris 7 (sub-kotak tanda tangan)
  ws.mergeCells("H7:J7");
  applyBoxBorder(ws, 7, 7, 7, 7);
  applyBoxBorder(ws, 7, 8, 7, 10);
  applyBoxBorder(ws, 7, 11, 7, 11);
  applyBoxBorder(ws, 7, 12, 7, 12);
  if (hdr.tanggalPr) {
    ws.getCell("G7").value = hdr.tanggalPr;
    ws.getCell("G7").font = { name: "Arial", size: 8.5 };
    ws.getCell("G7").alignment = { horizontal: "center", vertical: "middle" };
  }

  // ==================== BARIS 8: HEADER TABEL KOMPONEN ====================
  ws.mergeCells("B8:C8");
  ws.mergeCells("D8:F8");
  ws.mergeCells("J8:K8");
  applyAllThinBorders(ws, 8, 1, 8, 14);

  const tableHeaders: { addr: string; text: string; fontName: string; size: number }[] = [
    { addr: "A8", text: "NO.", fontName: "Roboto", size: 11 },
    { addr: "B8", text: "PART TYPE", fontName: "Roboto", size: 11 },
    { addr: "D8", text: "PARTS NAME", fontName: "Roboto", size: 11 },
    { addr: "G8", text: "DESCRIPTION", fontName: "Roboto", size: 11 },
    { addr: "H8", text: "QTY", fontName: "Arial", size: 10 },
    { addr: "I8", text: "Unit", fontName: "Arial", size: 10 },
    { addr: "J8", text: "NOTE", fontName: "Arial", size: 10 },
    { addr: "L8", text: "DATE OF USE", fontName: "Arial", size: 10 },
    { addr: "M8", text: "HARGA", fontName: "Arial", size: 10 },
    { addr: "N8", text: "TOTAL", fontName: "Arial", size: 10 },
  ];

  for (const th of tableHeaders) {
    const c = ws.getCell(th.addr);
    c.value = th.text;
    c.font = { name: th.fontName, size: th.size, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
  }

  // ==================== BARIS 9+: DATA KOMPONEN PER KELOMPOK ====================
  // Urutkan per kelompok berdasarkan urutan kemunculan pertama
  const groupOrder: string[] = [];
  const groupedMap = new Map<string, ExportPrItemInput[]>();
  for (const item of input.items) {
    const grp = (item.kelompok || "Panel Utama").trim() || "Panel Utama";
    if (!groupedMap.has(grp)) {
      groupOrder.push(grp);
      groupedMap.set(grp, []);
    }
    groupedMap.get(grp)!.push(item);
  }

  let currentRow = 9;
  let grandTotal = 0;

  if (groupOrder.length === 0) {
    // Minimal 1 baris kosong bila belum ada item
    ws.getRow(currentRow).height = 16;
    applyAllThinBorders(ws, currentRow, 1, currentRow, 14);
    currentRow++;
  } else {
    groupOrder.forEach((grpName, grpIdx) => {
      // Pisahkan antar kelompok dengan 1 baris kosong ber-border (persis R23 & R30 di File 1)
      if (grpIdx > 0) {
        ws.getRow(currentRow).height = 14;
        applyAllThinBorders(ws, currentRow, 1, currentRow, 14);
        currentRow++;
      }

      const grpItems = groupedMap.get(grpName) ?? [];
      grpItems.forEach((item, idxInGrp) => {
        const r = currentRow++;
        ws.getRow(r).height = 18;

        ws.mergeCells(`B${r}:C${r}`);
        ws.mergeCells(`D${r}:F${r}`);
        ws.mergeCells(`J${r}:K${r}`);
        applyAllThinBorders(ws, r, 1, r, 14);

        // Simpan nama kelompok di note sel kolom A baris pertama kelompok agar round-trip import 100% akurat
        if (idxInGrp === 0) {
          ws.getCell(r, 1).note = `Kelompok: ${grpName}`;
        }

        // A: NO.
        const rawNo = item.noPr?.trim() ?? "";
        const noCell = ws.getCell(r, 1);
        noCell.value =
          rawNo && /^\d+$/.test(rawNo)
            ? Number(rawNo)
            : rawNo
              ? rawNo
              : null;
        noCell.font = { name: "Roboto", size: 10 };
        noCell.alignment = { horizontal: "center", vertical: "middle" };

        // B:C PART TYPE
        const typeCell = ws.getCell(r, 2);
        typeCell.value = item.partType.trim();
        typeCell.font = { name: "Roboto", size: 10 };
        typeCell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };

        // D:F PARTS NAME
        const nameCell = ws.getCell(r, 4);
        nameCell.value = item.partName.trim();
        nameCell.font = { name: "Roboto", size: 10 };
        nameCell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };

        // G: DESCRIPTION (Supplier)
        const descCell = ws.getCell(r, 7);
        descCell.value = item.supplier?.trim() || null;
        descCell.font = { name: "Roboto", size: 10 };
        descCell.alignment = { horizontal: "center", vertical: "middle" };

        // H: QTY
        const qtyVal = Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 1;
        const qtyCell = ws.getCell(r, 8);
        qtyCell.value = qtyVal;
        qtyCell.font = { name: "Arial", size: 10 };
        qtyCell.alignment = { horizontal: "center", vertical: "middle" };

        // I: Unit
        const unitCell = ws.getCell(r, 9);
        unitCell.value = item.unit?.trim() || "pcs";
        unitCell.font = { name: "Arial", size: 10 };
        unitCell.alignment = { horizontal: "center", vertical: "middle" };

        // J:K NOTE
        const noteCell = ws.getCell(r, 10);
        noteCell.value = item.catatanPr?.trim() || null;
        noteCell.font = { name: "Arial", size: 10 };
        noteCell.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };

        // L: DATE OF USE
        const dateCell = ws.getCell(r, 12);
        if (item.tanggalPakai && /^\d{4}-\d{2}-\d{2}$/.test(item.tanggalPakai)) {
          dateCell.value = new Date(`${item.tanggalPakai}T00:00:00.000Z`);
          dateCell.numFmt = "dd/mm/yyyy";
        } else {
          dateCell.value = null;
        }
        dateCell.font = { name: "Arial", size: 10 };
        dateCell.alignment = { horizontal: "center", vertical: "middle" };

        // M: HARGA SATUAN
        const hargaCell = ws.getCell(r, 13);
        const unitPrice =
          item.hargaSatuan !== null &&
          item.hargaSatuan !== undefined &&
          Number.isFinite(item.hargaSatuan)
            ? item.hargaSatuan
            : null;
        hargaCell.value = unitPrice;
        hargaCell.font = { name: "Arial", size: 10 };
        hargaCell.alignment = { horizontal: "right", vertical: "middle" };
        if (unitPrice !== null) {
          hargaCell.numFmt = "#,##0";
        }

        // N: TOTAL (QTY x HARGA)
        const totalCell = ws.getCell(r, 14);
        totalCell.font = { name: "Arial", size: 10 };
        totalCell.alignment = { horizontal: "right", vertical: "middle" };
        if (unitPrice !== null) {
          const computed = Math.round(qtyVal * unitPrice);
          grandTotal += computed;
          totalCell.value = {
            formula: `H${r}*M${r}`,
            result: computed,
          };
          totalCell.numFmt = "#,##0";
        } else if (item.total !== null && item.total !== undefined) {
          grandTotal += item.total;
          totalCell.value = item.total;
          totalCell.numFmt = "#,##0";
        } else {
          totalCell.value = null;
        }
      });
    });
  }

  const lastDataRow = currentRow - 1;

  // ==================== FOOTER: PARTS NAME, PARTS NUMBER, JOB NUMBER, CUSTOMER ====================
  const ftr = input.footer ?? {};
  const footerStart = currentRow;
  const footerRows: { label: string; value: string | null }[] = [
    { label: " PARTS NAME", value: ftr.partsName?.trim() || null },
    { label: " PARTS NUMBER", value: ftr.partsNumber?.trim() || null },
    { label: " JOB NUMBER", value: ftr.jobNumber?.trim() || null },
    { label: " CUSTOMER", value: ftr.customer?.trim() || null },
  ];

  footerRows.forEach((fr, idx) => {
    const r = footerStart + idx;
    ws.getRow(r).height = 16;
    ws.mergeCells(`A${r}:C${r}`);
    ws.mergeCells(`D${r}:G${r}`);
    applyBoxBorder(ws, r, 1, r, 3);
    applyBoxBorder(ws, r, 4, r, 7);

    const lblCell = ws.getCell(r, 1);
    lblCell.value = fr.label;
    lblCell.font = { name: "Arial", size: 10, bold: true };
    lblCell.alignment = { horizontal: "left", vertical: "middle" };

    const valCell = ws.getCell(r, 4);
    valCell.value = fr.value;
    valCell.font = { name: "Arial", size: 10 };
    valCell.alignment = { horizontal: "left", vertical: "middle" };
  });

  // Kotak kanan footer H..L (persis H37:L40 di File 1)
  ws.mergeCells(`H${footerStart}:L${footerStart + 3}`);
  applyBoxBorder(ws, footerStart, 8, footerStart + 3, 12);

  // Ringkasan GRAND TOTAL di kolom M:N baris pertama footer
  const gtLabelCell = ws.getCell(footerStart, 13);
  gtLabelCell.value = "GRAND TOTAL";
  gtLabelCell.font = { name: "Arial", size: 10, bold: true };
  gtLabelCell.alignment = { horizontal: "center", vertical: "middle" };
  gtLabelCell.border = THIN_BORDER;
  gtLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  const gtValCell = ws.getCell(footerStart, 14);
  gtValCell.value = {
    formula: `SUM(N9:N${lastDataRow})`,
    result: grandTotal,
  };
  gtValCell.numFmt = "#,##0";
  gtValCell.font = { name: "Arial", size: 10, bold: true };
  gtValCell.alignment = { horizontal: "right", vertical: "middle" };
  gtValCell.border = THIN_BORDER;
  gtValCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF2CC" },
  };

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
