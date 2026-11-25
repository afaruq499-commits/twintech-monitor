import {
  DEFAULT_PR_CATALOG,
  formatCatalogItemForPr,
  type CatalogItemFields,
} from "@/lib/pr-catalog-default";
import {
  HMI_HARDWARE,
  PLC_HARDWARE,
  computeIoBreakdown,
  selectPlcConfiguration,
  sizeHmi,
  type HmiSizing,
  type IoBreakdown,
  type PlcHardwareSpec,
  type PlcSelection,
} from "@/lib/ml-plc-hmi-sizing";

export interface CatalogLookupItem extends CatalogItemFields {
  id?: string;
  noUrut?: number;
  fungsi?: string | null;
}

export type CoreEntityKind =
  | "ROBOT"
  | "SERVO"
  | "VALVE"
  | "INVERTER_MOTOR"
  | "SENSOR"
  | "ANALOG_PRECISION"
  | "SAFETY_DEVICE"
  | "HEATER"
  | "HMI_NETWORK";

export interface ExtractedCoreEntity {
  kind: CoreEntityKind;
  qty: number;
  brand: string | null;
  seriesOrType: string | null;
  powerKw: number | null;
  label: string;
  rawSegment: string;
}

export interface HistoricalProjectSample {
  projectId: string;
  projectName: string;
  coreDescription: string;
  components: Array<{
    partType: string;
    partName: string;
    qty: number;
  }>;
}

export interface RecommendedPrComponent {
  key: string;
  pillar:
    | "PSU"
    | "SAFETY_RELAY"
    | "RELAY"
    | "PLC"
    | "HMI"
    | "MCB"
    | "PENDUKUNG";
  kelompok: "Panel Utama" | "OP Panel" | "Sensor & Push Button";
  partType: string;
  partName: string;
  supplier?: string;
  qty: number;
  unit: string;
  hargaSatuan: number | null;
  catatanPr: string;
  alasanSingkat: string;
  catalogId: string | null;
  defaultChecked: boolean;
}

export interface MlRecommendationResult {
  inputDescription: string;
  entities: ExtractedCoreEntity[];
  mlMeta: {
    algorithm: string;
    confidencePct: number;
    trainingSamplesCount: number;
    historicalSamplesCount: number;
    nearestProfiles: Array<{
      title: string;
      similarityPct: number;
      source: "REFERENSI_OTOMASI" | "RIWAYAT_PROYEK";
    }>;
  };
  summaryFivePillars: {
    psu: {
      headline: string;
      activeLoadWatts: number;
      recommendedMinWatts: number;
      activeCurrentAmps: number;
      reasoning: string;
      primaryItems: RecommendedPrComponent[];
      alternativeNote: string;
    };
    safetyRelay: {
      headline: string;
      safetyCategory: string;
      reasoning: string;
      primaryItems: RecommendedPrComponent[];
      alternativeNote: string;
    };
    relay: {
      headline: string;
      totalRelayQty: number;
      breakdown: Array<{ label: string; qty: number }>;
      reasoning: string;
      primaryItems: RecommendedPrComponent[];
    };
    plc: {
      headline: string;
      estimatedDi: number;
      estimatedDo: number;
      outputType: "TRANSISTOR_HIGH_SPEED" | "RELAY_STANDARD" | "MODULAR_HIGH_IO";
      highSpeedAxes: number;
      reasoning: string;
      primaryItems: RecommendedPrComponent[];
      alternativeNote: string;
      calculation: {
        io: IoBreakdown;
        selection: PlcSelection;
      };
    };
    hmi: {
      headline: string;
      reasoning: string;
      primaryItems: RecommendedPrComponent[];
      calculation: HmiSizing;
    };
    mcb: {
      headline: string;
      supplyPhase: "3-PHASA 380V/220V" | "1-PHASA 220VAC";
      estimatedMainAmps: number;
      specsBreakdown: Array<{
        jalur: string;
        spekMcb: string;
        qty: number;
      }>;
      reasoning: string;
      primaryItems: RecommendedPrComponent[];
    };
  };
  supportingItems: RecommendedPrComponent[];
  allRecommendedItems: RecommendedPrComponent[];
}

type PsuClass = "PSU_60W" | "PSU_120W" | "PSU_240W" | "PSU_240W_DUAL";
type SafetyClass = "SAFETY_G9SA" | "SAFETY_G9SP";
type PlcClass = "PLC_FX5U_32MR" | "PLC_FX5U_80MT" | "PLC_IQR_R04";
type McbClass =
  | "MCB_1P_LIGHT"
  | "MCB_1P_STANDARD"
  | "MCB_3P_10A_SERVO"
  | "MCB_3P_10A_MOTOR"
  | "MCB_3P_40A_ROBOT"
  | "MCB_3P_40A_ROBOT_SERVO"
  | "MCB_3P_40A_HEAVY";

interface TrainingSample {
  title: string;
  description: string;
  source: "REFERENSI_OTOMASI" | "RIWAYAT_PROYEK";
  weightMultiplier: number;
  features: number[];
  labels: {
    psu: PsuClass;
    safety: SafetyClass;
    plc: PlcClass;
    mcb: McbClass;
  };
}

const INDONESIAN_NUMBER_WORDS: Record<string, number> = {
  satu: 1,
  sebuah: 1,
  seunit: 1,
  sepasang: 2,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  duabelas: 12,
};

const BRAND_PATTERNS: Array<[regex: RegExp, canonical: string]> = [
  [/\b(?:yaskawa|yasakawa|motoman)\b/i, "Yaskawa"],
  [/\bfanuc\b/i, "Fanuc"],
  [/\b(?:mitsubishi|melsec)\b/i, "Mitsubishi"],
  [/\bomron\b/i, "Omron"],
  [/\babb\b/i, "ABB"],
  [/\bkuka\b/i, "KUKA"],
  [/\b(?:epson|epsom)\b/i, "Epson"],
  [/\bnachi\b/i, "Nachi"],
  [/\bdenso\b/i, "Denso"],
  [/\b(?:universal\s*robot|cobot|\bur\d+\b)/i, "Universal Robots"],
  [/\bpanasonic\b/i, "Panasonic"],
  [/\bkeyence\b/i, "Keyence"],
  [/\bsmc\b/i, "SMC"],
  [/\bfesto\b/i, "Festo"],
  [/\bautonics\b/i, "Autonics"],
  [/\bschneider\b/i, "Schneider"],
  [/\bsiemens\b/i, "Siemens"],
  [/\bidec\b/i, "IDEC"],
];

function detectBrand(segment: string): string | null {
  for (const [rx, name] of BRAND_PATTERNS) {
    if (rx.test(segment)) return name;
  }
  return null;
}

function detectSeriesOrType(segment: string): string | null {
  // Contoh: "tipe a", "seri b", "series J4", "model GP8", atau kode alfanumerik seperti "MR-J4-40A", "GP8"
  const explicitMatch = segment.match(
    /\b(?:tipe|type|seri|series|model)\s+([a-z0-9][a-z0-9\-_/.]*(?:\s+[a-z0-9\-_/.]+)?)/i
  );
  if (explicitMatch) {
    const prefixWord = explicitMatch[0].split(/\s+/)[0];
    return `${prefixWord} ${explicitMatch[1].trim()}`;
  }

  const codeMatch = segment.match(
    /\b([A-Z]{1,5}[-_]?[0-9]{1,4}[A-Z0-9\-/]*)\b/
  );
  if (codeMatch) {
    return codeMatch[1];
  }
  return null;
}

function detectPowerKw(segment: string): number | null {
  const kwMatch = segment.match(/(\d+(?:[.,]\d+)?)\s*kw\b/i);
  if (kwMatch) {
    const val = Number(kwMatch[1].replace(",", "."));
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  const wattMatch = segment.match(/(\d+(?:[.,]\d+)?)\s*(?:watt|w)\b/i);
  if (wattMatch) {
    const val = Number(wattMatch[1].replace(",", "."));
    return Number.isFinite(val) && val > 0 ? val / 1000 : null;
  }
  return null;
}

function detectQuantity(segment: string): number {
  // 1. Angka di depan kata benda: "3 valve", "2x motor servo", "1 unit robot"
  const leadingNum = segment.match(
    /(?:^|\s)(\d+)\s*(?:x|pcs|buah|unit|set|axis|jalur|titik|zona|ch|channel)?\b/i
  );
  if (leadingNum) {
    const n = Number(leadingNum[1]);
    if (Number.isFinite(n) && n > 0 && n <= 200) return n;
  }

  // 2. Kata bilangan Bahasa Indonesia
  for (const [word, num] of Object.entries(INDONESIAN_NUMBER_WORDS)) {
    const rx = new RegExp(`\\b${word}\\b`, "i");
    if (rx.test(segment)) return num;
  }

  return 1;
}

/**
 * Stage 1 (NLP Domain Otomasi):
 * Mengekstrak entitas perangkat keras inti beserta jumlah, merek (termasuk koreksi typo umum
 * seperti "Yasakawa" -> "Yaskawa", "selenoid" -> "Solenoid"), seri/tipe, dan rating daya.
 */
export function extractCoreEntities(
  rawDescription: string
): ExtractedCoreEntity[] {
  const clean = rawDescription.trim();
  if (!clean) return [];

  // Pecah berdasarkan koma, titik koma, baris baru, kata hubung "dan", "serta", "plus", "+", "&"
  const rawClauses = clean
    .split(/[,;\n+]+|\s+(?:dan|serta|plus|dengan|&)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  // Jika user menulis "3 valve 1 robot 2 servo" dalam 1 klausa tanpa koma, pecah sebelum angka baru
  const segments: string[] = [];
  for (const clause of rawClauses) {
    const subParts = clause
      .split(/(?=\b\d+\s+(?:x\s+)?(?:valve|selenoid|solenoid|katup|silinder|robot|motor|servo|stepper|sensor|proximity|inverter|vfd|conveyor|heater|light\s*curtain|laser|load\s*cell|vacuum|hmi)\b)/i)
      .map((s) => s.trim())
      .filter(Boolean);
    segments.push(...subParts);
  }

  const entities: ExtractedCoreEntity[] = [];

  for (const seg of segments) {
    const lower = seg.toLowerCase();
    const qty = detectQuantity(seg);
    const brand = detectBrand(seg);
    const seriesOrType = detectSeriesOrType(seg);
    const powerKw = detectPowerKw(seg);

    // Urutan pengecekan spesifik ke umum agar "motor servo" tidak masuk ke "motor ac"
    if (
      /\b(?:robot|cobot|scara|yaskawa|yasakawa|motoman|fanuc|kuka|abb|nachi)\b/i.test(
        lower
      )
    ) {
      const descParts = ["Robot Industri", brand, seriesOrType ? `(${seriesOrType})` : null]
        .filter(Boolean)
        .join(" ");
      entities.push({
        kind: "ROBOT",
        qty,
        brand,
        seriesOrType,
        powerKw,
        label: descParts,
        rawSegment: seg,
      });
      continue;
    }

    if (/\b(?:servo|stepper)\b/i.test(lower)) {
      const baseName = /stepper/i.test(lower) ? "Motor Stepper" : "Motor Servo";
      const descParts = [
        baseName,
        brand,
        seriesOrType ? `(${seriesOrType})` : null,
        powerKw ? `${powerKw}kW` : null,
      ]
        .filter(Boolean)
        .join(" ");
      entities.push({
        kind: "SERVO",
        qty,
        brand,
        seriesOrType,
        powerKw,
        label: descParts,
        rawSegment: seg,
      });
      continue;
    }

    if (
      /\b(?:valve|selenoid|solenoid|katup|silinder|cylinder|pneumatik|pneumatic|gripper)\b/i.test(
        lower
      )
    ) {
      const isCylinder = /\b(?:silinder|cylinder)\b/i.test(lower);
      const baseName = isCylinder
        ? "Silinder & Solenoid Valve"
        : "Solenoid Valve";
      const descParts = [baseName, brand, seriesOrType ? `(${seriesOrType})` : null]
        .filter(Boolean)
        .join(" ");
      entities.push({
        kind: "VALVE",
        qty,
        brand,
        seriesOrType,
        powerKw: null,
        label: descParts,
        rawSegment: seg,
      });
      continue;
    }

    if (
      /\b(?:light\s*curtain|safety\s*door|door\s*interlock|interlock\s*pintu|pagar\s*safety|safety\s*fence|area\s*scanner)\b/i.test(
        lower
      )
    ) {
      const isCurtain = /light\s*curtain/i.test(lower);
      entities.push({
        kind: "SAFETY_DEVICE",
        qty,
        brand,
        seriesOrType,
        powerKw: null,
        label: isCurtain ? "Safety Light Curtain" : "Safety Door / Fence Interlock",
        rawSegment: seg,
      });
      continue;
    }

    if (
      /\b(?:load\s*cell|timbangan|weighing|pressure\s*sensor|vacuum\s*sensor|analog|vision|kamera|camera)\b/i.test(
        lower
      )
    ) {
      entities.push({
        kind: "ANALOG_PRECISION",
        qty,
        brand,
        seriesOrType,
        powerKw: null,
        label: [
          /load\s*cell|timbangan/i.test(lower)
            ? "Load Cell / Weighing"
            : /vision|kamera|camera/i.test(lower)
              ? "Vision Camera Inspection"
              : "Sensor Presisi / Analog",
          brand,
        ]
          .filter(Boolean)
          .join(" "),
        rawSegment: seg,
      });
      continue;
    }

    if (/\b(?:heater|pemanas|pid|thermocouple|sealing|oven)\b/i.test(lower)) {
      entities.push({
        kind: "HEATER",
        qty,
        brand,
        seriesOrType,
        powerKw,
        label: "Zona Heater / Kontrol Suhu PID",
        rawSegment: seg,
      });
      continue;
    }

    if (
      /\b(?:inverter|vfd|conveyor|konveyor|vacuum\s*pump|blower|pompa|kompresor|motor\s*3|motor\s*ac|motor\s*induksi|motor)\b/i.test(
        lower
      )
    ) {
      entities.push({
        kind: "INVERTER_MOTOR",
        qty,
        brand,
        seriesOrType,
        powerKw,
        label: [
          /inverter|vfd/i.test(lower)
            ? "Motor AC + Inverter (VFD)"
            : /vacuum|blower/i.test(lower)
              ? "Motor Vacuum / Blower 3-Phasa"
              : /conveyor|konveyor/i.test(lower)
                ? "Motor Conveyor"
                : "Motor AC 3-Phasa",
          brand,
          powerKw ? `${powerKw}kW` : null,
        ]
          .filter(Boolean)
          .join(" "),
        rawSegment: seg,
      });
      continue;
    }

    if (
      /\b(?:sensor|proximity|photoelectric|photosensor|diffuse|laser|limit\s*switch|reed\s*switch|optik|optic)\b/i.test(
        lower
      )
    ) {
      entities.push({
        kind: "SENSOR",
        qty,
        brand,
        seriesOrType,
        powerKw: null,
        label: [
          /laser|diffuse/i.test(lower)
            ? "Laser / Diffuse Sensor (DI 1/0)"
            : /photo/i.test(lower)
              ? "Photoelectric Sensor"
              : "Sensor Proximity / Limit",
          brand,
        ]
          .filter(Boolean)
          .join(" "),
        rawSegment: seg,
      });
      continue;
    }

    if (/\b(?:hmi|touchscreen|ethernet|cc-link|remote\s*io)\b/i.test(lower)) {
      entities.push({
        kind: "HMI_NETWORK",
        qty,
        brand,
        seriesOrType,
        powerKw: null,
        label: /hmi|touchscreen/i.test(lower)
          ? "HMI Touchscreen"
          : "Jaringan Komunikasi / Remote I/O",
        rawSegment: seg,
      });
    }
  }

  return entities;
}

interface AggregatedMetrics {
  valveCount: number;
  robotCount: number;
  servoCount: number;
  inverterMotorCount: number;
  explicitSensorCount: number;
  effectiveSensorCount: number;
  safetyDeviceCount: number;
  analogCount: number;
  heaterCount: number;
  hasLightCurtain: boolean;
  safetyZoneScore: number;
  relayBreakdown: Array<{ label: string; qty: number }>;
  totalRelayQty: number;
  activeDcWatts: number;
  recommendedMinPsuWatts: number;
  activeCurrentAmps: number;
  estimatedDi: number;
  estimatedDo: number;
  ioBreakdown: IoBreakdown;
  highSpeedAxes: number;
  supplyPhase: "3-PHASA 380V/220V" | "1-PHASA 220VAC";
  estimatedMainAmps: number;
  featureVector: number[];
}

function sumByKind(entities: ExtractedCoreEntity[], kind: CoreEntityKind): number {
  return entities
    .filter((e) => e.kind === kind)
    .reduce((acc, e) => acc + e.qty, 0);
}

function computeAggregatedMetrics(
  entities: ExtractedCoreEntity[]
): AggregatedMetrics {
  const valveCount = sumByKind(entities, "VALVE");
  const robotCount = sumByKind(entities, "ROBOT");
  const servoCount = sumByKind(entities, "SERVO");
  const inverterMotorCount = sumByKind(entities, "INVERTER_MOTOR");
  const explicitSensorCount = sumByKind(entities, "SENSOR");
  const safetyDeviceCount = sumByKind(entities, "SAFETY_DEVICE");
  const analogCount = sumByKind(entities, "ANALOG_PRECISION");
  const heaterCount = sumByKind(entities, "HEATER");

  const hasLightCurtain = entities.some(
    (e) =>
      e.kind === "SAFETY_DEVICE" &&
      /light\s*curtain/i.test(e.rawSegment)
  );

  // Setiap valve pneumatik silinder rata-rata memiliki 2 reed switch (maju & mundur) bila sensor tidak ditulis eksplisit
  const effectiveSensorCount =
    explicitSensorCount > 0
      ? explicitSensorCount + Math.ceil(valveCount * 1.0)
      : valveCount * 2 + servoCount * 2;

  // Skor kompleksitas zona safety (menentukan Dual-Channel Safety Relay vs Programmable Safety Controller)
  const safetyZoneScore =
    robotCount * 3.0 +
    (servoCount >= 2 ? 1.5 : servoCount * 0.7) +
    safetyDeviceCount * 1.2 +
    inverterMotorCount * 0.6;

  // Perhitungan kebutuhan Relay 24VDC interposing + isolasi sinyal
  const relayBreakdown: Array<{ label: string; qty: number }> = [];
  if (valveCount > 0) {
    relayBreakdown.push({
      label: `Interposing output PLC ke ${valveCount} Solenoid Valve`,
      qty: valveCount,
    });
  }
  if (servoCount > 0) {
    relayBreakdown.push({
      label: `Holding Brake 24VDC & Enable Interlock untuk ${servoCount} Motor Servo`,
      qty: servoCount * 2,
    });
  }
  if (robotCount > 0) {
    relayBreakdown.push({
      label: `Isolasi sinyal dry-contact Handshake I/O ${robotCount} Robot Controller`,
      qty: robotCount * 4,
    });
  }
  if (inverterMotorCount > 0 || heaterCount > 0) {
    relayBreakdown.push({
      label: `Kontrol Run/Reset Inverter Motor & Heater (${inverterMotorCount + heaterCount} unit)`,
      qty: (inverterMotorCount + heaterCount) * 2,
    });
  }

  const rawWorkingRelays = relayBreakdown.reduce((s, b) => s + b.qty, 0);
  const masterAndSpareQty = Math.max(
    2,
    Math.ceil(Math.max(rawWorkingRelays, 2) * 0.22)
  );
  relayBreakdown.push({
    label: "Master Control, Alarm/Tower Lamp & Cadangan Panel (~20% Spare)",
    qty: masterAndSpareQty,
  });

  const totalRelayQty = rawWorkingRelays + masterAndSpareQty;

  // Perhitungan daya beban 24VDC (Watt)
  // Catatan engineering: FX5U-32MR/ES disuplai langsung 220VAC sehingga beban 24VDC dasar hanya HMI 7" (~9W) + indikator (~5W) = 14W;
  // sedangkan sel Robot/Servo memakai Safety Controller G9SP + Ethernet Switch + Tower Lamp (~30W).
  const baseControlWatts = robotCount > 0 || servoCount > 0 ? 30 : 14;
  const valveWatts = valveCount * 4.8; // ~0.2A @ 24VDC per koil solenoid
  const servoDcWatts = servoCount * 13.5; // Electromagnetic brake (~0.4A-0.5A) + CN1 driver I/O
  const robotDcWatts = robotCount * 16.0; // Handshake I/O + Safety Door lock + Remote I/O
  const sensorWatts = effectiveSensorCount * 1.1 + analogCount * 5.5;
  const relayCoilWatts = totalRelayQty * 0.9; // MY2N-D2 coil ~0.9W

  const activeDcWatts = Math.round(
    baseControlWatts +
      valveWatts +
      servoDcWatts +
      robotDcWatts +
      sensorWatts +
      relayCoilWatts
  );
  // Standar panel otomasi: beban kontinu maksimum 65-70% kapasitas PSU (faktor aman 1.45x untuk inrush koil/brake)
  const recommendedMinPsuWatts = Math.ceil(activeDcWatts * 1.45);
  const activeCurrentAmps = Number((activeDcWatts / 24).toFixed(2));

  // Perhitungan titik I/O PLC (termasuk 20% spare ekspansi) — rincian di ml-plc-hmi-sizing.ts
  const ioBreakdown = computeIoBreakdown({
    valveCount,
    robotCount,
    servoCount,
    inverterMotorCount,
    explicitSensorCount,
    safetyDeviceCount,
    analogCount,
    heaterCount,
  });
  const estimatedDi = ioBreakdown.requiredDi;
  const estimatedDo = ioBreakdown.requiredDo;
  const highSpeedAxes = servoCount;

  // Perhitungan suplai AC & arus utama untuk sizing MCCB / MCB
  const isThreePhase =
    robotCount > 0 || servoCount >= 2 || inverterMotorCount > 0;
  const supplyPhase = isThreePhase
    ? "3-PHASA 380V/220V"
    : "1-PHASA 220VAC";

  const robotAmps = robotCount * 12; // Rata-rata robot industri kecil-menengah ~3-5kVA
  const servoAmps = entities
    .filter((e) => e.kind === "SERVO")
    .reduce((s, e) => s + e.qty * ((e.powerKw ?? 0.75) * 4.2), 0);
  const motorAmps = entities
    .filter((e) => e.kind === "INVERTER_MOTOR" || e.kind === "HEATER")
    .reduce((s, e) => s + e.qty * ((e.powerKw ?? 1.1) * 3.2), 0);
  const controlAcAmps = 3.5; // PLC + HMI + PSU 24V + Kipas

  const estimatedMainAmps = Math.ceil(
    (robotAmps + servoAmps + motorAmps + controlAcAmps) * 1.25
  );

  // Vektor fitur 10-dimensi untuk model Weighted k-NN
  const featureVector = [
    valveCount,
    robotCount * 3.0,
    servoCount * 2.2,
    inverterMotorCount * 1.8,
    effectiveSensorCount * 0.35,
    safetyZoneScore * 1.2,
    (analogCount + heaterCount) * 1.1,
    recommendedMinPsuWatts / 60,
    (estimatedDi + estimatedDo) / 20,
    highSpeedAxes * 2.0,
  ];

  return {
    valveCount,
    robotCount,
    servoCount,
    inverterMotorCount,
    explicitSensorCount,
    effectiveSensorCount,
    safetyDeviceCount,
    analogCount,
    heaterCount,
    hasLightCurtain,
    safetyZoneScore,
    relayBreakdown,
    totalRelayQty,
    activeDcWatts,
    recommendedMinPsuWatts,
    activeCurrentAmps,
    estimatedDi,
    estimatedDo,
    ioBreakdown,
    highSpeedAxes,
    supplyPhase,
    estimatedMainAmps,
    featureVector,
  };
}

/**
 * Dataset Referensi Otomasi Industri (18 arketipe proyek nyata panel otomasi, jig, servo, & robot cell)
 * untuk melatih model Hybrid Weighted k-NN + TF-IDF Cosine Similarity.
 */
const CURATED_ARCHETYPES: Array<{
  title: string;
  description: string;
  labels: TrainingSample["labels"];
}> = [
  {
    title: "Jig Pneumatic Sederhana (2 Valve & 4 Proximity)",
    description: "2 valve pneumatik, 4 sensor proximity",
    labels: {
      psu: "PSU_60W",
      safety: "SAFETY_G9SA",
      plc: "PLC_FX5U_32MR",
      mcb: "MCB_1P_LIGHT",
    },
  },
  {
    title: "Jig Checking Collar Presisi (4 Valve, Laser & Load Cell)",
    description: "4 solenoid valve, 1 laser sensor Keyence, 1 load cell, 6 proximity",
    labels: {
      psu: "PSU_120W",
      safety: "SAFETY_G9SA",
      plc: "PLC_FX5U_32MR",
      mcb: "MCB_1P_STANDARD",
    },
  },
  {
    title: "Fixture Assembly Multi-Silinder + Light Curtain",
    description: "6 valve pneumatik, 1 light curtain safety, 10 sensor proximity",
    labels: {
      psu: "PSU_120W",
      safety: "SAFETY_G9SA",
      plc: "PLC_FX5U_80MT",
      mcb: "MCB_1P_STANDARD",
    },
  },
  {
    title: "Meja Indexing 1 Axis Motor Servo & 2 Valve",
    description: "1 motor servo Mitsubishi, 2 solenoid valve, 4 sensor proximity",
    labels: {
      psu: "PSU_120W",
      safety: "SAFETY_G9SA",
      plc: "PLC_FX5U_80MT",
      mcb: "MCB_3P_10A_SERVO",
    },
  },
  {
    title: "Dual-Axis Motor Servo Positioning & 4 Valve Clamp",
    description: "2 motor servo, 4 valve pneumatik, 6 sensor proximity",
    labels: {
      psu: "PSU_240W",
      safety: "SAFETY_G9SA",
      plc: "PLC_FX5U_80MT",
      mcb: "MCB_3P_10A_SERVO",
    },
  },
  {
    title: "Robot Cell Assembly + Dual Motor Servo & Pneumatic Valve",
    description: "3 valve, 1 robot Yaskawa, dan 2 motor servo",
    labels: {
      psu: "PSU_240W",
      safety: "SAFETY_G9SP",
      plc: "PLC_FX5U_80MT",
      mcb: "MCB_3P_40A_ROBOT_SERVO",
    },
  },
  {
    title: "Robot Cell Pick & Place Fanuc + Gripper Valve & Door Interlock",
    description: "1 robot Fanuc, 4 solenoid valve gripper, 1 safety door interlock",
    labels: {
      psu: "PSU_240W",
      safety: "SAFETY_G9SP",
      plc: "PLC_FX5U_80MT",
      mcb: "MCB_3P_40A_ROBOT",
    },
  },
  {
    title: "Robot Handling Yaskawa + 1 Servo Rotary Table & 2 Valve",
    description: "1 robot Yaskawa Motoman, 1 motor servo rotary, 2 valve",
    labels: {
      psu: "PSU_240W",
      safety: "SAFETY_G9SP",
      plc: "PLC_FX5U_80MT",
      mcb: "MCB_3P_40A_ROBOT_SERVO",
    },
  },
  {
    title: "Robot Cell AICC + Vacuum Blower 3-Phasa & Remote I/O",
    description: "1 robot Mitsubishi, 1 motor vacuum 3 phase, 6 valve, 1 vacuum sensor, remote io cc-link",
    labels: {
      psu: "PSU_240W",
      safety: "SAFETY_G9SP",
      plc: "PLC_IQR_R04",
      mcb: "MCB_3P_40A_ROBOT_SERVO",
    },
  },
  {
    title: "Multi-Robot Cell Heavy Line (2 Robot + 4 Servo + 8 Valve)",
    description: "2 robot Yaskawa, 4 motor servo, 8 solenoid valve, 2 safety door interlock",
    labels: {
      psu: "PSU_240W_DUAL",
      safety: "SAFETY_G9SP",
      plc: "PLC_IQR_R04",
      mcb: "MCB_3P_40A_HEAVY",
    },
  },
  {
    title: "Mesin Testing Multi-Axis (4 Motor Servo + 4 Valve + Light Curtain)",
    description: "4 motor servo, 4 solenoid valve, 1 light curtain Keyence",
    labels: {
      psu: "PSU_240W",
      safety: "SAFETY_G9SP",
      plc: "PLC_FX5U_80MT",
      mcb: "MCB_3P_40A_ROBOT_SERVO",
    },
  },
  {
    title: "Line Otomasi 6-Axis Servo & 10 Valve High-I/O",
    description: "6 motor servo, 10 solenoid valve, 16 sensor proximity, light curtain",
    labels: {
      psu: "PSU_240W_DUAL",
      safety: "SAFETY_G9SP",
      plc: "PLC_IQR_R04",
      mcb: "MCB_3P_40A_HEAVY",
    },
  },
  {
    title: "Conveyor Sorting 2 Inverter VFD + 4 Valve Pusher",
    description: "2 motor conveyor inverter, 4 valve pneumatik, 6 photoelectric sensor",
    labels: {
      psu: "PSU_120W",
      safety: "SAFETY_G9SA",
      plc: "PLC_FX5U_32MR",
      mcb: "MCB_3P_10A_MOTOR",
    },
  },
  {
    title: "Mesin Heat Sealing 3 Zona Heater PID & 3 Silinder Pneumatik",
    description: "3 heater sealing pid, 3 silinder valve pneumatik, 1 light curtain",
    labels: {
      psu: "PSU_120W",
      safety: "SAFETY_G9SA",
      plc: "PLC_FX5U_32MR",
      mcb: "MCB_3P_10A_MOTOR",
    },
  },
  {
    title: "Leak Tester Vacuum & Digital Pressure Sensor (3 Valve)",
    description: "3 solenoid valve, 2 pressure sensor SMC, 4 proximity",
    labels: {
      psu: "PSU_120W",
      safety: "SAFETY_G9SA",
      plc: "PLC_FX5U_32MR",
      mcb: "MCB_1P_STANDARD",
    },
  },
  {
    title: "Stasiun Vision Inspection Kamera + 1 Servo & 2 Valve Ejector",
    description: "1 kamera vision, 1 motor servo, 2 solenoid valve, 3 photoelectric sensor",
    labels: {
      psu: "PSU_120W",
      safety: "SAFETY_G9SA",
      plc: "PLC_FX5U_80MT",
      mcb: "MCB_3P_10A_SERVO",
    },
  },
  {
    title: "Robot Palletizer + 2 Conveyor Motor 3-Phase & Light Curtain",
    description: "1 robot ABB, 2 motor conveyor 3 phase, 4 valve vacuum, 1 light curtain",
    labels: {
      psu: "PSU_240W",
      safety: "SAFETY_G9SP",
      plc: "PLC_IQR_R04",
      mcb: "MCB_3P_40A_ROBOT_SERVO",
    },
  },
  {
    title: "Panel Poka-Yoke Ringkas (1 Valve & 3 Sensor)",
    description: "1 solenoid valve, 3 sensor proximity",
    labels: {
      psu: "PSU_60W",
      safety: "SAFETY_G9SA",
      plc: "PLC_FX5U_32MR",
      mcb: "MCB_1P_LIGHT",
    },
  },
];

function tokenizeDomainTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/yasakawa/g, "yaskawa")
    .replace(/selenoid/g, "solenoid")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function computeCosineTextSimilarity(a: string, b: string): number {
  const tokA = tokenizeDomainTerms(a);
  const tokB = tokenizeDomainTerms(b);
  if (tokA.length === 0 || tokB.length === 0) return 0;

  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  for (const t of tokA) freqA.set(t, (freqA.get(t) ?? 0) + 1);
  for (const t of tokB) freqB.set(t, (freqB.get(t) ?? 0) + 1);

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, va] of freqA.entries()) {
    normA += va * va;
    const vb = freqB.get(k) ?? 0;
    if (vb > 0) dot += va * vb;
  }
  for (const vb of freqB.values()) {
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function computeRbfFeatureSimilarity(v1: number[], v2: number[]): number {
  let sqDist = 0;
  const len = Math.min(v1.length, v2.length);
  for (let i = 0; i < len; i += 1) {
    const diff = v1[i] - v2[i];
    sqDist += diff * diff;
  }
  // Gaussian RBF kernel (gamma = 0.22) menghasilkan bobot tajam untuk tetangga terdekat
  return Math.exp(-0.22 * sqDist);
}

/**
 * Mengonversi riwayat proyek nyata dari database SQL Server menjadi sampel pelatihan tambahan
 * (Online Learning dari preferensi komponen aktual user).
 */
function buildHistoricalTrainingSamples(
  historicalProjects: HistoricalProjectSample[]
): TrainingSample[] {
  const samples: TrainingSample[] = [];

  for (const proj of historicalProjects) {
    const desc = proj.coreDescription.trim();
    if (!desc || proj.components.length < 2) continue;
    const entities = extractCoreEntities(desc);
    if (entities.length === 0) continue;

    const metrics = computeAggregatedMetrics(entities);
    const joinedComps = proj.components
      .map((c) => `${c.partType} ${c.partName}`.toLowerCase())
      .join(" | ");

    let psu: PsuClass =
      metrics.recommendedMinPsuWatts > 240
        ? "PSU_240W_DUAL"
        : metrics.recommendedMinPsuWatts > 115
          ? "PSU_240W"
          : metrics.recommendedMinPsuWatts > 55
            ? "PSU_120W"
            : "PSU_60W";

    if (/24024|240\s*w/i.test(joinedComps)) psu = "PSU_240W";
    else if (/12024|spb-120|120\s*w/i.test(joinedComps)) psu = "PSU_120W";
    else if (/spb-060|ps5r-vc24|60\s*w/i.test(joinedComps)) psu = "PSU_60W";

    let safety: SafetyClass =
      metrics.robotCount > 0 || metrics.safetyZoneScore >= 3.0
        ? "SAFETY_G9SP"
        : "SAFETY_G9SA";
    if (/g9sp/i.test(joinedComps)) safety = "SAFETY_G9SP";
    else if (/g9sa/i.test(joinedComps)) safety = "SAFETY_G9SA";

    let plc: PlcClass =
      metrics.robotCount >= 2 || metrics.estimatedDi > 40
        ? "PLC_IQR_R04"
        : metrics.servoCount > 0 || metrics.estimatedDi > 16
          ? "PLC_FX5U_80MT"
          : "PLC_FX5U_32MR";
    if (/r04cpu|q03udv/i.test(joinedComps)) plc = "PLC_IQR_R04";
    else if (/fx5u-80mt/i.test(joinedComps)) plc = "PLC_FX5U_80MT";
    else if (/fx5u-32mr/i.test(joinedComps)) plc = "PLC_FX5U_32MR";

    let mcb: McbClass =
      metrics.robotCount > 0 && metrics.servoCount > 0
        ? "MCB_3P_40A_ROBOT_SERVO"
        : metrics.robotCount > 0
          ? "MCB_3P_40A_ROBOT"
          : metrics.servoCount > 0
            ? "MCB_3P_10A_SERVO"
            : "MCB_1P_STANDARD";
    if (/ezc100b3040|40a/i.test(joinedComps)) {
      mcb =
        metrics.servoCount > 0 ? "MCB_3P_40A_ROBOT_SERVO" : "MCB_3P_40A_ROBOT";
    } else if (/nf32-svf|3p\s*10a/i.test(joinedComps)) {
      mcb = "MCB_3P_10A_SERVO";
    }

    samples.push({
      title: proj.projectName,
      description: desc,
      source: "RIWAYAT_PROYEK",
      weightMultiplier: 1.25, // Preferensi proyek historis user diberi bobot ekstra
      features: metrics.featureVector,
      labels: { psu, safety, plc, mcb },
    });
  }

  return samples;
}

function voteTopK<L extends string>(
  neighbors: Array<{ sim: number; label: L }>
): { winner: L; probability: number } {
  const tally = new Map<L, number>();
  let totalWeight = 0;
  for (const n of neighbors) {
    // Bobot kuadratik kemiripan (sim^3) agar sampel yang sangat identik tidak dikalahkan mayoritas sampel jauh
    const w = n.sim * n.sim * n.sim;
    totalWeight += w;
    tally.set(n.label, (tally.get(n.label) ?? 0) + w);
  }
  let bestLabel = neighbors[0].label;
  let bestScore = -1;
  for (const [lbl, sc] of tally.entries()) {
    if (sc > bestScore) {
      bestScore = sc;
      bestLabel = lbl;
    }
  }
  return {
    winner: bestLabel,
    probability: totalWeight > 0 ? bestScore / totalWeight : 0.85,
  };
}

function findCatalogByModel(
  liveCatalog: CatalogLookupItem[],
  modelKeyword: string,
  fallbackNoUrut?: number
): CatalogLookupItem {
  const needle = modelKeyword.toLowerCase();
  const foundLive = liveCatalog.find((c) =>
    `${c.merek} ${c.tipeModel} ${c.nama}`.toLowerCase().includes(needle)
  );
  if (foundLive) return foundLive;

  if (fallbackNoUrut !== undefined) {
    const foundDefault = DEFAULT_PR_CATALOG.find(
      (c) => c.noUrut === fallbackNoUrut
    );
    if (foundDefault) return foundDefault;
  }

  // Synthesize from hardware catalog if not found in live/default catalog
  const hw =
    (PLC_HARDWARE as Record<string, PlcHardwareSpec | undefined>)[modelKeyword] ??
    Object.values(PLC_HARDWARE).find((h) => h.model.toLowerCase() === needle) ??
    Object.values(HMI_HARDWARE).find((h) => h.model.toLowerCase() === needle);

  if (hw) {
    return {
      merek: hw.merek,
      tipeModel: hw.model,
      nama: hw.nama,
      kategori: hw.kategori,
      spesifikasi: hw.spesifikasi,
      estimasiHarga: hw.estimasiHarga,
      defaultUnit: hw.defaultUnit,
      fungsi: hw.fungsi,
    };
  }

  return DEFAULT_PR_CATALOG[0];
}

function makeRecommendedRow(
  item: CatalogLookupItem,
  opts: {
    key: string;
    pillar: RecommendedPrComponent["pillar"];
    kelompok: RecommendedPrComponent["kelompok"];
    qty: number;
    catatanPr: string;
    alasanSingkat: string;
    defaultChecked?: boolean;
  }
): RecommendedPrComponent {
  const pr = formatCatalogItemForPr(item);
  return {
    key: opts.key,
    pillar: opts.pillar,
    kelompok: opts.kelompok,
    partType: pr.partType,
    partName: pr.partName,
    supplier: pr.merek || undefined,
    qty: opts.qty,
    unit: pr.unit,
    hargaSatuan: pr.hargaSatuan,
    catatanPr: opts.catatanPr || pr.spesifikasi || "",
    alasanSingkat: opts.alasanSingkat,
    catalogId: item.id ?? null,
    defaultChecked: opts.defaultChecked ?? true,
  };
}

/**
 * Fungsi Utama Machine Learning Recommender:
 * Mengidentifikasi komponen inti dari deskripsi teks bebas dan menghasilkan rekomendasi
 * PSU, Safety Relay, Jumlah Relay, PLC, Spek MCB, serta komponen pendukung dari katalog.
 */
export function recommendComponentsWithMl(
  description: string,
  liveCatalog: CatalogLookupItem[] = DEFAULT_PR_CATALOG,
  historicalProjects: HistoricalProjectSample[] = []
): MlRecommendationResult {
  const catalogToUse =
    liveCatalog.length > 0 ? liveCatalog : DEFAULT_PR_CATALOG;
  const entities = extractCoreEntities(description);
  const metrics = computeAggregatedMetrics(entities);

  // Bangun korpus training (18 arketipe referensi + riwayat proyek aktual user di SQL Server)
  const curatedSamples: TrainingSample[] = CURATED_ARCHETYPES.map((arch) => {
    const ent = extractCoreEntities(arch.description);
    const met = computeAggregatedMetrics(ent);
    return {
      title: arch.title,
      description: arch.description,
      source: "REFERENSI_OTOMASI",
      weightMultiplier: 1.0,
      features: met.featureVector,
      labels: arch.labels,
    };
  });

  const historicalSamples = buildHistoricalTrainingSamples(historicalProjects);
  const allSamples = [...curatedSamples, ...historicalSamples];

  // Hitung kemiripan Hybrid (74% Gaussian RBF Feature Vector + 26% Domain TF-Cosine Text)
  const rankedNeighbors = allSamples
    .map((sample) => {
      const featSim = computeRbfFeatureSimilarity(
        metrics.featureVector,
        sample.features
      );
      const textSim = computeCosineTextSimilarity(
        description,
        sample.description
      );
      const rawSim = 0.74 * featSim + 0.26 * textSim;
      const weightedSim = Math.min(0.99, rawSim * sample.weightMultiplier);
      return {
        sample,
        rawSim,
        weightedSim,
      };
    })
    .sort((a, b) => b.weightedSim - a.weightedSim);

  const topK = rankedNeighbors.slice(0, 5);

  const psuVote = voteTopK(
    topK.map((n) => ({ sim: n.weightedSim, label: n.sample.labels.psu }))
  );
  const safetyVote = voteTopK(
    topK.map((n) => ({ sim: n.weightedSim, label: n.sample.labels.safety }))
  );
  const plcVote = voteTopK(
    topK.map((n) => ({ sim: n.weightedSim, label: n.sample.labels.plc }))
  );
  const mcbVote = voteTopK(
    topK.map((n) => ({ sim: n.weightedSim, label: n.sample.labels.mcb }))
  );

  // Guardrail Engineering (memastikan hasil voting ML selalu memenuhi batas aman arus, Watt, & axis pulse!)
  let finalPsuClass: PsuClass = psuVote.winner;
  if (metrics.recommendedMinPsuWatts > 235) {
    finalPsuClass = "PSU_240W_DUAL";
  } else if (
    metrics.recommendedMinPsuWatts > 110 &&
    (finalPsuClass === "PSU_60W" || finalPsuClass === "PSU_120W")
  ) {
    finalPsuClass = "PSU_240W";
  } else if (
    metrics.recommendedMinPsuWatts > 58 &&
    finalPsuClass === "PSU_60W"
  ) {
    finalPsuClass = "PSU_120W";
  }

  let finalSafetyClass: SafetyClass = safetyVote.winner;
  if (metrics.robotCount > 0 || metrics.safetyZoneScore >= 3.2) {
    finalSafetyClass = "SAFETY_G9SP";
  }

  // PLC ditentukan oleh PERHITUNGAN KAPASITAS I/O & axis pulse (bukan sekadar voting ML),
  // agar bila I/O cukup memakai FX5U-32M tidak membeli modul I/O tambahan / modul 64 titik.
  const plcSelection = selectPlcConfiguration(metrics.ioBreakdown, {
    robotCount: metrics.robotCount,
    preferModular: metrics.robotCount >= 2,
  });

  let finalMcbClass: McbClass = mcbVote.winner;
  if (metrics.robotCount > 0 && metrics.servoCount > 0) {
    finalMcbClass =
      metrics.robotCount >= 2 ? "MCB_3P_40A_HEAVY" : "MCB_3P_40A_ROBOT_SERVO";
  } else if (metrics.robotCount > 0) {
    finalMcbClass = "MCB_3P_40A_ROBOT";
  } else if (
    metrics.servoCount > 0 &&
    (finalMcbClass === "MCB_1P_LIGHT" || finalMcbClass === "MCB_1P_STANDARD")
  ) {
    finalMcbClass = "MCB_3P_10A_SERVO";
  } else if (
    metrics.inverterMotorCount > 0 &&
    (finalMcbClass === "MCB_1P_LIGHT" || finalMcbClass === "MCB_1P_STANDARD")
  ) {
    finalMcbClass = "MCB_3P_10A_MOTOR";
  }

  const avgVoteProb =
    (psuVote.probability +
      safetyVote.probability +
      plcVote.probability +
      mcbVote.probability) /
    4;
  const topSim = topK[0]?.rawSim ?? 0.75;
  const confidencePct =
    entities.length === 0
      ? 0
      : Math.min(
          98,
          Math.max(72, Math.round((0.55 * topSim + 0.45 * avgVoteProb) * 100))
        );

  // ==================== 1. SUSUN REKOMENDASI PSU ====================
  const psuPrimaryItems: RecommendedPrComponent[] = [];
  let psuHeadline = "";
  let psuAlternativeNote = "";

  if (finalPsuClass === "PSU_240W_DUAL") {
    const psu240 = findCatalogByModel(catalogToUse, "S8VK-C24024", 67);
    psuHeadline = "2x Omron S8VK-C24024 (Total 480W / 20A @ 24VDC)";
    psuAlternativeNote =
      "Beban 24VDC tinggi: disarankan memisahkan 1 unit PSU 240W khusus PLC/Sensor/Safety dan 1 unit PSU 240W khusus Solenoid Valve & Brake Servo.";
    psuPrimaryItems.push(
      makeRecommendedRow(psu240, {
        key: "ml-psu-240-dual",
        pillar: "PSU",
        kelompok: "Panel Utama",
        qty: 2,
        catatanPr: "1x PSU Kontrol PLC/Sensor + 1x PSU Valve/Brake Servo",
        alasanSingkat: `Total beban aktif ~${metrics.activeDcWatts}W (butuh ≥${metrics.recommendedMinPsuWatts}W dengan safety factor 1.45x)`,
      })
    );
  } else if (finalPsuClass === "PSU_240W") {
    const psu240 = findCatalogByModel(catalogToUse, "S8VK-C24024", 67);
    psuHeadline = "Omron S8VK-C24024 (240W / 10A @ 24VDC)";
    psuAlternativeNote =
      "Alternatif: 2x Omron S8VK-C12024 / Autonics SPB-120-24 (120W 5A) bila ingin memisahkan jalur DC kontrol PLC dan jalur DC aktuator valve/brake servo.";
    psuPrimaryItems.push(
      makeRecommendedRow(psu240, {
        key: "ml-psu-240",
        pillar: "PSU",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: `PSU Utama 24VDC 10A (Beban estimasi ~${metrics.activeDcWatts}W)`,
        alasanSingkat: `Kapasitas 240W (10A) aman memikul inrush koil valve + holding brake servo (kebutuhan ≥${metrics.recommendedMinPsuWatts}W)`,
      })
    );
  } else if (finalPsuClass === "PSU_120W") {
    const psu120 = findCatalogByModel(catalogToUse, "S8VK-C12024", 66);
    psuHeadline = "Omron S8VK-C12024 / Autonics SPB-120-24 (120W / 5A @ 24VDC)";
    psuAlternativeNote =
      "Alternatif setara di katalog: Autonics SPB-120-24 (Slim Din Rail 120W 24VDC 5A).";
    psuPrimaryItems.push(
      makeRecommendedRow(psu120, {
        key: "ml-psu-120",
        pillar: "PSU",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: `PSU Utama 24VDC 5A (Beban estimasi ~${metrics.activeDcWatts}W)`,
        alasanSingkat: `Kapasitas 120W (5A) ideal untuk beban aktif ~${metrics.activeDcWatts}W (target ≥${metrics.recommendedMinPsuWatts}W)`,
      })
    );
  } else {
    const psu60 = findCatalogByModel(catalogToUse, "SPB-060-24", 63);
    psuHeadline = "Autonics SPB-060-24 / IDEC PS5R-VC24 (60W / 2.5A @ 24VDC)";
    psuAlternativeNote =
      "Alternatif premium: IDEC PS5R-VC24 (60W) atau upgrade ke SPB-120-24 (120W) bila berencana menambah valve.";
    psuPrimaryItems.push(
      makeRecommendedRow(psu60, {
        key: "ml-psu-60",
        pillar: "PSU",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: `PSU 24VDC 2.5A (Beban ringan ~${metrics.activeDcWatts}W)`,
        alasanSingkat: `Beban DC ringan (~${metrics.activeDcWatts}W), PSU 60W sudah memiliki margin >40%`,
      })
    );
  }

  const psuReasoning = `Estimasi arus aktif 24VDC sebesar ${metrics.activeCurrentAmps}A (~${metrics.activeDcWatts}W). Dengan standar derating industri 1.45x untuk lonjakan inrush koil valve & brake servo, kapasitas minimum PSU adalah ${metrics.recommendedMinPsuWatts}W.`;

  // ==================== 2. SUSUN REKOMENDASI SAFETY RELAY ====================
  const safetyPrimaryItems: RecommendedPrComponent[] = [];
  let safetyHeadline = "";
  let safetyCategory = "";
  let safetyReasoning = "";
  let safetyAlternativeNote = "";

  if (finalSafetyClass === "SAFETY_G9SP") {
    const g9sp = findCatalogByModel(catalogToUse, "G9SP-N10S", 46);
    safetyHeadline =
      "Omron G9SP-N10S (Programmable Safety Controller — 10 Safety In / 4 Safety Out)";
    safetyCategory = "ISO 13849-1 PLe / Safety Category 4 (Multi-Zone Robot & Servo)";
    safetyReasoning =
      metrics.robotCount > 0 && metrics.servoCount > 0
        ? `Proyek melibatkan ${metrics.robotCount} Robot Industri + ${metrics.servoCount} Motor Servo yang memerlukan pemisahan zona safety antara E-Stop Panel/Teach Pendant, Pintu Pagar Interlock Robot, dan pemutus STO/Kontaktor Servo.`
        : `Skor kompleksitas safety tinggi (multi-aktuator/robot cell), sehingga Programmable Safety Controller memudahkan logika muting, door interlock, dan dual-channel E-Stop.`;
    safetyAlternativeNote =
      "Alternatif lebih hemat: Omron G9SA-501 AC/DC24V (Rp 2,45 Jt) apabila seluruh E-Stop & Door Switch digabung dalam 1 loop hardwired tunggal tanpa pemisahan zona.";
    safetyPrimaryItems.push(
      makeRecommendedRow(g9sp, {
        key: "ml-safety-g9sp",
        pillar: "SAFETY_RELAY",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Safety Controller E-Stop, Fence Robot & STO Servo",
        alasanSingkat:
          "10 Safety Input & 4 Safety Output untuk integrasi safety Robot + Servo",
      })
    );
  } else {
    const g9sa = findCatalogByModel(catalogToUse, "G9SA-501", 45);
    safetyHeadline =
      "Omron G9SA-501 AC/DC24V (Dual-Channel Safety Relay 3PST-NO + 1SPST-NC)";
    safetyCategory = "ISO 13849-1 PLe / Category 4 Dual-Channel Hardwired";
    safetyReasoning =
      "Sistem tidak menggunakan multi-zona robot kompleks, sehingga unit Safety Relay Dual-Channel G9SA-501 sudah sangat andal dan ekonomis untuk memutus daya aktuator/valve/servo saat E-Stop atau Light Curtain aktif.";
    safetyAlternativeNote =
      "Upgrade ke Omron G9SP-N10S hanya jika membutuhkan pemisahan zona pintu pagar independen.";
    safetyPrimaryItems.push(
      makeRecommendedRow(g9sa, {
        key: "ml-safety-g9sa",
        pillar: "SAFETY_RELAY",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Dual-Channel Safety Relay E-Stop & Aktuator",
        alasanSingkat: "3 kontak Safety NO + 1 kontak Aux NC feedback ke PLC",
      })
    );
  }

  // ==================== 3. SUSUN REKOMENDASI JUMLAH & TIPE RELAY ====================
  const relayItem = findCatalogByModel(catalogToUse, "MY2N-D2", 40);
  const socketItem = findCatalogByModel(catalogToUse, "PYF08A", 41);
  const relayHeadline = `${metrics.totalRelayQty} pcs Omron MY2N-D2 24VDC + ${metrics.totalRelayQty} pcs Socket PYF08A`;
  const relayReasoning = `Tipe MY2N-D2 dipilih karena sudah dilengkapi Diode Surge Suppression internal untuk meredam tegangan balik (back-EMF) koil valve & brake servo agar output transistor PLC awet.`;

  const relayPrimaryItems: RecommendedPrComponent[] = [
    makeRecommendedRow(relayItem, {
      key: "ml-relay-my2n",
      pillar: "RELAY",
      kelompok: "Panel Utama",
      qty: metrics.totalRelayQty,
      catatanPr: `Interposing Valve/Servo/Robot termasuk ~20% spare`,
      alasanSingkat: `${metrics.totalRelayQty} titik relai kontrol 24VDC DPDT + Surge Diode`,
    }),
    makeRecommendedRow(socketItem, {
      key: "ml-relay-socket-pyf08a",
      pillar: "RELAY",
      kelompok: "Panel Utama",
      qty: metrics.totalRelayQty,
      catatanPr: "Socket Din Rail pasangan Relay MY2N-D2",
      alasanSingkat: "Pasangan 1:1 untuk dudukan Din Rail Relay MY2N-D2",
    }),
  ];

  // ==================== 4. SUSUN REKOMENDASI PLC (OPTIMASI BIAYA & KAPASITAS I/O RIIL) ====================
  const plcPrimaryItems: RecommendedPrComponent[] = [];
  for (const line of plcSelection.chosen.lines) {
    const spec = PLC_HARDWARE[line.hwKey];
    const catItem = findCatalogByModel(
      catalogToUse,
      spec.model,
      spec.fallbackNoUrut
    );
    plcPrimaryItems.push(
      makeRecommendedRow(catItem, {
        key: `ml-plc-${line.hwKey.toLowerCase()}`,
        pillar: "PLC",
        kelompok: "Panel Utama",
        qty: line.qty,
        catatanPr: `${spec.nama} (${line.role})`,
        alasanSingkat: `${spec.spesifikasi} — ${line.role}`,
        defaultChecked: true,
      })
    );
  }

  // Tambah modul analog bila FX5U dan ada > 2 channel analog input
  if (plcSelection.needsAnalogAdp) {
    const adpSpec = PLC_HARDWARE.FX5_4AD_ADP;
    const catItem = findCatalogByModel(
      catalogToUse,
      adpSpec.model,
      adpSpec.fallbackNoUrut
    );
    plcPrimaryItems.push(
      makeRecommendedRow(catItem, {
        key: "ml-plc-fx5-4ad",
        pillar: "PLC",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: `${adpSpec.nama} (${adpSpec.spesifikasi})`,
        alasanSingkat:
          "Modul ekspansi analog input tambahan (>2 channel sinyal analog presisi)",
        defaultChecked: true,
      })
    );
  }

  const plcHeadline = plcSelection.chosen.label;
  const plcOutputType = plcSelection.outputType;
  const plcReasoning =
    plcSelection.family === "IQR"
      ? `Estimasi kebutuhan I/O (${metrics.ioBreakdown.rawDi} DI / ${metrics.ioBreakdown.rawDo} DO + spare 20% = ${metrics.ioBreakdown.requiredDi} DI / ${metrics.ioBreakdown.requiredDo} DO) melampaui batas CPU compact FX5U, sehingga sistem menggunakan modular MELSEC iQ-R.`
      : plcSelection.chosen.lines.length === 1
        ? `Kebutuhan I/O riil (${metrics.ioBreakdown.rawDi} DI / ${metrics.ioBreakdown.rawDo} DO, termasuk spare 20% = ${metrics.ioBreakdown.requiredDi} DI / ${metrics.ioBreakdown.requiredDo} DO) cukup ditangani langsung oleh ${plcSelection.chosen.label} (kapasitas ${plcSelection.chosen.capacityDi} DI / ${plcSelection.chosen.capacityDo} DO) tanpa perlu membeli modul I/O tambahan / modul 64 titik yang mahal.`
        : `Kebutuhan I/O riil (${metrics.ioBreakdown.rawDi} DI / ${metrics.ioBreakdown.rawDo} DO + spare 20% = ${metrics.ioBreakdown.requiredDi} DI / ${metrics.ioBreakdown.requiredDo} DO) ditangani secara hemat oleh ${plcSelection.chosen.label} (kapasitas ${plcSelection.chosen.capacityDi} DI / ${plcSelection.chosen.capacityDo} DO).`;
  const plcAlternativeNote =
    plcSelection.family === "FX5U"
      ? "Alternatif: Bila standar end-user mewajibkan arsitektur modular rack, dapat menggunakan MELSEC iQ-R R04CPU."
      : "Alternatif: Pertimbangkan arsitektur FX5U-80MT dengan penyederhanaan wiring bila ingin menekan biaya hardware.";

  // ==================== 5. SUSUN REKOMENDASI SPEK MCB / MCCB ====================
  const mcbPrimaryItems: RecommendedPrComponent[] = [];
  const specsBreakdown: MlRecommendationResult["summaryFivePillars"]["mcb"]["specsBreakdown"] =
    [];
  let mcbHeadline = "";
  let mcbReasoning = "";

  const mccb40 = findCatalogByModel(catalogToUse, "EZC100B3040", 77);
  const mccb10 = findCatalogByModel(catalogToUse, "NF32-SVF", 70);
  const mcb16 = findCatalogByModel(catalogToUse, "A9F74216", 75);
  const mcb6 = findCatalogByModel(catalogToUse, "A9F74206", 73);
  const mcb4 = findCatalogByModel(catalogToUse, "A9F74204", 74);
  const cp5a = findCatalogByModel(catalogToUse, "CP30-BA 2P 5A", 72);
  const cp2a = findCatalogByModel(catalogToUse, "CP30-BA 2P 2A", 71);

  if (
    finalMcbClass === "MCB_3P_40A_ROBOT_SERVO" ||
    finalMcbClass === "MCB_3P_40A_ROBOT" ||
    finalMcbClass === "MCB_3P_40A_HEAVY"
  ) {
    const powerBranchQty = Math.max(
      1,
      metrics.robotCount + metrics.servoCount + metrics.inverterMotorCount
    );
    mcbHeadline = `Main MCCB 3P 40A (EZC100B3040) + ${powerBranchQty}x MCB 16A (Robot/Servo) + MCB 6A (Kontrol) + CP 2P 5A (PSU) + MCB 4A (Aksesoris)`;
    mcbReasoning = `Estimasi arus puncak total 3-phasa ~${metrics.estimatedMainAmps}A (memikul ${metrics.robotCount} Robot Controller${metrics.servoCount > 0 ? ` + ${metrics.servoCount} Servo Amplifier` : ""}). Main Incoming menggunakan MCCB 3-Pole 40A (7.5kA), sedangkan tiap jalur daya Robot/Servo diproteksi terpisah dengan MCB 16A Kurva C agar jika 1 axis trip tidak mematikan CPU PLC.`;

    specsBreakdown.push(
      {
        jalur: "Main Incoming Breaker Panel (3-Phasa)",
        spekMcb: "MCCB 3-Pole 40A 7.5kA (Schneider EZC100B3040)",
        qty: 1,
      },
      {
        jalur: `Jalur Daya Robot Controller & Servo Driver (${powerBranchQty} jalur)`,
        spekMcb: "MCB 1P 16A Kurva C 6kA (Schneider Acti9 A9F74216)",
        qty: powerBranchQty,
      },
      {
        jalur: "Jalur Kontrol AC (Input PLC, HMI & Input SMPS 24VDC)",
        spekMcb: "MCB 1P 6A Kurva C 6kA (Schneider Acti9 A9F74206)",
        qty: 2,
      },
      {
        jalur: "Proteksi Presisi Beban Power Supply 24VDC",
        spekMcb: "Circuit Protector 2-Pole 5A (Mitsubishi CP30-BA 2P 5A)",
        qty: finalPsuClass === "PSU_240W_DUAL" ? 2 : 1,
      },
      {
        jalur: "Aksesoris Kipas Panel, Lampu & Stop Kontak Servis Laptop",
        spekMcb: "MCB 1P 4A Kurva C 6kA (Schneider Acti9 A9F74204)",
        qty: 1,
      }
    );

    mcbPrimaryItems.push(
      makeRecommendedRow(mccb40, {
        key: "ml-mcb-main-40a",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Main Incoming Breaker 3P 40A Panel Utama",
        alasanSingkat: "Pemutus utama incoming 3-Phasa 40A",
      }),
      makeRecommendedRow(mcb16, {
        key: "ml-mcb-16a-power",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: powerBranchQty,
        catatanPr: `Proteksi cabang daya (${metrics.robotCount} Robot / ${metrics.servoCount} Servo)`,
        alasanSingkat: "MCB 16A Kurva C tahan arus inrush driver servo/robot",
      }),
      makeRecommendedRow(mcb6, {
        key: "ml-mcb-6a-ctrl",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: 2,
        catatanPr: "Proteksi jalur AC PLC/HMI & Input PSU 24VDC",
        alasanSingkat: "Pemisah proteksi jalur kontrol PLC & PSU",
      }),
      makeRecommendedRow(cp5a, {
        key: "ml-cp-5a-dc",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: finalPsuClass === "PSU_240W_DUAL" ? 2 : 1,
        catatanPr: "Circuit Protector beban Power Supply DC",
        alasanSingkat: "Proteksi trip cepat arus lebih jalur DC",
      }),
      makeRecommendedRow(mcb4, {
        key: "ml-mcb-4a-aux",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Proteksi Cooling Fan, Lampu Panel & Stop Kontak",
        alasanSingkat: "Proteksi jalur utilitas pintu/dinding panel",
      })
    );
  } else if (
    finalMcbClass === "MCB_3P_10A_SERVO" ||
    finalMcbClass === "MCB_3P_10A_MOTOR"
  ) {
    const branchDriveQty = Math.max(
      1,
      metrics.servoCount + metrics.inverterMotorCount
    );
    mcbHeadline = `Main MCCB 3P 10A (NF32-SVF) + ${branchDriveQty}x MCB 16A/6A Drive + MCB 6A Kontrol + CP 2P 5A + MCB 4A`;
    mcbReasoning = `Beban daya menengah tanpa robot besar (~${metrics.estimatedMainAmps}A). Menggunakan Main MCCB 3-Pole 10A Mitsubishi NF32-SVF dengan cabang terpisah untuk Servo/Inverter dan sirkuit kontrol PLC.`;

    specsBreakdown.push(
      {
        jalur: "Main Incoming 3-Phasa",
        spekMcb: "MCCB 3-Pole 10A (Mitsubishi NF32-SVF 3P 10A)",
        qty: 1,
      },
      {
        jalur: `Cabang Power Servo / Inverter (${branchDriveQty} unit)`,
        spekMcb: "MCB 1P 16A Kurva C (Schneider A9F74216)",
        qty: branchDriveQty,
      },
      {
        jalur: "Sirkuit Kontrol PLC, HMI & Input PSU 24V",
        spekMcb: "MCB 1P 6A Kurva C (Schneider A9F74206)",
        qty: 1,
      },
      {
        jalur: "Proteksi Beban DC Power Supply",
        spekMcb: "Circuit Protector 2P 5A (Mitsubishi CP30-BA 2P 5A)",
        qty: 1,
      },
      {
        jalur: "Kipas Pendingin & Stop Kontak Servis",
        spekMcb: "MCB 1P 4A Kurva C (Schneider A9F74204)",
        qty: 1,
      }
    );

    mcbPrimaryItems.push(
      makeRecommendedRow(mccb10, {
        key: "ml-mcb-main-10a",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Main Incoming MCCB 3P 10A",
        alasanSingkat: "Pemutus utama panel 3-Phasa skala menengah",
      }),
      makeRecommendedRow(mcb16, {
        key: "ml-mcb-16a-drive",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: branchDriveQty,
        catatanPr: "Proteksi jalur power Servo Amplifier / Inverter",
        alasanSingkat: "MCB cabang masing-masing driver motor",
      }),
      makeRecommendedRow(mcb6, {
        key: "ml-mcb-6a-ctrl",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Proteksi sirkuit kontrol PLC & PSU",
        alasanSingkat: "Proteksi jalur kontrol utama",
      }),
      makeRecommendedRow(cp5a, {
        key: "ml-cp-5a",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Circuit Protector jalur PSU 24VDC",
        alasanSingkat: "Pengaman beban DC",
      }),
      makeRecommendedRow(mcb4, {
        key: "ml-mcb-4a-aux",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Proteksi kipas & stop kontak panel",
        alasanSingkat: "Pengaman aksesoris AC panel",
      })
    );
  } else {
    mcbHeadline =
      "MCB 1P 6A (Kontrol Utama PLC/PSU) + Circuit Protector 2P 2A/5A (DC) + MCB 1P 4A (Aksesoris)";
    mcbReasoning =
      "Panel kontrol murni 1-Phasa 220VAC tanpa beban motor daya besar (~3-5A). Cukup menggunakan MCB 1P 6A Kurva C untuk incoming kontrol PLC/PSU, Circuit Protector 2P untuk jalur instrumen DC, dan MCB 1P 4A untuk kipas/stop kontak.";

    const cpToUse = finalPsuClass === "PSU_60W" ? cp2a : cp5a;
    const cpLabel =
      finalPsuClass === "PSU_60W"
        ? "Circuit Protector 2P 2A (Mitsubishi CP30-BA 2P 2A)"
        : "Circuit Protector 2P 5A (Mitsubishi CP30-BA 2P 5A)";

    specsBreakdown.push(
      {
        jalur: "Main Kontrol 1-Phasa (PLC, HMI & Input PSU 24VDC)",
        spekMcb: "MCB 1P 6A Kurva C (Schneider A9F74206)",
        qty: 2,
      },
      {
        jalur: "Proteksi Sirkuit Instrumen / Output PSU DC",
        spekMcb: cpLabel,
        qty: 1,
      },
      {
        jalur: "Aksesoris Kipas & Stop Kontak Panel",
        spekMcb: "MCB 1P 4A Kurva C (Schneider A9F74204)",
        qty: 1,
      }
    );

    mcbPrimaryItems.push(
      makeRecommendedRow(mcb6, {
        key: "ml-mcb-6a-1p",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: 2,
        catatanPr: "Main MCB 6A Incoming & Sirkuit PLC/PSU",
        alasanSingkat: "Proteksi 1-Phasa 6A Kurva C",
      }),
      makeRecommendedRow(cpToUse, {
        key: "ml-cp-1p",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Circuit Protector jalur DC instrumen",
        alasanSingkat: "Proteksi presisi beban 24VDC",
      }),
      makeRecommendedRow(mcb4, {
        key: "ml-mcb-4a-1p",
        pillar: "MCB",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Proteksi kipas & lampu panel",
        alasanSingkat: "Proteksi aksesoris panel 4A",
      })
    );
  }

  // ==================== 6. KOMPONEN PENDUKUNG OTOMATIS (OPSIONAL) ====================
  const supportingItems: RecommendedPrComponent[] = [];

  // Kontaktor pemutus daya utama servo / motor yang dikontrol oleh Safety Relay
  if (
    metrics.servoCount > 0 ||
    metrics.inverterMotorCount > 0 ||
    metrics.robotCount > 0
  ) {
    const contactor = findCatalogByModel(catalogToUse, "LC1D12M7", 79);
    const contactorQty =
      metrics.servoCount > 0 || metrics.robotCount > 0
        ? 2 // Dual-contactor feedback loop untuk Safety Category 3/4!
        : metrics.inverterMotorCount;
    supportingItems.push(
      makeRecommendedRow(contactor, {
        key: "ml-sup-contactor",
        pillar: "PENDUKUNG",
        kelompok: "Panel Utama",
        qty: contactorQty,
        catatanPr: "Kontaktor pemutus daya aktuator/servo dari Safety Relay",
        alasanSingkat:
          "2x Kontaktor seri (dual-channel safety cutoff) untuk memutus daya motor/servo saat E-Stop",
        defaultChecked: true,
      })
    );
  }

  if (metrics.inverterMotorCount > 0) {
    const overload = findCatalogByModel(catalogToUse, "LRD14", 80);
    supportingItems.push(
      makeRecommendedRow(overload, {
        key: "ml-sup-overload",
        pillar: "PENDUKUNG",
        kelompok: "Panel Utama",
        qty: metrics.inverterMotorCount,
        catatanPr: "Thermal Overload proteksi motor 3-Phasa",
        alasanSingkat: "Pengaman arus lebih thermal motor AC",
        defaultChecked: false,
      })
    );
  }

  // ==================== 5. SUSUN REKOMENDASI HMI (ANALISIS & PERHITUNGAN HMI) ====================
  const hmiSizing = sizeHmi(metrics, metrics.ioBreakdown, plcSelection.family);
  const hmiSpec = HMI_HARDWARE[hmiSizing.hwKey];
  const hmiCat = findCatalogByModel(
    catalogToUse,
    hmiSpec.model,
    hmiSpec.fallbackNoUrut
  );
  const hmiPrimaryItems: RecommendedPrComponent[] = [
    makeRecommendedRow(hmiCat, {
      key: `ml-hmi-${hmiSizing.hwKey.toLowerCase()}`,
      pillar: "HMI",
      kelompok: "OP Panel",
      qty: 1,
      catatanPr: `${hmiSpec.nama} (${hmiSizing.sizeLabel})`,
      alasanSingkat: `${hmiSizing.reasoning} (${hmiSizing.totalScreens} layar, ~${hmiSizing.estimatedTags} tag)`,
      defaultChecked: true,
    }),
  ];
  const hmiHeadline = `${hmiSpec.nama} (${hmiSpec.model} - ${hmiSizing.sizeLabel})`;
  const hmiReasoning = hmiSizing.reasoning;

  // Ethernet Switch 5-Port jika terdeteksi kebutuhan topologi multi-device
  if (
    hmiSizing.needsEthernetSwitch ||
    metrics.robotCount > 0 ||
    metrics.servoCount > 0
  ) {
    const ethSwitch = findCatalogByModel(catalogToUse, "MES-M5RJ-ST", 84);
    supportingItems.push(
      makeRecommendedRow(ethSwitch, {
        key: "ml-sup-eth-switch",
        pillar: "PENDUKUNG",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Industrial Ethernet Switch (PLC - HMI - Robot - Laptop)",
        alasanSingkat: `Menghubungkan komunikasi Ethernet (${hmiSizing.ethernetDevices} node: PLC, HMI${metrics.robotCount > 0 ? `, ${metrics.robotCount}x Robot` : ""}, & port teknisi)`,
        defaultChecked: true,
      })
    );
  }

  // EMC Noise Filter untuk meredam harmonisa servo & robot
  if (metrics.robotCount > 0 || metrics.servoCount >= 2) {
    const filter3p = findCatalogByModel(catalogToUse, "ENF-RTEN-5020D", 83);
    supportingItems.push(
      makeRecommendedRow(filter3p, {
        key: "ml-sup-emc-3p",
        pillar: "PENDUKUNG",
        kelompok: "Panel Utama",
        qty: 1,
        catatanPr: "Noise Filter 3-Phasa 20A peredam harmonisa Servo/Robot",
        alasanSingkat:
          "Mencegah gangguan noise PWM servo/robot ke sinyal komunikasi PLC",
        defaultChecked: false,
      })
    );
  }
  const filter1p = findCatalogByModel(catalogToUse, "RSEN-2006", 81);
  supportingItems.push(
    makeRecommendedRow(filter1p, {
      key: "ml-sup-emc-1p",
      pillar: "PENDUKUNG",
      kelompok: "Panel Utama",
      qty: 1,
      catatanPr: "Noise Filter 1-Phasa 6A jalur supply bersih PLC & PSU",
      alasanSingkat: "Filter EMC 6A sebelum masuk ke PLC & SMPS 24VDC",
      defaultChecked: true,
    })
  );

  // Tombol Emergency Stop & Safety Door Interlock jika ada Robot
  if (metrics.robotCount > 0) {
    const estopRobot = findCatalogByModel(catalogToUse, "XN4E-TL412Q4MR", 10);
    const doorSwitch = findCatalogByModel(catalogToUse, "D4NS-1BF", 34);
    supportingItems.push(
      makeRecommendedRow(estopRobot, {
        key: "ml-sup-estop-padlock",
        pillar: "PENDUKUNG",
        kelompok: "OP Panel",
        qty: 2,
        catatanPr: "E-Stop Padlockable (Main Panel & Pintu Sel Robot)",
        alasanSingkat: "E-Stop 2NC dengan fitur gembok LOTO khusus sel robot",
        defaultChecked: true,
      }),
      makeRecommendedRow(doorSwitch, {
        key: "ml-sup-door-interlock",
        pillar: "PENDUKUNG",
        kelompok: "Sensor & Push Button",
        qty: metrics.robotCount,
        catatanPr: "Safety Door Interlock pintu pagar sel robot",
        alasanSingkat: "Sensor pengaman pintu pagar robot terhubung ke G9SP",
        defaultChecked: true,
      })
    );
  } else {
    const estopStd = findCatalogByModel(catalogToUse, "YW1B-V4E02", 7);
    supportingItems.push(
      makeRecommendedRow(estopStd, {
        key: "ml-sup-estop-std",
        pillar: "PENDUKUNG",
        kelompok: "OP Panel",
        qty: 1,
        catatanPr: "Emergency Stop 2NC Turn-Reset OP Panel",
        alasanSingkat: "Tombol darurat dual-channel ke Safety Relay",
        defaultChecked: true,
      })
    );
  }

  // Sign Tower Lamp (indikator status operasi visual)
  const towerLamp = findCatalogByModel(catalogToUse, "PTE-APZ-302-RYG", 22);
  supportingItems.push(
    makeRecommendedRow(towerLamp, {
      key: "ml-sup-tower",
      pillar: "PENDUKUNG",
      kelompok: "OP Panel",
      qty: 1,
      catatanPr: "Tower Lamp 3 Warna RYG + Buzzer 24VDC",
      alasanSingkat: "Indikator status Run / Idle / Alarm sel otomasi",
      defaultChecked: true,
    })
  );

  // PID Temperature Controller jika terdeteksi heater
  if (metrics.heaterCount > 0) {
    const pid = findCatalogByModel(catalogToUse, "TCN4S-24R", 49);
    supportingItems.push(
      makeRecommendedRow(pid, {
        key: "ml-sup-pid",
        pillar: "PENDUKUNG",
        kelompok: "Panel Utama",
        qty: metrics.heaterCount,
        catatanPr: `Digital PID Temperature Controller (${metrics.heaterCount} zona heater)`,
        alasanSingkat: "Kontrol suhu presisi untuk setiap zona heater",
        defaultChecked: true,
      })
    );
  }

  const allRecommendedItems: RecommendedPrComponent[] = [
    ...psuPrimaryItems,
    ...safetyPrimaryItems,
    ...relayPrimaryItems,
    ...plcPrimaryItems,
    ...hmiPrimaryItems,
    ...mcbPrimaryItems,
    ...supportingItems,
  ];

  return {
    inputDescription: description,
    entities,
    mlMeta: {
      algorithm:
        "Hybrid Weighted k-NN (RBF Kernel) + Domain TF-Cosine + IEC Panel Sizing",
      confidencePct,
      trainingSamplesCount: allSamples.length,
      historicalSamplesCount: historicalSamples.length,
      nearestProfiles: rankedNeighbors.slice(0, 3).map((n) => ({
        title: n.sample.title,
        similarityPct: Math.min(99, Math.max(45, Math.round(n.rawSim * 100))),
        source: n.sample.source,
      })),
    },
    summaryFivePillars: {
      psu: {
        headline: psuHeadline,
        activeLoadWatts: metrics.activeDcWatts,
        recommendedMinWatts: metrics.recommendedMinPsuWatts,
        activeCurrentAmps: metrics.activeCurrentAmps,
        reasoning: psuReasoning,
        primaryItems: psuPrimaryItems,
        alternativeNote: psuAlternativeNote,
      },
      safetyRelay: {
        headline: safetyHeadline,
        safetyCategory,
        reasoning: safetyReasoning,
        primaryItems: safetyPrimaryItems,
        alternativeNote: safetyAlternativeNote,
      },
      relay: {
        headline: relayHeadline,
        totalRelayQty: metrics.totalRelayQty,
        breakdown: metrics.relayBreakdown,
        reasoning: relayReasoning,
        primaryItems: relayPrimaryItems,
      },
      plc: {
        headline: plcHeadline,
        estimatedDi: metrics.estimatedDi,
        estimatedDo: metrics.estimatedDo,
        outputType: plcOutputType,
        highSpeedAxes: metrics.highSpeedAxes,
        reasoning: plcReasoning,
        primaryItems: plcPrimaryItems,
        alternativeNote: plcAlternativeNote,
        calculation: {
          io: metrics.ioBreakdown,
          selection: plcSelection,
        },
      },
      hmi: {
        headline: hmiHeadline,
        reasoning: hmiReasoning,
        primaryItems: hmiPrimaryItems,
        calculation: hmiSizing,
      },
      mcb: {
        headline: mcbHeadline,
        supplyPhase: metrics.supplyPhase,
        estimatedMainAmps: metrics.estimatedMainAmps,
        specsBreakdown,
        reasoning: mcbReasoning,
        primaryItems: mcbPrimaryItems,
      },
    },
    supportingItems,
    allRecommendedItems,
  };
}
