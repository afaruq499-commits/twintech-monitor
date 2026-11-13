import ExcelJS from "exceljs";
import type {
  PlcAddressAllocationResult,
  PlcAddressEntry,
} from "@/lib/plc-address-allocator";

export interface PlcAddressExportCompanyInfo {
  namaPerusahaan: string;
  alamatPerusahaan: string;
  telpPerusahaan: string;
  faxPerusahaan: string;
}

export interface PlcAddressExportProjectInfo {
  nama: string;
  client: string;
  kode?: string | null;
}

const KIND_COLORS_ARGB: Record<string, string> = {
  DI: "FFD9E1F2", // Soft Blue
  DO: "FFE2EFDA", // Soft Green
  AI: "FFE1D5E7", // Soft Purple
  AO: "FFDAE8FC", // Soft Indigo
  M: "FFFFF2CC", // Soft Yellow
  D: "FFF2F2F2", // Soft Gray
};

const KIND_HEADER_BG_ARGB: Record<string, string> = {
  DI: "FF1E3A8A", // Blue 900
  DO: "FF065F46", // Emerald 900
  AI: "FF581C87", // Purple 900
  AO: "FF3730A3", // Indigo 900
  M: "FF78350F", // Amber 900
  D: "FF1E293B", // Slate 800
};

const KIND_SECTION_TITLES: Record<string, string> = {
  DI: "BAGIAN 1: DIGITAL INPUT (DI) — SINYAL MASUKAN DIGITAL PLC",
  DO: "BAGIAN 2: DIGITAL OUTPUT (DO) — SINYAL KELUARAN AKTUATOR / SOLENOID / LAMPU",
  AI: "BAGIAN 3: ANALOG INPUT (AI) — SENSOR ANALOG / LASER / LOAD CELL",
  AO: "BAGIAN 4: ANALOG OUTPUT (AO) — SINYAL ANALOG KONTROL (VFD / VALVE PROPORSIONAL)",
  M: "BAGIAN 5: INTERNAL RELAY / HMI BITS (M) — BIT STATUS & TOMBOL MANUAL SCREEN",
  D: "BAGIAN 6: DATA REGISTER (D) — REGISTER DATA / PARAMETER / COUNTER",
};

function formatWorksheetHeaders(
  ws: ExcelJS.Worksheet,
  title: string,
  subTitle: string,
  statText: string
): number {
  ws.views = [{ showGridLines: true, zoomScale: 90 }];
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  // Column widths
  ws.getColumn(1).width = 5; // A: Margin
  ws.getColumn(2).width = 6; // B: NO
  ws.getColumn(3).width = 8; // C: JENIS
  ws.getColumn(4).width = 16; // D: ALAMAT PLC
  ws.getColumn(5).width = 28; // E: SIMBOL / TAG NAME
  ws.getColumn(6).width = 15; // F: WIRE NO / FERRULE
  ws.getColumn(7).width = 14; // G: TIPE DATA
  ws.getColumn(8).width = 46; // H: DESKRIPSI & FUNGSI
  ws.getColumn(9).width = 30; // I: KOMPONEN PR
  ws.getColumn(10).width = 22; // J: MODUL / RAK

  // Title Block
  ws.getRow(2).height = 24;
  const titleCell = ws.getCell("B2");
  titleCell.value = title;
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1E3A8A" } };

  ws.getRow(3).height = 18;
  const subCell = ws.getCell("B3");
  subCell.value = subTitle;
  subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF475569" } };

  // Summary Stat Cards in row 5
  ws.getRow(5).height = 22;
  const statCell = ws.getCell("B5");
  statCell.value = statText;
  statCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF0F172A" } };
  ws.mergeCells("B5:J5");
  statCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };
  statCell.alignment = { horizontal: "center", vertical: "middle" };

  // Table Headers at Row 7
  const headerRow = 7;
  ws.getRow(headerRow).height = 24;
  const headers = [
    { col: 2, label: "NO" },
    { col: 3, label: "TIPE" },
    { col: 4, label: "ALAMAT PLC" },
    { col: 5, label: "SIMBOL / TAG NAME" },
    { col: 6, label: "WIRE NO" },
    { col: 7, label: "TIPE DATA" },
    { col: 8, label: "FUNGSI & DESKRIPSI" },
    { col: 9, label: "SUMBER KOMPONEN PR" },
    { col: 10, label: "MODUL / ROL" },
  ];

  for (const h of headers) {
    const c = ws.getCell(headerRow, h.col);
    c.value = h.label;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Slate 800
    };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  }

  return headerRow;
}

function writeEntryRow(
  ws: ExcelJS.Worksheet,
  r: number,
  entry: PlcAddressEntry,
  displayNo: number
) {
  ws.getRow(r).height = 20;

  const cNo = ws.getCell(r, 2);
  cNo.value = displayNo;
  cNo.alignment = { horizontal: "center", vertical: "middle" };

  const cKind = ws.getCell(r, 3);
  cKind.value = entry.kind;
  cKind.alignment = { horizontal: "center", vertical: "middle" };
  cKind.font = { name: "Calibri", size: 10, bold: true };
  const bgArgb = KIND_COLORS_ARGB[entry.kind] || "FFFFFFFF";
  cKind.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: bgArgb },
  };

  const cAddr = ws.getCell(r, 4);
  cAddr.value = entry.address;
  cAddr.alignment = { horizontal: "center", vertical: "middle" };
  cAddr.font = { name: "Consolas", size: 10, bold: true, color: { argb: "FF1E40AF" } };

  const cSym = ws.getCell(r, 5);
  cSym.value = entry.symbol;
  cSym.alignment = { horizontal: "left", vertical: "middle" };
  cSym.font = { name: "Consolas", size: 9.5, bold: true };

  const cWire = ws.getCell(r, 6);
  cWire.value = entry.wireNo;
  cWire.alignment = { horizontal: "center", vertical: "middle" };
  cWire.font = { name: "Consolas", size: 9.5 };

  const cData = ws.getCell(r, 7);
  cData.value = entry.dataType;
  cData.alignment = { horizontal: "center", vertical: "middle" };
  cData.font = { name: "Calibri", size: 9 };

  const cDesc = ws.getCell(r, 8);
  cDesc.value = entry.description;
  cDesc.alignment = { horizontal: "left", vertical: "middle" };
  cDesc.font = { name: "Calibri", size: 9.5 };

  const cComp = ws.getCell(r, 9);
  cComp.value = entry.sourceComponent
    ? `${entry.sourceComponent.partType} (${entry.sourceComponent.partName})`
    : "-";
  cComp.alignment = { horizontal: "left", vertical: "middle" };
  cComp.font = { name: "Calibri", size: 9, italic: true };

  const cMod = ws.getCell(r, 10);
  cMod.value = entry.moduleRole || "-";
  cMod.alignment = { horizontal: "left", vertical: "middle" };
  cMod.font = { name: "Calibri", size: 9 };

  for (let col = 2; col <= 10; col++) {
    const cell = ws.getCell(r, col);
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  }
}

export async function buildPlcAddressWorkbook(
  result: PlcAddressAllocationResult,
  project: PlcAddressExportProjectInfo,
  company: PlcAddressExportCompanyInfo
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = company.namaPerusahaan || "PT. Twintech Precision";
  wb.created = new Date();

  const titleText = `${company.namaPerusahaan.toUpperCase()} — TABEL PENGELAMATAN I/O & REGISTER PLC`;
  const subText = `Proyek: ${project.nama} | Client: ${project.client}${
    project.kode ? ` | Kode: ${project.kode}` : ""
  } | Format: ${
    result.system === "MITSUBISHI_FX5U_OCTAL"
      ? "Mitsubishi FX5U (Oktal)"
      : "Standar Desimal"
  }`;
  const statText = `Total I/O: ${result.summary.totalDi} DI  |  ${result.summary.totalDo} DO  |  ${result.summary.totalAi} AI  |  ${result.summary.totalAo} AO  |  ${result.summary.totalM} Bit M  |  ${result.summary.totalD} Register D`;

  // 1. SHEET UTAMA: "Semua I-O & Register" DENGAN PEMISAH SEKSI
  const wsMain = wb.addWorksheet("Semua I-O & Register");
  formatWorksheetHeaders(wsMain, titleText, subText, statText);

  const kindsInOrder = ["DI", "DO", "AI", "AO", "M", "D"] as const;
  let currentRow = 8;
  let overallIdx = 1;

  for (const k of kindsInOrder) {
    const groupEntries = result.entries.filter((e) => e.kind === k);
    if (groupEntries.length === 0) continue;

    // Header banner seksi
    wsMain.getRow(currentRow).height = 24;
    const bannerCell = wsMain.getCell(currentRow, 2);
    bannerCell.value = `${KIND_SECTION_TITLES[k]} (${groupEntries.length} Item)`;
    bannerCell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
    bannerCell.alignment = { horizontal: "left", vertical: "middle" };
    bannerCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: KIND_HEADER_BG_ARGB[k] || "FF1E293B" },
    };
    wsMain.mergeCells(currentRow, 2, currentRow, 10);
    currentRow++;

    // Tulis baris dalam kategori ini
    for (const entry of groupEntries) {
      writeEntryRow(wsMain, currentRow, entry, overallIdx);
      currentRow++;
      overallIdx++;
    }

    // Beri 1 baris jarak pemisah antar seksi
    currentRow++;
  }

  // 2. SHEET INDIVIDUAL: DI, DO, AI-AO, D-M
  const categorySheets = [
    { name: "Digital Input (DI)", kinds: ["DI"] as const },
    { name: "Digital Output (DO)", kinds: ["DO"] as const },
    { name: "Analog (AI & AO)", kinds: ["AI", "AO"] as const },
    { name: "Register & Relay (D & M)", kinds: ["M", "D"] as const },
  ];

  for (const cat of categorySheets) {
    const catEntries = result.entries.filter((e) =>
      (cat.kinds as readonly string[]).includes(e.kind)
    );
    if (catEntries.length === 0) continue;

    const wsCat = wb.addWorksheet(cat.name);
    const catStat = `Kategori: ${cat.name} (${catEntries.length} Item)`;
    formatWorksheetHeaders(wsCat, `${titleText} — ${cat.name}`, subText, catStat);

    let catRow = 8;
    catEntries.forEach((entry, idx) => {
      writeEntryRow(wsCat, catRow, entry, idx + 1);
      catRow++;
    });
  }

  return wb;
}

export async function exportPlcAddressesToBuffer(
  result: PlcAddressAllocationResult,
  project: PlcAddressExportProjectInfo,
  company: PlcAddressExportCompanyInfo
): Promise<Buffer> {
  const wb = await buildPlcAddressWorkbook(result, project, company);
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
