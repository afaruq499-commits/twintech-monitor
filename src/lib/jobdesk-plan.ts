import { z } from "zod";
import {
  PROJECT_STATUS_LABELS,
  type ComponentImportStatus,
  type ProjectPriority,
  type ProjectStatus,
  type PurchaseStatus,
} from "@/lib/constants";
import { addDaysIso, todayIsoLocal } from "@/lib/date-utils";
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
  { badge: string; border: string; dot: string }
> = {
  PROGRAM: {
    badge:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
    border: "border-l-blue-500",
    dot: "bg-blue-500",
  },
  HMI: {
    badge:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60",
    border: "border-l-purple-500",
    dot: "bg-purple-500",
  },
  WIRING: {
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
    border: "border-l-amber-500",
    dot: "bg-amber-500",
  },
  DIAGRAM_WIRING: {
    badge:
      "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800/60",
    border: "border-l-cyan-500",
    dot: "bg-cyan-500",
  },
  PANEL: {
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
  },
  LAINNYA: {
    badge:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700",
    border: "border-l-slate-400",
    dot: "bg-slate-400",
  },
};

export const DEFAULT_SUB_JOBDESK_NOTE =
  "sub jobdesk dikerjakan ketika wiring delay komponen";

export const DEFAULT_JOBDESK_TITLE = "Pembagian Jobdesk Harian Tim";

export interface JobdeskDayColumn {
  id: string;
  dateIso: string; // YYYY-MM-DD
  label: string; // e.g. "26 Nov"
}

export interface JobdeskCellEntry {
  id: string;
  title: string;
  category: JobdeskCategory;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  sourceKey?: string | null;
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
});

export const jobdeskCellEntrySchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  category: z.enum(JOBDESK_CATEGORIES).default("LAINNYA"),
  projectId: z.string().max(100).nullable().optional(),
  projectCode: z.string().max(120).nullable().optional(),
  projectName: z.string().max(300).nullable().optional(),
  sourceKey: z.string().max(200).nullable().optional(),
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
  days: z.array(jobdeskDayColumnSchema).min(1).max(31),
  pics: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  cells: z.record(z.string(), z.record(z.string(), z.array(jobdeskCellEntrySchema))),
  subJobdesks: z.array(subJobdeskItemSchema).max(100),
  subNote: z.string().max(400),
});

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

export function generateConsecutiveDayColumns(
  startDateIso: string,
  count: number = 5,
  skipSundays: boolean = false
): JobdeskDayColumn[] {
  const safeCount = Math.max(1, Math.min(31, Math.round(count)));
  const cols: JobdeskDayColumn[] = [];
  let offset = 0;

  while (cols.length < safeCount && offset < 90) {
    const iso = addDaysIso(startDateIso, offset);
    offset += 1;
    if (skipSundays) {
      const [y, m, d] = iso.split("-").map(Number);
      const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (dayOfWeek === 0) continue;
    }
    cols.push({
      id: `day-${iso}`,
      dateIso: iso,
      label: formatDayShortLabel(iso),
    });
  }
  return cols;
}

export function createDefaultJobdeskPlanData(
  startDateIso: string = todayIsoLocal(),
  dayCount: number = 5
): JobdeskPlanData {
  return {
    title: DEFAULT_JOBDESK_TITLE,
    startDateIso,
    days: generateConsecutiveDayColumns(startDateIso, dayCount, false),
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
      return validated.data;
    }
  } catch {
    // fallback to default
  }
  const def = createDefaultJobdeskPlanData();
  if (fallbackTitle?.trim()) def.title = fallbackTitle.trim();
  return def;
}

export function inferCategoryFromText(text: string): JobdeskCategory {
  const lower = text.toLowerCase();
  if (lower.includes("diagram") || lower.includes("wiring diagram") || lower.includes("skematik")) {
    return "DIAGRAM_WIRING";
  }
  if (lower.includes("hmi") || lower.includes("got") || lower.includes("touchscreen")) {
    return "HMI";
  }
  if (lower.includes("program") || lower.includes("plc") || lower.includes("ladder")) {
    return "PROGRAM";
  }
  if (lower.includes("wiring") || lower.includes("panel") && lower.includes("rakit")) {
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
      (sum, l) => sum + l.workItems.reduce((wSum, w) => wSum + w.scheduleCells.length, 0),
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
      pushChecklistJob("diagram_wiring", `Diagram Wiring ${shortCode}`, "DIAGRAM_WIRING");
    }

    const isWiringStageFinished =
      src.status === "PROGRAMMING" || src.status === "COMMISSIONING";
    if (!isWiringStageFinished && !coveredCategories.has("WIRING")) {
      pushChecklistJob("wiring", `Wiring ${shortCode}`, "WIRING");
    }

    const isProgramManualDone = Boolean(checklistState.pemprograman?.checked);
    if (!isProgramManualDone && !detection.hasPlcProgram && !coveredCategories.has("PROGRAM")) {
      pushChecklistJob("program", `Program ${shortCode}`, "PROGRAM");
    }

    if (!isProgramManualDone && !detection.hasHmiProgram && !coveredCategories.has("HMI")) {
      pushChecklistJob("hmi", `HMI ${shortCode}`, "HMI");
    }

    const isPanelMainDone =
      Boolean(checklistState.layout_panel_utama?.checked) || detection.hasPanelMain;
    if (!isPanelMainDone && !coveredCategories.has("PANEL")) {
      pushChecklistJob("layout_panel", `Layout Panel ${shortCode}`, "PANEL");
    }
  }

  return results;
}

export interface JobdeskAssignmentLocation {
  area: "MATRIX" | "SUB";
  pic?: string;
  dayId?: string;
  dayLabel?: string;
  entryId: string;
}

export function buildAssignmentMap(
  plan: JobdeskPlanData
): Map<string, JobdeskAssignmentLocation[]> {
  const map = new Map<string, JobdeskAssignmentLocation[]>();
  const dayLabelMap = new Map(plan.days.map((d) => [d.id, d.label]));

  for (const pic of plan.pics) {
    const row = plan.cells[pic];
    if (!row) continue;
    for (const [dayId, entries] of Object.entries(row)) {
      for (const entry of entries) {
        const key = entry.sourceKey || `title:${entry.title.trim().toLowerCase()}`;
        const list = map.get(key) ?? [];
        list.push({
          area: "MATRIX",
          pic,
          dayId,
          dayLabel: dayLabelMap.get(dayId) ?? dayId,
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
 * Job HMI pada proyek yang komponennya masih delay diarahkan ke daftar Sub Jobdesk
 * jika slot cadangan dipilih, atau tetap menjaga item yang sudah diisi user.
 */
export function autoDistributeUnassignedJobdesks(
  plan: JobdeskPlanData,
  available: AvailableJobdeskItem[],
  options: { putDelayedHmiToSub?: boolean } = {}
): JobdeskPlanData {
  const putDelayedHmiToSub = options.putDelayedHmiToSub ?? true;
  const nextCells: Record<string, Record<string, JobdeskCellEntry[]>> = {};
  for (const pic of plan.pics) {
    nextCells[pic] = {};
    for (const day of plan.days) {
      nextCells[pic][day.id] = [...(plan.cells[pic]?.[day.id] ?? [])];
    }
  }
  const nextSubs: SubJobdeskItem[] = [...plan.subJobdesks];

  const existingKeys = new Set<string>();
  for (const pic of plan.pics) {
    for (const day of plan.days) {
      for (const entry of nextCells[pic][day.id]) {
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

  // Kumpulkan daftar slot [dayIdx][picIdx] kosong lebih dulu, lalu isi secara merata
  const slots: { pic: string; dayId: string }[] = [];
  for (const day of plan.days) {
    for (const pic of plan.pics) {
      slots.push({ pic, dayId: day.id });
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

    let targetSlot: { pic: string; dayId: string } | undefined;
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

    nextCells[targetSlot.pic][targetSlot.dayId].push({
      id: `cell-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title,
      category: item.category,
      projectId: item.projectId,
      projectCode: item.projectCode,
      projectName: item.projectName,
      sourceKey: item.sourceKey,
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
