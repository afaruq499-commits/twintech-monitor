export const PROJECT_TYPES = [
  "IOT",
  "AUTOMATION_KECIL",
  "AUTOMATION_BESAR",
  "INTEGRASI_ROBOT",
  "AFTER_SALES",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  IOT: "IoT Proyek",
  AUTOMATION_KECIL: "Automation Kecil",
  AUTOMATION_BESAR: "Automation Besar",
  INTEGRASI_ROBOT: "Integrasi Robot",
  AFTER_SALES: "After Sale",
};

export const PROJECT_PRIORITIES = ["TINGGI", "SEDANG", "RENDAH"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  TINGGI: "Tinggi",
  SEDANG: "Sedang",
  RENDAH: "Rendah",
};

export const PROJECT_STATUSES = [
  "PLANNING",
  "MENUNGGU_KOMPONEN",
  "WIRING",
  "PROGRAMMING",
  "COMMISSIONING",
  "SELESAI",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  MENUNGGU_KOMPONEN: "Menunggu Komponen",
  WIRING: "Wiring",
  PROGRAMMING: "Programming",
  COMMISSIONING: "Commissioning",
  SELESAI: "Selesai",
};

export const PR_STATUSES = [
  "DRAFT",
  "PREPARED",
  "CHECKED",
  "PURCHASING",
  "APPROVED",
] as const;
export type PrStatus = (typeof PR_STATUSES)[number];

export const PR_STATUS_LABELS: Record<PrStatus, string> = {
  DRAFT: "Draft",
  PREPARED: "Prepared",
  CHECKED: "Checked",
  PURCHASING: "Purchasing",
  APPROVED: "Approved",
};

export const PURCHASE_STATUSES = [
  "BELUM_PR",
  "PR_DIAJUKAN",
  "SUDAH_DIPESAN",
  "SUDAH_ADA",
  "SUDAH_DATANG",
  "TERPASANG",
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  BELUM_PR: "Belum PR",
  PR_DIAJUKAN: "PR Diajukan",
  SUDAH_DIPESAN: "Sudah Dipesan",
  SUDAH_ADA: "Sudah Ada",
  SUDAH_DATANG: "Sudah Datang",
  TERPASANG: "Terpasang",
};

export const ARRIVED_PURCHASE_STATUSES: PurchaseStatus[] = [
  "SUDAH_ADA",
  "SUDAH_DATANG",
  "TERPASANG",
];

/** Status komponen yang dikecualikan saat Export PR Excel (sudah ada / datang / terpasang). */
export function isExcludedFromPrExport(
  statusPembelian?: string | null
): boolean {
  if (!statusPembelian) return false;
  return (ARRIVED_PURCHASE_STATUSES as readonly string[]).includes(
    statusPembelian
  );
}

/** Menyaring item agar komponen berstatus Sudah Ada / Sudah Datang / Terpasang tidak ikut saat Export PR. */
export function filterExportablePrItems<
  T extends { statusPembelian?: string | null }
>(items: T[]): T[] {
  return items.filter((item) => !isExcludedFromPrExport(item.statusPembelian));
}

export const COMPONENT_IMPORT_STATUSES = [
  "NORMAL",
  "BARU",
  "HILANG_DI_REVISI",
] as const;
export type ComponentImportStatus = (typeof COMPONENT_IMPORT_STATUSES)[number];

export const WORK_TYPES = [
  "WIRING",
  "PROGRAMMING",
  "TESTING_FAT",
  "INSTALASI_SITE",
  "COMMISSIONING",
  "MEETING",
  "LAINNYA",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  WIRING: "Wiring",
  PROGRAMMING: "Programming",
  TESTING_FAT: "Testing / FAT",
  INSTALASI_SITE: "Instalasi di Site",
  COMMISSIONING: "Commissioning",
  MEETING: "Meeting",
  LAINNYA: "Lainnya",
};

/** Jenis pekerjaan yang memicu warning komponen belum lengkap */
export const COMPONENT_DEPENDENT_WORK_TYPES: WorkType[] = [
  "WIRING",
  "INSTALASI_SITE",
];

export const SCHEDULE_CELL_STATUSES = [
  "TARGET",
  "ON_PROGRESS",
  "DONE",
  "DELAY",
] as const;
export type ScheduleCellStatus = (typeof SCHEDULE_CELL_STATUSES)[number];

export const SCHEDULE_CELL_LABELS: Record<ScheduleCellStatus, string> = {
  TARGET: "TARGET",
  ON_PROGRESS: "ON PROGRES",
  DONE: "DONE",
  DELAY: "DELAY",
};

/**
 * Warna RGB hasil pembacaan langsung File 2 (Rencana Jadwal Kerja MGS.xlsx):
 * - TARGET: argb FF00B050 -> 00B050
 * - ON PROGRES: theme 7 (accent4 FFC000) + tint 0.4 -> FFD966
 * - DONE: argb FF00B0F0 -> 00B0F0
 * - DELAY: theme 5 (accent2 ED7D31) + tint 0.4 -> F4B084
 */
export const SCHEDULE_STATUS_RGB: Record<ScheduleCellStatus, string> = {
  TARGET: "00B050",
  ON_PROGRESS: "FFD966",
  DONE: "00B0F0",
  DELAY: "F4B084",
};

export const SCHEDULE_STATUS_ARGB: Record<ScheduleCellStatus, string> = {
  TARGET: "FF00B050",
  ON_PROGRESS: "FFFFD966",
  DONE: "FF00B0F0",
  DELAY: "FFF4B084",
};

export const PROJECT_COLOR_PALETTE = [
  "#2563eb", // Biru
  "#059669", // Emerald
  "#d97706", // Amber
  "#7c3aed", // Violet
  "#dc2626", // Merah
  "#0891b2", // Cyan
  "#db2777", // Pink
  "#4f46e5", // Indigo
];

export const SCHEDULE_CUSTOM_COLOR_SWATCHES = [
  { hex: "#00B050", label: "Hijau (Target)" },
  { hex: "#FFD966", label: "Kuning (Progres)" },
  { hex: "#00B0F0", label: "Biru (Done)" },
  { hex: "#F4B084", label: "Oranye (Delay)" },
  { hex: "#10B981", label: "Emerald" },
  { hex: "#8B5CF6", label: "Ungu" },
  { hex: "#EF4444", label: "Merah" },
  { hex: "#EC4899", label: "Pink" },
  { hex: "#06B6D4", label: "Toska" },
  { hex: "#64748B", label: "Abu-abu" },
] as const;

export function isLightHexColor(hexColor: string): boolean {
  const clean = hexColor.replace("#", "").trim();
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Rumus luminansi relatif persepsi mata
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62;
}
