import ExcelJS from "exceljs";
import { cellText } from "@/lib/excel/cells";
import {
  SCHEDULE_CELL_STATUSES,
  type ScheduleCellStatus,
  type WorkType,
} from "@/lib/constants";
import { addDaysIso, todayIsoLocal } from "@/lib/date-utils";

export interface ParsedScheduleTaskDetail {
  urutan: number;
  teks: string;
}

export interface ParsedScheduleSubScope {
  urutan: number;
  judul: string;
  details: ParsedScheduleTaskDetail[];
}

export interface ParsedScheduleCell {
  dayIndex: number; // 1..jumlahHari
  tanggal: string; // YYYY-MM-DD
  status: ScheduleCellStatus;
  warnaCustom?: string | null;
  catatan?: string | null;
  subScopeUrutan?: number;
}

export interface ParsedScheduleWorkItem {
  urutan: number;
  rawJudul: string;
  judul: string;
  pic?: string | null;
  deadline?: string | null;
  jenis: WorkType;
  subScopes: ParsedScheduleSubScope[];
  scheduleCells: ParsedScheduleCell[];
}

export interface ParsedScheduleLane {
  sheetIndex: number;
  sheetName: string;
  client: string;
  laneNama: string;
  subjudul: string;
  tanggalMulai: string; // YYYY-MM-DD
  jumlahHari: number;
  workItems: ParsedScheduleWorkItem[];
  summary: {
    totalWorkItems: number;
    totalSubScopes: number;
    totalDetails: number;
    totalScheduledCells: number;
    statusCounts: Record<ScheduleCellStatus, number>;
    hasNotesCount: number;
  };
}

export interface ParsedScheduleWorkbookResult {
  filename: string;
  lanes: ParsedScheduleLane[];
  companyName?: string | null;
  companyAddress?: string | null;
  logoBase64?: string | null;
}

/**
 * Ekstrak note / comment ExcelJS dari cell
 */
function extractCellNote(cell: ExcelJS.Cell): string | null {
  const note = cell.note;
  if (!note) return null;
  if (typeof note === "string") {
    const trimmed = note.trim();
    return trimmed || null;
  }
  if (typeof note === "object") {
    const obj = note as {
      texts?: Array<{ text?: string }>;
      text?: string;
    };
    if (Array.isArray(obj.texts)) {
      const combined = obj.texts
        .map((t) => (typeof t?.text === "string" ? t.text : ""))
        .join("")
        .trim();
      return combined || null;
    }
    if (typeof obj.text === "string") {
      const trimmed = obj.text.trim();
      return trimmed || null;
    }
  }
  return null;
}

/**
 * Evaluasi status & warna custom dari fill cell
 */
function parseCellStatusAndColor(
  cell: ExcelJS.Cell
): { status: ScheduleCellStatus; warnaCustom: string | null } | null {
  const fill = cell.fill ?? (cell.isMerged ? cell.master.fill : null);
  if (!fill || fill.type !== "pattern") {
    // Periksa jika ada text manual status (mis. "DONE" / "TARGET")
    const txt = cellText(
      cell.worksheet,
      Number(cell.row),
      Number(cell.fullAddress.col)
    );
    if (txt) {
      const up = txt.toUpperCase();
      if (up.includes("DONE") || up.includes("SELESAI") || up === "OK") {
        return { status: "DONE", warnaCustom: null };
      }
      if (up.includes("PROGRESS") || up.includes("PROGRES") || up.includes("ON")) {
        return { status: "ON_PROGRESS", warnaCustom: null };
      }
      if (up.includes("DELAY") || up.includes("TUNDA")) {
        return { status: "DELAY", warnaCustom: null };
      }
      if (up.includes("TARGET")) {
        return { status: "TARGET", warnaCustom: null };
      }
    }
    return null;
  }

  const fg = fill.fgColor;
  if (!fg || !fg.argb) return null;

  const argb = String(fg.argb).toUpperCase().replace(/^#/, "");
  const hex6 =
    argb.length >= 6 ? argb.slice(-6).toUpperCase() : argb.padStart(6, "0");

  // Warna putih, hitam, atau soft-rose tanggal merah/libur tanpa makna pengerjaan
  if (
    hex6 === "FFFFFF" ||
    hex6 === "000000" ||
    hex6 === "FFF1F2" || // Soft rose-50 (background kolom tanggal merah)
    hex6 === "FFE4E6" || // Rose-100
    hex6 === "FECDD3"    // Rose-200
  ) {
    return null;
  }

  // TARGET: Hijau (#00B050 / #70AD47)
  if (
    hex6 === "00B050" ||
    hex6 === "70AD47" ||
    hex6 === "548235" ||
    hex6 === "A9D08E" ||
    hex6 === "E2EFDA"
  ) {
    return { status: "TARGET", warnaCustom: null };
  }

  // ON_PROGRESS: Kuning (#FFD966 / #FFC000)
  if (
    hex6 === "FFD966" ||
    hex6 === "FFC000" ||
    hex6 === "FFF2CC" ||
    hex6 === "BF8F00"
  ) {
    return { status: "ON_PROGRESS", warnaCustom: null };
  }

  // DONE: Biru/Cyan (#00B0F0 / #4472C4)
  if (
    hex6 === "00B0F0" ||
    hex6 === "4472C4" ||
    hex6 === "2F5597" ||
    hex6 === "B4C6E7" ||
    hex6 === "D9E1F2"
  ) {
    return { status: "DONE", warnaCustom: null };
  }

  // DELAY: Oranye/Merah/Peach (#F4B084 / #ED7D31)
  if (
    hex6 === "F4B084" ||
    hex6 === "ED7D31" ||
    hex6 === "C00000" ||
    hex6 === "FF0000" ||
    hex6 === "F8CBAD"
  ) {
    return { status: "DELAY", warnaCustom: null };
  }

  // Warna kustom lainnya: simpan sebagai warnaCustom (#RRGGBB)
  return {
    status: "TARGET",
    warnaCustom: `#${hex6}`,
  };
}

/**
 * Pisahkan judul pekerjaan, PIC, dan deadline dari teks kolom DESCRIPTION:
 * Contoh: "Instalasi Motor pada Rotary Table\n(PIC: Faruq • Deadline: 12 Nov 2026)"
 */
function parseWorkItemMetadata(raw: string): {
  judul: string;
  pic: string | null;
  deadline: string | null;
  jenis: WorkType;
} {
  let judul = raw.trim();
  let pic: string | null = null;
  let deadline: string | null = null;

  // Cek pola metadata (PIC: ... • Deadline: ...) baik dipisah newline atau spasi
  const metaMatch = judul.match(
    /\s*\(([^)]*(?:PIC:|Deadline:)[^)]*)\)\s*$/i
  );
  if (metaMatch) {
    judul = judul.slice(0, metaMatch.index).trim();
    const metaInner = metaMatch[1];
    const picMatch = metaInner.match(/PIC:\s*([^•\n]+)/i);
    if (picMatch) {
      pic = picMatch[1].trim() || null;
    }
    const deadMatch = metaInner.match(/Deadline:\s*([^•\n]+)/i);
    if (deadMatch) {
      deadline = deadMatch[1].trim() || null;
    }
  }

  // Tebak WorkType berdasarkan kata kunci
  let jenis: WorkType = "COMMISSIONING";
  const low = judul.toLowerCase();
  if (/\b(?:wiring|panel|kabel|terminasi|power)\b/i.test(low)) {
    jenis = "WIRING";
  } else if (/\b(?:program|plc|hmi|logic|software|code|robot)\b/i.test(low)) {
    jenis = "PROGRAMMING";
  } else if (/\b(?:fat|testing|factory\s*acceptance|uji)\b/i.test(low)) {
    jenis = "TESTING_FAT";
  } else if (/\b(?:instalasi|site|mekanik|rotary|bracket|pasang|assembly)\b/i.test(low)) {
    jenis = "INSTALASI_SITE";
  } else if (/\b(?:meeting|rapat|koordinasi|briefing)\b/i.test(low)) {
    jenis = "MEETING";
  } else if (/\b(?:commissioning|trial|running|dry\s*run)\b/i.test(low)) {
    jenis = "COMMISSIONING";
  }

  return { judul, pic, deadline, jenis };
}

/**
 * Parsing buffer Excel Jadwal (format export atau File 2 referensi)
 */
export async function parseScheduleWorkbookBuffer(
  buffer: Buffer,
  filename = "schedule.xlsx",
  customStartDates: Record<string, string> = {}
): Promise<ParsedScheduleWorkbookResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  let logoBase64: string | null = null;
  const mediaList = (wb.model as unknown as {
    media?: { extension?: string; buffer?: Buffer }[];
  })?.media;
  if (Array.isArray(mediaList) && mediaList.length > 0 && mediaList[0].buffer) {
    const ext = mediaList[0].extension === "png" ? "png" : "jpeg";
    logoBase64 = `data:image/${ext};base64,${Buffer.from(mediaList[0].buffer).toString("base64")}`;
  }

  let companyName: string | null = null;
  let companyAddress: string | null = null;

  const lanes: ParsedScheduleLane[] = [];
  let sheetIdx = 0;

  wb.eachSheet((ws) => {
    sheetIdx++;
    // Ambil identitas sheet
    const sheetName = ws.name.trim();
    const parts = sheetName.split("|").map((s) => s.trim());
    const client = parts.length > 1 ? parts[0] : "Client";
    let laneNama = parts.length > 1 ? parts[1] : sheetName;

    // Header judul di E3 & subjudul di E4
    const titleE3 = cellText(ws, 3, 5);
    if (titleE3 && /schedule lane/i.test(titleE3)) {
      laneNama = titleE3.replace(/^schedule\s+lane\s+/i, "").trim() || laneNama;
    }
    const subjudul = cellText(ws, 4, 5) ?? "(Timeline Onsite & Commissioning)";

    // Info perusahaan di B4 & B5
    if (!companyName) {
      companyName = cellText(ws, 4, 2);
    }
    if (!companyAddress) {
      companyAddress = cellText(ws, 5, 2);
    }

    // Cari header row tabel (default baris 8, cari teks "NO" atau "DESCRIPTION" di B/C)
    let headerStartRow = 8;
    for (let r = 6; r <= 15; r++) {
      const b = cellText(ws, r, 2);
      const c = cellText(ws, r, 3);
      if (
        (b && /^no$/i.test(b.trim())) ||
        (c && /description/i.test(c.trim()))
      ) {
        headerStartRow = r;
        break;
      }
    }

    const dayNumberRow = headerStartRow + 1;

    // Hitung jumlah kolom hari dari baris nomor hari
    const dayCols: number[] = [];
    for (let c = 6; c <= 90; c++) {
      const v = ws.getCell(dayNumberRow, c).value;
      if (typeof v === "number" && v > 0) {
        dayCols.push(c);
      } else if (typeof v === "string" && /^\d+$/.test(v.trim())) {
        dayCols.push(c);
      } else {
        break;
      }
    }

    const jumlahHari = Math.max(1, dayCols.length || 6);

    // Cek apakah ada baris tanggal kalender di bawah nomor hari (misal baris 10 merged/berisi string tanggal)
    let headerEndRow = dayNumberRow;
    const testRowBelow = dayNumberRow + 1;
    const cellBBelow = ws.getCell(testRowBelow, 2);
    const isMergedWithHeader =
      cellBBelow.isMerged && Number(cellBBelow.master.row) === headerStartRow;
    const hasDateTextInDayCols =
      dayCols.length > 0 &&
      typeof ws.getCell(testRowBelow, dayCols[0]).value === "string" &&
      cellText(ws, testRowBelow, 5) === null;

    if (isMergedWithHeader || hasDateTextInDayCols) {
      headerEndRow = testRowBelow;
    }

    const dataStartRow = headerEndRow + 1;

    // Tanggal mulai lane: dari argumen kustom atau default
    const tanggalMulai =
      customStartDates[laneNama] ||
      customStartDates[sheetName] ||
      todayIsoLocal();

    // Data Pekerjaan
    const workItems: ParsedScheduleWorkItem[] = [];
    let currentWi: ParsedScheduleWorkItem | null = null;
    let currentWiMasterRow = -1;
    let currentSs: ParsedScheduleSubScope | null = null;
    let currentSsMasterRow = -1;

    let emptyCount = 0;

    for (let r = dataStartRow; r <= ws.rowCount; r++) {
      const cNo = cellText(ws, r, 2);
      const cDesc = cellText(ws, r, 3);
      const rawDetail = ws.getCell(r, 5).value;
      const detailTeks =
        typeof rawDetail === "string"
          ? rawDetail.trimEnd()
          : (cellText(ws, r, 5) ?? "");

      // Cek apakah baris legenda (misal: "TARGET", "ON PROGRES", "DONE", "DELAY")
      const statusList = SCHEDULE_CELL_STATUSES as readonly string[];
      if (cDesc && statusList.includes(cDesc.toUpperCase())) {
        break;
      }
      if (cNo && statusList.includes(cNo.toUpperCase())) {
        break;
      }

      if (!cDesc && !detailTeks) {
        emptyCount++;
        if (emptyCount >= 8) break; // 8 baris kosong berturut-turut menandakan akhir tabel
        continue;
      }
      emptyCount = 0;

      // Master row untuk Work Item di kolom 3 (DESCRIPTION)
      const descCell = ws.getCell(r, 3);
      const wiMasterRow = Number(descCell.isMerged ? descCell.master.row : r);

      if (!currentWi || currentWiMasterRow !== wiMasterRow) {
        currentWiMasterRow = wiMasterRow;
        const rawJudul =
          cellText(ws, wiMasterRow, 3) || `Pekerjaan ${workItems.length + 1}`;
        const meta = parseWorkItemMetadata(rawJudul);

        currentWi = {
          urutan: workItems.length + 1,
          rawJudul,
          judul: meta.judul,
          pic: meta.pic,
          deadline: meta.deadline,
          jenis: meta.jenis,
          subScopes: [],
          scheduleCells: [],
        };
        workItems.push(currentWi);
        currentSs = null;
        currentSsMasterRow = -1;
      }

      // Master row untuk Sub Scope di kolom 4
      const subCell = ws.getCell(r, 4);
      const ssMasterRow = Number(subCell.isMerged ? subCell.master.row : r);
      const ssJudul = cellText(ws, ssMasterRow, 4) || "-";

      if (!currentSs || currentSsMasterRow !== ssMasterRow) {
        currentSsMasterRow = ssMasterRow;
        currentSs = {
          urutan: currentWi.subScopes.length + 1,
          judul: ssJudul,
          details: [],
        };
        currentWi.subScopes.push(currentSs);
      }

      // Tambahkan detail tugas
      if (detailTeks) {
        currentSs.details.push({
          urutan: currentSs.details.length + 1,
          teks: detailTeks,
        });
      }

      // Evaluasi pewarnaan sel hari (Day 1..N) untuk pekerjaan & sub-pekerjaan ini
      for (let d = 1; d <= jumlahHari; d++) {
        const col = 5 + d;
        const dayCell = ws.getCell(r, col);
        const parsedColor = parseCellStatusAndColor(dayCell);
        const note = extractCellNote(dayCell);

        if (parsedColor || note) {
          const currentSsUrutan = currentSs ? currentSs.urutan : 1;
          const existing = currentWi.scheduleCells.find(
            (sc) => sc.dayIndex === d && sc.subScopeUrutan === currentSsUrutan
          );
          if (existing) {
            if (note && !existing.catatan) {
              existing.catatan = note;
            }
            if (parsedColor && existing.status === "TARGET" && parsedColor.status !== "TARGET") {
              existing.status = parsedColor.status;
              existing.warnaCustom = parsedColor.warnaCustom;
            }
          } else {
            currentWi.scheduleCells.push({
              dayIndex: d,
              tanggal: addDaysIso(tanggalMulai, d - 1),
              status: parsedColor?.status ?? "TARGET",
              warnaCustom: parsedColor?.warnaCustom ?? null,
              catatan: note,
              subScopeUrutan: currentSsUrutan,
            });
          }
        }
      }
    }

    // Hitung ringkasan statistik lane
    let totalSubScopes = 0;
    let totalDetails = 0;
    let totalScheduledCells = 0;
    let hasNotesCount = 0;
    const statusCounts: Record<ScheduleCellStatus, number> = {
      TARGET: 0,
      ON_PROGRESS: 0,
      DONE: 0,
      DELAY: 0,
    };

    for (const wi of workItems) {
      totalSubScopes += wi.subScopes.length;
      for (const ss of wi.subScopes) {
        totalDetails += ss.details.length;
      }
      totalScheduledCells += wi.scheduleCells.length;
      for (const sc of wi.scheduleCells) {
        statusCounts[sc.status] = (statusCounts[sc.status] || 0) + 1;
        if (sc.catatan) hasNotesCount++;
      }
    }

    lanes.push({
      sheetIndex: sheetIdx,
      sheetName,
      client,
      laneNama,
      subjudul,
      tanggalMulai,
      jumlahHari,
      workItems,
      summary: {
        totalWorkItems: workItems.length,
        totalSubScopes,
        totalDetails,
        totalScheduledCells,
        statusCounts,
        hasNotesCount,
      },
    });
  });

  return {
    filename,
    lanes,
    companyName,
    companyAddress,
    logoBase64,
  };
}
