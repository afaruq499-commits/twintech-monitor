import {
  ARRIVED_PURCHASE_STATUSES,
  COMPONENT_DEPENDENT_WORK_TYPES,
  PURCHASE_STATUS_LABELS,
  WORK_TYPE_LABELS,
  type ComponentImportStatus,
  type PurchaseStatus,
  type WorkType,
} from "@/lib/constants";
import { formatTanggalId } from "@/lib/date-utils";

export interface ComponentForWarning {
  id: string;
  kelompok: string;
  partType: string;
  partName: string;
  qty: number;
  unit: string | null;
  statusPembelian: PurchaseStatus;
  estimasiTiba: string | null;
  statusImport?: ComponentImportStatus;
}

export interface ComponentWarningResult {
  hasWarning: boolean;
  scope: "LINKED" | "PROJECT" | "NONE";
  missingComponents: ComponentForWarning[];
  checkedCount: number;
  message: string | null;
}

/**
 * Cek kesiapan komponen saat menjadwalkan Wiring / Instalasi di Site.
 * Tidak memblokir penyimpanan, tetapi mengembalikan WARNING beserta daftar komponen belum datang & ETA.
 */
export function checkComponentReadinessWarning(params: {
  jenis: WorkType;
  projectComponents: ComponentForWarning[];
  linkedComponentIds?: string[];
}): ComponentWarningResult {
  const { jenis, projectComponents, linkedComponentIds = [] } = params;

  if (!COMPONENT_DEPENDENT_WORK_TYPES.includes(jenis)) {
    return {
      hasWarning: false,
      scope: "NONE",
      missingComponents: [],
      checkedCount: 0,
      message: null,
    };
  }

  const activeComponents = projectComponents.filter(
    (c) => c.statusImport !== "HILANG_DI_REVISI"
  );

  const useLinked = linkedComponentIds.length > 0;
  const linkedSet = new Set(linkedComponentIds);
  const relevant = useLinked
    ? activeComponents.filter((c) => linkedSet.has(c.id))
    : activeComponents;

  const missingComponents = relevant.filter(
    (c) => !ARRIVED_PURCHASE_STATUSES.includes(c.statusPembelian)
  );

  if (missingComponents.length === 0) {
    return {
      hasWarning: false,
      scope: useLinked ? "LINKED" : "PROJECT",
      missingComponents: [],
      checkedCount: relevant.length,
      message: null,
    };
  }

  const jenisLabel = WORK_TYPE_LABELS[jenis];
  const scopeText = useLinked
    ? "komponen yang ditautkan ke pekerjaan ini"
    : "komponen proyek ini";
  const previewItems = missingComponents
    .slice(0, 3)
    .map((c) => {
      const eta = c.estimasiTiba
        ? `ETA ${formatTanggalId(c.estimasiTiba, false)}`
        : PURCHASE_STATUS_LABELS[c.statusPembelian];
      return `${c.partName} - ${c.partType} (${eta})`;
    })
    .join("; ");

  const moreText =
    missingComponents.length > 3
      ? ` dan ${missingComponents.length - 3} komponen lainnya`
      : "";

  const message = `Peringatan ${jenisLabel}: ${missingComponents.length} dari ${relevant.length} ${scopeText} belum datang: ${previewItems}${moreText}.`;

  return {
    hasWarning: true,
    scope: useLinked ? "LINKED" : "PROJECT",
    missingComponents,
    checkedCount: relevant.length,
    message,
  };
}
