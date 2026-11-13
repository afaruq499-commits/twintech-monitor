/**
 * Definisi & helper komponen wajib Purchase Requisition (PR).
 *
 * Setiap PR selalu menyertakan daftar komponen wajib ini yang tidak bisa dihapus
 * dan hanya kolom value (qty) saja yang dapat diubah (qty = 0 berarti tidak masuk PR).
 */

export type MandatoryPrKey =
  | "kabel-034"
  | "kabel-075"
  | "kabel-25"
  | "kabel-6"
  | "kabel-core-034"
  | "kabel-core-075"
  | "ducting-30x30"
  | "ducting-30x40"
  | "ducting-30x60"
  | "ducting-40x40"
  | "ducting-40x60"
  | "ducting-60x60"
  | "din-rail"
  | "tag-panel"
  | "skun-y"
  | "kabel-bakar";

export interface MandatoryPrSpec {
  key: MandatoryPrKey;
  label: string;
  kelompok: string;
  partType: string;
  partName: string;
  supplier: string;
  defaultQty: number;
  unit: string;
  hargaSatuan: number;
  catatanPr: string;
}

export const MANDATORY_PR_GROUP = "Material Wiring & Panel (Wajib)";

export const MANDATORY_PR_COMPONENTS: MandatoryPrSpec[] = [
  {
    key: "kabel-034",
    label: "Kabel 0.34 mm²",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Federal / Supreme NYAF 0.34 mm² (AWG 22 - Rol 100M)",
    partName: "Kabel Fleksibel Kontrol NYAF 0.34 mm²",
    supplier: "",
    defaultQty: 0,
    unit: "rol",
    hargaSatuan: 175000,
    catatanPr: "",
  },
  {
    key: "kabel-075",
    label: "Kabel 0.75 mm²",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Federal / Supreme NYAF 0.75 mm² (AWG 18 - Rol 100M)",
    partName: "Kabel Fleksibel Kontrol NYAF 0.75 mm²",
    supplier: "",
    defaultQty: 0,
    unit: "rol",
    hargaSatuan: 280000,
    catatanPr: "",
  },
  {
    key: "kabel-25",
    label: "Kabel 2.5 mm²",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Federal / Supreme NYAF 2.5 mm² (AWG 14 - Rol 100M)",
    partName: "Kabel Fleksibel Power NYAF 2.5 mm²",
    supplier: "",
    defaultQty: 0,
    unit: "rol",
    hargaSatuan: 780000,
    catatanPr: "",
  },
  {
    key: "kabel-6",
    label: "Kabel 6 mm²",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Federal / Supreme NYAF 6 mm² (AWG 10 - Rol 100M)",
    partName: "Kabel Fleksibel Power NYAF 6 mm²",
    supplier: "",
    defaultQty: 0,
    unit: "rol",
    hargaSatuan: 1650000,
    catatanPr: "",
  },
  {
    key: "kabel-core-034",
    label: "Kabel Core 0.34 mm²",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Lapp / Belden / LiYCY Kabel Core 0.34 mm² (Multicore)",
    partName: "Kabel Core Sinyal 0.34 mm² (Multicore Shielded)",
    supplier: "",
    defaultQty: 0,
    unit: "m",
    hargaSatuan: 22000,
    catatanPr: "",
  },
  {
    key: "kabel-core-075",
    label: "Kabel Core 0.75 mm²",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Federal / Lapp / NYYHY Kabel Core 0.75 mm² (Multicore)",
    partName: "Kabel Core Kontrol 0.75 mm² (Multicore)",
    supplier: "",
    defaultQty: 0,
    unit: "m",
    hargaSatuan: 24000,
    catatanPr: "",
  },
  {
    key: "ducting-30x30",
    label: "Ducting 30×30",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Bebas / KSS PVC Wiring Duct 30x30 mm (per 2m)",
    partName: "Kabel Duct PVC Berlubang 30x30",
    supplier: "",
    defaultQty: 0,
    unit: "btg",
    hargaSatuan: 28000,
    catatanPr: "",
  },
  {
    key: "ducting-30x40",
    label: "Ducting 30×40",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Bebas / KSS PVC Wiring Duct 30x40 mm (per 2m)",
    partName: "Kabel Duct PVC Berlubang 30x40",
    supplier: "",
    defaultQty: 0,
    unit: "btg",
    hargaSatuan: 32000,
    catatanPr: "",
  },
  {
    key: "ducting-30x60",
    label: "Ducting 30×60",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Bebas / KSS PVC Wiring Duct 30x60 mm (per 2m)",
    partName: "Kabel Duct PVC Berlubang 30x60",
    supplier: "",
    defaultQty: 0,
    unit: "btg",
    hargaSatuan: 38000,
    catatanPr: "",
  },
  {
    key: "ducting-40x40",
    label: "Ducting 40×40",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Bebas / KSS PVC Wiring Duct 40x40 mm (per 2m)",
    partName: "Kabel Duct PVC Berlubang 40x40",
    supplier: "",
    defaultQty: 0,
    unit: "btg",
    hargaSatuan: 36000,
    catatanPr: "",
  },
  {
    key: "ducting-40x60",
    label: "Ducting 40×60",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Bebas / KSS PVC Wiring Duct 40x60 mm (per 2m)",
    partName: "Kabel Duct PVC Berlubang 40x60 / 65x65",
    supplier: "",
    defaultQty: 0,
    unit: "btg",
    hargaSatuan: 45000,
    catatanPr: "",
  },
  {
    key: "ducting-60x60",
    label: "Ducting 60×60",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Bebas / KSS PVC Wiring Duct 60x60 mm (per 2m)",
    partName: "Kabel Duct PVC Berlubang 60x60",
    supplier: "",
    defaultQty: 0,
    unit: "btg",
    hargaSatuan: 62000,
    catatanPr: "",
  },
  {
    key: "din-rail",
    label: "DIN Rail",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Bebas / FORT Din Rail 35x7.5mm Slotted",
    partName: "Aluminium Din Rail 35mm (1 Meter)",
    supplier: "",
    defaultQty: 0,
    unit: "m",
    hargaSatuan: 25000,
    catatanPr: "",
  },
  {
    key: "tag-panel",
    label: "Tag Panel",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Custom / IDEC Tag Panel Acrylic / Legend Plate",
    partName: "Tag Panel (Nameplate & Label Tombol Panel)",
    supplier: "",
    defaultQty: 0,
    unit: "pcs",
    hargaSatuan: 15000,
    catatanPr: "",
  },
  {
    key: "skun-y",
    label: "Skun Y",
    kelompok: MANDATORY_PR_GROUP,
    partType: "Skun Y 1.25-3 / 1.25-4 (Pack 100 pcs)",
    partName: "Skun Garpu Y 1.25 / Ferrule",
    supplier: "",
    defaultQty: 0,
    unit: "pack",
    hargaSatuan: 22000,
    catatanPr: "",
  },
  {
    key: "kabel-bakar",
    label: "Kabel Bakar",
    kelompok: MANDATORY_PR_GROUP,
    partType: "KSS / Sumitomo Kabel Bakar / Heat Shrink Set",
    partName: "Kabel Bakar / Heat Shrink Tube (Selongsong Bakar)",
    supplier: "",
    defaultQty: 0,
    unit: "m",
    hargaSatuan: 8000,
    catatanPr: "",
  },
];

const EXACT_SPEC_MAP = new Map<string, MandatoryPrKey>(
  MANDATORY_PR_COMPONENTS.map((s) => [
    `${s.partType.trim().toLowerCase()}||${s.partName.trim().toLowerCase()}`,
    s.key,
  ])
);

const PART_TYPE_MAP = new Map<string, MandatoryPrKey>(
  MANDATORY_PR_COMPONENTS.map((s) => [s.partType.trim().toLowerCase(), s.key])
);

/**
 * Mencocokkan partType & partName terhadap daftar komponen wajib PR.
 * Mengutamakan kecocokan persis lalu alias standar di PR / Excel.
 */
export function matchMandatoryKey(
  partType: string,
  partName: string
): MandatoryPrKey | null {
  const pt = (partType ?? "").trim().toLowerCase();
  const pn = (partName ?? "").trim().toLowerCase();
  if (!pt && !pn) return null;

  const exact = EXACT_SPEC_MAP.get(`${pt}||${pn}`);
  if (exact) return exact;

  const byPt = PART_TYPE_MAP.get(pt);
  if (byPt) return byPt;

  const text = `${pt} ${pn}`.replace(/,/g, ".").replace(/\s+/g, " ").trim();

  // Kabel core harus diperiksa sebelum kabel tunggal agar 0.34/0.75 tidak tertukar
  const isCoreCable =
    /\bkabel\s*core\b|\bmulticore\b|\bmulti[\s-]*core\b|\bliycy\b|\bliyy\b/.test(
      text
    );
  if (isCoreCable) {
    if (/(?:^|\D)0\.34(?:\D|$)/.test(text)) return "kabel-core-034";
    if (/(?:^|\D)0\.75(?:\D|$)/.test(text)) return "kabel-core-075";
  }

  // Kabel tunggal (bukan multicore / NYYHY / NYMHY / grounding kuning-hijau / kabel robotik / kabel bakar)
  const isSingleWireContext =
    (/\b(?:kabel|nyaf|kiv|wire)\b/.test(text) ||
      /\bawg\s*(?:22|18|14|10)\b/.test(text)) &&
    !text.includes("bakar") &&
    !text.includes("heat shrink") &&
    !text.includes("duct") &&
    !text.includes("gland") &&
    !text.includes("clamp") &&
    !text.includes("tie") &&
    !text.includes("core") &&
    !text.includes("multicore") &&
    !text.includes("nyyhy") &&
    !text.includes("nymhy") &&
    !text.includes("grounding") &&
    !text.includes("yellow-green") &&
    !text.includes("kuning-hijau") &&
    !text.includes("bonding") &&
    !text.includes("robocable");

  if (isSingleWireContext) {
    if (/(?:^|\D)0\.34(?:\D|$)|\bawg\s*22\b/.test(text)) return "kabel-034";
    if (/(?:^|\D)0\.75(?:\D|$)|\bawg\s*18\b/.test(text)) return "kabel-075";
    if (/(?:^|\D)2\.5(?:\D|$)|\bawg\s*14\b/.test(text)) return "kabel-25";
    if (
      /(?:^|\s|nyaf\s*|kiv\s*)6(?:\s*mm|\s*sq|\s|$)|\bawg\s*10\b/.test(text) &&
      !/0\.6|16|26|36|46|56|60|65/.test(text)
    ) {
      return "kabel-6";
    }
  }

  if (
    text.includes("skun y") ||
    text.includes("skun garpu y") ||
    /\bskun[\s-]*y\b/.test(text)
  ) {
    return "skun-y";
  }

  if (
    text.includes("kabel bakar") ||
    text.includes("heat shrink") ||
    text.includes("heatshrink") ||
    text.includes("selongsong bakar")
  ) {
    return "kabel-bakar";
  }

  if (
    text.includes("tag panel") ||
    /\bname\s*plate\s*panel\b/.test(text) ||
    (text.includes("tag") && text.includes("legend plate"))
  ) {
    return "tag-panel";
  }

  if (
    /\bdin\s*rail\s*(?:35|ts35)/i.test(text) ||
    text === "din rail" ||
    text.includes("rel din rail")
  ) {
    return "din-rail";
  }

  if (text.includes("duct") || text.includes("ducting")) {
    if (/\b30\s*[x×]\s*30\b/.test(text)) return "ducting-30x30";
    if (/\b30\s*[x×]\s*40\b/.test(text)) return "ducting-30x40";
    if (/\b30\s*[x×]\s*60\b/.test(text)) return "ducting-30x60";
    if (/\b40\s*[x×]\s*40\b/.test(text)) return "ducting-40x40";
    if (/\b40\s*[x×]\s*60\b/.test(text)) return "ducting-40x60";
    if (/\b60\s*[x×]\s*60\b/.test(text)) return "ducting-60x60";
  }

  return null;
}

export interface MandatoryMergeRowInput {
  kelompok: string;
  noPr: string;
  partType: string;
  partName: string;
  supplier: string;
  qty: number;
  unit: string;
  catatanPr: string;
  tanggalPakai: string;
  hargaSatuan: string;
  mandatoryKey?: MandatoryPrKey | null;
  statusPembelian?: string | null;
}

/**
 * Menggabungkan daftar baris PR yang sudah ada dengan seluruh komponen wajib PR.
 * - Baris existing yang cocok dengan komponen wajib ditandai `mandatoryKey` (maksimal 1 baris per key).
 * - Komponen wajib yang belum ada otomatis ditambahkan dengan qty = 0 (tidak masuk PR).
 */
export function mergeMandatoryPrRows<T extends MandatoryMergeRowInput>(
  existingRows: T[],
  buildMandatoryRow: (spec: MandatoryPrSpec, index: number) => T
): T[] {
  const claimedKeys = new Set<MandatoryPrKey>();
  const taggedRows: T[] = existingRows.map((row) => {
    const matched = row.mandatoryKey ?? matchMandatoryKey(row.partType, row.partName);
    if (matched && !claimedKeys.has(matched)) {
      claimedKeys.add(matched);
      return {
        ...row,
        mandatoryKey: matched,
      };
    }
    return {
      ...row,
      mandatoryKey: null,
    };
  });

  const missingRows: T[] = [];
  let idxOffset = taggedRows.length;
  for (const spec of MANDATORY_PR_COMPONENTS) {
    if (!claimedKeys.has(spec.key)) {
      idxOffset += 1;
      missingRows.push(buildMandatoryRow(spec, idxOffset));
    }
  }

  return [...taggedRows, ...missingRows];
}

export interface PrSubmissionPayloadItem {
  kelompok: string;
  noPr: string;
  partType: string;
  partName: string;
  supplier: string | null;
  qty: number;
  unit: string;
  catatanPr: string | null;
  tanggalPakai: string | null;
  hargaSatuan: number | null;
  statusPembelian?: string | null;
}

/**
 * Menyaring dan memvalidasi baris PR sebelum disimpan atau di-export:
 * - Komponen wajib dengan qty <= 0 TIDAK masuk PR (diabaikan).
 * - Komponen non-wajib kosong diabaikan, dan yang terisi wajib lengkap & qty > 0.
 */
export function buildPrSubmissionItems<T extends MandatoryMergeRowInput>(
  rows: T[]
): { items: PrSubmissionPayloadItem[]; error: null } | { items: null; error: string } {
  const includedRows = rows.filter((r) => {
    if (r.mandatoryKey) {
      return (Number(r.qty) || 0) > 0;
    }
    return r.partType.trim() !== "" || r.partName.trim() !== "";
  });

  if (includedRows.length === 0) {
    return {
      items: null,
      error:
        "Belum ada komponen yang masuk PR. Tambahkan komponen atau isi Qty > 0 pada komponen wajib.",
    };
  }

  for (let i = 0; i < includedRows.length; i++) {
    const r = includedRows[i];
    if (!r.partType.trim() || !r.partName.trim()) {
      return {
        items: null,
        error: `Baris ke-${i + 1} (${r.partType || r.partName}): Kolom PART TYPE dan PARTS NAME wajib diisi.`,
      };
    }
    if ((Number(r.qty) || 0) <= 0) {
      return {
        items: null,
        error: `Baris ke-${i + 1} (${r.partType}): Qty harus lebih dari 0.`,
      };
    }
  }

  return {
    items: includedRows.map((r, idx) => ({
      kelompok: r.kelompok.trim() || "Panel Utama",
      noPr: r.mandatoryKey
        ? String(idx + 1)
        : r.noPr.trim() || String(idx + 1),
      partType: r.partType.trim(),
      partName: r.partName.trim(),
      supplier: r.supplier.trim() || null,
      qty: Number(r.qty) || 1,
      unit: r.unit.trim() || "pcs",
      catatanPr: r.catatanPr.trim() || null,
      tanggalPakai: r.tanggalPakai || null,
      hargaSatuan:
        r.hargaSatuan.trim() !== "" && Number.isFinite(Number(r.hargaSatuan))
          ? Number(r.hargaSatuan)
          : null,
      statusPembelian: r.statusPembelian ?? null,
    })),
    error: null,
  };
}
