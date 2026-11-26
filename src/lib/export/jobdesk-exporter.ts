import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  countWorkingDaysInRange,
  formatDayShortLabel,
  getEntryDateRange,
  packPicScheduleTracks,
  type JobdeskCategory,
  type JobdeskPlanData,
} from "@/lib/jobdesk-plan";

export interface JobdeskExportCompanyInfo {
  namaPerusahaan?: string | null;
  alamatPerusahaan?: string | null;
  telpPerusahaan?: string | null;
  faxPerusahaan?: string | null;
  logoBase64?: string | null;
}

export interface ProjectRoleSummaryCell {
  pic: string;
  dateRangeText: string;
  done: boolean;
  urgent: boolean;
}

export interface ProjectRoleSummaryRow {
  projectLabel: string;
  program: ProjectRoleSummaryCell[];
  hmi: ProjectRoleSummaryCell[];
  wiring: ProjectRoleSummaryCell[];
  diagram: ProjectRoleSummaryCell[];
  lainnya: ProjectRoleSummaryCell[];
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

const TABLE_HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "medium", color: { argb: "FF94A3B8" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

const CATEGORY_EXCEL_THEME: Record<
  JobdeskCategory,
  { fillArgb: string; accentArgb: string }
> = {
  PROGRAM: { fillArgb: "FFEFF6FF", accentArgb: "FF3B82F6" },
  HMI: { fillArgb: "FFFAF5FF", accentArgb: "FFA855F7" },
  WIRING: { fillArgb: "FFFFFBEB", accentArgb: "FFF59E0B" },
  DIAGRAM_WIRING: { fillArgb: "FFECFEFF", accentArgb: "FF06B6D4" },
  PANEL: { fillArgb: "FFECFDF5", accentArgb: "FF10B981" },
  LAINNYA: { fillArgb: "FFF8FAFC", accentArgb: "FF64748B" },
};

const PIC_ACCENT_TEXT: Record<string, string> = {
  faruq: "FFF05232",
  apip: "FF0284C7",
  ijlal: "FF059669",
};

function parseLogoImage(
  logoBase64?: string | null
): { base64: string; extension: "png" | "jpeg" } | null {
  if (logoBase64 && logoBase64.trim()) {
    const trimmed = logoBase64.trim();
    const match = trimmed.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
    if (match) {
      return {
        base64: match[2],
        extension: match[1].toLowerCase() === "png" ? "png" : "jpeg",
      };
    }
    return { base64: trimmed, extension: "png" };
  }

  try {
    const fallbackPath = path.join(
      process.cwd(),
      "public",
      "logo-twintech.png"
    );
    if (fs.existsSync(fallbackPath)) {
      const fileBuf = fs.readFileSync(fallbackPath);
      return {
        base64: fileBuf.toString("base64"),
        extension: "png",
      };
    }
  } catch {
    // Abaikan bila file logo default tidak tersedia
  }
  return null;
}

function formatShortDateWithoutDay(iso: string): string {
  return formatDayShortLabel(iso).replace(/^[A-Za-z]+,\s*/, "");
}

function formatCompactDateRange(startIso: string, endIso: string): string {
  const s = formatShortDateWithoutDay(startIso);
  if (endIso <= startIso) return s;
  const e = formatShortDateWithoutDay(endIso);
  // Jika bulan sama, tulis ringkas misal "9–10 Des", bila beda "26 Nov–1 Des"
  const sParts = s.split(" ");
  const eParts = e.split(" ");
  if (sParts.length === 2 && eParts.length === 2 && sParts[1] === eParts[1]) {
    return `${sParts[0]}–${eParts[0]} ${eParts[1]}`;
  }
  return `${s}–${e}`;
}

/**
 * Mengekstrak kode/nama proyek yang konsisten agar pekerjaan satu proyek
 * (mis. "Pembuatan Program 26 MTM 1015" & "Perakitan Panel 26-MTM-1015") otomatis
 * tergabung dalam 1 baris proyek yang sama.
 */
function resolveSummaryProjectLabel(
  title: string,
  explicitProjectCode?: string | null,
  explicitProjectName?: string | null
): string {
  if (explicitProjectCode?.trim()) {
    return explicitProjectCode.trim().toUpperCase().replace(/\s+/g, "-");
  }

  // Deteksi pola kode proyek umum seperti "26-TBI-1023", "26 MTM 1015", "TBU-1105"
  const codeMatch = title.match(
    /\b(?:2\d[-\s]*)?(?:TBI|TBU|MTM|BLN|RKI|YTK|TBD|MGS|AHM|WEJ|JIG)[-\s]*\d{3,4}\b/i
  );
  if (codeMatch) {
    return codeMatch[0].trim().toUpperCase().replace(/\s+/g, "-");
  }

  if (explicitProjectName?.trim()) {
    return explicitProjectName.trim();
  }

  // Bersihkan awalan jenis pekerjaan agar tersisa nama proyek/mesinnya
  const cleaned = title
    .replace(
      /^(?:penambahan\s+program|pembuatan\s+program|tracking\s+bug\s+program|perbaikan\s+cbox|perakitan\s+panel|diagram\s+wiring|wiring\s+mesin|layout\s+panel|program|wiring|hmi)\s+/i,
      ""
    )
    .trim();

  if (/\bpanasonic\b/i.test(cleaned)) {
    return "Panasonic";
  }

  return cleaned || title;
}

/**
 * Mengelompokkan seluruh penugasan di tabel harian menjadi ringkasan per-proyek:
 * setiap baris proyek memperlihatkan siapa yang pegang Program PLC, HMI, Wiring/Panel, Diagram Wiring, dan Lainnya beserta rentang tanggalnya.
 */
export function buildProjectRoleSummaryRows(
  plan: JobdeskPlanData
): ProjectRoleSummaryRow[] {
  const map = new Map<string, ProjectRoleSummaryRow>();

  for (const pic of plan.pics) {
    const picEntries = plan.cells[pic] ?? {};
    for (const [dayId, entries] of Object.entries(picEntries)) {
      const fallbackIso = dayId.startsWith("day-")
        ? dayId.slice(4, 14)
        : plan.startDateIso;

      for (const entry of entries) {
        const range = getEntryDateRange(entry, fallbackIso);
        const workingDays = countWorkingDaysInRange(
          range.startIso,
          range.endIso,
          Boolean(entry.urgent)
        );
        const label = resolveSummaryProjectLabel(
          entry.title,
          entry.projectCode,
          entry.projectName
        );
        const key = label.toLowerCase();

        let row = map.get(key);
        if (!row) {
          row = {
            projectLabel: label,
            program: [],
            hmi: [],
            wiring: [],
            diagram: [],
            lainnya: [],
          };
          map.set(key, row);
        }

        const dateRangeText = `${formatCompactDateRange(
          range.startIso,
          range.endIso
        )} (${workingDays}h)`;

        const cellItem: ProjectRoleSummaryCell = {
          pic,
          dateRangeText,
          done: Boolean(entry.done),
          urgent: Boolean(entry.urgent),
        };

        if (entry.category === "PROGRAM") {
          row.program.push(cellItem);
        } else if (entry.category === "HMI") {
          row.hmi.push(cellItem);
        } else if (entry.category === "WIRING" || entry.category === "PANEL") {
          row.wiring.push(cellItem);
        } else if (entry.category === "DIAGRAM_WIRING") {
          row.diagram.push(cellItem);
        } else {
          row.lainnya.push(cellItem);
        }
      }
    }
  }

  return Array.from(map.values());
}

function formatSummaryCellText(items: ProjectRoleSummaryCell[]): string {
  if (items.length === 0) return "-";
  return items
    .map(
      (it) =>
        `${it.done ? "✓ " : ""}${it.pic} (${it.dateRangeText})${
          it.urgent ? " [Urgent]" : ""
        }`
    )
    .join("\n");
}

/**
 * Mengekspor Pembagian Jobdesk Harian ke format Excel (.xlsx):
 * - Header & Logo resmi PT. Twintech Precision
 * - Matriks warna per kategori mengikuti visual UI
 * - Ringkasan singkat per proyek (Program, HMI, Wiring/Panel, Diagram Wiring, Lainnya)
 * - Blok `sub jobdesk` bernomor dan catatan footer.
 */
export async function exportJobdeskPlanToExcelBuffer(
  plan: JobdeskPlanData,
  company: JobdeskExportCompanyInfo = {}
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const companyName = company.namaPerusahaan?.trim() || "PT. Twintech Precision";
  const companyAddress =
    company.alamatPerusahaan?.trim() ||
    "Multiguna 1, Jl. Mahoni 1 No. 9 Lippo Cikarang 17550, Indonesia";
  const companyTel = company.telpPerusahaan?.trim() || "+62 (21) 89902228";
  const companyFax = company.faxPerusahaan?.trim() || "+62 (21) 89902229";

  wb.creator = companyName;
  wb.created = new Date();

  const totalCols = Math.max(plan.days.length + 1, 7);

  const ws = wb.addWorksheet("Pembagian Jobdesk", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    },
  });

  ws.getColumn(1).width = 16;
  for (let c = 2; c <= totalCols; c++) {
    ws.getColumn(c).width = 25;
  }

  // ==================== KOP PERUSAHAAN + LOGO TWINTECH ====================
  const parsedLogo = parseLogoImage(company.logoBase64);
  if (parsedLogo) {
    const logoId = wb.addImage({
      base64: parsedLogo.base64,
      extension: parsedLogo.extension,
    });
    ws.addImage(logoId, {
      tl: { col: 0.1, row: 0.25 },
      ext: { width: 175, height: 42 },
    } as unknown as ExcelJS.ImagePosition);
  }

  ws.getRow(1).height = 28;
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 17;
  ws.getRow(4).height = 16;
  ws.getRow(5).height = 16;
  ws.getRow(6).height = 10;

  ws.mergeCells(1, 3, 1, totalCols);
  const titleCell = ws.getCell(1, 3);
  titleCell.value = plan.title || "Pembagian Jobdesk Harian Tim";
  titleCell.font = {
    name: "Calibri",
    size: 20,
    bold: true,
    color: { argb: "FF0F172A" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(2, 3, 2, totalCols);
  const subTitleCell = ws.getCell(2, 3);
  subTitleCell.value = "(Schedule Pembagian Pekerjaan Tim Engineering)";
  subTitleCell.font = {
    name: "Calibri",
    size: 13,
    color: { argb: "FF334155" },
  };
  subTitleCell.alignment = { horizontal: "center", vertical: "middle" };

  const nameCell = ws.getCell(3, 1);
  nameCell.value = companyName;
  nameCell.font = {
    name: "Cambria",
    size: 11,
    bold: true,
    color: { argb: "FF0F172A" },
  };

  const addrCell = ws.getCell(4, 1);
  addrCell.value = companyAddress;
  addrCell.font = {
    name: "Cambria",
    size: 10,
    color: { argb: "FF334155" },
  };

  const contactParts: string[] = [];
  if (companyTel) contactParts.push(`Tel . ${companyTel}`);
  if (companyFax) contactParts.push(`Fax. ${companyFax}`);
  const contactCell = ws.getCell(5, 1);
  contactCell.value = contactParts.join("   ");
  contactCell.font = {
    name: "Cambria",
    size: 10,
    color: { argb: "FF334155" },
  };

  // ==================== MATRIKS HARIAN (VISUAL WARNA UI) ====================
  let currentRowIdx = 7;
  const headerRow = ws.getRow(currentRowIdx);
  headerRow.height = 24;

  const cornerHeader = headerRow.getCell(1);
  cornerHeader.value = "PIC / Tgl";
  cornerHeader.font = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FF334155" },
  };
  cornerHeader.alignment = { vertical: "middle", horizontal: "left" };
  cornerHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };
  cornerHeader.border = TABLE_HEADER_BORDER;

  plan.days.forEach((day, idx) => {
    const cell = headerRow.getCell(idx + 2);
    cell.value = day.isWeekend ? `${day.label} (Urgent)` : day.label;
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: day.isWeekend ? "FF9F1239" : "FF0F172A" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: day.isWeekend ? "FFFFF1F2" : "FFF1F5F9" },
    };
    cell.border = TABLE_HEADER_BORDER;
  });

  currentRowIdx += 1;

  for (const pic of plan.pics) {
    const packed = packPicScheduleTracks(plan.cells[pic], plan.days);
    const trackCount = Math.max(1, packed.tracks.length);
    const picStartRow = currentRowIdx;
    const picEndRow = currentRowIdx + trackCount - 1;
    const picColor = PIC_ACCENT_TEXT[pic.trim().toLowerCase()] || "FF0F172A";

    for (let tIdx = 0; tIdx < trackCount; tIdx++) {
      const row = ws.getRow(currentRowIdx);
      row.height = 24;

      for (let colIdx = 1; colIdx <= plan.days.length + 1; colIdx++) {
        const baseCell = row.getCell(colIdx);
        baseCell.border = THIN_BORDER;
        baseCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              colIdx > 1 && plan.days[colIdx - 2]?.isWeekend
                ? "FFFFF8F9"
                : "FFFFFFFF",
          },
        };
      }

      if (tIdx === 0) {
        const picCell = row.getCell(1);
        picCell.value = pic;
        picCell.font = {
          name: "Calibri",
          size: 11,
          bold: true,
          color: { argb: picColor },
        };
        picCell.alignment = { vertical: "middle", horizontal: "left" };
        picCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFFFF" },
        };
      }

      const track = packed.tracks[tIdx] ?? [];
      for (const span of track) {
        const startExcelCol = span.startColIdx + 2;
        const endExcelCol = span.endColIdx + 2;
        const cell = row.getCell(startExcelCol);
        const theme =
          CATEGORY_EXCEL_THEME[span.entry.category] ??
          CATEGORY_EXCEL_THEME.LAINNYA;

        const prefix = span.entry.done ? "✓ " : "";
        const urgentBadge = span.entry.urgent ? " [URGENT]" : "";

        cell.value = `${prefix}${span.entry.title}${urgentBadge}`;
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: !span.entry.done,
          color: { argb: span.entry.done ? "FF475569" : "FF0F172A" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: span.colSpan > 1 ? "center" : "left",
          wrapText: true,
        };

        const fillArgb = span.entry.done ? "FFD1FAE5" : theme.fillArgb;
        const accentArgb = span.entry.done ? "FF10B981" : theme.accentArgb;

        for (let c = startExcelCol; c <= endExcelCol; c++) {
          const targetCell = row.getCell(c);
          targetCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fillArgb },
          };
          targetCell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            left:
              c === startExcelCol
                ? { style: "thick", color: { argb: accentArgb } }
                : { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
          };
        }

        if (span.colSpan > 1) {
          ws.mergeCells(
            currentRowIdx,
            startExcelCol,
            currentRowIdx,
            endExcelCol
          );
        }
      }

      currentRowIdx += 1;
    }

    if (picEndRow > picStartRow) {
      ws.mergeCells(picStartRow, 1, picEndRow, 1);
    }
  }

  // ==================== RINGKASAN PER PROYEK (SINGKAT & MUDAH DIBACA) ====================
  currentRowIdx += 1;

  ws.mergeCells(currentRowIdx, 1, currentRowIdx, 7);
  const recapTitleRow = ws.getRow(currentRowIdx);
  recapTitleRow.height = 22;
  const recapTitleCell = recapTitleRow.getCell(1);
  recapTitleCell.value =
    "RINGKASAN PIC PER PROYEK (PROGRAM / HMI / WIRING / DIAGRAM WIRING)";
  recapTitleCell.font = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FF0F172A" },
  };
  recapTitleCell.alignment = { vertical: "middle", horizontal: "left" };
  currentRowIdx += 1;

  const recapHeaders = [
    { label: "No", fill: "FF1E293B" },
    { label: "Proyek / Kode", fill: "FF1E293B" },
    { label: "Program PLC", fill: "FF2563EB" },
    { label: "HMI", fill: "FF9333EA" },
    { label: "Wiring / Panel", fill: "FFD97706" },
    { label: "Diagram Wiring", fill: "FF0891B2" },
    { label: "Lainnya", fill: "FF475569" },
  ];
  const recapHeaderRow = ws.getRow(currentRowIdx);
  recapHeaderRow.height = 23;
  recapHeaders.forEach((hdr, i) => {
    const cell = recapHeaderRow.getCell(i + 1);
    cell.value = hdr.label;
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: i === 0 ? "center" : "left",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: hdr.fill },
    };
    cell.border = TABLE_HEADER_BORDER;
  });
  currentRowIdx += 1;

  const summaryRows = buildProjectRoleSummaryRows(plan);

  if (summaryRows.length === 0) {
    ws.mergeCells(currentRowIdx, 1, currentRowIdx, 7);
    const emptyRow = ws.getRow(currentRowIdx);
    emptyRow.height = 20;
    emptyRow.getCell(1).value = "Belum ada pekerjaan terjadwal pada tabel.";
    emptyRow.getCell(1).font = {
      name: "Calibri",
      size: 10,
      italic: true,
      color: { argb: "FF64748B" },
    };
    for (let c = 1; c <= 7; c++) {
      emptyRow.getCell(c).border = THIN_BORDER;
    }
    currentRowIdx += 1;
  } else {
    summaryRows.forEach((projRow, idx) => {
      const row = ws.getRow(currentRowIdx);
      const maxLines = Math.max(
        1,
        projRow.program.length,
        projRow.hmi.length,
        projRow.wiring.length,
        projRow.diagram.length,
        projRow.lainnya.length
      );
      row.height = Math.max(22, maxLines * 17);

      const cols: {
        value: string | number;
        fill: string;
        bold?: boolean;
        center?: boolean;
      }[] = [
        { value: idx + 1, fill: "FFF8FAFC", center: true },
        { value: projRow.projectLabel, fill: "FFFFFFFF", bold: true },
        {
          value: formatSummaryCellText(projRow.program),
          fill:
            projRow.program.length > 0
              ? CATEGORY_EXCEL_THEME.PROGRAM.fillArgb
              : "FFFFFFFF",
        },
        {
          value: formatSummaryCellText(projRow.hmi),
          fill:
            projRow.hmi.length > 0
              ? CATEGORY_EXCEL_THEME.HMI.fillArgb
              : "FFFFFFFF",
        },
        {
          value: formatSummaryCellText(projRow.wiring),
          fill:
            projRow.wiring.length > 0
              ? CATEGORY_EXCEL_THEME.WIRING.fillArgb
              : "FFFFFFFF",
        },
        {
          value: formatSummaryCellText(projRow.diagram),
          fill:
            projRow.diagram.length > 0
              ? CATEGORY_EXCEL_THEME.DIAGRAM_WIRING.fillArgb
              : "FFFFFFFF",
        },
        {
          value: formatSummaryCellText(projRow.lainnya),
          fill:
            projRow.lainnya.length > 0
              ? CATEGORY_EXCEL_THEME.LAINNYA.fillArgb
              : "FFFFFFFF",
        },
      ];

      cols.forEach((col, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = col.value;
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: Boolean(col.bold),
          color: {
            argb: col.value === "-" ? "FF94A3B8" : "FF0F172A",
          },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: col.center ? "center" : col.value === "-" ? "center" : "left",
          wrapText: true,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: col.fill },
        };
        cell.border = THIN_BORDER;
      });

      currentRowIdx += 1;
    });
  }

  // ==================== BLOK SUB JOBDESK & CATATAN ====================
  currentRowIdx += 1;

  const subHeaderRow = ws.getRow(currentRowIdx);
  subHeaderRow.height = 22;
  const subHeaderCell = subHeaderRow.getCell(2);
  subHeaderCell.value = "sub jobdesk";
  subHeaderCell.font = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FF0F172A" },
  };
  subHeaderCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };
  subHeaderCell.border = THIN_BORDER;
  currentRowIdx += 1;

  if (plan.subJobdesks.length === 0) {
    const emptySubRow = ws.getRow(currentRowIdx);
    emptySubRow.getCell(2).value = "1. -";
    emptySubRow.getCell(2).font = {
      name: "Calibri",
      size: 10,
      color: { argb: "FF64748B" },
    };
    emptySubRow.getCell(2).border = THIN_BORDER;
    currentRowIdx += 1;
  } else {
    plan.subJobdesks.forEach((sub, idx) => {
      const row = ws.getRow(currentRowIdx);
      row.height = 20;
      const theme =
        CATEGORY_EXCEL_THEME[sub.category] ?? CATEGORY_EXCEL_THEME.HMI;
      const cell = row.getCell(2);
      cell.value = `${idx + 1}. ${sub.title}${sub.done ? " (Selesai)" : ""}`;
      cell.font = {
        name: "Calibri",
        size: 10,
        color: { argb: "FF1E293B" },
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: sub.done ? "FFD1FAE5" : theme.fillArgb },
      };
      cell.border = {
        ...THIN_BORDER,
        left: { style: "medium", color: { argb: theme.accentArgb } },
      };
      currentRowIdx += 1;
    });
  }

  currentRowIdx += 1;

  const noteRow = ws.getRow(currentRowIdx);
  noteRow.height = 22;
  const noteCell = noteRow.getCell(2);
  noteCell.value =
    plan.subNote || "sub jobdesk dikerjakan ketika wiring delay komponen";
  noteCell.font = {
    name: "Calibri",
    size: 10,
    italic: true,
    color: { argb: "FF334155" },
  };

  const rawBuffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(rawBuffer as ArrayBuffer);
}
