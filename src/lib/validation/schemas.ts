import { z } from "zod";
import {
  PR_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  PURCHASE_STATUSES,
  SCHEDULE_CELL_STATUSES,
  WORK_TYPES,
} from "@/lib/constants";

const isoDateOptional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null));

const isoDateRequired = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const projectSchema = z.object({
  kode: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  nama: z.string().trim().min(1, "Nama proyek wajib diisi").max(300),
  client: z.string().trim().min(1, "Nama client wajib diisi").max(300),
  komponenInti: z.string().trim().optional().nullable(),
  deskripsi: z.string().trim().optional().nullable(),
  tanggalMulai: isoDateOptional,
  deadline: isoDateOptional,
  prioritas: z.enum(PROJECT_PRIORITIES).default("SEDANG"),
  tipeProyek: z
    .enum([...PROJECT_TYPES, "AFTER_SALE"] as const)
    .default("AUTOMATION_KECIL")
    .transform((v) => (v === "AFTER_SALE" ? "AFTER_SALES" : v)),
  status: z.enum(PROJECT_STATUSES).default("PLANNING"),
  prStatus: z.enum(PR_STATUSES).default("DRAFT"),
  catatan: z.string().trim().optional().nullable(),
  pic: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  customDatesJson: z.string().trim().optional().nullable(),
  bolehParalel: z.boolean().default(false),
  warna: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#2563eb"),
  plcAddressesJson: z.string().trim().optional().nullable(),
  gambarUrl: z.string().trim().optional().nullable(),
  flowSequenceJson: z.string().trim().optional().nullable(),
  wiringDiagramPdfUrl: z.string().trim().optional().nullable(),
  wiringDiagramPdfName: z.string().trim().max(300).optional().nullable(),
  plcProgramFileUrl: z.string().trim().optional().nullable(),
  plcProgramFileName: z.string().trim().max(300).optional().nullable(),
  plcProgramFileSize: z.coerce.number().optional().nullable(),
  hmiProgramFileUrl: z.string().trim().optional().nullable(),
  hmiProgramFileName: z.string().trim().max(300).optional().nullable(),
  hmiProgramFileSize: z.coerce.number().optional().nullable(),
  panelLayoutJson: z.string().trim().optional().nullable(),
  fileChecklistJson: z.string().trim().optional().nullable(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const componentUpdateSchema = z.object({
  kelompok: z.string().trim().min(1).max(200).optional(),
  partType: z.string().trim().min(1).max(400).optional(),
  partName: z.string().trim().min(1).max(300).optional(),
  supplier: z.string().trim().max(300).optional().nullable(),
  qty: z.coerce.number().positive("Qty harus lebih dari 0").optional(),
  unit: z.string().trim().max(50).optional().nullable(),
  hargaSatuan: z.coerce.number().nonnegative().optional().nullable(),
  statusPembelian: z.enum(PURCHASE_STATUSES).optional(),
  estimasiTiba: isoDateOptional,
  tanggalPakai: isoDateOptional,
  perluDicek: z.boolean().optional(),
  catatanPr: z.string().trim().optional().nullable(),
  catatan: z.string().trim().optional().nullable(),
});

export const componentCreateSchema = z.object({
  projectId: z.string().min(1),
  kelompok: z.string().trim().min(1, "Kelompok wajib diisi").max(200),
  noPr: z.string().trim().max(50).optional().nullable(),
  partType: z.string().trim().min(1, "Part Type wajib diisi").max(400),
  partName: z.string().trim().min(1, "Parts Name wajib diisi").max(300),
  supplier: z.string().trim().max(300).optional().nullable(),
  qty: z.coerce.number().positive("Qty harus > 0").default(1),
  unit: z.string().trim().max(50).optional().nullable(),
  hargaSatuan: z.coerce.number().nonnegative().optional().nullable(),
  statusPembelian: z.enum(PURCHASE_STATUSES).default("BELUM_PR"),
  estimasiTiba: isoDateOptional,
  catatanPr: z.string().trim().optional().nullable(),
  catatan: z.string().trim().optional().nullable(),
});

export const bulkComponentUpdateSchema = z.object({
  componentIds: z.array(z.string().min(1)).min(1, "Pilih minimal 1 komponen"),
  statusPembelian: z.enum(PURCHASE_STATUSES).optional(),
  estimasiTiba: isoDateOptional,
  kelompok: z.string().trim().min(1).max(200).optional(),
});

export const prImportCommitSchema = z.object({
  targetMode: z.enum(["NEW_PROJECT", "EXISTING_PROJECT"]),
  projectId: z.string().optional().nullable(),
  newProject: z
    .object({
      kode: z.string().trim().optional().nullable(),
      nama: z.string().trim().min(1, "Nama proyek wajib diisi"),
      client: z.string().trim().min(1, "Client wajib diisi"),
      prioritas: z.enum(PROJECT_PRIORITIES).default("SEDANG"),
      deadline: isoDateOptional,
    })
    .optional()
    .nullable(),
  importMode: z.enum(["REPLACE", "MERGE"]).default("MERGE"),
  namaFile: z.string().trim().min(1),
  tanggalRevisi: isoDateOptional,
  header: z.record(z.string().nullable()).optional(),
  duplicateResolutions: z.record(z.enum(["MERGE", "KEEP"])).default({}),
  rows: z.array(
    z.object({
      tempId: z.string(),
      rowNumber: z.number(),
      kelompok: z.string().trim().min(1),
      noPr: z.string().nullable(),
      partType: z.string().nullable(),
      partName: z.string().nullable(),
      supplier: z.string().nullable(),
      qty: z.number().nullable(),
      unit: z.string().nullable(),
      catatanPr: z.string().nullable(),
      tanggalPakai: isoDateOptional,
      hargaSatuan: z.number().nullable(),
      hargaRaw: z.string().nullable(),
      total: z.number().nullable(),
      perluDicek: z.boolean(),
      alasan: z.array(z.string()).default([]),
      state: z.enum(["OK", "CHECK", "ERROR"]).default("OK"),
    })
  ),
});

export const laneSchema = z.object({
  projectId: z.string().min(1),
  nama: z.string().trim().min(1, "Nama lane wajib diisi").max(200),
  subjudul: z
    .string()
    .trim()
    .max(300)
    .default("(Timeline Onsite & Commissioning)"),
  tanggalMulai: isoDateRequired,
  jumlahHari: z.coerce.number().int().min(1).max(90),
  deadline: isoDateOptional,
  pic: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  customDatesJson: z.string().trim().optional().nullable(),
});

export const subScopeInputSchema = z.object({
  judul: z.string().trim().min(1, "Judul sub-scope wajib diisi").max(400),
  details: z
    .array(z.string().trim().min(1, "Detail tugas tidak boleh kosong"))
    .min(1, "Minimal 1 detail tugas"),
});

export const workItemSchema = z.object({
  laneId: z.string().min(1),
  judul: z.string().trim().min(1, "Judul pekerjaan wajib diisi").max(400),
  jenis: z.enum(WORK_TYPES).default("COMMISSIONING"),
  bolehParalel: z.boolean().default(false),
  pic: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  customDatesJson: z.string().trim().optional().nullable(),
  deadline: isoDateOptional,
  componentIds: z.array(z.string()).default([]),
  subScopes: z.array(subScopeInputSchema).min(1, "Minimal 1 sub-scope"),
});

export const scheduleCellUpsertSchema = z.object({
  workItemId: z.string().min(1),
  subScopeId: z.string().trim().optional().nullable(),
  taskDetailId: z.string().trim().optional().nullable(),
  allDetailIds: z.array(z.string()).optional().nullable(),
  isShiftClick: z.boolean().optional().default(false),
  tanggal: isoDateRequired,
  status: z.enum(SCHEDULE_CELL_STATUSES).default("TARGET"),
  warnaCustom: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null)),
  catatan: z.string().trim().optional().nullable(),
  moveFromTanggal: isoDateOptional,
  acknowledgeComponentWarning: z.boolean().default(false),
  allowParallelOverride: z.boolean().default(false),
});

export const createFullScheduleSchema = z.object({
  projectMode: z.enum(["NEW", "EXISTING"]).default("NEW"),
  existingProjectId: z.string().optional().nullable(),
  namaProyek: z.string().trim().optional().nullable(),
  client: z.string().trim().optional().nullable(),
  kodeProyek: z.string().trim().optional().nullable(),
  warnaProyek: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#2563eb"),
  prioritasProyek: z.enum(PROJECT_PRIORITIES).default("TINGGI"),
  tipeProyek: z
    .enum([...PROJECT_TYPES, "AFTER_SALE"] as const)
    .default("AUTOMATION_KECIL")
    .transform((v) => (v === "AFTER_SALE" ? "AFTER_SALES" : v)),
  proyekParalel: z.boolean().default(false),
  judulPengerjaan: z
    .string()
    .trim()
    .min(1, "Judul pengerjaan wajib diisi")
    .max(200),
  tanggalMulai: isoDateRequired,
  deadline: isoDateOptional,
  picUtama: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  pekerjaanList: z
    .array(
      z.object({
        judul: z.string().trim().min(1, "Nama pekerjaan wajib diisi").max(400),
        jenis: z.enum(WORK_TYPES).default("WIRING"),
        pic: z
          .string()
          .trim()
          .max(200)
          .optional()
          .nullable()
          .transform((v) => (v ? v : null)),
        deadline: isoDateOptional,
        bolehParalel: z.boolean().default(false),
        jadwalMulai: isoDateOptional,
        jadwalSelesai: isoDateOptional,
        statusJadwal: z.enum(SCHEDULE_CELL_STATUSES).default("TARGET"),
        warnaKolom: z
          .string()
          .trim()
          .optional()
          .nullable()
          .transform((v) => (v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null)),
        komentarAwal: z.string().trim().optional().nullable(),
        subPekerjaan: z
          .array(subScopeInputSchema)
          .min(1, "Minimal 1 sub pekerjaan"),
      })
    )
    .min(1, "Tambahkan minimal 1 pekerjaan"),
});

export const workTemplateSchema = z.object({
  nama: z.string().trim().min(1, "Nama template wajib diisi").max(300),
  jenis: z.enum(WORK_TYPES).default("WIRING"),
  bolehParalel: z.boolean().default(false),
  deskripsi: z.string().trim().optional().nullable(),
  subScopes: z.array(subScopeInputSchema).min(1, "Minimal 1 sub-scope"),
});

export const settingSchema = z.object({
  kapasitasPerHari: z.coerce.number().int().min(1).max(20).default(1),
  jenisDikecualikan: z.array(z.enum(WORK_TYPES)).default(["MEETING"]),
  namaPerusahaan: z.string().trim().min(1, "Nama perusahaan wajib diisi").max(300),
  alamatPerusahaan: z.string().trim().max(500).default(""),
  telpPerusahaan: z.string().trim().max(100).default(""),
  faxPerusahaan: z.string().trim().max(100).default(""),
  logoBase64: z.string().optional().nullable(),
});

export const catalogComponentSchema = z.object({
  noUrut: z.coerce.number().int().min(0).default(0),
  kategori: z.string().trim().min(1, "Kategori komponen wajib diisi").max(150),
  nama: z.string().trim().min(1, "Nama komponen wajib diisi").max(300),
  merek: z.string().trim().max(150).default("Bebas"),
  tipeModel: z.string().trim().min(1, "Tipe / Model wajib diisi").max(300),
  spesifikasi: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  estimasiHarga: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
  defaultUnit: z.string().trim().max(40).default("pcs"),
  fungsi: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const PR_NOTE_CATEGORIES = [
  "NEW PROJECT",
  "INVENTORY",
  "EXPENSES",
  "NON INVENTORY",
] as const;

export const prHeaderInputSchema = z.object({
  department: z.string().trim().max(150).default("ENGINEERING"),
  noteCategory: z.enum(PR_NOTE_CATEGORIES).default("NEW PROJECT"),
  prepared: z.string().trim().max(150).optional().nullable(),
  checked: z.string().trim().max(150).optional().nullable(),
  purchasing: z.string().trim().max(150).optional().nullable(),
  approved: z.string().trim().max(150).optional().nullable(),
  tanggalPr: isoDateOptional,
});

export const prFooterInputSchema = z.object({
  partsName: z.string().trim().max(300).optional().nullable(),
  partsNumber: z.string().trim().max(150).optional().nullable(),
  jobNumber: z.string().trim().max(150).optional().nullable(),
  customer: z.string().trim().max(300).optional().nullable(),
});

export const prWebItemSchema = z.object({
  kelompok: z.string().trim().min(1).max(200).default("Panel Utama"),
  noPr: z
    .string()
    .trim()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  partType: z.string().trim().min(1, "Part Type / Tipe Komponen wajib diisi").max(400),
  partName: z.string().trim().min(1, "Parts Name / Nama Komponen wajib diisi").max(300),
  supplier: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  qty: z.coerce.number().positive("Qty harus lebih dari 0").default(1),
  unit: z.string().trim().max(50).default("pcs"),
  catatanPr: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  tanggalPakai: isoDateOptional,
  hargaSatuan: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
  statusPembelian: z.enum(PURCHASE_STATUSES).optional().nullable(),
});

export const prExportPayloadSchema = z.object({
  header: prHeaderInputSchema.optional(),
  footer: prFooterInputSchema.optional(),
  items: z.array(prWebItemSchema).min(1, "Tambahkan minimal 1 komponen untuk di-export"),
});

export const prWebSaveSchema = z.object({
  targetMode: z.enum(["EXISTING_PROJECT", "NEW_PROJECT"]).default("EXISTING_PROJECT"),
  projectId: z.string().optional().nullable(),
  saveMode: z.enum(["MERGE", "REPLACE"]).default("MERGE"),
  komponenInti: z.string().trim().optional().nullable(),
  newProject: z
    .object({
      kode: z.string().trim().optional().nullable(),
      nama: z.string().trim().min(1, "Nama proyek wajib diisi").max(300),
      client: z.string().trim().min(1, "Nama client wajib diisi").max(300),
      komponenInti: z.string().trim().optional().nullable(),
      prioritas: z.enum(PROJECT_PRIORITIES).default("TINGGI"),
      deadline: isoDateOptional,
    })
    .optional()
    .nullable(),
  header: prHeaderInputSchema.optional(),
  footer: prFooterInputSchema.optional(),
  items: z.array(prWebItemSchema).min(1, "Tambahkan minimal 1 komponen PR"),
});
