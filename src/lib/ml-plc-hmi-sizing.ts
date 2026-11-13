/**
 * Perhitungan PLC & HMI untuk Analisis Machine Learning komponen otomasi.
 *
 * - Rincian kebutuhan titik I/O (DI / DO) per perangkat inti + spare 20%.
 * - Optimasi konfigurasi PLC berbasis kapasitas I/O & axis pulse:
 *   memilih kombinasi CPU + modul ekspansi TERMURAH yang mencukupi,
 *   sehingga bila I/O cukup memakai FX5U-32M maka TIDAK membeli modul I/O tambahan / modul 64 titik.
 * - Sizing HMI: estimasi jumlah layar, tag, alarm, dan ukuran layar yang sesuai.
 */

export interface IoLine {
  label: string;
  qty: number;
}

export interface IoBreakdown {
  diItems: IoLine[];
  doItems: IoLine[];
  rawDi: number;
  rawDo: number;
  spareDi: number;
  spareDo: number;
  requiredDi: number;
  requiredDo: number;
  highSpeedAxes: number;
  analogInputs: number;
}

export interface IoInput {
  valveCount: number;
  robotCount: number;
  servoCount: number;
  inverterMotorCount: number;
  explicitSensorCount: number;
  safetyDeviceCount: number;
  analogCount: number;
  heaterCount: number;
}

export const IO_SPARE_RATIO = 0.2;

export function computeIoBreakdown(m: IoInput): IoBreakdown {
  const diItems: IoLine[] = [
    {
      label: "Panel operator (Start, Stop, Reset, Auto/Manual, Aux E-Stop, Feedback Safety)",
      qty: 6,
    },
  ];

  if (m.explicitSensorCount > 0) {
    diItems.push({
      label: "Sensor yang disebutkan (proximity / photoelectric / limit)",
      qty: m.explicitSensorCount,
    });
    if (m.valveCount > 0) {
      diItems.push({
        label: `Reed switch posisi silinder (2 per valve × ${m.valveCount})`,
        qty: m.valveCount * 2,
      });
    }
  } else {
    if (m.valveCount > 0) {
      diItems.push({
        label: `Reed switch maju/mundur silinder (2 per valve × ${m.valveCount})`,
        qty: m.valveCount * 2,
      });
    }
    if (m.servoCount > 0) {
      diItems.push({
        label: `Sensor Home/Origin & Limit servo (2 per axis × ${m.servoCount})`,
        qty: m.servoCount * 2,
      });
    }
  }

  if (m.servoCount > 0) {
    diItems.push({
      label: `Status servo driver: Ready, Alarm, In-Position (3 × ${m.servoCount})`,
      qty: m.servoCount * 3,
    });
  }
  if (m.robotCount > 0) {
    diItems.push({
      label: `Handshake robot: Running, Home, Busy, Fault, Servo-ON, Area Clear (6 × ${m.robotCount})`,
      qty: m.robotCount * 6,
    });
  }
  if (m.inverterMotorCount > 0) {
    diItems.push({
      label: `Feedback inverter/motor: Running, Fault (2 × ${m.inverterMotorCount})`,
      qty: m.inverterMotorCount * 2,
    });
  }
  if (m.safetyDeviceCount > 0) {
    diItems.push({
      label: `Aux light curtain / door interlock (2 × ${m.safetyDeviceCount})`,
      qty: m.safetyDeviceCount * 2,
    });
  }
  if (m.heaterCount > 0) {
    diItems.push({
      label: `Alarm output PID heater (1 × ${m.heaterCount})`,
      qty: m.heaterCount,
    });
  }

  const doItems: IoLine[] = [
    { label: "Tower lamp Merah/Kuning/Hijau + Buzzer", qty: 4 },
  ];
  if (m.valveCount > 0) {
    doItems.push({
      label: `Koil solenoid valve (1 per valve × ${m.valveCount})`,
      qty: m.valveCount,
    });
  }
  if (m.servoCount > 0) {
    doItems.push({
      label: `Servo: Pulse, Direction (high-speed) + Servo-ON, Alarm Reset (4 × ${m.servoCount})`,
      qty: m.servoCount * 4,
    });
  }
  if (m.robotCount > 0) {
    doItems.push({
      label: `Perintah robot: Start, Hold, Reset, Program Select, Area Permit (5 × ${m.robotCount})`,
      qty: m.robotCount * 5,
    });
  }
  if (m.inverterMotorCount + m.heaterCount > 0) {
    doItems.push({
      label: `Run/Reset inverter & enable heater (2 × ${m.inverterMotorCount + m.heaterCount})`,
      qty: (m.inverterMotorCount + m.heaterCount) * 2,
    });
  }

  const rawDi = diItems.reduce((s, i) => s + i.qty, 0);
  const rawDo = doItems.reduce((s, i) => s + i.qty, 0);
  const requiredDi = Math.ceil(rawDi * (1 + IO_SPARE_RATIO));
  const requiredDo = Math.ceil(rawDo * (1 + IO_SPARE_RATIO));

  return {
    diItems,
    doItems,
    rawDi,
    rawDo,
    spareDi: requiredDi - rawDi,
    spareDo: requiredDo - rawDo,
    requiredDi,
    requiredDo,
    highSpeedAxes: m.servoCount,
    analogInputs: m.analogCount,
  };
}

// ==================== OPTIMASI KONFIGURASI PLC ====================

export interface PlcHardwareSpec {
  model: string; // kata kunci tipe untuk dicari di katalog
  merek: string;
  nama: string;
  kategori: string;
  spesifikasi: string;
  estimasiHarga: number;
  defaultUnit: string;
  fungsi: string;
  fallbackNoUrut?: number; // nomor di katalog bawaan bila ada
  di: number;
  do: number;
  pulseAxes: number;
  outputType: "RELAY" | "TRANSISTOR" | "NONE";
}

export const PLC_HARDWARE: Record<string, PlcHardwareSpec> = {
  FX5U_32MR: {
    model: "FX5U-32MR/ES",
    merek: "Mitsubishi",
    nama: "Compact PLC CPU Unit (FX5U Series)",
    kategori: "PLC & HMI",
    spesifikasi: "16 In / 16 Out Relay, Built-in Ethernet & Analog",
    estimasiHarga: 5665000,
    defaultUnit: "pcs",
    fungsi: "CPU PLC compact output relay",
    fallbackNoUrut: 50,
    di: 16,
    do: 16,
    pulseAxes: 0,
    outputType: "RELAY",
  },
  FX5U_32MT: {
    model: "FX5U-32MT/ES",
    merek: "Mitsubishi",
    nama: "Compact PLC CPU Unit Transistor (FX5U Series)",
    kategori: "PLC & HMI",
    spesifikasi: "16 In / 16 Out Transistor Sink, 4-Axis Pulse 200kHz, Ethernet",
    estimasiHarga: 6250000,
    defaultUnit: "pcs",
    fungsi: "CPU PLC compact untuk pulse servo/stepper",
    di: 16,
    do: 16,
    pulseAxes: 4,
    outputType: "TRANSISTOR",
  },
  FX5U_80MT: {
    model: "FX5U-80MT/ES",
    merek: "Mitsubishi",
    nama: "High-End PLC CPU Unit (FX5U Series)",
    kategori: "PLC & HMI",
    spesifikasi: "40 In / 40 Out Transistor Sink, Built-in Ethernet",
    estimasiHarga: 9850000,
    defaultUnit: "pcs",
    fungsi: "CPU PLC I/O besar + pulse servo",
    fallbackNoUrut: 51,
    di: 40,
    do: 40,
    pulseAxes: 4,
    outputType: "TRANSISTOR",
  },
  FX5_16EX: {
    model: "FX5-16EX/ES",
    merek: "Mitsubishi",
    nama: "Modul Ekspansi 16 Digital Input (FX5)",
    kategori: "PLC & HMI",
    spesifikasi: "16 Point DC Input 24VDC Sink/Source",
    estimasiHarga: 1350000,
    defaultUnit: "pcs",
    fungsi: "Tambahan input digital FX5U",
    di: 16,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
  FX5_16EYT: {
    model: "FX5-16EYT/ES",
    merek: "Mitsubishi",
    nama: "Modul Ekspansi 16 Digital Output Transistor (FX5)",
    kategori: "PLC & HMI",
    spesifikasi: "16 Point Transistor Output Sink 24VDC 0.5A",
    estimasiHarga: 1450000,
    defaultUnit: "pcs",
    fungsi: "Tambahan output digital FX5U",
    di: 0,
    do: 16,
    pulseAxes: 0,
    outputType: "TRANSISTOR",
  },
  FX5_32ET: {
    model: "FX5-32ET/ES",
    merek: "Mitsubishi",
    nama: "Modul Ekspansi 16 In / 16 Out Transistor (FX5)",
    kategori: "PLC & HMI",
    spesifikasi: "16 Point DC Input + 16 Point Transistor Output Sink",
    estimasiHarga: 2650000,
    defaultUnit: "pcs",
    fungsi: "Tambahan input & output digital FX5U",
    di: 16,
    do: 16,
    pulseAxes: 0,
    outputType: "TRANSISTOR",
  },
  FX5_4AD_ADP: {
    model: "FX5-4AD-ADP",
    merek: "Mitsubishi",
    nama: "Analog Input Module",
    kategori: "PLC & HMI",
    spesifikasi: "4 Channel Analog Input (0-10V, 4-20mA)",
    estimasiHarga: 2150000,
    defaultUnit: "pcs",
    fungsi: "Pembacaan sinyal analog tambahan",
    fallbackNoUrut: 58,
    di: 0,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
  R04CPU: {
    model: "R04CPU",
    merek: "Mitsubishi",
    nama: "Modular PLC CPU (MELSEC iQ-R Series)",
    kategori: "PLC & HMI",
    spesifikasi: "Program Kapasitas 40K Steps, High-Speed Bus",
    estimasiHarga: 14500000,
    defaultUnit: "pcs",
    fungsi: "CPU modular sistem besar",
    fallbackNoUrut: 52,
    di: 0,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
  R35B: {
    model: "R35B",
    merek: "Mitsubishi",
    nama: "Main Base Unit Rack 5-Slot",
    kategori: "PLC & HMI",
    spesifikasi: "5-Slot Base Unit untuk modul CPU & I/O iQ-R",
    estimasiHarga: 3200000,
    defaultUnit: "pcs",
    fungsi: "Backplane modul iQ-R",
    fallbackNoUrut: 54,
    di: 0,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
  R61P: {
    model: "R61P",
    merek: "Mitsubishi",
    nama: "Power Supply Module PLC",
    kategori: "PLC & HMI",
    spesifikasi: "Input 100-240VAC, Output 5VDC 5A ke bus rack",
    estimasiHarga: 2400000,
    defaultUnit: "pcs",
    fungsi: "Catu daya rack iQ-R",
    fallbackNoUrut: 55,
    di: 0,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
  RX40C7: {
    model: "RX40C7",
    merek: "Mitsubishi",
    nama: "Digital Input Module (16 Point)",
    kategori: "PLC & HMI",
    spesifikasi: "16 Point DC Input 24VDC",
    estimasiHarga: 1650000,
    defaultUnit: "pcs",
    fungsi: "Input digital iQ-R 16 titik",
    di: 16,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
  RX41C4: {
    model: "RX41C4",
    merek: "Mitsubishi",
    nama: "Digital Input Module (32 Point)",
    kategori: "PLC & HMI",
    spesifikasi: "32 Point DC Input 24VDC",
    estimasiHarga: 2450000,
    defaultUnit: "pcs",
    fungsi: "Input digital iQ-R 32 titik",
    di: 32,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
  RX42C4: {
    model: "RX42C4",
    merek: "Mitsubishi",
    nama: "Digital Input Module (64 Point)",
    kategori: "PLC & HMI",
    spesifikasi: "64 Point DC Input 24VDC (Sink/Source)",
    estimasiHarga: 4100000,
    defaultUnit: "pcs",
    fungsi: "Input digital iQ-R 64 titik",
    fallbackNoUrut: 56,
    di: 64,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
  RY40NT5P: {
    model: "RY40NT5P",
    merek: "Mitsubishi",
    nama: "Digital Output Module (16 Point Transistor)",
    kategori: "PLC & HMI",
    spesifikasi: "16 Point Transistor Output Sink 24VDC 0.5A",
    estimasiHarga: 1850000,
    defaultUnit: "pcs",
    fungsi: "Output digital iQ-R 16 titik",
    di: 0,
    do: 16,
    pulseAxes: 0,
    outputType: "TRANSISTOR",
  },
  RY41NT2P: {
    model: "RY41NT2P",
    merek: "Mitsubishi",
    nama: "Digital Output Module (32 Point Transistor)",
    kategori: "PLC & HMI",
    spesifikasi: "32 Point Transistor Output Sink 24VDC 0.2A",
    estimasiHarga: 2750000,
    defaultUnit: "pcs",
    fungsi: "Output digital iQ-R 32 titik",
    di: 0,
    do: 32,
    pulseAxes: 0,
    outputType: "TRANSISTOR",
  },
  RY42NT2P: {
    model: "RY42NT2P",
    merek: "Mitsubishi",
    nama: "Digital Output Module (64 Point Transistor)",
    kategori: "PLC & HMI",
    spesifikasi: "64 Point Transistor Output Sink 24VDC 0.1A",
    estimasiHarga: 4600000,
    defaultUnit: "pcs",
    fungsi: "Output digital iQ-R 64 titik",
    fallbackNoUrut: 57,
    di: 0,
    do: 64,
    pulseAxes: 0,
    outputType: "TRANSISTOR",
  },
  RD75P4: {
    model: "RD75P4",
    merek: "Mitsubishi",
    nama: "Positioning Module 4-Axis Pulse (iQ-R)",
    kategori: "PLC & HMI",
    spesifikasi: "4 Axis Open Collector Pulse Output 200kpps",
    estimasiHarga: 9800000,
    defaultUnit: "pcs",
    fungsi: "Kontrol posisi servo pulse untuk iQ-R",
    di: 0,
    do: 0,
    pulseAxes: 4,
    outputType: "NONE",
  },
};

export interface PlcConfigLine {
  hwKey: keyof typeof PLC_HARDWARE;
  qty: number;
  role: string;
}

export interface PlcCandidateEvaluation {
  label: string;
  valid: boolean;
  reason: string;
  totalPrice: number;
  capacityDi: number;
  capacityDo: number;
  lines: PlcConfigLine[];
}

export interface PlcSelection {
  family: "FX5U" | "IQR";
  chosen: PlcCandidateEvaluation;
  candidates: PlcCandidateEvaluation[];
  utilizationDiPct: number;
  utilizationDoPct: number;
  freeDi: number;
  freeDo: number;
  outputType: "TRANSISTOR_HIGH_SPEED" | "RELAY_STANDARD" | "MODULAR_HIGH_IO";
  needsAnalogAdp: boolean;
}

const FX5U_MAX_TOTAL_IO = 256;
const FX5U_MAX_EXPANSION_MODULES = 8;

function priceOf(lines: PlcConfigLine[]): number {
  return lines.reduce(
    (s, l) => s + PLC_HARDWARE[l.hwKey].estimasiHarga * l.qty,
    0
  );
}

function capacityOf(lines: PlcConfigLine[]) {
  return lines.reduce(
    (acc, l) => ({
      di: acc.di + PLC_HARDWARE[l.hwKey].di * l.qty,
      do: acc.do + PLC_HARDWARE[l.hwKey].do * l.qty,
    }),
    { di: 0, do: 0 }
  );
}

function buildFx5uCandidate(
  cpuKey: "FX5U_32MR" | "FX5U_32MT" | "FX5U_80MT",
  io: IoBreakdown
): PlcCandidateEvaluation {
  const cpu = PLC_HARDWARE[cpuKey];
  const lines: PlcConfigLine[] = [
    { hwKey: cpuKey, qty: 1, role: "CPU utama" },
  ];

  if (io.highSpeedAxes > 0 && cpu.outputType === "RELAY") {
    return {
      label: `${cpu.model}`,
      valid: false,
      reason: "Output relay tidak bisa mengeluarkan high-speed pulse untuk servo",
      totalPrice: priceOf(lines),
      capacityDi: cpu.di,
      capacityDo: cpu.do,
      lines,
    };
  }
  if (io.highSpeedAxes > cpu.pulseAxes) {
    return {
      label: `${cpu.model}`,
      valid: false,
      reason: `Butuh ${io.highSpeedAxes} axis pulse, CPU hanya mendukung ${cpu.pulseAxes} axis`,
      totalPrice: priceOf(lines),
      capacityDi: cpu.di,
      capacityDo: cpu.do,
      lines,
    };
  }

  const extraDi = Math.max(0, io.requiredDi - cpu.di);
  const extraDo = Math.max(0, io.requiredDo - cpu.do);
  let diMods = Math.ceil(extraDi / 16);
  let doMods = Math.ceil(extraDo / 16);

  // Gabungkan pasangan 16 In + 16 Out menjadi 1 modul FX5-32ET bila lebih murah
  const comboMods = Math.min(diMods, doMods);
  const comboCheaper =
    PLC_HARDWARE.FX5_32ET.estimasiHarga <
    PLC_HARDWARE.FX5_16EX.estimasiHarga + PLC_HARDWARE.FX5_16EYT.estimasiHarga;
  if (comboMods > 0 && comboCheaper) {
    lines.push({
      hwKey: "FX5_32ET",
      qty: comboMods,
      role: "Ekspansi 16 In / 16 Out",
    });
    diMods -= comboMods;
    doMods -= comboMods;
  }
  if (diMods > 0) {
    lines.push({ hwKey: "FX5_16EX", qty: diMods, role: "Ekspansi input" });
  }
  if (doMods > 0) {
    lines.push({ hwKey: "FX5_16EYT", qty: doMods, role: "Ekspansi output" });
  }

  const cap = capacityOf(lines);
  const expansionCount = lines
    .filter((l) => l.hwKey !== cpuKey)
    .reduce((s, l) => s + l.qty, 0);

  const labelParts = lines.map((l) =>
    l.qty > 1
      ? `${l.qty}x ${PLC_HARDWARE[l.hwKey].model}`
      : PLC_HARDWARE[l.hwKey].model
  );

  if (cap.di + cap.do > FX5U_MAX_TOTAL_IO) {
    return {
      label: labelParts.join(" + "),
      valid: false,
      reason: `Total I/O ${cap.di + cap.do} melebihi batas FX5U (${FX5U_MAX_TOTAL_IO} titik)`,
      totalPrice: priceOf(lines),
      capacityDi: cap.di,
      capacityDo: cap.do,
      lines,
    };
  }
  if (expansionCount > FX5U_MAX_EXPANSION_MODULES) {
    return {
      label: labelParts.join(" + "),
      valid: false,
      reason: `Butuh ${expansionCount} modul ekspansi (terlalu banyak untuk panel)`,
      totalPrice: priceOf(lines),
      capacityDi: cap.di,
      capacityDo: cap.do,
      lines,
    };
  }

  return {
    label: labelParts.join(" + "),
    valid: true,
    reason:
      expansionCount === 0
        ? `I/O built-in CPU sudah cukup (${cpu.di} DI / ${cpu.do} DO), tanpa modul tambahan`
        : `CPU + ${expansionCount} modul ekspansi 16 titik`,
    totalPrice: priceOf(lines),
    capacityDi: cap.di,
    capacityDo: cap.do,
    lines,
  };
}

function pickIqrModule(
  need: number,
  options: Array<keyof typeof PLC_HARDWARE>,
  kind: "di" | "do"
): PlcConfigLine[] {
  if (need <= 0) return [];
  // Pilih kombinasi termurah: modul besar sebanyak ceil, atau satu modul kecil yang pas
  const sorted = [...options].sort(
    (a, b) => PLC_HARDWARE[a][kind] - PLC_HARDWARE[b][kind]
  );
  for (const key of sorted) {
    if (PLC_HARDWARE[key][kind] >= need) {
      return [{ hwKey: key, qty: 1, role: kind === "di" ? "Modul input" : "Modul output" }];
    }
  }
  const biggest = sorted[sorted.length - 1];
  const qty = Math.ceil(need / PLC_HARDWARE[biggest][kind]);
  return [
    { hwKey: biggest, qty, role: kind === "di" ? "Modul input" : "Modul output" },
  ];
}

function buildIqrCandidate(io: IoBreakdown): PlcCandidateEvaluation {
  const lines: PlcConfigLine[] = [
    { hwKey: "R04CPU", qty: 1, role: "CPU utama" },
    { hwKey: "R35B", qty: 1, role: "Base rack" },
    { hwKey: "R61P", qty: 1, role: "Power supply rack" },
    ...pickIqrModule(io.requiredDi, ["RX40C7", "RX41C4", "RX42C4"], "di"),
    ...pickIqrModule(io.requiredDo, ["RY40NT5P", "RY41NT2P", "RY42NT2P"], "do"),
  ];
  if (io.highSpeedAxes > 0) {
    lines.push({
      hwKey: "RD75P4",
      qty: Math.ceil(io.highSpeedAxes / 4),
      role: "Modul positioning pulse servo",
    });
  }
  const cap = capacityOf(lines);
  return {
    label: lines
      .map((l) =>
        l.qty > 1
          ? `${l.qty}x ${PLC_HARDWARE[l.hwKey].model}`
          : PLC_HARDWARE[l.hwKey].model
      )
      .join(" + "),
    valid: true,
    reason: "Arsitektur modular iQ-R (dipakai bila FX5U tidak mencukupi)",
    totalPrice: priceOf(lines),
    capacityDi: cap.di,
    capacityDo: cap.do,
    lines,
  };
}

export interface PlcSelectionOptions {
  robotCount?: number;
  preferModular?: boolean;
}

/**
 * Memilih konfigurasi PLC termurah yang memenuhi kebutuhan I/O (+ spare) & axis pulse.
 * Urutan prioritas:
 * 1. Jika I/O cukup memakai FX5U-32M (MR / MT) -> pakai FX5U-32M tanpa modul tambahan.
 * 2. Jika butuh I/O lebih banyak atau 4-axis pulse -> pakai FX5U-32M + ekspansi 16-pt ATAU FX5U-80MT.
 * 3. HANYA beralih ke MELSEC iQ-R (R04CPU) jika multi-robot (>=2 robot), axis pulse > 4, atau I/O melampaui batas fisik FX5U (>56-80 I/O).
 * 4. Untuk iQ-R pun, ukuran modul I/O dipilih proporsional (16/32-pt) dan hanya memakai 64-pt bila kebutuhan I/O riil memang >32 titik.
 */
export function selectPlcConfiguration(
  io: IoBreakdown,
  opts?: PlcSelectionOptions
): PlcSelection {
  const fxCandidates = (
    ["FX5U_32MR", "FX5U_32MT", "FX5U_80MT"] as const
  ).map((k) => buildFx5uCandidate(k, io));

  const validFx = fxCandidates
    .filter((c) => c.valid)
    .sort((a, b) => {
      if (a.totalPrice !== b.totalPrice) return a.totalPrice - b.totalPrice;
      return a.lines.length - b.lines.length;
    });

  const iqr = buildIqrCandidate(io);
  // Sistem multi-robot (>= 2 robot) atau preferModular secara historis membutuhkan arsitektur modular iQ-R
  const multiRobotRequiresModular = (opts?.robotCount ?? 0) >= 2;
  const useIqr =
    validFx.length === 0 || multiRobotRequiresModular || !!opts?.preferModular;
  const chosen = useIqr ? iqr : validFx[0];

  const candidates: PlcCandidateEvaluation[] = [
    ...fxCandidates,
    {
      ...iqr,
      valid: useIqr,
      reason: useIqr
        ? iqr.reason
        : "Tidak diperlukan — FX5U sudah mencukupi & jauh lebih ekonomis (tanpa modul 64-pin)",
    },
  ];

  const cpuSpec = PLC_HARDWARE[chosen.lines[0].hwKey];
  const outputType: PlcSelection["outputType"] = useIqr
    ? "MODULAR_HIGH_IO"
    : cpuSpec.outputType === "RELAY"
      ? "RELAY_STANDARD"
      : "TRANSISTOR_HIGH_SPEED";

  return {
    family: useIqr ? "IQR" : "FX5U",
    chosen,
    candidates,
    utilizationDiPct: chosen.capacityDi
      ? Math.round((io.rawDi / chosen.capacityDi) * 100)
      : 0,
    utilizationDoPct: chosen.capacityDo
      ? Math.round((io.rawDo / chosen.capacityDo) * 100)
      : 0,
    freeDi: chosen.capacityDi - io.rawDi,
    freeDo: chosen.capacityDo - io.rawDo,
    outputType,
    // FX5U punya 2 channel analog input built-in; modul ADP hanya bila > 2 sinyal analog
    needsAnalogAdp: !useIqr && io.analogInputs > 2,
  };
}

// ==================== SIZING HMI ====================

export const HMI_HARDWARE: Record<string, PlcHardwareSpec> = {
  GS2107: {
    model: "GS2107-WTBD-N",
    merek: "Mitsubishi",
    nama: "HMI Touchscreen 7 Inch Widescreen",
    kategori: "PLC & HMI",
    spesifikasi: "TFT Color 800x480, RS232/422/485, Ethernet, 24VDC",
    estimasiHarga: 3059000,
    defaultUnit: "pcs",
    fungsi: "HMI operator mesin skala kecil-menengah",
    fallbackNoUrut: 61,
    di: 0,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
  GS2110: {
    model: "GS2110-WTBD-N",
    merek: "Mitsubishi",
    nama: "HMI Touchscreen 10 Inch Widescreen",
    kategori: "PLC & HMI",
    spesifikasi: "TFT Color 800x480 10.1', Ethernet, RS232/422/485, 24VDC",
    estimasiHarga: 5850000,
    defaultUnit: "pcs",
    fungsi: "HMI operator banyak layar / teaching servo",
    di: 0,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
  GT2510: {
    model: "GT2510-VTBD",
    merek: "Mitsubishi",
    nama: "HMI GOT2000 10.4 Inch",
    kategori: "PLC & HMI",
    spesifikasi: "10.4' VGA TFT, 2x Ethernet, Multi-touch, 24VDC",
    estimasiHarga: 12500000,
    defaultUnit: "pcs",
    fungsi: "HMI kelas atas untuk sistem robot/multi-axis besar",
    di: 0,
    do: 0,
    pulseAxes: 0,
    outputType: "NONE",
  },
};

export interface HmiScreenLine {
  label: string;
  qty: number;
}

export interface HmiSizing {
  screenItems: HmiScreenLine[];
  totalScreens: number;
  estimatedTags: number;
  estimatedAlarms: number;
  ethernetDevices: number;
  needsEthernetSwitch: boolean;
  hwKey: keyof typeof HMI_HARDWARE;
  sizeLabel: string;
  reasoning: string;
}

export function sizeHmi(
  m: IoInput,
  io: IoBreakdown,
  plcFamily: "FX5U" | "IQR"
): HmiSizing {
  const screenItems: HmiScreenLine[] = [
    { label: "Main / Auto Operation (status siklus, counter produksi)", qty: 1 },
  ];
  if (m.valveCount > 0) {
    screenItems.push({
      label: `Manual valve / silinder (8 aktuator per layar × ${m.valveCount})`,
      qty: Math.ceil(m.valveCount / 8),
    });
  }
  if (m.servoCount > 0) {
    screenItems.push(
      {
        label: `Jog & Homing servo (2 axis per layar × ${m.servoCount})`,
        qty: Math.ceil(m.servoCount / 2),
      },
      {
        label: `Teaching tabel posisi servo (1 per axis × ${m.servoCount})`,
        qty: m.servoCount,
      }
    );
  }
  if (m.robotCount > 0) {
    screenItems.push({
      label: `Status & handshake robot + pemilihan program (${m.robotCount} robot)`,
      qty: m.robotCount + 1,
    });
  }
  if (m.inverterMotorCount + m.heaterCount > 0) {
    screenItems.push({
      label: "Setting kecepatan inverter / suhu heater",
      qty: 1,
    });
  }
  if (m.analogCount > 0) {
    screenItems.push({ label: "Monitor & trend sensor analog", qty: 1 });
  }
  screenItems.push(
    {
      label: `I/O Monitor (32 titik per layar, ${io.rawDi + io.rawDo} titik)`,
      qty: Math.max(1, Math.ceil((io.rawDi + io.rawDo) / 32)),
    },
    { label: "Alarm aktif & riwayat alarm", qty: 2 },
    { label: "Recipe / parameter mesin & login maintenance", qty: 2 }
  );

  const totalScreens = screenItems.reduce((s, i) => s + i.qty, 0);

  const estimatedTags =
    40 +
    io.rawDi +
    io.rawDo +
    m.valveCount * 2 +
    m.servoCount * 24 +
    m.robotCount * 16 +
    m.analogCount * 4 +
    (m.inverterMotorCount + m.heaterCount) * 6;

  const estimatedAlarms =
    6 +
    m.valveCount * 2 +
    m.servoCount * 3 +
    m.robotCount * 4 +
    m.safetyDeviceCount * 2 +
    (m.inverterMotorCount + m.heaterCount) * 2;

  const ethernetDevices = 2 + m.robotCount; // PLC + HMI + robot controller
  const needsEthernetSwitch = ethernetDevices >= 3;

  let hwKey: keyof typeof HMI_HARDWARE = "GS2107";
  let sizeLabel = "7 inch";
  if (totalScreens > 20 || (plcFamily === "IQR" && m.robotCount >= 2)) {
    hwKey = "GT2510";
    sizeLabel = "10.4 inch (GOT2000)";
  } else if (totalScreens > 10 || m.servoCount >= 3) {
    hwKey = "GS2110";
    sizeLabel = "10 inch";
  }

  const reasoning =
    hwKey === "GS2107"
      ? `Estimasi ${totalScreens} layar & ~${estimatedTags} tag masih ringan, layar 7 inch GS2107 sudah cukup dan paling ekonomis.`
      : hwKey === "GS2110"
        ? `Estimasi ${totalScreens} layar (termasuk teaching posisi servo) dengan ~${estimatedTags} tag — layar 10 inch lebih nyaman untuk tabel posisi & tombol jog.`
        : `Estimasi ${totalScreens} layar & ~${estimatedTags} tag untuk sistem multi-robot/modular — GOT2000 10.4 inch dengan 2 port Ethernet dan memori lebih besar.`;

  return {
    screenItems,
    totalScreens,
    estimatedTags,
    estimatedAlarms,
    ethernetDevices,
    needsEthernetSwitch,
    hwKey,
    sizeLabel,
    reasoning,
  };
}
