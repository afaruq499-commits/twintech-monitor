import {
  ARRIVED_PURCHASE_STATUSES,
  PROJECT_PRIORITY_LABELS,
  type ComponentImportStatus,
  type ProjectPriority,
  type ProjectStatus,
  type PurchaseStatus,
} from "@/lib/constants";
import { diffDaysIso } from "@/lib/date-utils";

export interface PriorityProjectInput {
  id: string;
  kode: string | null;
  nama: string;
  client: string;
  status: ProjectStatus;
  prioritas: ProjectPriority;
  deadline: string | null; // YYYY-MM-DD
  urutanManual: number | null;
  warna?: string;
  scheduledCellsCount: number;
  components: {
    statusPembelian: PurchaseStatus;
    statusImport?: ComponentImportStatus;
  }[];
}

export interface RankedProjectPriority {
  project: PriorityProjectInput;
  rank: number;
  isManualOverride: boolean;
  autoScore: number;
  breakdown: {
    deadlineScore: number;
    priorityScore: number;
    readinessScore: number;
  };
  daysToDeadline: number | null;
  totalComponents: number;
  arrivedComponents: number;
  componentReadinessPct: number;
  isDeadlineRisk: boolean;
  riskReasons: string[];
  reasons: string[];
  reasonSummary: string;
}

function calcDeadlineScore(days: number | null): number {
  if (days === null) return 10;
  if (days < 0) return 60;
  if (days === 0) return 56;
  if (days <= 3) return 52 - (days - 1) * 3;
  if (days <= 7) return 42 - (days - 4) * 3;
  if (days <= 14) return 28 - (days - 8) * 2;
  if (days <= 30) return Math.max(5, 15 - Math.floor((days - 15) / 2));
  return 4;
}

function calcPriorityLevelScore(prioritas: ProjectPriority): number {
  switch (prioritas) {
    case "TINGGI":
      return 30;
    case "SEDANG":
      return 15;
    case "RENDAH":
      return 0;
  }
}

export function rankProjectPriorities(
  projects: PriorityProjectInput[],
  todayIso: string
): RankedProjectPriority[] {
  const active = projects.filter((p) => p.status !== "SELESAI");

  const scored = active.map((p) => {
    const daysToDeadline = p.deadline ? diffDaysIso(todayIso, p.deadline) : null;
    const activeComps = p.components.filter(
      (c) => c.statusImport !== "HILANG_DI_REVISI"
    );
    const totalComponents = activeComps.length;
    const arrivedComponents = activeComps.filter((c) =>
      ARRIVED_PURCHASE_STATUSES.includes(c.statusPembelian)
    ).length;
    const componentReadinessPct =
      totalComponents === 0
        ? 100
        : Math.round((arrivedComponents / totalComponents) * 100);

    const deadlineScore = calcDeadlineScore(daysToDeadline);
    const priorityScore = calcPriorityLevelScore(p.prioritas);
    const readinessScore = Math.round((componentReadinessPct / 100) * 25);
    const autoScore = deadlineScore + priorityScore + readinessScore;

    const reasons: string[] = [];
    if (daysToDeadline === null) {
      reasons.push("Belum ada deadline");
    } else if (daysToDeadline < 0) {
      reasons.push(`Terlambat ${Math.abs(daysToDeadline)} hari dari deadline`);
    } else if (daysToDeadline === 0) {
      reasons.push("Deadline hari ini");
    } else {
      reasons.push(`Deadline ${daysToDeadline} hari lagi`);
    }

    reasons.push(`Prioritas ${PROJECT_PRIORITY_LABELS[p.prioritas]}`);

    if (totalComponents === 0) {
      reasons.push("komponen 100% siap (tanpa PR)");
    } else {
      reasons.push(
        `komponen ${componentReadinessPct}% lengkap (${arrivedComponents}/${totalComponents})`
      );
    }

    // Aturan 4.4 Deadline risk: deadline < 7 hari & (belum punya jadwal ATAU komponen belum lengkap)
    const riskReasons: string[] = [];
    if (daysToDeadline !== null && daysToDeadline < 7) {
      if (p.scheduledCellsCount === 0) {
        riskReasons.push("Belum memiliki jadwal pengerjaan");
      }
      if (totalComponents > 0 && componentReadinessPct < 100) {
        riskReasons.push(
          `Komponen baru ${componentReadinessPct}% (${totalComponents - arrivedComponents} belum datang)`
        );
      }
    }

    return {
      project: p,
      rank: 0,
      isManualOverride: p.urutanManual !== null && p.urutanManual !== undefined,
      autoScore,
      breakdown: {
        deadlineScore,
        priorityScore,
        readinessScore,
      },
      daysToDeadline,
      totalComponents,
      arrivedComponents,
      componentReadinessPct,
      isDeadlineRisk: riskReasons.length > 0,
      riskReasons,
      reasons,
      reasonSummary: reasons.join(", "),
    };
  });

  scored.sort((a, b) => {
    const aHasManual = a.project.urutanManual !== null && a.project.urutanManual !== undefined;
    const bHasManual = b.project.urutanManual !== null && b.project.urutanManual !== undefined;
    if (aHasManual && bHasManual) {
      return (a.project.urutanManual as number) - (b.project.urutanManual as number);
    }
    if (aHasManual) return -1;
    if (bHasManual) return 1;

    if (b.autoScore !== a.autoScore) return b.autoScore - a.autoScore;
    const aDays = a.daysToDeadline ?? 99999;
    const bDays = b.daysToDeadline ?? 99999;
    if (aDays !== bDays) return aDays - bDays;
    return a.project.nama.localeCompare(b.project.nama);
  });

  return scored.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}
