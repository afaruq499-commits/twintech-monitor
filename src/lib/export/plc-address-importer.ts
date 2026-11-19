import { Readable } from "stream";
import ExcelJS from "exceljs";
import { cellText } from "@/lib/excel/cells";
import type {
  PlcAddressEntry,
  PlcAddressKind,
  PlcAddressingSystem,
} from "@/lib/plc-address-allocator";

export interface ParsedPlcAddressResult {
  entries: PlcAddressEntry[];
  summary: {
    total: number;
    totalDi: number;
    totalDo: number;
    totalAi: number;
    totalAo: number;
    totalM: number;
    totalD: number;
  };
  detectedMetadata?: {
    projectName?: string;
    client?: string;
    kode?: string;
    system?: PlcAddressingSystem;
  };
  filename?: string;
}

interface ColumnMapping {
  no?: number;
  kind?: number;
  address?: number;
  symbol?: number;
  wireNo?: number;
  dataType?: number;
  description?: number;
  sourceComponent?: number;
  moduleRole?: number;
}

function getWsText(ws: ExcelJS.Worksheet, r: number, c: number): string {
  const v = cellText(ws, r, c);
  return v ? v.trim() : "";
}

/**
 * Normalisasi jenis/tipe alamat PLC
 */
function normalizeKind(rawKind: string, address: string): PlcAddressKind {
  const k = rawKind.trim().toUpperCase();
  if (k === "DI" || k.includes("DIGITAL INPUT") || k.includes("INPUT")) return "DI";
  if (k === "DO" || k.includes("DIGITAL OUTPUT") || k.includes("OUTPUT")) return "DO";
  if (k === "AI" || k.includes("ANALOG IN")) return "AI";
  if (k === "AO" || k.includes("ANALOG OUT")) return "AO";
  if (k === "M" || k.includes("INTERNAL RELAY") || k.includes("RELAY BIT") || k.includes("HMI BIT")) return "M";
  if (k === "D" || k.includes("DATA REGISTER") || k.includes("REGISTER")) return "D";

  // Inferensi dari pola alamat jika kolom tipe kosong / tidak spesifik
  const addr = address.trim().toUpperCase();
  if (/^X\d+/i.test(addr)) return "DI";
  if (/^Y\d+/i.test(addr)) return "DO";
  if (/^AI|^AD\d+/i.test(addr)) return "AI";
  if (/^AO|^DA\d+/i.test(addr)) return "AO";
  if (/^M\d+|^MR\d+/i.test(addr)) return "M";
  if (/^D\d+|^DM\d+|^DT\d+/i.test(addr)) return "D";

  return "DI";
}

/**
 * Normalisasi tipe data alamat PLC
 */
function normalizeDataType(
  rawDataType: string,
  kind: PlcAddressKind
): PlcAddressEntry["dataType"] {
  const dt = rawDataType.trim().toUpperCase();
  if (dt.includes("DWORD") || dt.includes("32")) return "DWORD_32";
  if (dt.includes("WORD") || dt.includes("16") || dt.includes("INT")) return "WORD_16";
  if (dt.includes("ANALOG_IN") || dt.includes("ANALOG IN") || dt.includes("AI")) return "ANALOG_INPUT";
  if (dt.includes("ANALOG_OUT") || dt.includes("ANALOG OUT") || dt.includes("AO")) return "ANALOG_OUTPUT";
  if (dt.includes("BOOL") || dt.includes("BIT")) return "BOOL";

  // Fallback berdasarkan kind
  switch (kind) {
    case "AI":
      return "ANALOG_INPUT";
    case "AO":
      return "ANALOG_OUTPUT";
    case "D":
      return "WORD_16";
    case "DI":
    case "DO":
    case "M":
    default:
      return "BOOL";
  }
}

/**
 * Normalisasi sistem pengelamatan PLC jika terdeteksi dari metadata header
 */
function normalizeSystem(rawSystem: string): PlcAddressingSystem | undefined {
  const s = rawSystem.toUpperCase();
  if (s.includes("FX5U") || s.includes("MITSUBISHI") || s.includes("OKTAL")) {
    return "MITSUBISHI_FX5U_OCTAL";
  }
  if (s.includes("KV") || s.includes("KEYENCE")) {
    return "KEYENCE_KV8000";
  }
  if (s.includes("PANASONIC") || s.includes("FPWIN")) {
    return "PANASONIC_FPWIN_PRO";
  }
  if (s.includes("FATEK") || s.includes("UPPERLOGIC")) {
    return "FATEK_UPPERLOGIC";
  }
  if (s.includes("DESIMAL") || s.includes("STANDARD")) {
    return "STANDARD_DECIMAL";
  }
  return undefined;
}

/**
 * Ekstraksi angka indeks numerik dari alamat
 */
function extractNumericIndex(address: string, fallback: number): number {
  const numMatch = address.match(/\d+/);
  if (!numMatch) return fallback;
  const num = parseInt(numMatch[0], 10);
  return Number.isNaN(num) ? fallback : num;
}

/**
 * Membaca buffer Excel (.xlsx / .xls) atau CSV (.csv) dan memetakan ke array PlcAddressEntry[]
 */
export async function parsePlcAddressWorkbook(
  buffer: Buffer | ArrayBuffer,
  filename?: string
): Promise<ParsedPlcAddressResult> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const isZip =
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    buf[2] === 0x03 &&
    buf[3] === 0x04;
  const isExplicitCsv = filename ? /\.csv$/i.test(filename) : false;

  const workbook = new ExcelJS.Workbook();

  if (isExplicitCsv || !isZip) {
    try {
      await workbook.csv.read(Readable.from(buf));
    } catch (csvErr) {
      if (isZip) {
        // Fallback jika ternyata berkas zip/xlsx valid
        // @ts-expect-error exceljs Buffer compatibility
        await workbook.xlsx.load(buf);
      } else {
        throw new Error(
          `Gagal memproses berkas CSV: ${csvErr instanceof Error ? csvErr.message : "Format tidak valid"}`
        );
      }
    }
  } else {
    try {
      // @ts-expect-error exceljs Buffer compatibility
      await workbook.xlsx.load(buf);
    } catch (xlsxErr) {
      // Fallback: coba baca sebagai CSV jika ternyata teks CSV diunggah dengan nama .xlsx
      try {
        await workbook.csv.read(Readable.from(buf));
      } catch {
        throw new Error(
          `Gagal membaca berkas Excel: ${xlsxErr instanceof Error ? xlsxErr.message : "Format tidak valid"}`
        );
      }
    }
  }

  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    throw new Error("Berkas tidak memiliki lembar kerja atau baris tabel yang dapat dibaca.");
  }

  // Cari sheet komprehensif (misal: "Semua I-O & Register" / "Semua" / "All")
  const allSheet = workbook.worksheets.find((w) =>
    /semua|all\s*i-?o/i.test(w.name)
  );

  let targetSheets: ExcelJS.Worksheet[] = [];
  if (allSheet) {
    targetSheets = [allSheet];
  } else if (workbook.worksheets.length === 1) {
    targetSheets = [workbook.worksheets[0]];
  } else {
    // Multi-sheet per kategori
    targetSheets = workbook.worksheets;
  }

  const entries: PlcAddressEntry[] = [];
  const seenKeys = new Set<string>();

  let detectedProjectName: string | undefined;
  let detectedClient: string | undefined;
  let detectedKode: string | undefined;
  let detectedSystem: PlcAddressingSystem | undefined;

  for (const ws of targetSheets) {
    let headerRowIndex = -1;
    const colMap: ColumnMapping = {};

    // 1. Scan 15 baris pertama untuk mencari baris header tabel dan metadata proyek
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const rowCells: { col: number; text: string }[] = [];

      for (let c = 1; c <= Math.max(ws.columnCount || 15, 15); c++) {
        const text = getWsText(ws, r, c);
        if (text) {
          rowCells.push({ col: c, text });
        }
      }

      // Deteksi metadata proyek pada baris-baris atas
      const fullRowText = rowCells.map((c) => c.text).join(" | ");
      if (
        fullRowText.includes("Proyek:") ||
        fullRowText.includes("Client:") ||
        fullRowText.includes("Kode:")
      ) {
        const projMatch = fullRowText.match(/Proyek:\s*([^|]+)/i);
        if (projMatch && !detectedProjectName) detectedProjectName = projMatch[1].trim();

        const clientMatch = fullRowText.match(/Client:\s*([^|]+)/i);
        if (clientMatch && !detectedClient) detectedClient = clientMatch[1].trim();

        const kodeMatch = fullRowText.match(/Kode:\s*([^|]+)/i);
        if (kodeMatch && !detectedKode) detectedKode = kodeMatch[1].trim();

        const formatMatch = fullRowText.match(/Format:\s*([^|]+)/i);
        if (formatMatch && !detectedSystem) {
          detectedSystem = normalizeSystem(formatMatch[1].trim());
        }
      }

      // Deteksi baris header kolom
      const upperRow = rowCells.map((c) => ({ col: c.col, upper: c.text.toUpperCase() }));
      const hasAddressCol = upperRow.some(
        (c) => c.upper.includes("ALAMAT") || c.upper.includes("ADDRESS")
      );
      const hasSymbolCol = upperRow.some(
        (c) => c.upper.includes("SIMBOL") || c.upper.includes("TAG") || c.upper.includes("SYMBOL")
      );

      if (hasAddressCol && hasSymbolCol) {
        headerRowIndex = r;
        for (const c of upperRow) {
          if (c.upper === "NO" || c.upper === "NO.") {
            colMap.no = c.col;
          } else if (c.upper.includes("TIPE DATA") || c.upper.includes("DATA TYPE")) {
            colMap.dataType = c.col;
          } else if (c.upper.includes("TIPE") || c.upper.includes("JENIS") || c.upper === "TYPE" || c.upper === "KIND") {
            colMap.kind = c.col;
          } else if (c.upper.includes("ALAMAT") || c.upper.includes("ADDRESS")) {
            colMap.address = c.col;
          } else if (c.upper.includes("SIMBOL") || c.upper.includes("TAG") || c.upper.includes("SYMBOL")) {
            colMap.symbol = c.col;
          } else if (c.upper.includes("WIRE") || c.upper.includes("KABEL") || c.upper.includes("FERRULE")) {
            colMap.wireNo = c.col;
          } else if (
            c.upper.includes("FUNGSI") ||
            c.upper.includes("DESKRIPSI") ||
            c.upper.includes("KETERANGAN") ||
            c.upper.includes("DESCRIPTION")
          ) {
            colMap.description = c.col;
          } else if (c.upper.includes("SUMBER") || c.upper.includes("KOMPONEN") || c.upper.includes("PART")) {
            colMap.sourceComponent = c.col;
          } else if (c.upper.includes("MODUL") || c.upper.includes("ROL") || c.upper.includes("RAK")) {
            colMap.moduleRole = c.col;
          }
        }
        break;
      }
    }

    if (headerRowIndex === -1) {
      // Tidak menemukan header pada worksheet ini, lanjut worksheet lain
      continue;
    }

    // Default kolom jika tidak terpetakan eksplisit (mengikuti 5-kolom: B=NO, C=ALAMAT, D=SIMBOL, E=TIPE DATA, F=DESKRIPSI)
    const colAddress = colMap.address ?? 3;
    const colSymbol = colMap.symbol ?? 4;
    const colDataType = colMap.dataType ?? 5;
    const colDescription = colMap.description ?? 6;

    // Lacak kind seksi aktif jika dokumen menggunakan banner seksi (BAGIAN 1, 2, 5, 6, dsb.)
    let currentSectionKind: PlcAddressKind | null = null;

    // 2. Loop setiap baris data setelah header
    for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
      // Kumpulkan teks seluruh kolom baris ini
      const rowTexts: string[] = [];
      for (let c = 1; c <= Math.max(ws.columnCount || 10, 10); c++) {
        const val = getWsText(ws, r, c);
        if (val) rowTexts.push(val);
      }

      if (rowTexts.length === 0) continue;
      const combinedRowUpper = rowTexts.join(" ").toUpperCase();

      // Deteksi banner pembatas seksi
      if (combinedRowUpper.includes("BAGIAN 1") || (combinedRowUpper.includes("DIGITAL INPUT") && !combinedRowUpper.includes("X0"))) {
        currentSectionKind = "DI";
        continue;
      }
      if (combinedRowUpper.includes("BAGIAN 2") || (combinedRowUpper.includes("DIGITAL OUTPUT") && !combinedRowUpper.includes("Y0"))) {
        currentSectionKind = "DO";
        continue;
      }
      if (combinedRowUpper.includes("BAGIAN 3") || combinedRowUpper.includes("ANALOG INPUT")) {
        currentSectionKind = "AI";
        continue;
      }
      if (combinedRowUpper.includes("BAGIAN 4") || combinedRowUpper.includes("ANALOG OUTPUT")) {
        currentSectionKind = "AO";
        continue;
      }
      if (combinedRowUpper.includes("BAGIAN 5") || combinedRowUpper.includes("INTERNAL RELAY") || combinedRowUpper.includes("HMI BIT")) {
        currentSectionKind = "M";
        continue;
      }
      if (combinedRowUpper.includes("BAGIAN 6") || combinedRowUpper.includes("DATA REGISTER")) {
        currentSectionKind = "D";
        continue;
      }

      // Abaikan baris informasi/ringkasan
      if (
        combinedRowUpper.startsWith("BAGIAN") ||
        combinedRowUpper.startsWith("TOTAL") ||
        combinedRowUpper.startsWith("KATEGORI") ||
        combinedRowUpper.startsWith("CATATAN") ||
        combinedRowUpper.startsWith("SUMMARY") ||
        combinedRowUpper.includes("TABEL PENGELAMATAN")
      ) {
        continue;
      }

      const rawAddress = getWsText(ws, r, colAddress);
      if (!rawAddress) continue;

      const normalizedAddress = rawAddress.toUpperCase();
      if (normalizedAddress === "ALAMAT PLC" || normalizedAddress === "ADDRESS") {
        continue;
      }

      // Tentukan kind: gunakan kolom kind jika ada, atau currentSectionKind, atau inferensi prefix
      let kind: PlcAddressKind;
      if (colMap.kind !== undefined) {
        const rawKind = getWsText(ws, r, colMap.kind);
        if (rawKind) {
          kind = normalizeKind(rawKind, normalizedAddress);
        } else if (currentSectionKind) {
          kind = currentSectionKind;
        } else {
          kind = normalizeKind("", normalizedAddress);
        }
      } else if (currentSectionKind) {
        kind = currentSectionKind;
      } else {
        kind = normalizeKind("", normalizedAddress);
      }

      // Hindari duplikasi jika alamat yang sama sudah ada di list
      const dedupKey = `${kind}:${normalizedAddress}`;
      if (seenKeys.has(dedupKey)) {
        continue;
      }
      seenKeys.add(dedupKey);

      let symbol = colSymbol ? getWsText(ws, r, colSymbol) : "";
      if (!symbol || symbol === "-") {
        symbol = `${kind}_${normalizedAddress.replace(/[^A-Z0-9]/gi, "_")}`;
      } else {
        symbol = symbol.toUpperCase().replace(/\s+/g, "_");
      }

      let wireNo = colMap.wireNo ? getWsText(ws, r, colMap.wireNo) : "-";
      if (!wireNo || wireNo === "-") {
        wireNo = "-";
      }

      const rawDataType = colDataType ? getWsText(ws, r, colDataType) : "";
      const dataType = normalizeDataType(rawDataType, kind);

      let description = colDescription ? getWsText(ws, r, colDescription) : "";
      if (description === "-") {
        description = "";
      }

      const sourceText = colMap.sourceComponent ? getWsText(ws, r, colMap.sourceComponent) : "";
      const sourceComponent =
        sourceText && sourceText !== "-"
          ? {
              partType: sourceText,
              partName: sourceText,
              kelompok: "",
            }
          : null;

      let moduleRole = colMap.moduleRole ? getWsText(ws, r, colMap.moduleRole) : "";
      if (!moduleRole || moduleRole === "-") {
        moduleRole = "Import Tabel I/O";
      }

      const numericIndex = extractNumericIndex(normalizedAddress, entries.length + 1);
      const id = `import-${kind.toLowerCase()}-${normalizedAddress.toLowerCase().replace(/[^a-z0-9]/g, "_")}-${entries.length + 1}`;

      entries.push({
        id,
        kind,
        address: normalizedAddress,
        numericIndex,
        symbol,
        wireNo,
        description,
        dataType,
        sourceComponent,
        moduleRole,
        isCustom: true,
      });
    }
  }

  // Hitung ringkasan
  let totalDi = 0;
  let totalDo = 0;
  let totalAi = 0;
  let totalAo = 0;
  let totalM = 0;
  let totalD = 0;

  for (const item of entries) {
    if (item.kind === "DI") totalDi++;
    else if (item.kind === "DO") totalDo++;
    else if (item.kind === "AI") totalAi++;
    else if (item.kind === "AO") totalAo++;
    else if (item.kind === "M") totalM++;
    else if (item.kind === "D") totalD++;
  }

  return {
    entries,
    summary: {
      total: entries.length,
      totalDi,
      totalDo,
      totalAi,
      totalAo,
      totalM,
      totalD,
    },
    detectedMetadata: {
      projectName: detectedProjectName,
      client: detectedClient,
      kode: detectedKode,
      system: detectedSystem,
    },
    filename,
  };
}
