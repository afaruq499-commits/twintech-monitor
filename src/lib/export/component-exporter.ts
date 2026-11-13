import ExcelJS from "exceljs";
import {
  ARRIVED_PURCHASE_STATUSES,
  PURCHASE_STATUS_LABELS,
  type ComponentImportStatus,
  type PurchaseStatus,
} from "@/lib/constants";
import { formatTanggalId } from "@/lib/date-utils";

export interface ExportComponentItem {
  noPr: string | null;
  kelompok: string;
  partType: string;
  partName: string;
  supplier: string | null;
  qty: number;
  unit: string | null;
  statusPembelian: PurchaseStatus;
  estimasiTiba: string | null;
  tanggalPakai: string | null;
  hargaSatuan: number | null;
  total: number | null;
  catatanPr: string | null;
  catatan: string | null;
  perluDicek: boolean;
  statusImport: ComponentImportStatus;
}

export interface ExportComponentProjectInfo {
  kode: string | null;
  nama: string;
  client: string;
  prStatus: string;
}

const STATUS_FILL_ARGB: Record<PurchaseStatus, string> = {
  BELUM_PR: "FFF3F4F6",
  PR_DIAJUKAN: "FFFEF3C7",
  SUDAH_DIPESAN: "FFDBEAFE",
  SUDAH_ADA: "FFD1FAE5",
  SUDAH_DATANG: "FFD1FAE5",
  TERPASANG: "FFA7F3D0",
};

export async function exportComponentsToBuffer(
  project: ExportComponentProjectInfo,
  components: ExportComponentItem[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Daftar Komponen", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const active = components.filter((c) => c.statusImport !== "HILANG_DI_REVISI");
  const arrived = active.filter((c) =>
    ARRIVED_PURCHASE_STATUSES.includes(c.statusPembelian)
  ).length;
  const pct = active.length ? Math.round((arrived / active.length) * 100) : 0;

  ws.mergeCells("A1:M1");
  const title = ws.getCell("A1");
  title.value = `MONITORING KOMPONEN — ${project.nama}`;
  title.font = { name: "Calibri", size: 16, bold: true };

  ws.mergeCells("A2:M2");
  const sub = ws.getCell("A2");
  sub.value = `Kode: ${project.kode || "-"} | Client: ${project.client} | Status PR: ${project.prStatus} | Progress Kedatangan: ${arrived}/${active.length} (${pct}%)`;
  sub.font = { name: "Calibri", size: 11 };

  const headers = [
    "No PR",
    "Kelompok",
    "Part Type / Spesifikasi",
    "Parts Name",
    "Supplier",
    "Qty",
    "Unit",
    "Status Pembelian",
    "Estimasi Tiba",
    "Harga Satuan",
    "Total",
    "Catatan PR",
    "Catatan Monitoring",
  ];

  const headerRow = ws.getRow(4);
  headerRow.height = 24;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  const widths = [8, 22, 34, 18, 16, 8, 8, 18, 15, 16, 16, 28, 28];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  let rowIdx = 5;
  for (const c of components) {
    const row = ws.getRow(rowIdx++);
    row.height = 20;
    const values = [
      c.noPr ?? "-",
      c.kelompok,
      c.partType,
      c.partName,
      c.supplier ?? "-",
      c.qty,
      c.unit ?? "-",
      PURCHASE_STATUS_LABELS[c.statusPembelian],
      c.estimasiTiba ? formatTanggalId(c.estimasiTiba, false) : "-",
      c.hargaSatuan ?? null,
      c.total ?? null,
      c.catatanPr ?? "",
      c.catatan ?? "",
    ];
    values.forEach((v, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = v;
      cell.font = {
        name: "Calibri",
        size: 10.5,
        strike: c.statusImport === "HILANG_DI_REVISI",
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: idx === 5 ? "center" : idx === 9 || idx === 10 ? "right" : "left",
        wrapText: true,
      };
      if (idx === 9 || idx === 10) {
        cell.numFmt = "#,##0";
      }
      if (idx === 7) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: STATUS_FILL_ARGB[c.statusPembelian] },
        };
      }
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
