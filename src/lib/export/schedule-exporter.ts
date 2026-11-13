import ExcelJS from "exceljs";
import {
  SCHEDULE_CELL_LABELS,
  SCHEDULE_STATUS_ARGB,
  type ScheduleCellStatus,
} from "@/lib/constants";
import { addDaysIso, formatTanggalId, isTanggalMerah } from "@/lib/date-utils";

export interface ExportTaskDetail {
  urutan: number;
  teks: string;
}

export interface ExportSubScope {
  id?: string;
  urutan: number;
  judul: string;
  details: ExportTaskDetail[];
}

export interface ExportScheduleCell {
  subScopeId?: string | null;
  tanggal: string; // YYYY-MM-DD
  status: ScheduleCellStatus;
  warnaCustom?: string | null; // #RRGGBB opsional
  catatan?: string | null;
}

export interface ExportWorkItem {
  urutan: number;
  judul: string;
  pic?: string | null;
  deadline?: string | null;
  subScopes: ExportSubScope[];
  scheduleCells: ExportScheduleCell[];
}

export interface ExportLaneInput {
  client: string;
  laneNama: string;
  subjudul?: string;
  tanggalMulai: string; // YYYY-MM-DD
  jumlahHari: number;
  customDates?: string[];
  workItems: ExportWorkItem[];
}

export interface ExportCompanyInfo {
  namaPerusahaan: string;
  alamatPerusahaan: string;
  telpPerusahaan: string;
  faxPerusahaan: string;
  /** Data URL atau base64 murni JPEG/PNG */
  logoBase64?: string | null;
}

export interface ScheduleExportOptions {
  /** Tambah baris tanggal kalender aktual di bawah angka Day 1..N */
  includeCalendarDates?: boolean;
}

function sanitizeSheetName(raw: string, usedNames: Set<string>): string {
  const cleaned = raw.replace(/[\\/*?:[\]]/g, "-").trim() || "Jadwal";
  let candidate = cleaned.slice(0, 31);
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const tag = ` (${suffix++})`;
    candidate = cleaned.slice(0, 31 - tag.length) + tag;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function colLetter(colNumber: number): string {
  let n = colNumber;
  let s = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseBase64Logo(
  logoBase64: string
): { base64: string; extension: "jpeg" | "png" } | null {
  const trimmed = logoBase64.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (match) {
    const ext = match[1].toLowerCase() === "png" ? "png" : "jpeg";
    return { base64: match[2], extension: ext };
  }
  return { base64: trimmed, extension: "jpeg" };
}

/**
 * Bangun Workbook ExcelJS yang mereplikasi struktur, merge, warna, border, dan print setup File 2.
 */
export async function buildScheduleWorkbook(
  lanes: ExportLaneInput[],
  company: ExportCompanyInfo,
  options: ScheduleExportOptions = {}
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = company.namaPerusahaan || "Project Monitor";
  wb.created = new Date();

  const usedSheetNames = new Set<string>();
  let logoImageId: number | null = null;
  if (company.logoBase64) {
    const parsedLogo = parseBase64Logo(company.logoBase64);
    if (parsedLogo) {
      logoImageId = wb.addImage({
        base64: parsedLogo.base64,
        extension: parsedLogo.extension,
      });
    }
  }

  for (const lane of lanes) {
    const jumlahHari = Math.max(1, lane.jumlahHari);
    const lastCol = 5 + jumlahHari;
    const lastColStr = colLetter(lastCol);

    const rawSheetName = `${lane.client} | ${lane.laneNama}`;
    const sheetName = sanitizeSheetName(rawSheetName, usedSheetNames);

    const ws = wb.addWorksheet(sheetName, {
      views: [{ showGridLines: false, zoomScale: 55, zoomScaleNormal: 55 }],
      pageSetup: {
        paperSize: 9, // A4
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        verticalCentered: false,
        showGridLines: false,
        margins: {
          left: 0.12,
          right: 0.12,
          top: 0.16,
          bottom: 0.16,
          header: 0.3,
          footer: 0.3,
        },
      },
    });

    // Lebar kolom persis File 2
    ws.getColumn(1).width = 3.6;
    ws.getColumn(2).width = 4.7;
    ws.getColumn(3).width = 18.6;
    ws.getColumn(4).width = 70.8;
    ws.getColumn(5).width = 97.6;
    for (let d = 1; d <= jumlahHari; d++) {
      ws.getColumn(5 + d).width = options.includeCalendarDates ? 12.5 : 10.7;
    }

    // Logo perusahaan (B2:D4 seperti File 2)
    if (logoImageId !== null) {
      ws.addImage(
        logoImageId,
        {
          tl: { col: 1, row: 1 },
          br: { col: 3, row: 3 },
        } as unknown as ExcelJS.ImageRange
      );
    }

    // Judul & Subjudul di E3 & E4
    ws.getRow(3).height = 33.6;
    const titleCell = ws.getCell("E3");
    titleCell.value = `Schedule Lane ${lane.laneNama}`;
    titleCell.font = { name: "Calibri", size: 36, bold: true };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    ws.getRow(4).height = 46.2;
    const subCell = ws.getCell("E4");
    subCell.value = lane.subjudul || "(Timeline Onsite & Commissioning)";
    subCell.font = { name: "Calibri", size: 26, bold: false };
    subCell.alignment = { horizontal: "center", vertical: "middle" };

    // Blok identitas perusahaan dari Pengaturan (nama, alamat, telp, fax)
    const nameCell = ws.getCell("B4");
    nameCell.value = company.namaPerusahaan;
    nameCell.font = { name: "Cambria", size: 14, bold: true };
    nameCell.alignment = { horizontal: "left", vertical: "bottom" };

    ws.getRow(5).height = 19.5;
    const addrCell = ws.getCell("B5");
    addrCell.value = company.alamatPerusahaan;
    addrCell.font = { name: "Cambria", size: 14 };
    addrCell.alignment = { horizontal: "left", vertical: "middle" };

    ws.getRow(6).height = 30;
    const telParts: string[] = [];
    if (company.telpPerusahaan) telParts.push(`Tel . ${company.telpPerusahaan}`);
    if (company.faxPerusahaan) telParts.push(`Fax. ${company.faxPerusahaan}`);
    const telCell = ws.getCell("B6");
    telCell.value = telParts.join("   ");
    telCell.font = { name: "Cambria", size: 14 };
    telCell.alignment = { horizontal: "left", vertical: "middle" };

    // Header Tabel (Baris 8-9, atau 8-10 bila toggle tanggal aktual aktif)
    const headerStartRow = 8;
    const headerEndRow = options.includeCalendarDates ? 10 : 9;
    ws.getRow(8).height = 20.1;
    ws.getRow(9).height = 20.1;
    if (options.includeCalendarDates) {
      ws.getRow(10).height = 18;
    }

    ws.getCell(headerStartRow, 2).value = "NO";
    ws.getCell(headerStartRow, 3).value = "DESCRIPTION";
    ws.getCell(headerStartRow, 5).value = "SCOPE of WORK";
    ws.getCell(headerStartRow, 6).value = "DAY";

    // Merge header persis File 2
    ws.mergeCells(headerStartRow, 2, headerEndRow, 2); // B8:B9
    ws.mergeCells(headerStartRow, 3, headerEndRow, 4); // C8:D9
    ws.mergeCells(headerStartRow, 5, headerEndRow, 5); // E8:E9
    if (jumlahHari > 1) {
      ws.mergeCells(headerStartRow, 6, headerStartRow, lastCol); // F8:K8
    }

    for (let d = 1; d <= jumlahHari; d++) {
      const col = 5 + d;
      const dtIso =
        lane.customDates && lane.customDates[d - 1]
          ? lane.customDates[d - 1]
          : addDaysIso(lane.tanggalMulai, d - 1);
      const tglMerah = isTanggalMerah(dtIso);
      const dayNumCell = ws.getCell(9, col);
      dayNumCell.value = d;

      if (tglMerah.isRed) {
        dayNumCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFE4E6" }, // rose-100
        };
      }

      if (options.includeCalendarDates) {
        const dtCell = ws.getCell(10, col);
        dtCell.value = formatTanggalId(dtIso, false).replace(/\s+\d{4}$/, "");
        if (tglMerah.isRed) {
          dtCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFE4E6" },
          };
          if (tglMerah.keterangan) {
            dtCell.note = tglMerah.keterangan;
          }
        }
      }
    }

    // Styling & border header
    for (let r = headerStartRow; r <= headerEndRow; r++) {
      for (let c = 2; c <= lastCol; c++) {
        const cell = ws.getCell(r, c);
        const isDaySubRow = r >= 9 && c >= 6;
        const d = c - 5;
        const dtIso =
          isDaySubRow && d >= 1 && d <= jumlahHari
            ? lane.customDates && lane.customDates[d - 1]
              ? lane.customDates[d - 1]
              : addDaysIso(lane.tanggalMulai, d - 1)
            : null;
        const tglMerah = dtIso ? isTanggalMerah(dtIso) : null;

        cell.font = {
          name: "Arial Narrow",
          size: r === 10 ? 9.5 : isDaySubRow ? 11 : 16,
          bold: r !== 10 || Boolean(tglMerah?.isRed),
          color: tglMerah?.isRed ? { argb: "FFE11D48" } : undefined,
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: r === headerStartRow ? "medium" : "thin" },
          bottom: { style: r === headerEndRow ? "medium" : "thin" },
          left: { style: c === 2 ? "medium" : "thin" },
          right: { style: c === lastCol ? "medium" : "thin" },
        };
      }
    }

    // Baris Data Pekerjaan -> Sub-scope -> Detail Tugas
    let currentRow = headerEndRow + 1;
    const sortedWorkItems = [...lane.workItems].sort((a, b) => a.urutan - b.urutan);

    for (let wiIdx = 0; wiIdx < sortedWorkItems.length; wiIdx++) {
      const wi = sortedWorkItems[wiIdx];
      const wiStartRow = currentRow;

      // Map tanggal -> cell jadwal milik sub-scope atau pekerjaan ini
      const cellBySubScopeAndDate = new Map<string, ExportScheduleCell>();
      const cellByDate = new Map<string, ExportScheduleCell>();
      for (const sc of wi.scheduleCells) {
        const dt = sc.tanggal.slice(0, 10);
        if (sc.subScopeId) {
          cellBySubScopeAndDate.set(`${sc.subScopeId}_${dt}`, sc);
        } else {
          cellByDate.set(dt, sc);
        }
      }

      const subScopes =
        wi.subScopes.length > 0
          ? [...wi.subScopes].sort((a, b) => a.urutan - b.urutan)
          : [{ urutan: 1, judul: "-", details: [{ urutan: 1, teks: "-" }] }];

      for (const ss of subScopes) {
        const ssStartRow = currentRow;
        const details =
          ss.details.length > 0
            ? [...ss.details].sort((a, b) => a.urutan - b.urutan)
            : [{ urutan: 1, teks: "-" }];

        for (const det of details) {
          const row = ws.getRow(currentRow);
          row.height = 40.05;

          const cNo = ws.getCell(currentRow, 2);
          cNo.value = wiIdx + 1;
          cNo.font = { name: "Calibri", size: 14, bold: true };
          cNo.alignment = { horizontal: "center", vertical: "middle" };

          const cDesc = ws.getCell(currentRow, 3);
          const metaParts: string[] = [];
          if (wi.pic) metaParts.push(`PIC: ${wi.pic}`);
          if (wi.deadline) metaParts.push(`Deadline: ${formatTanggalId(wi.deadline, false)}`);
          cDesc.value =
            metaParts.length > 0
              ? `${wi.judul}\n(${metaParts.join(" • ")})`
              : wi.judul;
          cDesc.font = { name: "Calibri", size: 14, bold: true };
          cDesc.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

          const cSub = ws.getCell(currentRow, 4);
          cSub.value = ss.judul;
          cSub.font = { name: "Calibri", size: 14, bold: false };
          cSub.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

          const cDet = ws.getCell(currentRow, 5);
          cDet.value = det.teks;
          cDet.font = { name: "Calibri", size: 14, bold: false };
          cDet.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

          // Warnai sel hari sesuai warna custom atau status sub-scope pekerjaan pada tanggal tersebut
          for (let d = 1; d <= jumlahHari; d++) {
            const col = 5 + d;
            const dayCell = ws.getCell(currentRow, col);
            dayCell.font = { name: "Calibri", size: 14 };
            dayCell.alignment = { horizontal: "center", vertical: "middle" };

            const dateIso =
              lane.customDates && lane.customDates[d - 1]
                ? lane.customDates[d - 1]
                : addDaysIso(lane.tanggalMulai, d - 1);
            const hasSubScopeCellsForDate = wi.scheduleCells.some(
              (c) => c.subScopeId && c.tanggal.slice(0, 10) === dateIso
            );
            const scheduled =
              (ss.id ? cellBySubScopeAndDate.get(`${ss.id}_${dateIso}`) : undefined) ??
              (!hasSubScopeCellsForDate ? cellByDate.get(dateIso) : undefined);

            if (scheduled) {
              const customArgb =
                scheduled.warnaCustom && /^#[0-9a-fA-F]{6}$/.test(scheduled.warnaCustom)
                  ? `FF${scheduled.warnaCustom.slice(1).toUpperCase()}`
                  : null;
              dayCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                  argb: customArgb ?? SCHEDULE_STATUS_ARGB[scheduled.status],
                },
              };
              if (scheduled.catatan && currentRow === ssStartRow) {
                dayCell.note = scheduled.catatan;
              }
            } else {
              const tglMerah = isTanggalMerah(dateIso);
              if (tglMerah.isRed) {
                dayCell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFFFF1F2" }, // Soft rose-50
                };
              }
            }
          }

          currentRow++;
        }

        const ssEndRow = currentRow - 1;
        if (ssEndRow > ssStartRow) {
          ws.mergeCells(ssStartRow, 4, ssEndRow, 4);
        }
      }

      const wiEndRow = currentRow - 1;
      if (wiEndRow > wiStartRow) {
        ws.mergeCells(wiStartRow, 2, wiEndRow, 2);
        ws.mergeCells(wiStartRow, 3, wiEndRow, 3);
      }

      // Terapkan border: medium di atas tiap pekerjaan & tepi kiri/kanan, thin di dalam
      const isLastWorkItem = wiIdx === sortedWorkItems.length - 1;
      for (let r = wiStartRow; r <= wiEndRow; r++) {
        for (let c = 2; c <= lastCol; c++) {
          const cell = ws.getCell(r, c);
          cell.border = {
            top: { style: r === wiStartRow ? "medium" : "thin" },
            bottom: {
              style: isLastWorkItem && r === wiEndRow ? "medium" : "thin",
            },
            left: { style: c === 2 ? "medium" : "thin" },
            right: { style: c === lastCol ? "medium" : "thin" },
          };
        }
      }
    }

    const lastDataRow = Math.max(headerEndRow, currentRow - 1);

    // Legenda 2 baris kosong di bawah tabel (persis File 2: C39..C42 pada Glasstech)
    const legendOrder: ScheduleCellStatus[] = [
      "TARGET",
      "ON_PROGRESS",
      "DONE",
      "DELAY",
    ];
    const legendStartRow = lastDataRow + 3;
    legendOrder.forEach((st, idx) => {
      const r = legendStartRow + idx;
      const cell = ws.getCell(r, 3);
      cell.value = SCHEDULE_CELL_LABELS[st];
      cell.font = { name: "Calibri", size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: SCHEDULE_STATUS_ARGB[st] },
      };
    });

    const legendEndRow = legendStartRow + legendOrder.length - 1;
    ws.pageSetup.printArea = `B2:${lastColStr}${legendEndRow}`;
  }

  return wb;
}

export async function exportScheduleToBuffer(
  lanes: ExportLaneInput[],
  company: ExportCompanyInfo,
  options: ScheduleExportOptions = {}
): Promise<Buffer> {
  const wb = await buildScheduleWorkbook(lanes, company, options);
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
