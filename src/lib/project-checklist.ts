export interface FileChecklistState {
  [key: string]: {
    checked: boolean;
    updatedAt?: string;
    updatedBy?: string;
  };
}

export const PROJECT_CHECKLIST_KEYS = [
  "komponen_pr",
  "schedule_pengerjaan",
  "alamat_io",
  "layout_panel_hmi",
  "layout_panel_utama",
  "flowchart",
  "diagram_wiring",
  "pemprograman",
] as const;

export type ProjectChecklistKey = (typeof PROJECT_CHECKLIST_KEYS)[number];

export const PROJECT_CHECKLIST_TOTAL_COUNT = PROJECT_CHECKLIST_KEYS.length;

/**
 * Berkas-berkas yang TIDAK otomatis tercentang oleh deteksi sistem dan
 * hanya boleh diverifikasi / diceklis manual oleh pengguna dengan hak akses ADMIN.
 */
export const ADMIN_MANUAL_CHECKLIST_KEYS = [
  "komponen_pr",
  "schedule_pengerjaan",
  "layout_panel_hmi",
  "layout_panel_utama",
] as const;

export type AdminManualChecklistKey = (typeof ADMIN_MANUAL_CHECKLIST_KEYS)[number];

export function isAdminOnlyChecklistKey(
  key: string
): key is AdminManualChecklistKey {
  return (ADMIN_MANUAL_CHECKLIST_KEYS as readonly string[]).includes(key);
}

export interface ChecklistDetectionSummary {
  prStatus: string;
  componentsCount: number;
  lanesCount: number;
  scheduleCellsCount: number;
  hasPlcAddresses: boolean;
  plcAddressesCount: number;
  hasPanelMain: boolean;
  panelMainCount: number;
  hasPanelHmi: boolean;
  panelHmiCount: number;
  hasFlowchart: boolean;
  hasWiringPdf: boolean;
  wiringPdfName?: string | null;
  hasPlcProgram: boolean;
  plcProgramFileName?: string | null;
  hasHmiProgram: boolean;
  hmiProgramFileName?: string | null;
}

export interface ChecklistDetectionInput {
  prStatus?: string | null;
  componentsCount: number;
  lanesCount: number;
  scheduleCellsCount: number;
  plcAddressesJson?: string | null;
  panelLayoutJson?: string | null;
  flowSequenceJson?: string | null;
  wiringDiagramPdfUrl?: string | null;
  wiringDiagramPdfName?: string | null;
  plcProgramFileUrl?: string | null;
  plcProgramFileName?: string | null;
  hmiProgramFileUrl?: string | null;
  hmiProgramFileName?: string | null;
}

export interface ChecklistProgressResult {
  completedCount: number;
  totalCount: number;
  progressPct: number;
  autoByKey: Record<ProjectChecklistKey, boolean>;
}

/**
 * Safely parses serialized manual checklist state from `Project.fileChecklistJson`.
 */
export function parseFileChecklistJson(json?: string | null): FileChecklistState {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as FileChecklistState;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Extracts auto-detection signals for the 8 standard engineering project files.
 */
export function deriveChecklistDetection(
  input: ChecklistDetectionInput
): ChecklistDetectionSummary {
  let plcAddressesCount = 0;
  if (input.plcAddressesJson) {
    try {
      const parsedPlc = JSON.parse(input.plcAddressesJson);
      if (Array.isArray(parsedPlc)) {
        plcAddressesCount = parsedPlc.length;
      }
    } catch {
      plcAddressesCount = 1;
    }
  }

  let hasPanelMain = false;
  let panelMainCount = 0;
  let hasPanelHmi = false;
  let panelHmiCount = 0;

  if (input.panelLayoutJson) {
    try {
      const parsedPanel = JSON.parse(input.panelLayoutJson);
      if (parsedPanel?.main?.items && Array.isArray(parsedPanel.main.items)) {
        panelMainCount = parsedPanel.main.items.length;
        hasPanelMain = panelMainCount > 0;
      }
      if (parsedPanel?.hmi?.items && Array.isArray(parsedPanel.hmi.items)) {
        panelHmiCount = parsedPanel.hmi.items.length;
        hasPanelHmi = panelHmiCount > 0;
      }
      if (!hasPanelMain && !hasPanelHmi && Array.isArray(parsedPanel)) {
        hasPanelMain = parsedPanel.length > 0;
        panelMainCount = parsedPanel.length;
      }
    } catch {
      // Ignore malformed layout JSON
    }
  }

  return {
    prStatus: input.prStatus ?? "DRAFT",
    componentsCount: input.componentsCount,
    lanesCount: input.lanesCount,
    scheduleCellsCount: input.scheduleCellsCount,
    hasPlcAddresses: Boolean(input.plcAddressesJson) && plcAddressesCount > 0,
    plcAddressesCount,
    hasPanelMain,
    panelMainCount,
    hasPanelHmi,
    panelHmiCount,
    hasFlowchart: Boolean(input.flowSequenceJson),
    hasWiringPdf: Boolean(input.wiringDiagramPdfUrl),
    wiringPdfName: input.wiringDiagramPdfName ?? null,
    hasPlcProgram: Boolean(input.plcProgramFileUrl),
    plcProgramFileName: input.plcProgramFileName ?? null,
    hasHmiProgram: Boolean(input.hmiProgramFileUrl),
    hmiProgramFileName: input.hmiProgramFileName ?? null,
  };
}

/**
 * Computes completion counts and percentage across the 8 checklist items.
 *
 * Catatan penting:
 * - Berkas #1 (Komponen PR), #2 (Schedule pengerjaan), #4 (Layout HMI), dan #5 (Layout Panel Utama) TIDAK LAGI
 *   otomatis tercentang oleh deteksi sistem, melainkan murni verifikasi manual khusus ADMIN.
 * - Berkas lainnya (Alamat I/O, Flowchart, Diagram Wiring, Program PLC/HMI)
 *   tetap tercentang otomatis jika berkas/data telah diinput atau dicentang manual.
 */
export function computeChecklistProgress(
  checklistState: FileChecklistState,
  detection: ChecklistDetectionSummary
): ChecklistProgressResult {
  const autoByKey: Record<ProjectChecklistKey, boolean> = {
    // Verifikasi manual khusus Admin (tidak otomatis aktif oleh deteksi sistem)
    komponen_pr: false,
    schedule_pengerjaan: false,
    alamat_io: detection.hasPlcAddresses,
    layout_panel_hmi: false,
    layout_panel_utama: false,
    flowchart: detection.hasFlowchart,
    diagram_wiring: detection.hasWiringPdf,
    pemprograman: Boolean(detection.hasPlcProgram && detection.hasHmiProgram),
  };

  let completedCount = 0;
  for (const key of PROJECT_CHECKLIST_KEYS) {
    const isManuallyChecked = Boolean(checklistState[key]?.checked);
    if (isManuallyChecked || autoByKey[key]) {
      completedCount += 1;
    }
  }

  const totalCount = PROJECT_CHECKLIST_TOTAL_COUNT;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return {
    completedCount,
    totalCount,
    progressPct,
    autoByKey,
  };
}
