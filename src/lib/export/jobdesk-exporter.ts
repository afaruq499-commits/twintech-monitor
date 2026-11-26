import ExcelJS from "exceljs";
import type { JobdeskPlanData } from "@/lib/jobdesk-plan";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

/**
 * Mengekspor Pembagian Jobdesk Harian ke format Excel (.xlsx)
 * sesuai layout tabel referensi (Kolom A = PIC, Kolom B.. = Day / Tanggal,
 * dilanjutkan blok `sub jobdesk` bernomor dan catatan footer).
 */
export async function exportJobdeskPlanToExcelBuffer(
  plan: JobdeskPlanData
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PT Twintech Engineering Suite";
  wb.created = new Date();

  const ws = wb.addWorksheet("Pembagian Jobdesk", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
    },
  });

  // Lebar kolom mengikuti layout referensi
  ws.getColumn(1).width = 18; // Nama PIC / No sub jobdesk label
  for (let i = 0; i < plan.days.length; i++) {
    ws.getColumn(i + 2).width = 28;
  }

  // Baris 1: Header Tanggal (Day) — Kolom A kosong sesuai gambar referensi
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.getCell(1).value = "";
  headerRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };
  headerRow.getCell(1).border = THIN_BORDER;

  plan.days.forEach((day, idx) => {
    const cell = headerRow.getCell(idx + 2);
    cell.value = day.label;
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FF0F172A" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.border = THIN_BORDER;
  });

  // Baris 2..N: Baris per PIC
  let currentRowIdx = 2;
  for (const pic of plan.pics) {
    const row = ws.getRow(currentRowIdx);
    const picCell = row.getCell(1);
    picCell.value = pic;
    picCell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FF0F172A" },
    };
    picCell.alignment = { vertical: "middle", horizontal: "left" };
    picCell.border = THIN_BORDER;

    let maxLines = 1;
    plan.days.forEach((day, colIdx) => {
      const entries = plan.cells[pic]?.[day.id] ?? [];
      const text = entries
        .map((e) => (e.done ? `✓ ${e.title}` : e.title))
        .join("\n");
      if (entries.length > maxLines) maxLines = entries.length;

      const cell = row.getCell(colIdx + 2);
      cell.value = text;
      cell.font = {
        name: "Calibri",
        size: 11,
        color: { argb: "FF1E293B" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: true,
      };
      cell.border = THIN_BORDER;
    });

    row.height = Math.max(22, maxLines * 19);
    currentRowIdx += 1;
  }

  // Baris kosong pemisah sebelum sub jobdesk
  currentRowIdx += 1;

  // Header "sub jobdesk" di kolom B sesuai gambar referensi
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

  // Baris daftar sub jobdesk bernomor ("1. HMI TBU-1105", dst.)
  if (plan.subJobdesks.length === 0) {
    const emptySubRow = ws.getRow(currentRowIdx);
    emptySubRow.getCell(2).value = "1. -";
    emptySubRow.getCell(2).font = {
      name: "Calibri",
      size: 11,
      color: { argb: "FF64748B" },
    };
    emptySubRow.getCell(2).border = THIN_BORDER;
    currentRowIdx += 1;
  } else {
    plan.subJobdesks.forEach((sub, idx) => {
      const row = ws.getRow(currentRowIdx);
      row.height = 20;
      const cell = row.getCell(2);
      cell.value = `${idx + 1}. ${sub.title}${sub.done ? " (Selesai)" : ""}`;
      cell.font = {
        name: "Calibri",
        size: 11,
        color: { argb: "FF1E293B" },
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = THIN_BORDER;
      currentRowIdx += 1;
    });
  }

  // Baris kosong sebelum footer catatan
  currentRowIdx += 1;

  // Footer catatan sub jobdesk (default: "sub jobdesk dikerjakan ketika wiring delay komponen")
  const noteRow = ws.getRow(currentRowIdx);
  noteRow.height = 22;
  const noteCell = noteRow.getCell(2);
  noteCell.value = plan.subNote || "sub jobdesk dikerjakan ketika wiring delay komponen";
  noteCell.font = {
    name: "Calibri",
    size: 11,
    italic: true,
    color: { argb: "FF334155" },
  };

  const rawBuffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(rawBuffer as ArrayBuffer);
}
