export type PlcAddressKind = "DI" | "DO" | "AI" | "AO" | "M" | "D";

export type PlcAddressingSystem =
  | "KEYENCE_KV8000"
  | "PANASONIC_FPWIN_PRO"
  | "FATEK_UPPERLOGIC"
  | "MITSUBISHI_FX5U_OCTAL"
  | "STANDARD_DECIMAL";

export interface ComponentInputForPlc {
  id?: string;
  partType: string;
  partName: string;
  kelompok?: string | null;
  qty: number;
  catatanPr?: string | null;
}

export interface PlcAddressEntry {
  id: string; // Unique ID / key
  kind: PlcAddressKind;
  address: string; // e.g. "X0", "Y10", "AI-CH1", "M10", "D1000"
  numericIndex: number;
  symbol: string; // e.g. "PB_START", "VALVE_1_SOL", "SV1_TARGET_POS"
  wireNo: string; // e.g. "W001", "V-SOL1", "SV1-SON"
  description: string; // e.g. "Tombol Start Siklus Otomatis"
  dataType: "BOOL" | "WORD_16" | "DWORD_32" | "ANALOG_INPUT" | "ANALOG_OUTPUT";
  sourceComponent?: {
    id?: string;
    partType: string;
    partName: string;
    kelompok: string;
  } | null;
  moduleRole?: string | null;
  isCustom?: boolean;
}

export interface PlcAllocationSummary {
  totalDi: number;
  totalDo: number;
  totalAi: number;
  totalAo: number;
  totalM: number;
  totalD: number;
  cpuBuiltInDiCapacity: number;
  cpuBuiltInDoCapacity: number;
  expansionDiRequired: number;
  expansionDoRequired: number;
}

export interface GeneratePlcAddressesOptions {
  system?: PlcAddressingSystem;
  startDi?: number;
  startDo?: number;
  startM?: number;
  startD?: number;
  startAiCh?: number;
  startAoCh?: number;
  cpuModel?: string; // e.g. "FX5U-32M" | "FX5U-80MT"
  includeStandardPanelSignals?: boolean;
}

export interface PlcAddressAllocationResult {
  system: PlcAddressingSystem;
  entries: PlcAddressEntry[];
  summary: PlcAllocationSummary;
  options: Required<GeneratePlcAddressesOptions>;
}

/**
 * Format alamat PLC untuk berbagai vendor utama:
 * - Keyence KV-8000: R000~R015 (DI), R500~R515 (DO), MR (Internal), DM (Data)
 * - Panasonic FPWIN Pro 7: X0~XF (DI Hex), Y0~YF (DO Hex), R (Internal), DT (Data)
 * - Fatek UpperLogic: X0~X255 (DI Desimal), Y0~Y255 (DO Desimal), M (Internal), R/D (Data)
 * - Mitsubishi FX5U: Oktal X/Y, M/D
 * - Standar Desimal: X/Y/M/D Desimal
 */
export function formatPlcAddress(
  kind: PlcAddressKind,
  index: number,
  system: PlcAddressingSystem = "MITSUBISHI_FX5U_OCTAL"
): string {
  if (kind === "DI") {
    if (system === "KEYENCE_KV8000") {
      const slot = Math.floor(index / 16);
      const ch = index % 16;
      return `R${slot * 100 + ch}`; // R000~R015, R100~R115
    }
    if (system === "PANASONIC_FPWIN_PRO") {
      const word = Math.floor(index / 16);
      const bitHex = (index % 16).toString(16).toUpperCase();
      return word === 0 ? `X${bitHex}` : `X${word}${bitHex}`; // X0~XF, X10~X1F
    }
    if (system === "FATEK_UPPERLOGIC") {
      return `X${index}`;
    }
    if (system === "MITSUBISHI_FX5U_OCTAL") {
      return `X${index.toString(8)}`;
    }
    return `X${index}`;
  }
  if (kind === "DO") {
    if (system === "KEYENCE_KV8000") {
      const slot = Math.floor(index / 16);
      const ch = index % 16;
      return `R${500 + slot * 100 + ch}`; // R500~R515, R600~R615
    }
    if (system === "PANASONIC_FPWIN_PRO") {
      const word = Math.floor(index / 16);
      const bitHex = (index % 16).toString(16).toUpperCase();
      return word === 0 ? `Y${bitHex}` : `Y${word}${bitHex}`; // Y0~YF, Y10~Y1F
    }
    if (system === "FATEK_UPPERLOGIC") {
      return `Y${index}`;
    }
    if (system === "MITSUBISHI_FX5U_OCTAL") {
      return `Y${index.toString(8)}`;
    }
    return `Y${index}`;
  }
  if (kind === "M") {
    if (system === "KEYENCE_KV8000") {
      return `MR${index}`;
    }
    if (system === "PANASONIC_FPWIN_PRO") {
      return `R${index}`;
    }
    return `M${index}`;
  }
  if (kind === "D") {
    if (system === "KEYENCE_KV8000") {
      return `DM${index}`;
    }
    if (system === "PANASONIC_FPWIN_PRO") {
      return `DT${index}`;
    }
    if (system === "FATEK_UPPERLOGIC") {
      return `R${index}`;
    }
    return `D${index}`;
  }
  if (kind === "AI") {
    if (system === "KEYENCE_KV8000") {
      return `AI-CH${index} (DM${200 + (index - 1) * 2})`;
    }
    if (system === "PANASONIC_FPWIN_PRO") {
      return `AI-CH${index} (DT${200 + (index - 1) * 2})`;
    }
    if (system === "FATEK_UPPERLOGIC") {
      return `AI-CH${index} (R${3840 + index - 1})`;
    }
    return `AI-CH${index} (D${200 + (index - 1) * 2})`;
  }
  if (kind === "AO") {
    if (system === "KEYENCE_KV8000") {
      return `AO-CH${index} (DM${300 + (index - 1) * 2})`;
    }
    if (system === "PANASONIC_FPWIN_PRO") {
      return `AO-CH${index} (DT${300 + (index - 1) * 2})`;
    }
    return `AO-CH${index} (D${300 + (index - 1) * 2})`;
  }
  return `${kind}${index}`;
}

/**
 * Generator Otomatis Pengelamatan I/O & Register PLC dari daftar komponen PR
 */
export function generatePlcAddressesFromComponents(
  components: ComponentInputForPlc[],
  opts: GeneratePlcAddressesOptions = {}
): PlcAddressAllocationResult {
  const system: PlcAddressingSystem = opts.system ?? "MITSUBISHI_FX5U_OCTAL";
  const startDi = opts.startDi ?? 0;
  const startDo = opts.startDo ?? 0;
  const startM = opts.startM ?? 0;
  const startD = opts.startD ?? 100;
  const startAiCh = opts.startAiCh ?? 1;
  const startAoCh = opts.startAoCh ?? 1;
  const cpuModel = opts.cpuModel ?? "FX5U-32M";
  const includeStandardPanel = opts.includeStandardPanelSignals ?? true;

  const entries: PlcAddressEntry[] = [];

  let currentDi = startDi;
  let currentDo = startDo;
  let currentM = startM;
  let currentD = startD;
  let currentAi = startAiCh;
  let currentAo = startAoCh;

  function addEntry(
    e: Omit<PlcAddressEntry, "id" | "address" | "numericIndex"> & {
      customAddress?: string;
    }
  ) {
    let numIdx = 0;
    if (e.kind === "DI") numIdx = currentDi++;
    else if (e.kind === "DO") numIdx = currentDo++;
    else if (e.kind === "M") numIdx = currentM++;
    else if (e.kind === "D") numIdx = currentD++;
    else if (e.kind === "AI") numIdx = currentAi++;
    else if (e.kind === "AO") numIdx = currentAo++;

    const address = e.customAddress || formatPlcAddress(e.kind, numIdx, system);
    const id = `plc-${e.kind.toLowerCase()}-${numIdx}-${entries.length + 1}`;

    entries.push({
      id,
      kind: e.kind,
      address,
      numericIndex: numIdx,
      symbol: e.symbol,
      wireNo: e.wireNo,
      description: e.description,
      dataType: e.dataType,
      sourceComponent: e.sourceComponent ?? null,
      moduleRole: e.moduleRole ?? null,
      isCustom: e.isCustom ?? false,
    });
  }

  // 1. STANDARD PANEL OPERATOR & TOWER LAMP
  if (includeStandardPanel) {
    addEntry({
      kind: "DI",
      symbol: "PB_START",
      wireNo: "W001",
      description: "Push Button Siklus Otomatis (Start)",
      dataType: "BOOL",
      moduleRole: "Panel Operator",
    });
    addEntry({
      kind: "DI",
      symbol: "PB_STOP",
      wireNo: "W002",
      description: "Push Button Stop Siklus",
      dataType: "BOOL",
      moduleRole: "Panel Operator",
    });
    addEntry({
      kind: "DI",
      symbol: "PB_RESET",
      wireNo: "W003",
      description: "Push Button Reset Alarm & Fault",
      dataType: "BOOL",
      moduleRole: "Panel Operator",
    });
    addEntry({
      kind: "DI",
      symbol: "SS_AUTO_MAN",
      wireNo: "W004",
      description: "Selector Switch Mode Auto / Manual",
      dataType: "BOOL",
      moduleRole: "Panel Operator",
    });
    addEntry({
      kind: "DI",
      symbol: "ESTOP_STATUS",
      wireNo: "W005",
      description: "Auxiliary Feedback Emergency Stop / Safety Circuit Normal",
      dataType: "BOOL",
      moduleRole: "Panel Operator",
    });

    addEntry({
      kind: "DO",
      symbol: "TL_RED_ALARM",
      wireNo: "W101",
      description: "Sign Tower Lamp Merah (Mesin Alarm / E-Stop Active)",
      dataType: "BOOL",
      moduleRole: "OP Tower Lamp",
    });
    addEntry({
      kind: "DO",
      symbol: "TL_YELLOW_IDLE",
      wireNo: "W102",
      description: "Sign Tower Lamp Kuning (Mesin Standby / Pause)",
      dataType: "BOOL",
      moduleRole: "OP Tower Lamp",
    });
    addEntry({
      kind: "DO",
      symbol: "TL_GREEN_RUN",
      wireNo: "W103",
      description: "Sign Tower Lamp Hijau (Mesin Running Siklus Auto)",
      dataType: "BOOL",
      moduleRole: "OP Tower Lamp",
    });
    addEntry({
      kind: "DO",
      symbol: "TL_BUZZER",
      wireNo: "W104",
      description: "Buzzer Peringatan Alarm",
      dataType: "BOOL",
      moduleRole: "OP Tower Lamp",
    });
  }

  // 2. SCAN KOMPONEN PR UNTUK MENGALOKASIKAN I/O & REGISTER
  let valveCounter = 0;
  let servoCounter = 0;
  let robotCounter = 0;
  let sensorCounter = 0;
  let photoCounter = 0;
  let buttonCounter = 0;
  let estopCounter = 0;
  let laserCounter = 0;
  let relayCounter = 0;
  let inverterCounter = 0;
  let analogCounter = 0;
  let heaterCounter = 0;

  for (const comp of components) {
    const rawText =
      `${comp.partType} ${comp.partName} ${comp.kelompok ?? ""} ${comp.catatanPr ?? ""}`.toLowerCase();
    const partOnly = `${comp.partType} ${comp.partName}`.toLowerCase();
    const qty = Math.max(1, comp.qty);

    // 0. ABAIKAN AKSESORIS KABEL, SKUN, TERMINAL, HARDWARE YANG BUKAN I/O PLC
    const isWiringOrHardware =
      /\b(?:skun|sepatu\s*kabel|ferrule|terminal\s*block|terminal\s*strip|kabel|cable|ducting|spiral|conduit|pipa|marker|label|din\s*rail|omega\s*rail|fuse|sekering|mcb|mccb|elcb|psu|power\s*supply|trafo|transformer|socket|box\s*panel|enclosure|fan|filter\s*fan|bracket|spacer|baut|bolt|nut|mur)\b/i;

    // Jika partType sendiri adalah aksesoris (misal "Skun Y", "Kabel NYAF", "Terminal Block")
    // maka mutlak diabaikan meskipun di partName/keterangannya tertulis "untuk Sensor / Push Button"
    if (isWiringOrHardware.test(comp.partType)) {
      continue;
    }

    // Jika partOnly mengandung aksesoris dan bukan diawali / berstatus komponen aktif I/O
    if (
      isWiringOrHardware.test(partOnly) &&
      !/\b(?:sensor|valve|servo|robot|inverter|switch|push\s*b[ou]tton|pushbutton|push\s*botton|tombol|emergency|mergency|estop|e-stop|laser|photo|relay|rele|kontaktor)\b/i.test(
        comp.partType
      )
    ) {
      continue;
    }

    const src = {
      id: comp.id,
      partType: comp.partType,
      partName: comp.partName,
      kelompok: comp.kelompok || "PR Component",
    };

    // A. SOLENOID VALVE / PNEUMATIK
    if (
      /\b(?:valve|solenoid|selenoid|katup|silinder|cylinder|pneumatik|pneumatic|gripper)\b/i.test(
        rawText
      )
    ) {
      for (let i = 1; i <= qty; i++) {
        valveCounter++;
        const vNum = valveCounter;

        // Output Koil Solenoid
        addEntry({
          kind: "DO",
          symbol: `SOL_VALVE_${vNum}`,
          wireNo: `V-SOL${vNum}`,
          description: `Koil Solenoid Valve ${vNum} (${comp.partType})`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Aktuator Pneumatik",
        });

        // Input Reed Switch Silinder (Mundur & Maju)
        addEntry({
          kind: "DI",
          symbol: `CYL_${vNum}_RETRACTED`,
          wireNo: `V-SW${vNum}A`,
          description: `Reed Switch Silinder ${vNum} Posisi Mundur (Home)`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Sensor Silinder",
        });
        addEntry({
          kind: "DI",
          symbol: `CYL_${vNum}_EXTENDED`,
          wireNo: `V-SW${vNum}B`,
          description: `Reed Switch Silinder ${vNum} Posisi Maju (Work Position)`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Sensor Silinder",
        });

        // Internal Bit Relay (HMI Manual Control)
        addEntry({
          kind: "M",
          symbol: `HMI_MAN_VALVE_${vNum}`,
          wireNo: "-",
          description: `Tombol HMI Kontrol Manual Solenoid Valve ${vNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "HMI Control Bit",
        });
      }
      continue;
    }

    // B. MOTOR SERVO / STEPPER
    if (
      /\b(?:servo|motor\s*servo|stepper|mr-j|mr-je|direct\s*drive|rotary\s*table)\b/i.test(
        rawText
      ) &&
      !/\b(?:robot|cobot|scara|safety|relay)\b/i.test(rawText)
    ) {
      for (let i = 1; i <= qty; i++) {
        servoCounter++;
        const sNum = servoCounter;

        // High-Speed Pulse Output FX5U (Pulse & Direction)
        addEntry({
          kind: "DO",
          symbol: `SV${sNum}_PULSE`,
          wireNo: `SV${sNum}-PLS`,
          description: `High-Speed Pulse Train Positioning Motor Servo Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: `Servo Axis ${sNum} Pulse Output`,
        });
        addEntry({
          kind: "DO",
          symbol: `SV${sNum}_DIR`,
          wireNo: `SV${sNum}-DIR`,
          description: `Direction Signal (Arah Putaran) Motor Servo Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: `Servo Axis ${sNum} Pulse Output`,
        });
        addEntry({
          kind: "DO",
          symbol: `SV${sNum}_SERVO_ON`,
          wireNo: `SV${sNum}-SON`,
          description: `Perintah Servo-ON (Enable Driver) Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: `Servo Axis ${sNum} Control`,
        });
        addEntry({
          kind: "DO",
          symbol: `SV${sNum}_ALARM_RESET`,
          wireNo: `SV${sNum}-RST`,
          description: `Perintah Alarm Reset Driver Servo Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: `Servo Axis ${sNum} Control`,
        });

        // Feedback DI Driver & Sensor Limit Axis
        addEntry({
          kind: "DI",
          symbol: `SV${sNum}_READY`,
          wireNo: `SV${sNum}-RDY`,
          description: `Status Driver Servo Axis ${sNum} Siap (Servo Ready)`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: `Servo Axis ${sNum} Feedback`,
        });
        addEntry({
          kind: "DI",
          symbol: `SV${sNum}_IN_POSITION`,
          wireNo: `SV${sNum}-INP`,
          description: `Feedback Selesai Posisi (In-Position) Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: `Servo Axis ${sNum} Feedback`,
        });
        addEntry({
          kind: "DI",
          symbol: `SV${sNum}_ALARM_TRIP`,
          wireNo: `SV${sNum}-ALM`,
          description: `Status Alarm / Fault Driver Servo Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: `Servo Axis ${sNum} Feedback`,
        });
        addEntry({
          kind: "DI",
          symbol: `SV${sNum}_HOME_SENSOR`,
          wireNo: `SV${sNum}-ORG`,
          description: `Sensor Origin / Home Posisi Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: `Sensor Origin Axis ${sNum}`,
        });
        addEntry({
          kind: "DI",
          symbol: `SV${sNum}_POS_LIMIT`,
          wireNo: `SV${sNum}-FLS`,
          description: `Sensor Hardware Forward Limit Switch Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: `Hardware Limit Axis ${sNum}`,
        });
        addEntry({
          kind: "DI",
          symbol: `SV${sNum}_REV_LIMIT`,
          wireNo: `SV${sNum}-RLS`,
          description: `Sensor Hardware Reverse Limit Switch Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: `Hardware Limit Axis ${sNum}`,
        });

        // HMI Control Bits (M)
        addEntry({
          kind: "M",
          symbol: `HMI_SV${sNum}_JOG_FWD`,
          wireNo: "-",
          description: `Tombol Jog Maju (+) Axis ${sNum} pada Layar HMI`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "HMI Jog Bit",
        });
        addEntry({
          kind: "M",
          symbol: `HMI_SV${sNum}_JOG_REV`,
          wireNo: "-",
          description: `Tombol Jog Mundur (-) Axis ${sNum} pada Layar HMI`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "HMI Jog Bit",
        });
        addEntry({
          kind: "M",
          symbol: `HMI_SV${sNum}_EXECUTE_POS`,
          wireNo: "-",
          description: `Trigger Eksekusi Positioning Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "HMI Trigger Bit",
        });
        addEntry({
          kind: "M",
          symbol: `HMI_SV${sNum}_START_HOMING`,
          wireNo: "-",
          description: `Trigger Homing / Origin Return Axis ${sNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "HMI Trigger Bit",
        });

        // Data Registers (D)
        const dTargetPos = currentD;
        addEntry({
          kind: "D",
          symbol: `SV${sNum}_TARGET_POS_L`,
          wireNo: "-",
          description: `Target Posisi Axis ${sNum} (32-bit D${dTargetPos}-D${dTargetPos + 1} Lower Word)`,
          dataType: "DWORD_32",
          sourceComponent: src,
          moduleRole: "Positioning Data",
        });
        addEntry({
          kind: "D",
          symbol: `SV${sNum}_TARGET_POS_H`,
          wireNo: "-",
          description: `Target Posisi Axis ${sNum} (32-bit D${dTargetPos}-D${dTargetPos + 1} Upper Word)`,
          dataType: "DWORD_32",
          sourceComponent: src,
          moduleRole: "Positioning Data",
        });

        const dTargetSpd = currentD;
        addEntry({
          kind: "D",
          symbol: `SV${sNum}_TARGET_SPEED_L`,
          wireNo: "-",
          description: `Target Kecepatan Axis ${sNum} (32-bit D${dTargetSpd}-D${dTargetSpd + 1} Lower)`,
          dataType: "DWORD_32",
          sourceComponent: src,
          moduleRole: "Speed Data",
        });
        addEntry({
          kind: "D",
          symbol: `SV${sNum}_TARGET_SPEED_H`,
          wireNo: "-",
          description: `Target Kecepatan Axis ${sNum} (32-bit D${dTargetSpd}-D${dTargetSpd + 1} Upper)`,
          dataType: "DWORD_32",
          sourceComponent: src,
          moduleRole: "Speed Data",
        });

        const dCurPos = currentD;
        addEntry({
          kind: "D",
          symbol: `SV${sNum}_ACTUAL_POS_L`,
          wireNo: "-",
          description: `Feedback Posisi Aktual Axis ${sNum} (32-bit D${dCurPos}-D${dCurPos + 1} Lower)`,
          dataType: "DWORD_32",
          sourceComponent: src,
          moduleRole: "Feedback Monitor",
        });
        addEntry({
          kind: "D",
          symbol: `SV${sNum}_ACTUAL_POS_H`,
          wireNo: "-",
          description: `Feedback Posisi Aktual Axis ${sNum} (32-bit D${dCurPos}-D${dCurPos + 1} Upper)`,
          dataType: "DWORD_32",
          sourceComponent: src,
          moduleRole: "Feedback Monitor",
        });

        addEntry({
          kind: "D",
          symbol: `SV${sNum}_JOG_SPEED`,
          wireNo: "-",
          description: `Kecepatan Jog Manual Axis ${sNum} (Hz / rpm)`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "Speed Data",
        });
        addEntry({
          kind: "D",
          symbol: `SV${sNum}_ERROR_CODE`,
          wireNo: "-",
          description: `Kode Error / Alarm Driver Servo Axis ${sNum}`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "Diagnostic Data",
        });
      }
      continue;
    }

    // B. ROBOT CONTROLLER (Evaluasi sebelum servo agar robot 6-axis tidak tertukar)
    if (
      /\b(?:robot|yaskawa|fanuc|abb|kawasaki|kuka|motoman|ur\d+|cobot)\b/i.test(
        rawText
      )
    ) {
      for (let i = 1; i <= qty; i++) {
        robotCounter++;
        const rNum = robotCounter;

        // DI: Handshake Masuk dari Robot ke PLC
        addEntry({
          kind: "DI",
          symbol: `ROBOT${rNum}_RUNNING`,
          wireNo: `RB${rNum}-DI01`,
          description: `Status Robot ${rNum} Sedang Beroperasi (Cycle Running)`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Input",
        });
        addEntry({
          kind: "DI",
          symbol: `ROBOT${rNum}_HOME_POS`,
          wireNo: `RB${rNum}-DI02`,
          description: `Robot ${rNum} Telah di Posisi Home / Standby Aman`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Input",
        });
        addEntry({
          kind: "DI",
          symbol: `ROBOT${rNum}_ALARM_FAULT`,
          wireNo: `RB${rNum}-DI03`,
          description: `Robot ${rNum} Mengalami Alarm / E-Stop Interlock Trip`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Input",
        });
        addEntry({
          kind: "DI",
          symbol: `ROBOT${rNum}_SERVO_ON_FB`,
          wireNo: `RB${rNum}-DI04`,
          description: `Feedback Daya Motor Robot ${rNum} Aktif (Servo ON)`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Input",
        });
        addEntry({
          kind: "DI",
          symbol: `ROBOT${rNum}_AREA_PERMIT`,
          wireNo: `RB${rNum}-DI05`,
          description: `Robot ${rNum} Memberikan Izin Mesin Memasuki Interlock Area`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Input",
        });
        addEntry({
          kind: "DI",
          symbol: `ROBOT${rNum}_CYCLE_DONE`,
          wireNo: `RB${rNum}-DI06`,
          description: `Robot ${rNum} Telah Menyelesaikan 1 Siklus Pengerjaan`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Input",
        });

        // DO: Perintah Keluar dari PLC ke Robot
        addEntry({
          kind: "DO",
          symbol: `ROBOT${rNum}_CMD_START`,
          wireNo: `RB${rNum}-DO01`,
          description: `Perintah Start Siklus Kerja Robot ${rNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Output",
        });
        addEntry({
          kind: "DO",
          symbol: `ROBOT${rNum}_CMD_HOLD`,
          wireNo: `RB${rNum}-DO02`,
          description: `Perintah Pause / Hold Siklus Robot ${rNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Output",
        });
        addEntry({
          kind: "DO",
          symbol: `ROBOT${rNum}_CMD_RESET`,
          wireNo: `RB${rNum}-DO03`,
          description: `Perintah Reset Alarm Robot Controller ${rNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Output",
        });
        addEntry({
          kind: "DO",
          symbol: `ROBOT${rNum}_AREA_CLEAR`,
          wireNo: `RB${rNum}-DO04`,
          description: `Sinyal Konfirmasi Area Kerja Bebas & Aman untuk Robot ${rNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Output",
        });
        addEntry({
          kind: "DO",
          symbol: `ROBOT${rNum}_JOB_SEL_BIT0`,
          wireNo: `RB${rNum}-DO05`,
          description: `Bit Pemilihan Nomor Job Program Robot ${rNum} (Bit 0)`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Output",
        });
        addEntry({
          kind: "DO",
          symbol: `ROBOT${rNum}_JOB_SEL_BIT1`,
          wireNo: `RB${rNum}-DO06`,
          description: `Bit Pemilihan Nomor Job Program Robot ${rNum} (Bit 1)`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Handshake Output",
        });

        // Memory Bit & Registers
        addEntry({
          kind: "M",
          symbol: `HMI_RB${rNum}_AUTO_ENABLE`,
          wireNo: "-",
          description: `Enable Siklus Otomatis Robot ${rNum} dari Layar HMI`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Robot Control Bit",
        });
        addEntry({
          kind: "D",
          symbol: `RB${rNum}_JOB_NUMBER`,
          wireNo: "-",
          description: `Nomor Resep / Varian Program Job Robot ${rNum}`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "Robot Parameters",
        });
        addEntry({
          kind: "D",
          symbol: `RB${rNum}_CYCLE_TIME_MS`,
          wireNo: "-",
          description: `Monitor Durasi Siklus Aktual Robot ${rNum} (ms)`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "Robot Monitor",
        });
      }
      continue;
    }

    // D. INVERTER / VFD MOTOR CONVEYOR
    if (
      /\b(?:inverter|vfd|freqrol|conveyor|konveyor|pompa|blower|motor\s*ac|motor\s*induksi)\b/i.test(
        rawText
      ) &&
      !/\b(?:servo)\b/i.test(rawText)
    ) {
      for (let i = 1; i <= qty; i++) {
        inverterCounter++;
        const invNum = inverterCounter;

        addEntry({
          kind: "DO",
          symbol: `INV${invNum}_RUN_FWD`,
          wireNo: `INV${invNum}-STF`,
          description: `Perintah Putar Maju Inverter Motor ${invNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Inverter Output",
        });
        addEntry({
          kind: "DO",
          symbol: `INV${invNum}_FAULT_RESET`,
          wireNo: `INV${invNum}-RES`,
          description: `Perintah Reset Fault Inverter Motor ${invNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Inverter Output",
        });

        addEntry({
          kind: "DI",
          symbol: `INV${invNum}_RUNNING_FB`,
          wireNo: `INV${invNum}-RUN`,
          description: `Feedback Status Inverter Motor ${invNum} Sedang Berputar`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Inverter Input",
        });
        addEntry({
          kind: "DI",
          symbol: `INV${invNum}_ALARM_TRIP`,
          wireNo: `INV${invNum}-ALM`,
          description: `Feedback Sinyal Fault / Trip Inverter Motor ${invNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Inverter Input",
        });

        addEntry({
          kind: "AO",
          symbol: `INV${invNum}_FREQ_REF`,
          wireNo: `INV${invNum}-10V`,
          description: `Referensi Frekuensi Analog Inverter Motor ${invNum} (0 - 50.00 Hz)`,
          dataType: "ANALOG_OUTPUT",
          sourceComponent: src,
          moduleRole: "Inverter Speed Analog",
        });
      }
      continue;
    }

    // E. SENSOR LASER / SENSOR DIFFUSE (Sinyal Digital Input 1/0 Diskrit)
    // Sesuai standar industri SPM: sensor diffuse / laser sensor (seperti Keyence LR-Z / LR-T / HG-C)
    // mengeluarkan sinyal switching diskrit 1/0 (ON/OFF) yang masuk ke terminal Digital Input (DI) PLC.
    if (
      /\b(?:laser|diffuse|keyence\s*lr|lr-z|lr-t|hg-c|optex\s*cd)\b/i.test(
        partOnly
      ) ||
      /\b(?:laser|diffuse)\b/i.test(rawText)
    ) {
      for (let i = 1; i <= qty; i++) {
        laserCounter++;
        const lNum = laserCounter;

        // Digital Input (DI): Switching / Threshold Detection Part (Sinyal 1/0)
        addEntry({
          kind: "DI",
          symbol: `LASER_DETECT_${lNum}`,
          wireNo: `LS0${lNum}`,
          description: `Sensor Laser Diffuse / Deteksi Part ${lNum} (${comp.partType}) - Sinyal 1/0`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Laser Sensor Diffuse (DI 1/0)",
        });
      }
      continue;
    }

    // F. ANALOG SENSOR PRESISI LAINNYA (Load Cell, Timbangan, Pressure Sensor, Vacuum Sensor)
    if (
      /\b(?:load\s*cell|timbangan|pressure\s*sensor|vacuum\s*sensor|analog|0-10v|4-20ma)\b/i.test(
        rawText
      )
    ) {
      for (let i = 1; i <= qty; i++) {
        analogCounter++;
        const aNum = analogCounter;

        addEntry({
          kind: "AI",
          symbol: `AI_CH${aNum}_RAW`,
          wireNo: `AI${aNum}-IN`,
          description: `Sinyal Analog Input Channel ${aNum} (${comp.partType} - 0-4000 digit)`,
          dataType: "ANALOG_INPUT",
          sourceComponent: src,
          moduleRole: "Analog Input",
        });
        addEntry({
          kind: "D",
          symbol: `AI_CH${aNum}_SCALED`,
          wireNo: "-",
          description: `Nilai Terkalibrasi Engineering Unit Sensor ${aNum} (bar / kg / psi)`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "Analog Scaled Data",
        });
        addEntry({
          kind: "D",
          symbol: `AI_CH${aNum}_HI_SETPOINT`,
          wireNo: "-",
          description: `Batas Ambang Atas (High Alarm Setpoint) Sensor ${aNum}`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "Alarm Setpoint",
        });
        addEntry({
          kind: "D",
          symbol: `AI_CH${aNum}_LO_SETPOINT`,
          wireNo: "-",
          description: `Batas Ambang Bawah (Low Alarm Setpoint) Sensor ${aNum}`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "Alarm Setpoint",
        });
      }
      continue;
    }

    // G. TEMPERATURE CONTROLLER / PID HEATER
    if (/\b(?:heater|pemanas|pid|tcn4s|temperature|suhu|oven|sealing)\b/i.test(rawText)) {
      for (let i = 1; i <= qty; i++) {
        heaterCounter++;
        const hNum = heaterCounter;

        addEntry({
          kind: "DO",
          symbol: `HEATER_${hNum}_SSR_ENABLE`,
          wireNo: `HTR${hNum}-ON`,
          description: `Kontrol Solid State Relay (SSR) Heater Zona ${hNum}`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Heater Output",
        });
        addEntry({
          kind: "D",
          symbol: `PID${hNum}_PV_TEMP`,
          wireNo: "-",
          description: `Monitor Suhu Aktual (Process Value) Heater Zona ${hNum} (°C)`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "PID Temperature",
        });
        addEntry({
          kind: "D",
          symbol: `PID${hNum}_SV_TEMP`,
          wireNo: "-",
          description: `Setting Suhu Target (Set Value) Heater Zona ${hNum} (°C)`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "PID Temperature",
        });
      }
      continue;
    }

    // H. SAFETY LIGHT CURTAIN & DOOR INTERLOCK (DI)
    if (
      /\b(?:light\s*curtain|safety\s*door|door\s*interlock|f3sg|d4ns|xn4e)\b/i.test(
        rawText
      )
    ) {
      for (let i = 1; i <= qty; i++) {
        const isCurtain = /light\s*curtain|f3sg/i.test(rawText);
        addEntry({
          kind: "DI",
          symbol: isCurtain ? "LIGHT_CURTAIN_OK" : "DOOR_INTERLOCK_CLOSED",
          wireNo: isCurtain ? "SAF-LC01" : "SAF-DR01",
          description: isCurtain
            ? `Output OSSD Safety Light Curtain Status Normal (${comp.partType})`
            : `Safety Door Interlock Pintu Pagar Tertutup (${comp.partType})`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Safety Circuit (DI)",
        });
      }
      continue;
    }

    // I. EMERGENCY STOP / E-STOP (DI)
    if (
      /\b(?:e(?:mergency)?\s*stop|estop|e-stop|mergency\s*stop|tombol\s*darurat|avw411|xme)\b/i.test(
        partOnly
      ) ||
      /\b(?:e(?:mergency)?\s*stop|estop|e-stop|mergency\s*stop)\b/i.test(comp.catatanPr ?? "")
    ) {
      for (let i = 1; i <= qty; i++) {
        estopCounter++;
        const esNum = estopCounter;
        addEntry({
          kind: "DI",
          symbol: `ESTOP_INPUT_${esNum}`,
          wireNo: `ES0${esNum}`,
          description: `Kontak NC Auxiliary Feedback Emergency Stop ${esNum} (${comp.partType})`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Emergency Stop Circuit (DI)",
        });
      }
      continue;
    }

    // J. PUSH BUTTON & SELECTOR SWITCH OPERATOR (DI)
    if (
      /\b(?:push\s*b[ou]tton|pushbutton|push\s*botton|illuminated\s*pb|tombol|selector\s*switch|rotary\s*switch|key\s*switch|ar22|ar30|la115|lay5|xb4|xb5)\b/i.test(
        partOnly
      ) ||
      /\b(?:push\s*b[ou]tton|pushbutton|push\s*botton)\b/i.test(comp.catatanPr ?? "")
    ) {
      for (let i = 1; i <= qty; i++) {
        buttonCounter++;
        const bNum = buttonCounter;

        let suffix = `PB_INPUT_${bNum}`;
        const combined = `${partOnly} ${comp.catatanPr ?? ""}`.toLowerCase();
        if (/hijau|green|start|jalan/i.test(combined)) {
          suffix = `PB_HIJAU_${bNum}`;
        } else if (/merah|red|stop|berhenti/i.test(combined)) {
          suffix = `PB_MERAH_${bNum}`;
        } else if (/kuning|yellow|reset/i.test(combined)) {
          suffix = `PB_KUNING_${bNum}`;
        } else if (/biru|blue/i.test(combined)) {
          suffix = `PB_BIRU_${bNum}`;
        } else if (/hitam|black|jog/i.test(combined)) {
          suffix = `PB_HITAM_${bNum}`;
        } else if (/selector|rotary|switch|auto\s*man/i.test(combined)) {
          suffix = `SS_MODE_${bNum}`;
        }

        addEntry({
          kind: "DI",
          symbol: suffix,
          wireNo: `PB0${bNum}`,
          description: `Push Button Operator ${comp.partType} (#${bNum})`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Panel Operator Push Button (DI)",
        });
      }
      continue;
    }

    // K. SENSOR PHOTOELECTRIC / PHOTO SENSOR & PROXIMITY UMUM (DI)
    if (
      /\b(?:proximity|prox|photoelectric|photo\s*sensor|photosensor|sensor|limit\s*switch|micro\s*switch|omron\s*e2e|autonics\s*pr|e3z|e3fa|ben5m|pr12|pr18|e2e)\b/i.test(
        partOnly
      ) ||
      /\b(?:photo\s*sensor|photosensor|photoelectric|proximity|sensor)\b/i.test(
        comp.catatanPr ?? ""
      )
    ) {
      for (let i = 1; i <= qty; i++) {
        const isPhoto = /\b(?:photo\s*sensor|photosensor|photoelectric|e3z|e3fa|ben5m)\b/i.test(
          `${partOnly} ${comp.catatanPr ?? ""}`
        );

        if (isPhoto) {
          photoCounter++;
          const pNum = photoCounter;
          addEntry({
            kind: "DI",
            symbol: `PHOTO_SENSOR_${pNum}`,
            wireNo: `PE0${pNum}`,
            description: `Photoelectric Sensor Deteksi Part ${pNum} (${comp.partType})`,
            dataType: "BOOL",
            sourceComponent: src,
            moduleRole: "Photoelectric Sensor (DI)",
          });
        } else {
          sensorCounter++;
          const senNum = sensorCounter;
          addEntry({
            kind: "DI",
            symbol: `SENSOR_${senNum}_INPUT`,
            wireNo: `S${senNum}`,
            description: `Sensor Deteksi Part / Benda Kerja ${senNum} (${comp.partType})`,
            dataType: "BOOL",
            sourceComponent: src,
            moduleRole: "Sensor Part (DI)",
          });
        }
      }
      continue;
    }

    // L. RELAY (DO untuk Koil Relay Umum seperti MY2N/MY4N/G2R, DI untuk Safety Relay Feedback)
    if (
      /\b(?:relay|rele|safety\s*relay|my2n|my4n|my2nj|my4nj|ly2n|ly4n|g2r|g9se|pnoz|solid\s*state\s*relay|ssr)\b/i.test(
        partOnly
      ) ||
      /\b(?:relay|rele)\b/i.test(comp.catatanPr ?? "")
    ) {
      for (let i = 1; i <= qty; i++) {
        relayCounter++;
        const rNum = relayCounter;

        const isSafetyRelay = /\b(?:safety|g9se|pnoz)\b/i.test(
          `${partOnly} ${comp.catatanPr ?? ""}`
        );

        if (isSafetyRelay) {
          // Safety Relay feedback kontak NO/NC dibaca oleh Input PLC (DI)
          addEntry({
            kind: "DI",
            symbol: `SAFETY_RELAY_FB_${rNum}`,
            wireNo: `SR-FB0${rNum}`,
            description: `Feedback Status Aktif Safety Relay ${rNum} (${comp.partType})`,
            dataType: "BOOL",
            sourceComponent: src,
            moduleRole: "Safety Relay Circuit (DI)",
          });
        } else {
          // Relay Umum (Omron MY2N, MY4N, G2R, SSR, dll) dikontrol koilnya oleh Output PLC (DO)
          addEntry({
            kind: "DO",
            symbol: `RELAY_OUT_${rNum}`,
            wireNo: `RY-OUT0${rNum}`,
            description: `Koil Output Relay ${rNum} (${comp.partType}) — Trigger Interposing / Beban`,
            dataType: "BOOL",
            sourceComponent: src,
            moduleRole: "Relay Output (DO)",
          });
        }
      }
      continue;
    }

    // L2. KONTAKTOR / CONTACTOR (DO koil + DI kontak auxiliary)
    if (
      /\b(?:kontaktor|contactor|mc\s*\d+|magnetic\s*contactor)\b/i.test(
        partOnly
      ) ||
      /\b(?:kontaktor|contactor)\b/i.test(comp.catatanPr ?? "")
    ) {
      for (let i = 1; i <= qty; i++) {
        relayCounter++;
        const rNum = relayCounter;

        // DO: Koil Kontaktor (PLC output untuk mengaktifkan)
        addEntry({
          kind: "DO",
          symbol: `MC_COIL_${rNum}`,
          wireNo: `MC${rNum}-COIL`,
          description: `Koil Kontaktor ${rNum} (${comp.partType}) — Aktifkan Motor / Beban`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Contactor Output (DO)",
        });

        // DI: Kontak Auxiliary NO Feedback
        addEntry({
          kind: "DI",
          symbol: `MC_AUX_FB_${rNum}`,
          wireNo: `MC${rNum}-AUX`,
          description: `Kontak Auxiliary Feedback NO Kontaktor ${rNum} — Status ON/OFF`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Contactor Feedback (DI)",
        });
      }
      continue;
    }

    // M. ROTARY ENCODER (DI atau D register high-speed counter)
    if (
      /\b(?:encoder|rotary\s*encoder|incremental\s*encoder|absolute\s*encoder|e6b2|e6c2|autonics\s*e|hes\s*\d+|pnp.*encoder)\b/i.test(
        partOnly
      )
    ) {
      for (let i = 1; i <= qty; i++) {
        sensorCounter++;
        const senNum = sensorCounter;

        addEntry({
          kind: "DI",
          symbol: `ENC_A_${senNum}`,
          wireNo: `ENC${senNum}-A`,
          description: `Phase A Pulse Rotary Encoder ${senNum} (${comp.partType}) — High-Speed Input`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Encoder High-Speed (DI)",
        });
        addEntry({
          kind: "DI",
          symbol: `ENC_B_${senNum}`,
          wireNo: `ENC${senNum}-B`,
          description: `Phase B Pulse Rotary Encoder ${senNum} (${comp.partType}) — High-Speed Input`,
          dataType: "BOOL",
          sourceComponent: src,
          moduleRole: "Encoder High-Speed (DI)",
        });
        addEntry({
          kind: "D",
          symbol: `ENC_COUNT_${senNum}`,
          wireNo: "-",
          description: `Register Counter Posisi Encoder ${senNum} (Pulse Count / Absolute Position)`,
          dataType: "DWORD_32",
          sourceComponent: src,
          moduleRole: "Encoder Position Data",
        });
      }
      continue;
    }

    // N. HMI / TOUCHSCREEN (Registers D untuk komunikasi data)
    if (
      /\b(?:hmi|touchscreen|touch\s*panel|weintek|proface|pro-face|got2000|got1000|ns\d+|nt\d+|gt\d+|mt8000|ea9000|kinco)\b/i.test(
        partOnly
      )
    ) {
      for (let i = 1; i <= qty; i++) {
        addEntry({
          kind: "D",
          symbol: `HMI_RECIPE_NO`,
          wireNo: "-",
          description: `Nomor Resep / Produk Aktif yang Dipilih Operator dari Layar HMI`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "HMI Communication D",
        });
        addEntry({
          kind: "D",
          symbol: `HMI_ALARM_CODE`,
          wireNo: "-",
          description: `Kode Alarm Aktif yang Ditampilkan di HMI (0 = Normal)`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "HMI Communication D",
        });
        addEntry({
          kind: "D",
          symbol: `HMI_CYCLE_TIME_MS`,
          wireNo: "-",
          description: `Durasi Siklus Aktual Mesin yang Ditampilkan di HMI (ms)`,
          dataType: "WORD_16",
          sourceComponent: src,
          moduleRole: "HMI Communication D",
        });
      }
      continue;
    }
  } // end: for (const comp of components)

  // 3. REGISTER GLOBAL SISTEM & HMI
  addEntry({
    kind: "D",
    symbol: "SYS_PRODUCT_COUNTER",
    wireNo: "-",
    description: "Counter Total Produk Bagus (OK) yang Telah Diproduksi",
    dataType: "WORD_16",
    moduleRole: "System Global",
  });
  addEntry({
    kind: "D",
    symbol: "SYS_REJECT_COUNTER",
    wireNo: "-",
    description: "Counter Total Produk Reject (NG)",
    dataType: "WORD_16",
    moduleRole: "System Global",
  });
  addEntry({
    kind: "D",
    symbol: "SYS_CYCLE_TIME_ACTUAL",
    wireNo: "-",
    description: "Durasi Waktu Siklus Mesin Aktual (0.1 detik)",
    dataType: "WORD_16",
    moduleRole: "System Global",
  });
  addEntry({
    kind: "D",
    symbol: "SYS_RECIPE_ACTIVE",
    wireNo: "-",
    description: "Nomor Resep / Varian Produk Aktif",
    dataType: "WORD_16",
    moduleRole: "System Global",
  });
  addEntry({
    kind: "M",
    symbol: "SYS_ALL_HOME_DONE",
    wireNo: "-",
    description: "Interlock Konfirmasi Seluruh Sumbu & Silinder di Posisi Home",
    dataType: "BOOL",
    moduleRole: "System Global",
  });
  addEntry({
    kind: "M",
    symbol: "SYS_GLOBAL_ALARM",
    wireNo: "-",
    description: "Global Flag Status Mesin Mengalami Alarm / Interlock Terputus",
    dataType: "BOOL",
    moduleRole: "System Global",
  });

  // 4. URUTKAN & PISAHKAN BERDASARKAN KATEGORI (DI SEMUA DULU, LALU DO SEMUA, AI, AO, M, D)
  const KIND_ORDER: Record<PlcAddressKind, number> = {
    DI: 1,
    DO: 2,
    AI: 3,
    AO: 4,
    M: 5,
    D: 6,
  };

  entries.sort((a, b) => {
    const diff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (diff !== 0) return diff;
    return a.numericIndex - b.numericIndex;
  });

  // 5. HITUNG RINGKASAN UTILISASI
  let totalDi = 0;
  let totalDo = 0;
  let totalAi = 0;
  let totalAo = 0;
  let totalM = 0;
  let totalD = 0;

  for (const item of entries) {
    if (item.kind === "DI") totalDi++;
    else if (item.kind === "DO") totalDo++;
    else if (item.kind === "AI") totalAi++;
    else if (item.kind === "AO") totalAo++;
    else if (item.kind === "M") totalM++;
    else if (item.kind === "D") totalD++;
  }

  // Kapasitas built-in CPU
  const is80 = cpuModel.includes("80");
  const cpuBuiltInDiCapacity = is80 ? 40 : 16;
  const cpuBuiltInDoCapacity = is80 ? 40 : 16;

  const expansionDiRequired = Math.max(0, totalDi - cpuBuiltInDiCapacity);
  const expansionDoRequired = Math.max(0, totalDo - cpuBuiltInDoCapacity);

  const summary: PlcAllocationSummary = {
    totalDi,
    totalDo,
    totalAi,
    totalAo,
    totalM,
    totalD,
    cpuBuiltInDiCapacity,
    cpuBuiltInDoCapacity,
    expansionDiRequired,
    expansionDoRequired,
  };

  return {
    system,
    entries,
    summary,
    options: {
      system,
      startDi,
      startDo,
      startM,
      startD,
      startAiCh,
      startAoCh,
      cpuModel,
      includeStandardPanelSignals: includeStandardPanel,
    },
  };
}
