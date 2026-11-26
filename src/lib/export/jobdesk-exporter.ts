import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  countWorkingDaysInRange,
  formatDayShortLabel,
  getEntryDateRange,
  JOBDESK_CATEGORY_LABELS,
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

/**
 * Warna kategori di Excel menyamakan visual kartu pada UI Pembagian Jobdesk (Gambar 2):
 * pastel lembut sebagai latar belakang + garis tepi kiri berwarna kategori.
 */
const CATEGORY_EXCEL_THEME: Record<
  JobdeskCategory,
  { fillArgb: string; accentArgb: string }
> = {
  PROGRAM: { fillArgb: "FFEFF6FF", accentArgb: "FF3B82F6" }, // Biru lembut
  HMI: { fillArgb: "FFFAF5FF", accentArgb: "FFA855F7" }, // Ungu lembut
  WIRING: { fillArgb: "FFFFFBEB", accentArgb: "FFF59E0B" }, // Kuning / Amber lembut
  DIAGRAM_WIRING: { fillArgb: "FFECFEFF", accentArgb: "FF06B6D4" }, // Cyan lembut
  PANEL: { fillArgb: "FFECFDF5", accentArgb: "FF10B981" }, // Hijau Emerald lembut
  LAINNYA: { fillArgb: "FFF8FAFC", accentArgb: "FF64748B" }, // Abu lembut
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

  // Fallback otomatis ke logo resmi PT. Twintech Precision di public/logo-twintech.png
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
    // Abaikan bila file tidak dapat dibaca
  }
  return null;
}

/**
 * Mengekspor Pembagian Jobdesk Harian ke format Excel (.xlsx):
 * - Header & Logo resmi PT. Twintech Precision (seperti Gambar 1)
 * - Matriks warna per kategori persis visual kartu di aplikasi (seperti Gambar 2)
 * - Tabel Rekap Detail Penugasan: Pekerjaan apa, Dipegang siapa, Dari tanggal s/d Sampai tanggal
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

  const totalCols = Math.max(plan.days.length + 1, 8);

  const ws = wb.addWorksheet("Pembagian Jobdesk", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    },
  });

  // Atur lebar kolom agar rapi baik untuk Matriks maupun Rekap Penugasan
  ws.getColumn(1).width = 18;
  for (let c = 2; c <= totalCols; c++) {
    ws.getColumn(c).width = c <= plan.days.length + 1 ? 26 : 19;
  }

  // ==================== KOP PERUSAHAAN + LOGO TWINTECH (GAMBAR 1) ====================
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

  // Judul & Subjudul di tengah atas (kolom C..terakhir)
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

  // Identitas Perusahaan di kiri bawah logo
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

  // ==================== MATRIKS HARIAN (VISUAL WARNA GAMBAR 2) ====================
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

  // Kumpulkan juga ringkasan penugasan (Pekerjaan, PIC, Dari Tgl, Sampai Tgl, Durasi, Status)
  const summaryRows: {
    title: string;
    category: JobdeskCategory;
    pic: string;
    startDateIso: string;
    endDateIso: string;
    workingDays: number;
    urgent: boolean;
    done: boolean;
  }[] = [];

  for (const pic of plan.pics) {
    const packed = packPicScheduleTracks(plan.cells[pic], plan.days);
    const trackCount = Math.max(1, packed.tracks.length);
    const picStartRow = currentRowIdx;
    const picEndRow = currentRowIdx + trackCount - 1;
    const picColor = PIC_ACCENT_TEXT[pic.trim().toLowerCase()] || "FF0F172A";

    for (let tIdx = 0; tIdx < trackCount; tIdx++) {
      const row = ws.getRow(currentRowIdx);
      row.height = 30;

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
        const rangeText =
          span.workingDaysCount > 1
            ? `${formatDayShortLabel(span.startDateIso)} → ${formatDayShortLabel(
                span.endDateIso
              )} (${span.workingDaysCount}h)`
            : `${formatDayShortLabel(span.startDateIso)} (1h)`;

        cell.value = `${prefix}${span.entry.title}${urgentBadge}\n${rangeText}`;
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

    // Kumpulkan semua entri PIC ini (termasuk di luar rentang tampilan) untuk tabel Rekap Penugasan
    const picEntriesMap = plan.cells[pic] ?? {};
    const picList: typeof summaryRows = [];
    for (const [dayId, entries] of Object.entries(picEntriesMap)) {
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
        picList.push({
          title: entry.title,
          category: entry.category,
          pic,
          startDateIso: range.startIso,
          endDateIso: range.endIso,
          workingDays,
          urgent: Boolean(entry.urgent),
          done: Boolean(entry.done),
        });
      }
    }
    picList.sort((a, b) => a.startDateIso.localeCompare(b.startDateIso));
    summaryRows.push(...picList);
  }

  // ==================== REKAP PENUGASAN (PEKERJAAN, PIC, DARI TGL - SAMPAI TGL) ====================
  currentRowIdx += 1;

  ws.mergeCells(currentRowIdx, 1, currentRowIdx, 8);
  const recapTitleRow = ws.getRow(currentRowIdx);
  recapTitleRow.height = 22;
  const recapTitleCell = recapTitleRow.getCell(1);
  recapTitleCell.value =
    "DETAIL PENUGASAN JOBDESK (PEKERJAAN, PIC & RENTANG TANGGAL)";
  recapTitleCell.font = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FF0F172A" },
  };
  recapTitleCell.alignment = { vertical: "middle", horizontal: "left" };
  currentRowIdx += 1;

  const recapHeaders = [
    "No",
    "Nama Pekerjaan / Jobdesk",
    "Kategori",
    "Dipegang Oleh (PIC)",
    "Dari Tanggal",
    "Sampai Tanggal",
    "Durasi",
    "Status",
  ];
  const recapHeaderRow = ws.getRow(currentRowIdx);
  recapHeaderRow.height = 22;
  recapHeaders.forEach((hdr, i) => {
    const cell = recapHeaderRow.getCell(i + 1);
    cell.value = hdr;
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: i === 0 || i >= 4 ? "center" : "left",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    cell.border = TABLE_HEADER_BORDER;
  });
  currentRowIdx += 1;

  if (summaryRows.length === 0) {
    ws.mergeCells(currentRowIdx, 1, currentRowIdx, 8);
    const emptyRow = ws.getRow(currentRowIdx);
    emptyRow.height = 20;
    emptyRow.getCell(1).value = "Belum ada pekerjaan terjadwal pada tabel.";
    emptyRow.getCell(1).font = {
      name: "Calibri",
      size: 10,
      italic: true,
      color: { argb: "FF64748B" },
    };
    for (let c = 1; c <= 8; c++) {
      emptyRow.getCell(c).border = THIN_BORDER;
    }
    currentRowIdx += 1;
  } else {
    summaryRows.forEach((item, idx) => {
      const row = ws.getRow(currentRowIdx);
      row.height = 21;
      const theme =
        CATEGORY_EXCEL_THEME[item.category] ?? CATEGORY_EXCEL_THEME.LAINNYA;
      const rowFill = item.done ? "FFD1FAE5" : theme.fillArgb;

      const vals: (string | number)[] = [
        idx + 1,
        item.title,
        JOBDESK_CATEGORY_LABELS[item.category] ?? item.category,
        item.pic,
        formatDayShortLabel(item.startDateIso),
        formatDayShortLabel(item.endDateIso),
        `${item.workingDays} Hari Kerja`,
        item.done
          ? "Selesai"
          : item.urgent
          ? "Urgent / Lembur"
          : "Terjadwal",
      ];

      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: cIdx === 1 || cIdx === 3,
          color: {
            argb:
              cIdx === 3
                ? PIC_ACCENT_TEXT[item.pic.trim().toLowerCase()] || "FF0F172A"
                : cIdx === 7 && item.urgent && !item.done
                ? "FFBE123C"
                : "FF1E293B",
          },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: cIdx === 0 || cIdx >= 4 ? "center" : "left",
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: cIdx === 0 ? "FFF8FAFC" : rowFill },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          left:
            cIdx === 1
              ? { style: "thick", color: { argb: theme.accentArgb } }
              : { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
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
