import { z } from "zod";
import {
  PROJECT_STATUS_LABELS,
  type ComponentImportStatus,
  type ProjectPriority,
  type ProjectStatus,
  type PurchaseStatus,
  type ScheduleCellStatus,
  type WorkType,
} from "@/lib/constants";
import {
  addDaysIso,
  diffDaysIso,
  todayIsoLocal,
} from "@/lib/date-utils";
import { rankProjectPriorities } from "@/lib/priority/score";
import {
  deriveChecklistDetection,
  parseFileChecklistJson,
} from "@/lib/project-checklist";
import { SYSTEM_PICS } from "@/lib/users";

export const JOBDESK_CATEGORIES = [
  "PROGRAM",
  "HMI",
  "WIRING",
  "DIAGRAM_WIRING",
  "PANEL",
  "LAINNYA",
] as const;

export type JobdeskCategory = (typeof JOBDESK_CATEGORIES)[number];

export const JOBDESK_CATEGORY_LABELS: Record<JobdeskCategory, string> = {
  PROGRAM: "Program PLC",
  HMI: "HMI",
  WIRING: "Wiring",
  DIAGRAM_WIRING: "Diagram Wiring",
  PANEL: "Layout / Panel",
  LAINNYA: "Lainnya",
};

export const JOBDESK_CATEGORY_STYLES: Record<
  JobdeskCategory,
  { badge: string; border: string; dot: string; barBg: string }
> = {
  PROGRAM: {
    badge:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
    border: "border-l-blue-500",
    dot: "bg-blue-500",
    barBg: "bg-blue-50/70 dark:bg-blue-950/25",
  },
  HMI: {
    badge:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60",
    border: "border-l-purple-500",
    dot: "bg-purple-500",
    barBg: "bg-purple-50/70 dark:bg-purple-950/25",
  },
  WIRING: {
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    barBg: "bg-amber-50/70 dark:bg-amber-950/25",
  },
  DIAGRAM_WIRING: {
    badge:
      "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800/60",
    border: "border-l-cyan-500",
    dot: "bg-cyan-500",
    barBg: "bg-cyan-50/70 dark:bg-cyan-950/25",
  },
  PANEL: {
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
    barBg: "bg-emerald-50/70 dark:bg-emerald-950/25",
  },
  LAINNYA: {
    badge:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700",
    border: "border-l-slate-400",
    dot: "bg-slate-400",
    barBg: "bg-slate-50/90 dark:bg-[#1a1d24]",
  },
};

export const DEFAULT_SUB_JOBDESK_NOTE =
  "sub jobdesk dikerjakan ketika wiring delay komponen";

export const DEFAULT_JOBDESK_TITLE = "Pembagian Jobdesk Harian Tim";

export interface JobdeskDayColumn {
  id: string;
  dateIso: string; // YYYY-MM-DD
  label: string; // e.g. "Kam, 26 Nov"
  isWeekend?: boolean;
}

export interface JobdeskCellEntry {
  id: string;
  title: string;
  category: JobdeskCategory;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  workItemId?: string | null;
  sourceKey?: string | null;
  startDateIso?: string | null;
  endDateIso?: string | null;
  urgent?: boolean;
  syncedFromSchedule?: boolean;
  done?: boolean;
  note?: string | null;
}

export interface SubJobdeskItem {
  id: string;
  title: string;
  category: JobdeskCategory;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  sourceKey?: string | null;
  done?: boolean;
}

export interface JobdeskPlanData {
  title: string;
  startDateIso: string;
  skipWeekends?: boolean;
  days: JobdeskDayColumn[];
  pics: string[];
  cells: Record<string, Record<string, JobdeskCellEntry[]>>;
  subJobdesks: SubJobdeskItem[];
  subNote: string;
}

export interface AvailableJobdeskItem {
  sourceKey: string;
  title: string;
  category: JobdeskCategory;
  projectId: string;
  projectCode: string;
  projectName: string;
  client: string;
  projectStatus: ProjectStatus;
  projectStatusLabel: string;
  projectPrioritas: ProjectPriority;
  priorityRank: number;
  deadline: string | null;
  daysToDeadline: number | null;
  defaultPic: string | null;
  componentReadinessPct: number;
  totalComponents: number;
  arrivedComponents: number;
  isWiringDelayed: boolean;
  sourceType: "WORK_ITEM" | "CHECKLIST";
}

export interface ProjectJobdeskSourceInput {
  id: string;
  kode: string | null;
  nama: string;
  client: string;
  status: string;
  prioritas: string;
  deadline: string | null;
  urutanManual: number | null;
  warna?: string | null;
  pic?: string | null;
  prStatus?: string | null;
  plcAddressesJson?: string | null;
  panelLayoutJson?: string | null;
  flowSequenceJson?: string | null;
  wiringDiagramPdfUrl?: string | null;
  wiringDiagramPdfName?: string | null;
  plcProgramFileUrl?: string | null;
  plcProgramFileName?: string | null;
  hmiProgramFileUrl?: string | null;
  hmiProgramFileName?: string | null;
  fileChecklistJson?: string | null;
  components: {
    statusPembelian: string;
    statusImport?: string | null;
  }[];
  lanes: {
    id: string;
    nama: string;
    pic?: string | null;
    workItems: {
      id: string;
      jenis: string;
      judul: string;
      pic?: string | null;
      scheduleCells: {
        tanggal?: string | null;
        status: string;
      }[];
    }[];
  }[];
}

const HARI_PENDEK_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN_PENDEK_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export const jobdeskDayColumnSchema = z.object({
  id: z.string().min(1).max(80),
  dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1).max(60),
  isWeekend: z.boolean().optional(),
});

export const jobdeskCellEntrySchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  category: z.enum(JOBDESK_CATEGORIES).default("LAINNYA"),
  projectId: z.string().max(100).nullable().optional(),
  projectCode: z.string().max(120).nullable().optional(),
  projectName: z.string().max(300).nullable().optional(),
  workItemId: z.string().max(100).nullable().optional(),
  sourceKey: z.string().max(200).nullable().optional(),
  startDateIso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  endDateIso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  urgent: z.boolean().optional(),
  syncedFromSchedule: z.boolean().optional(),
  done: z.boolean().optional(),
  note: z.string().max(300).nullable().optional(),
});

export const subJobdeskItemSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  category: z.enum(JOBDESK_CATEGORIES).default("HMI"),
  projectId: z.string().max(100).nullable().optional(),
  projectCode: z.string().max(120).nullable().optional(),
  projectName: z.string().max(300).nullable().optional(),
  sourceKey: z.string().max(200).nullable().optional(),
  done: z.boolean().optional(),
});

export const jobdeskPlanDataSchema = z.object({
  title: z.string().trim().min(1).max(300),
  startDateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  skipWeekends: z.boolean().optional(),
  days: z.array(jobdeskDayColumnSchema).min(1).max(45),
  pics: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  cells: z.record(z.string(), z.record(z.string(), z.array(jobdeskCellEntrySchema))),
  subJobdesks: z.array(subJobdeskItemSchema).max(100),
  subNote: z.string().max(400),
});

export function isWeekendIso(dateIso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso.trim());
  if (!match) return false;
  const [, yStr, mStr, dStr] = match;
  const dayOfWeek = new Date(
    Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr))
  ).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

export function formatDayShortLabel(dateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso.trim());
  if (!match) return dateIso;
  const [, yStr, mStr, dStr] = match;
  const d = Number(dStr);
  const m = Number(mStr);
  if (m < 1 || m > 12 || d < 1 || d > 31) return dateIso;
  const dt = new Date(Date.UTC(Number(yStr), m - 1, d));
  const hari = HARI_PENDEK_ID[dt.getUTCDay()] ?? "";
  const bulan = BULAN_PENDEK_ID[m - 1] ?? mStr;
  return `${hari}, ${d} ${bulan}`;
}

export function formatDayCompactTgl(dateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso.trim());
  if (!match) return dateIso;
  const [, , mStr, dStr] = match;
  const d = Number(dStr);
  const m = Number(mStr);
  const bulan = BULAN_PENDEK_ID[m - 1] ?? mStr;
  return `Tgl ${d} ${bulan}`;
}

/**
 * Menghasilkan daftar kolom Day (Tanggal).
 * Secara default `skipWeekends = true` melompati Sabtu & Minggu karena hari libur,
 * kecuali tanggal yang ada di `mustIncludeDates` (misal lembur/urgent).
 */
export function generateConsecutiveDayColumns(
  startDateIso: string,
  count: number = 5,
  skipWeekends: boolean = true,
  mustIncludeDates: string[] = []
): JobdeskDayColumn[] {
  const safeCount = Math.max(1, Math.min(45, Math.round(count)));
  const cols: JobdeskDayColumn[] = [];
  const mustSet = new Set(mustIncludeDates);
  let offset = 0;

  while (cols.length < safeCount && offset < 120) {
    const iso = addDaysIso(startDateIso, offset);
    offset += 1;
    const weekend = isWeekendIso(iso);
    if (skipWeekends && weekend && !mustSet.has(iso)) {
      continue;
    }
    cols.push({
      id: `day-${iso}`,
      dateIso: iso,
      label: formatDayShortLabel(iso),
      isWeekend: weekend,
    });
  }

  // Pastikan tanggal urgent di luar slot tetap ikut masuk apabila berada dalam rentang kolom
  const minIso = cols[0]?.dateIso;
  const maxIso = cols[cols.length - 1]?.dateIso;
  if (minIso && maxIso) {
    const existingIso = new Set(cols.map((c) => c.dateIso));
    for (const extraIso of mustSet) {
      if (
        !existingIso.has(extraIso) &&
        extraIso >= minIso &&
        extraIso <= maxIso
      ) {
        cols.push({
          id: `day-${extraIso}`,
          dateIso: extraIso,
          label: formatDayShortLabel(extraIso),
          isWeekend: isWeekendIso(extraIso),
        });
      }
    }
    cols.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  }

  return cols;
}

/**
 * Melompati Sabtu & Minggu saat melangkah N hari kerja ke depan atau ke belakang.
 */
export function stepWorkingDaysIso(
  startDateIso: string,
  deltaWorkingDays: number,
  allowWeekends: boolean = false
): string {
  if (deltaWorkingDays === 0) return startDateIso;
  const step = deltaWorkingDays > 0 ? 1 : -1;
  let remaining = Math.abs(deltaWorkingDays);
  let cur = startDateIso;
  let guard = 0;

  while (remaining > 0 && guard < 180) {
    cur = addDaysIso(cur, step);
    guard += 1;
    if (!allowWeekends && isWeekendIso(cur)) {
      continue;
    }
    remaining -= 1;
  }
  return cur;
}

/**
 * Mengembalikan seluruh tanggal aktif dalam rentang [startDateIso .. endDateIso].
 * Bila `allowWeekends = false`, Sabtu & Minggu dilewati (kecuali tidak ada hari kerja sama sekali).
 */
export function expandWorkingDateRange(
  startDateIso: string,
  endDateIso: string,
  allowWeekends: boolean = false
): string[] {
  const safeEnd = endDateIso >= startDateIso ? endDateIso : startDateIso;
  const span = Math.min(60, Math.max(0, diffDaysIso(startDateIso, safeEnd)));
  const out: string[] = [];

  for (let i = 0; i <= span; i++) {
    const iso = addDaysIso(startDateIso, i);
    if (!allowWeekends && isWeekendIso(iso)) continue;
    out.push(iso);
  }

  if (out.length === 0) {
    return [startDateIso];
  }
  return out;
}

export function getEntryDateRange(
  entry: JobdeskCellEntry,
  fallbackDateIso: string
): { startIso: string; endIso: string } {
  const startIso = entry.startDateIso || fallbackDateIso;
  const rawEnd = entry.endDateIso || startIso;
  const endIso = rawEnd >= startIso ? rawEnd : startIso;
  return { startIso, endIso };
}

export function countWorkingDaysInRange(
  startDateIso: string,
  endDateIso: string,
  allowWeekends: boolean = false
): number {
  return expandWorkingDateRange(startDateIso, endDateIso, allowWeekends).length;
}

export function createDefaultJobdeskPlanData(
  startDateIso: string = todayIsoLocal(),
  dayCount: number = 5,
  skipWeekends: boolean = true
): JobdeskPlanData {
  const safeStart =
    skipWeekends && isWeekendIso(startDateIso)
      ? stepWorkingDaysIso(startDateIso, 1, false)
      : startDateIso;
  return {
    title: DEFAULT_JOBDESK_TITLE,
    startDateIso: safeStart,
    skipWeekends,
    days: generateConsecutiveDayColumns(safeStart, dayCount, skipWeekends),
    pics: SYSTEM_PICS.map((p) => p.value),
    cells: {},
    subJobdesks: [],
    subNote: DEFAULT_SUB_JOBDESK_NOTE,
  };
}

export function parseJobdeskPlanJson(
  rawJson: string | null | undefined,
  fallbackTitle?: string | null
): JobdeskPlanData {
  if (!rawJson) {
    const def = createDefaultJobdeskPlanData();
    if (fallbackTitle?.trim()) def.title = fallbackTitle.trim();
    return def;
  }
  try {
    const parsed = JSON.parse(rawJson);
    const validated = jobdeskPlanDataSchema.safeParse(parsed);
    if (validated.success) {
      const data = validated.data;
      const skipWeekends = data.skipWeekends ?? true;

      // Bersihkan kolom Sabtu/Minggu yang kosong bila skipWeekends aktif dan belum ada entry urgent
      let nextDays: JobdeskDayColumn[] = data.days.map((d) => ({
        ...d,
        isWeekend: isWeekendIso(d.dateIso),
      }));

      if (skipWeekends) {
        const urgentWeekendDates = collectUrgentWeekendDates(data);
        const filteredDays = nextDays.filter(
          (d) => !d.isWeekend || urgentWeekendDates.has(d.dateIso)
        );
        if (filteredDays.length < data.days.length && filteredDays.length > 0) {
          // Lengkapi jumlah kolom hari kerja agar tetap minimal sesuai panjang sebelumnya
          const targetWorkDays = data.days.length;
          nextDays = generateConsecutiveDayColumns(
            filteredDays[0].dateIso,
            targetWorkDays,
            true,
            Array.from(urgentWeekendDates)
          );
        } else if (filteredDays.length > 0) {
          nextDays = filteredDays;
        }
      }

      return {
        ...data,
        skipWeekends,
        days: nextDays,
      };
    }
  } catch {
    // fallback to default
  }
  const def = createDefaultJobdeskPlanData();
  if (fallbackTitle?.trim()) def.title = fallbackTitle.trim();
  return def;
}

function collectUrgentWeekendDates(plan: JobdeskPlanData): Set<string> {
  const dayDateById = new Map(plan.days.map((d) => [d.id, d.dateIso]));
  const urgentDates = new Set<string>();

  for (const pic of plan.pics) {
    const row = plan.cells[pic];
    if (!row) continue;
    for (const [dayId, entries] of Object.entries(row)) {
      const colIso =
        dayDateById.get(dayId) ??
        (dayId.startsWith("day-") ? dayId.slice(4, 14) : "");
      for (const entry of entries) {
        if (!entry.urgent) continue;
        const { startIso, endIso } = getEntryDateRange(entry, colIso || plan.startDateIso);
        for (const dIso of expandWorkingDateRange(startIso, endIso, true)) {
          if (isWeekendIso(dIso)) {
            urgentDates.add(dIso);
          }
        }
      }
    }
  }
  return urgentDates;
}

export function inferCategoryFromText(text: string): JobdeskCategory {
  const lower = text.toLowerCase();
  if (
    lower.includes("diagram") ||
    lower.includes("wiring diagram") ||
    lower.includes("skematik")
  ) {
    return "DIAGRAM_WIRING";
  }
  if (lower.includes("hmi") || lower.includes("got") || lower.includes("touchscreen")) {
    return "HMI";
  }
  if (lower.includes("program") || lower.includes("plc") || lower.includes("ladder")) {
    return "PROGRAM";
  }
  if (lower.includes("wiring") || (lower.includes("panel") && lower.includes("rakit"))) {
    return "WIRING";
  }
  if (lower.includes("layout") || lower.includes("box")) {
    return "PANEL";
  }
  return "LAINNYA";
}

function mapWorkItemKindToCategory(jenis: string, judul: string): JobdeskCategory {
  const j = jenis.toUpperCase();
  if (j === "WIRING") return "WIRING";
  if (j === "PROGRAMMING") {
    return judul.toLowerCase().includes("hmi") ? "HMI" : "PROGRAM";
  }
  return inferCategoryFromText(judul);
}

function resolveProjectShortCode(kode: string | null, nama: string): string {
  const cleanCode = kode?.trim();
  if (cleanCode) return cleanCode;
  const words = nama.trim().split(/\s+/).slice(0, 3).join(" ");
  return words || "Proyek";
}

function parseAssignedPics(
  rawPic: string | null | undefined,
  knownPics: string[]
): string[] {
  if (!rawPic?.trim()) return [];
  const tokens = rawPic
    .split(/[,/&+]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const resolved: string[] = [];
  for (const token of tokens) {
    const matched = knownPics.find(
      (kp) => kp.toLowerCase() === token.toLowerCase()
    );
    const canonical = matched ?? token;
    if (!resolved.includes(canonical)) {
      resolved.push(canonical);
    }
  }
  return resolved;
}

function extractWorkItemIdFromSourceKey(
  sourceKey: string | null | undefined
): string | null {
  if (!sourceKey || !sourceKey.startsWith("wi:")) return null;
  return sourceKey.slice(3) || null;
}

/**
 * Mengambil seluruh jobdesk dari proyek aktif (antrian proyek, status !== SELESAI)
 * yang belum selesai dikerjakan, diurutkan sesuai ranking prioritas proyek.
 */
export function extractAvailableProjectJobdesks(
  projects: ProjectJobdeskSourceInput[],
  todayIso: string = todayIsoLocal()
): AvailableJobdeskItem[] {
  const activeProjects = projects.filter((p) => p.status !== "SELESAI");
  const projectMap = new Map(activeProjects.map((p) => [p.id, p]));

  const ranked = rankProjectPriorities(
    activeProjects.map((p) => ({
      id: p.id,
      kode: p.kode,
      nama: p.nama,
      client: p.client,
      status: p.status as ProjectStatus,
      prioritas: p.prioritas as ProjectPriority,
      deadline: p.deadline,
      urutanManual: p.urutanManual,
      warna: p.warna ?? undefined,
      scheduledCellsCount: p.lanes.reduce(
        (acc, lane) =>
          acc +
          lane.workItems.reduce((wiAcc, wi) => wiAcc + wi.scheduleCells.length, 0),
        0
      ),
      components: p.components.map((c) => ({
        statusPembelian: c.statusPembelian as PurchaseStatus,
        statusImport: (c.statusImport ?? "NORMAL") as ComponentImportStatus,
      })),
    })),
    todayIso
  );

  const results: AvailableJobdeskItem[] = [];

  for (const r of ranked) {
    const src = projectMap.get(r.project.id);
    if (!src) continue;

    const shortCode = resolveProjectShortCode(src.kode, src.nama);
    const isWiringDelayed = r.totalComponents > 0 && r.componentReadinessPct < 100;
    const statusLabel =
      PROJECT_STATUS_LABELS[src.status as ProjectStatus] ?? src.status;

    const checklistState = parseFileChecklistJson(src.fileChecklistJson);
    const allCellsCount = src.lanes.reduce(
      (sum, l) =>
        sum + l.workItems.reduce((wSum, w) => wSum + w.scheduleCells.length, 0),
      0
    );
    const detection = deriveChecklistDetection({
      prStatus: src.prStatus,
      componentsCount: src.components.length,
      lanesCount: src.lanes.length,
      scheduleCellsCount: allCellsCount,
      plcAddressesJson: src.plcAddressesJson,
      panelLayoutJson: src.panelLayoutJson,
      flowSequenceJson: src.flowSequenceJson,
      wiringDiagramPdfUrl: src.wiringDiagramPdfUrl,
      wiringDiagramPdfName: src.wiringDiagramPdfName,
      plcProgramFileUrl: src.plcProgramFileUrl,
      plcProgramFileName: src.plcProgramFileName,
      hmiProgramFileUrl: src.hmiProgramFileUrl,
      hmiProgramFileName: src.hmiProgramFileName,
    });

    const coveredCategories = new Set<JobdeskCategory>();

    // 1. WorkItems dari schedule proyek yang belum 100% DONE
    for (const lane of src.lanes) {
      for (const wi of lane.workItems) {
        const hasCells = wi.scheduleCells.length > 0;
        const allDone =
          hasCells && wi.scheduleCells.every((cell) => cell.status === "DONE");
        if (allDone) continue;

        const category = mapWorkItemKindToCategory(wi.jenis, wi.judul);
        coveredCategories.add(category);

        const cleanTitle = wi.judul.toLowerCase().includes(shortCode.toLowerCase())
          ? wi.judul
          : `${wi.judul} ${shortCode}`;

        results.push({
          sourceKey: `wi:${wi.id}`,
          title: cleanTitle,
          category,
          projectId: src.id,
          projectCode: shortCode,
          projectName: src.nama,
          client: src.client,
          projectStatus: src.status as ProjectStatus,
          projectStatusLabel: statusLabel,
          projectPrioritas: src.prioritas as ProjectPriority,
          priorityRank: r.rank,
          deadline: src.deadline,
          daysToDeadline: r.daysToDeadline,
          defaultPic: wi.pic ?? lane.pic ?? src.pic ?? null,
          componentReadinessPct: r.componentReadinessPct,
          totalComponents: r.totalComponents,
          arrivedComponents: r.arrivedComponents,
          isWiringDelayed,
          sourceType: "WORK_ITEM",
        });
      }
    }

    // 2. Jobdesk deliverable engineering dari checklist / status proyek yang belum selesai
    const pushChecklistJob = (
      suffix: string,
      title: string,
      category: JobdeskCategory
    ) => {
      results.push({
        sourceKey: `chk:${src.id}:${suffix}`,
        title,
        category,
        projectId: src.id,
        projectCode: shortCode,
        projectName: src.nama,
        client: src.client,
        projectStatus: src.status as ProjectStatus,
        projectStatusLabel: statusLabel,
        projectPrioritas: src.prioritas as ProjectPriority,
        priorityRank: r.rank,
        deadline: src.deadline,
        daysToDeadline: r.daysToDeadline,
        defaultPic: src.pic ?? null,
        componentReadinessPct: r.componentReadinessPct,
        totalComponents: r.totalComponents,
        arrivedComponents: r.arrivedComponents,
        isWiringDelayed,
        sourceType: "CHECKLIST",
      });
    };

    const isDiagramDone =
      Boolean(checklistState.diagram_wiring?.checked) || detection.hasWiringPdf;
    if (!isDiagramDone && !coveredCategories.has("DIAGRAM_WIRING")) {
      pushChecklistJob(
        "diagram_wiring",
        `Diagram Wiring ${shortCode}`,
        "DIAGRAM_WIRING"
      );
    }

    const isWiringStageFinished =
      src.status === "PROGRAMMING" || src.status === "COMMISSIONING";
    if (!isWiringStageFinished && !coveredCategories.has("WIRING")) {
      pushChecklistJob("wiring", `Wiring ${shortCode}`, "WIRING");
    }

    const isProgramManualDone = Boolean(checklistState.pemprograman?.checked);
    if (
      !isProgramManualDone &&
      !detection.hasPlcProgram &&
      !coveredCategories.has("PROGRAM")
    ) {
      pushChecklistJob("program", `Program ${shortCode}`, "PROGRAM");
    }

    if (
      !isProgramManualDone &&
      !detection.hasHmiProgram &&
      !coveredCategories.has("HMI")
    ) {
      pushChecklistJob("hmi", `HMI ${shortCode}`, "HMI");
    }

    const isPanelMainDone =
      Boolean(checklistState.layout_panel_utama?.checked) ||
      detection.hasPanelMain;
    if (!isPanelMainDone && !coveredCategories.has("PANEL")) {
      pushChecklistJob("layout_panel", `Layout Panel ${shortCode}`, "PANEL");
    }
  }

  return results;
}

/**
 * Mengelompokkan tanggal berurutan (atau hanya terpisah Sabtu/Minggu) menjadi segmen rentang hari.
 */
function groupScheduleDatesIntoSegments(
  cells: { tanggal?: string | null; status: string }[]
): { startDateIso: string; endDateIso: string; allDone: boolean; hasWeekend: boolean }[] {
  const byDate = new Map<string, string[]>();
  for (const c of cells) {
    if (!c.tanggal) continue;
    const iso = c.tanggal.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const arr = byDate.get(iso) ?? [];
    arr.push(c.status);
    byDate.set(iso, arr);
  }

  const sortedDates = Array.from(byDate.keys()).sort();
  if (sortedDates.length === 0) return [];

  const segments: {
    dates: string[];
  }[] = [];

  for (const dIso of sortedDates) {
    const lastSeg = segments[segments.length - 1];
    if (!lastSeg) {
      segments.push({ dates: [dIso] });
      continue;
    }

    const prevIso = lastSeg.dates[lastSeg.dates.length - 1];
    const diff = diffDaysIso(prevIso, dIso);

    // Dianggap bersambung jika selisih 1 hari ATAU hanya melompati hari libur Sabtu/Minggu
    let isContiguous = diff <= 1;
    if (!isContiguous && diff > 1 && diff <= 3) {
      let onlyWeekendsInBetween = true;
      for (let step = 1; step < diff; step++) {
        if (!isWeekendIso(addDaysIso(prevIso, step))) {
          onlyWeekendsInBetween = false;
          break;
        }
      }
      if (onlyWeekendsInBetween) isContiguous = true;
    }

    if (isContiguous) {
      lastSeg.dates.push(dIso);
    } else {
      segments.push({ dates: [dIso] });
    }
  }

  return segments.map((seg) => {
    const statuses = seg.dates.flatMap((d) => byDate.get(d) ?? []);
    const allDone =
      statuses.length > 0 && statuses.every((s) => s === "DONE");
    const hasWeekend = seg.dates.some((d) => isWeekendIso(d));
    return {
      startDateIso: seg.dates[0],
      endDateIso: seg.dates[seg.dates.length - 1],
      allDone,
      hasWeekend,
    };
  });
}

/**
 * Menyinkronkan penugasan PIC & tanggal dari Schedule Proyek (`/jadwal`, `/proyek/[id]`)
 * ke tabel Pembagian Jobdesk.
 *
 * Bila `options.onlyWorkItemIds` diberikan, HANYA WorkItem yang berubah tsb yang diperbarui
 * tanpa menyentuh/menimpa item lain yang sudah dijadwalkan di Pembagian Jobdesk.
 */
export function syncScheduleProyekToJobdeskPlan(
  plan: JobdeskPlanData,
  projects: ProjectJobdeskSourceInput[],
  options: { onlyWorkItemIds?: string[] } = {}
): JobdeskPlanData {
  const onlySet =
    options.onlyWorkItemIds && options.onlyWorkItemIds.length > 0
      ? new Set(options.onlyWorkItemIds)
      : null;

  const nextPics = [...plan.pics];
  const nextCells: Record<string, Record<string, JobdeskCellEntry[]>> = {};

  for (const pic of nextPics) {
    nextCells[pic] = {};
    for (const [dayId, list] of Object.entries(plan.cells[pic] ?? {})) {
      nextCells[pic][dayId] = list.map((entry) => ({ ...entry }));
    }
  }

  const dayIdByDate = new Map(plan.days.map((d) => [d.dateIso, d.id]));
  const scheduledWorkItemIds = new Set<string>();
  const urgentDatesNeeded = new Set<string>();

  const activeProjects = projects.filter((p) => p.status !== "SELESAI");

  // Kumpulkan workItem dari proyek aktif yang punya PIC & ScheduleCell tanggal
  const workItemSyncedItems: {
    workItemId: string;
    pic: string;
    entry: JobdeskCellEntry;
    dayId: string;
  }[] = [];

  for (const proj of activeProjects) {
    const shortCode = resolveProjectShortCode(proj.kode, proj.nama);
    const isProjectUrgent = proj.prioritas === "TINGGI";

    for (const lane of proj.lanes) {
      for (const wi of lane.workItems) {
        if (onlySet && !onlySet.has(wi.id)) continue;

        const datedCells = wi.scheduleCells.filter((c) => Boolean(c.tanggal));
        if (datedCells.length === 0) continue;

        const pics = parseAssignedPics(
          wi.pic ?? lane.pic ?? proj.pic,
          nextPics
        );
        if (pics.length === 0) continue;

        const segments = groupScheduleDatesIntoSegments(datedCells);
        if (segments.length === 0) continue;

        scheduledWorkItemIds.add(wi.id);
        const category = mapWorkItemKindToCategory(wi.jenis, wi.judul);
        const cleanTitle = wi.judul
          .toLowerCase()
          .includes(shortCode.toLowerCase())
          ? wi.judul
          : `${wi.judul} ${shortCode}`;

        for (const picName of pics) {
          if (!nextPics.includes(picName)) {
            nextPics.push(picName);
            nextCells[picName] = {};
          }

          segments.forEach((seg, segIdx) => {
            const isUrgent = seg.hasWeekend || isProjectUrgent;
            if (seg.hasWeekend) {
              for (const d of expandWorkingDateRange(
                seg.startDateIso,
                seg.endDateIso,
                true
              )) {
                if (isWeekendIso(d)) urgentDatesNeeded.add(d);
              }
            }

            const dayId =
              dayIdByDate.get(seg.startDateIso) ?? `day-${seg.startDateIso}`;

            workItemSyncedItems.push({
              workItemId: wi.id,
              pic: picName,
              dayId,
              entry: {
                id: `sync-wi-${wi.id}-${picName.toLowerCase()}-${segIdx}`,
                title: cleanTitle,
                category,
                projectId: proj.id,
                projectCode: shortCode,
                projectName: proj.nama,
                workItemId: wi.id,
                sourceKey: `wi:${wi.id}`,
                startDateIso: seg.startDateIso,
                endDateIso: seg.endDateIso,
                urgent: isUrgent ? true : undefined,
                syncedFromSchedule: true,
                done: seg.allDone,
                note: null,
              },
            });
          });
        }
      }
    }
  }

  // Bersihkan entri lama untuk item yang disinkronkan:
  // - Bila mode `onlySet`: HANYA hapus entri yang cocok `wiId` di `onlySet`
  // - Bila full sync: hapus entri `syncedFromSchedule` atau `wiId` aktif yang akan diisi ulang
  for (const pic of Object.keys(nextCells)) {
    for (const [dayId, list] of Object.entries(nextCells[pic])) {
      nextCells[pic][dayId] = list.filter((entry) => {
        const wiId =
          entry.workItemId ?? extractWorkItemIdFromSourceKey(entry.sourceKey);
        if (onlySet) {
          return !(wiId && onlySet.has(wiId));
        }
        if (entry.syncedFromSchedule) return false;
        if (wiId && scheduledWorkItemIds.has(wiId)) return false;
        return true;
      });
    }
  }

  // Masukkan entri hasil sinkronisasi Schedule Proyek ke dalam plan
  for (const item of workItemSyncedItems) {
    if (!nextCells[item.pic]) nextCells[item.pic] = {};
    if (!nextCells[item.pic][item.dayId]) {
      nextCells[item.pic][item.dayId] = [];
    }
    nextCells[item.pic][item.dayId].push(item.entry);
  }

  // Pastikan kolom hari urgent (Sabtu/Minggu) ikut terlihat apabila terpakai
  let nextDays = plan.days;
  if (urgentDatesNeeded.size > 0) {
    const existingSet = new Set(nextDays.map((d) => d.dateIso));
    const minIso = nextDays[0]?.dateIso;
    const maxIso = nextDays[nextDays.length - 1]?.dateIso;
    const appended: JobdeskDayColumn[] = [];

    for (const uIso of urgentDatesNeeded) {
      if (
        !existingSet.has(uIso) &&
        (!minIso || !maxIso || (uIso >= minIso && uIso <= maxIso))
      ) {
        appended.push({
          id: `day-${uIso}`,
          dateIso: uIso,
          label: formatDayShortLabel(uIso),
          isWeekend: isWeekendIso(uIso),
        });
      }
    }

    if (appended.length > 0) {
      nextDays = [...nextDays, ...appended].sort((a, b) =>
        a.dateIso.localeCompare(b.dateIso)
      );
    }
  }

  return {
    ...plan,
    pics: nextPics,
    days: nextDays,
    cells: nextCells,
  };
}

export interface PackedJobdeskSpan {
  entry: JobdeskCellEntry;
  storageDayId: string;
  startDateIso: string;
  endDateIso: string;
  startColIdx: number;
  endColIdx: number;
  colSpan: number;
  workingDaysCount: number;
}

export interface PackedPicTracksResult {
  tracks: PackedJobdeskSpan[][];
  outOfRangeEntries: {
    entry: JobdeskCellEntry;
    storageDayId: string;
    startDateIso: string;
    endDateIso: string;
  }[];
}

/**
 * Mengemas seluruh pekerjaan milik 1 PIC ke dalam baris track horizontal (Gantt-style)
 * sehingga pekerjaan dengan rentang multi-hari (`startDateIso .. endDateIso`) terbentang
 * mulus melintasi beberapa kolom tanggal tanpa bertabrakan.
 */
export function packPicScheduleTracks(
  picRow: Record<string, JobdeskCellEntry[]> | undefined,
  days: JobdeskDayColumn[]
): PackedPicTracksResult {
  if (!picRow || days.length === 0) {
    return { tracks: [], outOfRangeEntries: [] };
  }

  const dayDateById = new Map(days.map((d) => [d.id, d.dateIso]));
  const firstVisibleIso = days[0].dateIso;
  const lastVisibleIso = days[days.length - 1].dateIso;

  const spans: PackedJobdeskSpan[] = [];
  const outOfRangeEntries: PackedPicTracksResult["outOfRangeEntries"] = [];

  for (const [storageDayId, list] of Object.entries(picRow)) {
    const inferredIso =
      dayDateById.get(storageDayId) ??
      (storageDayId.startsWith("day-") ? storageDayId.slice(4, 14) : firstVisibleIso);

    for (const entry of list) {
      const { startIso, endIso } = getEntryDateRange(entry, inferredIso);

      // Di luar rentang kolom tanggal yang sedang ditampilkan
      if (endIso < firstVisibleIso || startIso > lastVisibleIso) {
        outOfRangeEntries.push({
          entry,
          storageDayId,
          startDateIso: startIso,
          endDateIso: endIso,
        });
        continue;
      }

      let startColIdx = days.findIndex((d) => d.dateIso >= startIso);
      if (startColIdx === -1) startColIdx = 0;

      let endColIdx = -1;
      for (let i = days.length - 1; i >= startColIdx; i--) {
        if (days[i].dateIso <= endIso) {
          endColIdx = i;
          break;
        }
      }
      if (endColIdx < startColIdx) endColIdx = startColIdx;

      const workingDaysCount = countWorkingDaysInRange(
        startIso,
        endIso,
        Boolean(entry.urgent)
      );

      spans.push({
        entry,
        storageDayId,
        startDateIso: startIso,
        endDateIso: endIso,
        startColIdx,
        endColIdx,
        colSpan: endColIdx - startColIdx + 1,
        workingDaysCount,
      });
    }
  }

  spans.sort((a, b) => {
    if (a.startColIdx !== b.startColIdx) return a.startColIdx - b.startColIdx;
    if (b.colSpan !== a.colSpan) return b.colSpan - a.colSpan;
    return a.entry.title.localeCompare(b.entry.title);
  });

  // Greedy track packing: masukkan setiap span ke baris track paling atas yang masih kosong
  const tracks: PackedJobdeskSpan[][] = [];
  for (const span of spans) {
    let placed = false;
    for (const track of tracks) {
      const hasOverlap = track.some(
        (existing) =>
          !(span.endColIdx < existing.startColIdx || span.startColIdx > existing.endColIdx)
      );
      if (!hasOverlap) {
        track.push(span);
        placed = true;
        break;
      }
    }
    if (!placed) {
      tracks.push([span]);
    }
  }

  return { tracks, outOfRangeEntries };
}

export interface JobdeskAssignmentLocation {
  area: "MATRIX" | "SUB";
  pic?: string;
  dayId?: string;
  dayLabel?: string;
  rangeLabel?: string;
  entryId: string;
}

export function buildAssignmentMap(
  plan: JobdeskPlanData
): Map<string, JobdeskAssignmentLocation[]> {
  const map = new Map<string, JobdeskAssignmentLocation[]>();
  const dayLabelMap = new Map(plan.days.map((d) => [d.id, d.label]));
  const dayDateById = new Map(plan.days.map((d) => [d.id, d.dateIso]));

  for (const pic of plan.pics) {
    const row = plan.cells[pic];
    if (!row) continue;
    for (const [dayId, entries] of Object.entries(row)) {
      const fallbackIso =
        dayDateById.get(dayId) ??
        (dayId.startsWith("day-") ? dayId.slice(4, 14) : plan.startDateIso);

      for (const entry of entries) {
        const key = entry.sourceKey || `title:${entry.title.trim().toLowerCase()}`;
        const list = map.get(key) ?? [];
        const { startIso, endIso } = getEntryDateRange(entry, fallbackIso);
        const startLbl =
          dayLabelMap.get(`day-${startIso}`) ?? formatDayShortLabel(startIso);
        const endLbl =
          dayLabelMap.get(`day-${endIso}`) ?? formatDayShortLabel(endIso);
        const rangeLabel =
          endIso > startIso ? `${startLbl} – ${endLbl}` : startLbl;

        list.push({
          area: "MATRIX",
          pic,
          dayId,
          dayLabel: startLbl,
          rangeLabel,
          entryId: entry.id,
        });
        map.set(key, list);
      }
    }
  }

  for (const sub of plan.subJobdesks) {
    const key = sub.sourceKey || `title:${sub.title.trim().toLowerCase()}`;
    const list = map.get(key) ?? [];
    list.push({
      area: "SUB",
      entryId: sub.id,
    });
    map.set(key, list);
  }

  return map;
}

/**
 * Mengisi otomatis jobdesk antrian proyek yang belum dibagikan ke slot PIC & Tanggal yang kosong.
 */
export function autoDistributeUnassignedJobdesks(
  plan: JobdeskPlanData,
  available: AvailableJobdeskItem[],
  options: { putDelayedHmiToSub?: boolean } = {}
): JobdeskPlanData {
  const putDelayedHmiToSub = options.putDelayedHmiToSub ?? true;
  const skipWeekends = plan.skipWeekends ?? true;

  const nextCells: Record<string, Record<string, JobdeskCellEntry[]>> = {};
  for (const pic of plan.pics) {
    nextCells[pic] = {};
    for (const [dayId, list] of Object.entries(plan.cells[pic] ?? {})) {
      nextCells[pic][dayId] = [...list];
    }
  }
  const nextSubs: SubJobdeskItem[] = [...plan.subJobdesks];

  const existingKeys = new Set<string>();
  for (const pic of plan.pics) {
    for (const list of Object.values(nextCells[pic])) {
      for (const entry of list) {
        if (entry.sourceKey) existingKeys.add(entry.sourceKey);
        existingKeys.add(`title:${entry.title.trim().toLowerCase()}`);
      }
    }
  }
  for (const sub of nextSubs) {
    if (sub.sourceKey) existingKeys.add(sub.sourceKey);
    existingKeys.add(`title:${sub.title.trim().toLowerCase()}`);
  }

  const unassigned = available.filter(
    (item) =>
      !existingKeys.has(item.sourceKey) &&
      !existingKeys.has(`title:${item.title.trim().toLowerCase()}`)
  );

  // Jangan jadwalkan otomatis ke hari Sabtu/Minggu jika skipWeekends aktif
  const workingDays = skipWeekends
    ? plan.days.filter((d) => !isWeekendIso(d.dateIso))
    : plan.days;
  const candidateDays = workingDays.length > 0 ? workingDays : plan.days;

  const slots: { pic: string; dayId: string; dateIso: string }[] = [];
  for (const day of candidateDays) {
    for (const pic of plan.pics) {
      slots.push({ pic, dayId: day.id, dateIso: day.dateIso });
    }
  }

  const emptySlots = slots.filter(
    (s) => (nextCells[s.pic]?.[s.dayId]?.length ?? 0) === 0
  );
  let emptyIdx = 0;
  let roundRobinIdx = 0;

  for (const item of unassigned) {
    if (putDelayedHmiToSub && item.isWiringDelayed && item.category === "HMI") {
      nextSubs.push({
        id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: item.title,
        category: item.category,
        projectId: item.projectId,
        projectCode: item.projectCode,
        projectName: item.projectName,
        sourceKey: item.sourceKey,
        done: false,
      });
      continue;
    }

    if (slots.length === 0) break;

    let targetSlot: { pic: string; dayId: string; dateIso: string } | undefined;
    if (item.defaultPic) {
      const matchedEmptyIdx = emptySlots.findIndex(
        (s, idx) =>
          idx >= emptyIdx &&
          s.pic.toLowerCase().includes(item.defaultPic!.trim().toLowerCase())
      );
      if (matchedEmptyIdx !== -1) {
        targetSlot = emptySlots.splice(matchedEmptyIdx, 1)[0];
      }
    }

    if (!targetSlot && emptyIdx < emptySlots.length) {
      targetSlot = emptySlots[emptyIdx];
      emptyIdx += 1;
    }

    if (!targetSlot) {
      targetSlot = slots[roundRobinIdx % slots.length];
      roundRobinIdx += 1;
    }

    if (!nextCells[targetSlot.pic][targetSlot.dayId]) {
      nextCells[targetSlot.pic][targetSlot.dayId] = [];
    }

    nextCells[targetSlot.pic][targetSlot.dayId].push({
      id: `cell-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title,
      category: item.category,
      projectId: item.projectId,
      projectCode: item.projectCode,
      projectName: item.projectName,
      workItemId: item.sourceType === "WORK_ITEM" ? extractWorkItemIdFromSourceKey(item.sourceKey) : null,
      sourceKey: item.sourceKey,
      startDateIso: targetSlot.dateIso,
      endDateIso: targetSlot.dateIso,
      done: false,
      note: null,
    });
  }

  return {
    ...plan,
    cells: nextCells,
    subJobdesks: nextSubs,
  };
}

export interface JobdeskDashboardTask {
  id: string;
  workItemId: string;
  workItemJudul: string;
  workItemPic: string | null;
  workItemUrutan: number | null;
  subScopeId: string | null;
  subScopeJudul: string | null;
  subScopeUrutan: number | null;
  jenis: WorkType;
  bolehParalel: boolean;
  laneId: string;
  laneNama: string;
  projectId: string;
  projectNama: string;
  projectClient: string;
  projectWarna: string;
  tanggal: string;
  status: ScheduleCellStatus;
  warnaCustom: string | null;
  catatan: string | null;
  pointsCount: number;
  source: "JOBDESK";
  jobdeskPic: string;
  jobdeskEntryId: string;
}

function mapJobdeskCategoryToWorkType(category: JobdeskCategory): WorkType {
  if (category === "PROGRAM" || category === "HMI") return "PROGRAMMING";
  if (category === "WIRING") return "WIRING";
  return "LAINNYA";
}

function defaultPicColor(picName: string): string {
  const found = SYSTEM_PICS.find(
    (p) => p.value.toLowerCase() === picName.trim().toLowerCase()
  );
  return found?.color ?? "#64748b";
}

function doesPicMatchString(rawPic: string | null | undefined, targetPic: string): boolean {
  if (!rawPic) return false;
  const target = targetPic.trim().toLowerCase();
  const tokens = rawPic
    .toLowerCase()
    .split(/[,/&+]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return tokens.includes(target);
}

/**
 * Mengambil seluruh tugas pada `Pembagian Jobdesk` yang aktif pada `targetDateIso`
 * untuk digabungkan ke Dashboard (`Delegasi Pekerjaan Tim & Penjadwalan` dan `Agenda Hari Ini/Besok`)
 * tanpa menduplikasi item yang sudah ada di Schedule Proyek pada tanggal dan PIC yang sama.
 */
export function extractJobdeskTasksForDate(
  plan: JobdeskPlanData,
  targetDateIso: string,
  projectsById: Map<
    string,
    { nama: string; client: string; warna: string; kode?: string | null }
  >,
  existingScheduleTasks: {
    workItemId?: string | null;
    workItemJudul: string;
    workItemPic?: string | null;
  }[] = []
): JobdeskDashboardTask[] {
  const dayDateById = new Map(plan.days.map((d) => [d.id, d.dateIso]));
  const result: JobdeskDashboardTask[] = [];

  for (const pic of plan.pics) {
    const picRow = plan.cells[pic];
    if (!picRow) continue;

    for (const [dayId, list] of Object.entries(picRow)) {
      const fallbackIso =
        dayDateById.get(dayId) ??
        (dayId.startsWith("day-") ? dayId.slice(4, 14) : plan.startDateIso);

      for (const entry of list) {
        const range = getEntryDateRange(entry, fallbackIso);
        const activeDates = expandWorkingDateRange(
          range.startIso,
          range.endIso,
          Boolean(entry.urgent)
        );
        if (!activeDates.includes(targetDateIso)) continue;

        const linkedWiId =
          entry.workItemId ||
          (entry.sourceKey?.startsWith("wi:") ? entry.sourceKey.slice(3) : null);

        // Cegah duplikasi jika tugas Schedule Proyek yang sama sudah muncul untuk PIC & tanggal ini
        const alreadyInSchedule = existingScheduleTasks.some((t) => {
          if (!doesPicMatchString(t.workItemPic, pic)) return false;
          if (linkedWiId && t.workItemId === linkedWiId) return true;
          return (
            t.workItemJudul.trim().toLowerCase() ===
            entry.title.trim().toLowerCase()
          );
        });
        if (alreadyInSchedule) continue;

        const proj = entry.projectId ? projectsById.get(entry.projectId) : undefined;
        const picColor = defaultPicColor(pic);

        result.push({
          id: `jobdesk:${pic}:${entry.id}`,
          workItemId: linkedWiId ?? "",
          workItemJudul: entry.title,
          workItemPic: pic,
          workItemUrutan: 999,
          subScopeId: null,
          subScopeJudul: null,
          subScopeUrutan: null,
          jenis: mapJobdeskCategoryToWorkType(entry.category),
          bolehParalel: true,
          laneId: "",
          laneNama: "Pembagian Jobdesk",
          projectId: entry.projectId ?? "",
          projectNama:
            proj?.nama || entry.projectName || "Pembagian Jobdesk Harian",
          projectClient:
            proj?.client || entry.projectCode || "Tim Engineering",
          projectWarna: proj?.warna || picColor,
          tanggal: targetDateIso,
          status: entry.done ? "DONE" : "ON_PROGRESS",
          warnaCustom: null,
          catatan: entry.urgent
            ? entry.note
              ? `URGENT • ${entry.note}`
              : "URGENT"
            : entry.note ?? null,
          pointsCount: 1,
          source: "JOBDESK",
          jobdeskPic: pic,
          jobdeskEntryId: entry.id,
        });
      }
    }
  }

  return result;
}
