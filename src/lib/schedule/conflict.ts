import {
  WORK_TYPE_LABELS,
  type ScheduleCellStatus,
  type WorkType,
} from "@/lib/constants";
import {
  addDaysIso,
  diffDaysIso,
  formatHariTanggalSingkat,
  formatTanggalId,
} from "@/lib/date-utils";

export interface ScheduledWorkEntry {
  cellId?: string;
  workItemId: string;
  judul: string;
  jenis: WorkType;
  bolehParalel: boolean;
  projectBolehParalel?: boolean;
  projectId: string;
  projectNama: string;
  laneId: string;
  laneNama: string;
  tanggal: string; // YYYY-MM-DD
  status?: ScheduleCellStatus;
}

export interface CandidateScheduleWork {
  workItemId: string;
  judul: string;
  jenis: WorkType;
  bolehParalel: boolean;
  projectBolehParalel?: boolean;
  projectId: string;
  projectNama: string;
  laneId?: string;
  laneNama?: string;
}

export interface ConflictSettings {
  kapasitasPerHari: number;
  jenisDikecualikan: WorkType[];
}

export interface SuggestedDate {
  tanggal: string;
  label: string;
  selisihHari: number;
}

export interface ConflictCheckResult {
  blocked: boolean;
  exempt: boolean;
  occupants: ScheduledWorkEntry[];
  message: string | null;
  suggestions: SuggestedDate[];
}

export const DEFAULT_CONFLICT_SETTINGS: ConflictSettings = {
  kapasitasPerHari: 1,
  jenisDikecualikan: ["MEETING"],
};

export function isWorkExemptFromCapacity(
  item: {
    jenis: WorkType;
    bolehParalel: boolean;
    projectBolehParalel?: boolean;
  },
  settings: ConflictSettings = DEFAULT_CONFLICT_SETTINGS
): boolean {
  if (item.bolehParalel || item.projectBolehParalel) return true;
  return settings.jenisDikecualikan.includes(item.jenis);
}

function formatOccupantLabel(entry: ScheduledWorkEntry): string {
  const titleLower = entry.judul.toLowerCase();
  const projLower = entry.projectNama.toLowerCase();
  if (titleLower.includes(projLower)) {
    return entry.judul;
  }
  return `${entry.judul} (${entry.projectNama})`;
}

/**
 * Cari N tanggal kosong terdekat dari targetDateIso di mana jumlah pekerjaan utama < kapasitasPerHari
 * dan workItem kandidat belum dijadwalkan di tanggal tersebut.
 */
export function suggestNearestFreeDates(
  targetDateIso: string,
  allEntries: ScheduledWorkEntry[],
  candidateWorkItemId: string,
  settings: ConflictSettings = DEFAULT_CONFLICT_SETTINGS,
  options?: { count?: number; minDateIso?: string; excludeDateIso?: string }
): SuggestedDate[] {
  const needed = options?.count ?? 3;
  const kapasitas = Math.max(1, settings.kapasitasPerHari);

  // Hitung pemakaian kapasitas per tanggal (abaikan sel yang sedang dipindah bila excludeDateIso diset)
  const mainWorkByDate = new Map<string, Set<string>>();
  const candidateDates = new Set<string>();

  for (const e of allEntries) {
    if (
      options?.excludeDateIso &&
      e.workItemId === candidateWorkItemId &&
      e.tanggal === options.excludeDateIso
    ) {
      continue;
    }
    if (e.workItemId === candidateWorkItemId) {
      candidateDates.add(e.tanggal);
    }
    if (isWorkExemptFromCapacity(e, settings)) continue;
    const set = mainWorkByDate.get(e.tanggal) ?? new Set<string>();
    set.add(e.workItemId);
    mainWorkByDate.set(e.tanggal, set);
  }

  const suggestions: SuggestedDate[] = [];
  // Urutan pencarian keluar dari target: +1, -1, +2, -2, ... hingga +-60 hari
  for (let offset = 1; offset <= 60 && suggestions.length < needed; offset++) {
    const candidates = [
      addDaysIso(targetDateIso, offset),
      addDaysIso(targetDateIso, -offset),
    ];
    for (const dt of candidates) {
      if (suggestions.length >= needed) break;
      if (options?.minDateIso && dt < options.minDateIso) continue;
      if (candidateDates.has(dt)) continue;
      const usedSet = mainWorkByDate.get(dt);
      const usedCount = usedSet ? usedSet.size : 0;
      if (usedCount < kapasitas) {
        suggestions.push({
          tanggal: dt,
          label: formatTanggalId(dt, true),
          selisihHari: diffDaysIso(targetDateIso, dt),
        });
      }
    }
  }

  return suggestions;
}

/**
 * Validasi konflik tanggal lintas SEMUA proyek dan lane pada level pekerjaan-per-tanggal.
 * Dipakai seragam oleh form, grid editor, dan drag-and-drop kalender.
 */
export function checkScheduleConflict(params: {
  targetDateIso: string;
  candidate: CandidateScheduleWork;
  allEntries: ScheduledWorkEntry[];
  settings?: ConflictSettings;
  /** Bila drag-and-drop memindahkan sel dari tanggal lama ke tanggal baru */
  moveFromDateIso?: string;
  minSuggestionDateIso?: string;
}): ConflictCheckResult {
  const {
    targetDateIso,
    candidate,
    allEntries,
    settings = DEFAULT_CONFLICT_SETTINGS,
    moveFromDateIso,
    minSuggestionDateIso,
  } = params;

  const kapasitas = Math.max(1, settings.kapasitasPerHari);

  // Meeting atau pekerjaan bertanda "boleh paralel" dikecualikan dari batas kapasitas
  if (isWorkExemptFromCapacity(candidate, settings)) {
    return {
      blocked: false,
      exempt: true,
      occupants: [],
      message: null,
      suggestions: [],
    };
  }

  // Kumpulkan pekerjaan utama unik di targetDateIso (selain kandidat sendiri)
  const occupantMap = new Map<string, ScheduledWorkEntry>();
  for (const entry of allEntries) {
    if (entry.tanggal !== targetDateIso) continue;
    if (entry.workItemId === candidate.workItemId) continue;
    if (isWorkExemptFromCapacity(entry, settings)) continue;
    if (!occupantMap.has(entry.workItemId)) {
      occupantMap.set(entry.workItemId, entry);
    }
  }

  const occupants = Array.from(occupantMap.values());
  if (occupants.length < kapasitas) {
    return {
      blocked: false,
      exempt: false,
      occupants,
      message: null,
      suggestions: [],
    };
  }

  const occupantPoints = occupants
    .map((occ, idx) => {
      const projSuffix =
        occ.projectId && candidate.projectId && occ.projectId !== candidate.projectId
          ? ` (${occ.projectNama})`
          : "";
      return `${idx + 1}. ${occ.judul}${projSuffix}`;
    })
    .join("\n");

  const hariTgl = formatHariTanggalSingkat(targetDateIso);
  const message = `Tanggal ${hariTgl} tabrakan dengan:\n${occupantPoints}`;

  const suggestions = suggestNearestFreeDates(
    targetDateIso,
    allEntries,
    candidate.workItemId,
    settings,
    {
      count: 3,
      minDateIso: minSuggestionDateIso,
      excludeDateIso: moveFromDateIso,
    }
  );

  return {
    blocked: true,
    exempt: false,
    occupants,
    message,
    suggestions,
  };
}
