import { describe, expect, it } from "vitest";
import { buildPlcAddressWorkbook } from "@/lib/export/plc-address-exporter";
import {
  formatPlcAddress,
  generatePlcAddressesFromComponents,
  type ComponentInputForPlc,
} from "@/lib/plc-address-allocator";

describe("PLC Address & Register Allocator (Pengelamatan I/O & Register PLC)", () => {
  it("memformat alamat Mitsubishi FX5U sistem oktal secara tepat (X0-X7, X10-X17)", () => {
    expect(formatPlcAddress("DI", 0)).toBe("X0");
    expect(formatPlcAddress("DI", 7)).toBe("X7");
    expect(formatPlcAddress("DI", 8)).toBe("X10");
    expect(formatPlcAddress("DI", 15)).toBe("X17");
    expect(formatPlcAddress("DI", 16)).toBe("X20");

    expect(formatPlcAddress("DO", 0)).toBe("Y0");
    expect(formatPlcAddress("DO", 7)).toBe("Y7");
    expect(formatPlcAddress("DO", 8)).toBe("Y10");
    expect(formatPlcAddress("DO", 15)).toBe("Y17");

    expect(formatPlcAddress("M", 10)).toBe("M10");
    expect(formatPlcAddress("D", 500)).toBe("D500");
    expect(formatPlcAddress("AI", 1)).toBe("AI-CH1 (D200)");
  });

  it("otomatis membagi alamat I/O (Input, Output, AI, AO) dan Register dari komponen PR", () => {
    const mockPrComponents: ComponentInputForPlc[] = [
      {
        partType: "SMC SY5120-5LZD-01",
        partName: "Solenoid Valve 5/2 Single 24VDC",
        kelompok: "Pneumatik",
        qty: 3,
      },
      {
        partType: "Mitsubishi MR-JE-40A",
        partName: "Motor Servo & Driver 400W Pulse",
        kelompok: "Aktuator & Motor",
        qty: 2,
      },
      {
        partType: "Yaskawa GP8",
        partName: "Robot 6-Axis Industrial",
        kelompok: "Robotik",
        qty: 1,
      },
      {
        partType: "Load Cell Transducer",
        partName: "Analog Sensor Presisi 0-10V",
        kelompok: "Sensor Presisi",
        qty: 1,
      },
      {
        partType: "Mitsubishi FR-D720-0.75K",
        partName: "Inverter VFD 3-Phasa",
        kelompok: "Inverter",
        qty: 1,
      },
    ];

    const result = generatePlcAddressesFromComponents(mockPrComponents, {
      system: "MITSUBISHI_FX5U_OCTAL",
      cpuModel: "FX5U-80MT",
    });

    expect(result.entries.length).toBeGreaterThan(30);

    // 1. Digital Input (DI)
    const diList = result.entries.filter((e) => e.kind === "DI");
    expect(diList.length).toBeGreaterThanOrEqual(20);
    // Verifikasi ada tombol panel, reed switch valve, feedback servo, dan handshake robot
    expect(diList.some((e) => e.symbol === "PB_START")).toBe(true);
    expect(diList.some((e) => e.symbol === "CYL_1_RETRACTED")).toBe(true);
    expect(diList.some((e) => e.symbol === "CYL_3_EXTENDED")).toBe(true);
    expect(diList.some((e) => e.symbol === "SV1_READY")).toBe(true);
    expect(diList.some((e) => e.symbol === "SV2_IN_POSITION")).toBe(true);
    expect(diList.some((e) => e.symbol === "ROBOT1_RUNNING")).toBe(true);
    expect(diList.some((e) => e.symbol === "INV1_RUNNING_FB")).toBe(true);

    // 2. Digital Output (DO)
    const doList = result.entries.filter((e) => e.kind === "DO");
    expect(doList.length).toBeGreaterThanOrEqual(15);
    // Verifikasi ada tower lamp, koil valve, pulse/dir servo, dan perintah start robot
    expect(doList.some((e) => e.symbol === "TL_GREEN_RUN")).toBe(true);
    expect(doList.some((e) => e.symbol === "SOL_VALVE_1")).toBe(true);
    expect(doList.some((e) => e.symbol === "SOL_VALVE_3")).toBe(true);
    expect(doList.some((e) => e.symbol === "SV1_PULSE")).toBe(true);
    expect(doList.some((e) => e.symbol === "SV2_DIR")).toBe(true);
    expect(doList.some((e) => e.symbol === "ROBOT1_CMD_START")).toBe(true);
    expect(doList.some((e) => e.symbol === "INV1_RUN_FWD")).toBe(true);

    // 3. Analog Input (AI) & Analog Output (AO)
    const aiList = result.entries.filter((e) => e.kind === "AI");
    expect(aiList).toHaveLength(1);
    expect(aiList[0].symbol).toBe("AI_CH1_RAW");
    expect(aiList[0].sourceComponent?.partType).toContain("Load Cell Transducer");

    const aoList = result.entries.filter((e) => e.kind === "AO");
    expect(aoList).toHaveLength(1);
    expect(aoList[0].symbol).toBe("INV1_FREQ_REF");

    // 4. Memory Bit (M) & Data Register (D)
    const mList = result.entries.filter((e) => e.kind === "M");
    expect(mList.some((e) => e.symbol === "HMI_MAN_VALVE_1")).toBe(true);
    expect(mList.some((e) => e.symbol === "HMI_SV1_JOG_FWD")).toBe(true);
    expect(mList.some((e) => e.symbol === "HMI_RB1_AUTO_ENABLE")).toBe(true);

    const dList = result.entries.filter((e) => e.kind === "D");
    expect(dList.some((e) => e.symbol === "SV1_TARGET_POS_L")).toBe(true);
    expect(dList.some((e) => e.symbol === "SV2_TARGET_SPEED_L")).toBe(true);
    expect(dList.some((e) => e.symbol === "AI_CH1_SCALED")).toBe(true);
    expect(dList.some((e) => e.symbol === "SYS_PRODUCT_COUNTER")).toBe(true);

    // Verifikasi ringkasan
    expect(result.summary.totalDi).toBe(diList.length);
    expect(result.summary.totalDo).toBe(doList.length);
    expect(result.summary.totalAi).toBe(1);
    expect(result.summary.totalAo).toBe(1);

    // 5. Verifikasi Pemisahan Kategori: Semua DI berurutan, lalu DO berurutan, AI, AO, M, D
    const kindsSequence = result.entries.map((e) => e.kind);
    const lastDiIndex = kindsSequence.lastIndexOf("DI");
    const firstDoIndex = kindsSequence.indexOf("DO");
    const lastDoIndex = kindsSequence.lastIndexOf("DO");
    const firstAiIndex = kindsSequence.indexOf("AI");
    const lastAiIndex = kindsSequence.lastIndexOf("AI");
    const firstAoIndex = kindsSequence.indexOf("AO");
    const lastAoIndex = kindsSequence.lastIndexOf("AO");
    const firstMIndex = kindsSequence.indexOf("M");
    const lastMIndex = kindsSequence.lastIndexOf("M");
    const firstDIndex = kindsSequence.indexOf("D");

    expect(lastDiIndex).toBeLessThan(firstDoIndex);
    expect(lastDoIndex).toBeLessThan(firstAiIndex);
    expect(lastAiIndex).toBeLessThan(firstAoIndex);
    expect(lastAoIndex).toBeLessThan(firstMIndex);
    expect(lastMIndex).toBeLessThan(firstDIndex);
  });

  it("menghasilkan workbook Excel format 5-kolom bersih (NO, ALAMAT PLC, SIMBOL, TIPE DATA, FUNGSI) dengan banner pemisah", async () => {
    const mockComponents: ComponentInputForPlc[] = [
      { partType: "SMC SY5120", partName: "Solenoid Valve", qty: 1 },
      { partType: "Load Cell Transducer", partName: "Analog Sensor Presisi 0-10V", qty: 1 },
    ];
    const allocation = generatePlcAddressesFromComponents(mockComponents);
    const wb = await buildPlcAddressWorkbook(
      allocation,
      { nama: "Testing Proyek", client: "Client PT Test" },
      {
        namaPerusahaan: "PT. Twintech Precision",
        alamatPerusahaan: "Cikarang",
        telpPerusahaan: "021-123456",
        faxPerusahaan: "021-123457",
      }
    );

    const sheetNames = wb.worksheets.map((s) => s.name);
    expect(sheetNames).toEqual(["Semua I-O & Register"]);

    const mainSheet = wb.getWorksheet("Semua I-O & Register")!;
    expect(mainSheet.getCell("B7").value).toBe("NO");
    expect(mainSheet.getCell("C7").value).toBe("ALAMAT PLC");
    expect(mainSheet.getCell("D7").value).toBe("SIMBOL / TAG NAME");
    expect(mainSheet.getCell("E7").value).toBe("TIPE DATA");
    expect(mainSheet.getCell("F7").value).toBe("FUNGSI & DESKRIPSI");
    // Kolom G (kolom ke-7) harus kosong karena format baru hanya 5 kolom
    expect(mainSheet.getCell("G7").value).toBeNull();
  });

  it("memastikan Skun Y dan aksesoris wiring kabel TIDAK dianggap sebagai sensor I/O", () => {
    const mockComponents: ComponentInputForPlc[] = [
      {
        partType: "Skun Y",
        partName: "Skun Y 1.25 (Sensor & Push Button)",
        kelompok: "Sensor & Push Button",
        qty: 10,
      },
      {
        partType: "Kabel NYAF 0.75mm",
        partName: "Kabel Wiring Sensor",
        kelompok: "Sensor & Push Button",
        qty: 1,
      },
      {
        partType: "OMRON PHOTO SENSOR E3Z-D12",
        partName: "Photoelectric Sensor Diffuse 24VDC",
        kelompok: "Sensor & Push Button",
        qty: 1,
      },
    ];

    const result = generatePlcAddressesFromComponents(mockComponents, {
      includeStandardPanelSignals: false,
    });

    // Hanya sensor Omron E3Z yang boleh masuk sebagai DI!
    expect(result.entries.some((e) => e.sourceComponent?.partType.includes("Skun Y"))).toBe(false);
    expect(result.entries.some((e) => e.sourceComponent?.partType.includes("NYAF"))).toBe(false);
    expect(result.entries.some((e) => e.sourceComponent?.partType.includes("OMRON PHOTO SENSOR"))).toBe(true);
  });

  it("mengalokasikan Push Button, Emergency Stop, Photo Sensor, dan Laser Sensor sebagai Input (DI)", () => {
    const mockPrList: ComponentInputForPlc[] = [
      {
        partType: "OMRON PHOTO SENSOR E3Z-D12",
        partName: "PHOTO SENSOR",
        catatanPr: "Flexindomas",
        qty: 2,
      },
      {
        partType: "25MM AVW411ERP (FORD)",
        partName: "MERGENCY STOP",
        catatanPr: "Flexindomas",
        qty: 1,
      },
      {
        partType: "Push Button Hijau Φ22 AR30",
        partName: "PUSH BOTTON",
        catatanPr: "Flexindomas",
        qty: 3,
      },
      {
        partType: "LA115-A5-01 Red 22mm (FORT)",
        partName: "PUSH BOTTON",
        catatanPr: "Flexindomas",
        qty: 2,
      },
      {
        partType: "Keyence LR-Z Laser Sensor",
        partName: "Laser Distance Sensor",
        qty: 1,
      },
      {
        partType: "Omron Relay MY2N 24VDC",
        partName: "General Purpose Relay",
        qty: 2,
      },
      {
        partType: "Omron G9SE-201",
        partName: "Safety Relay Unit",
        qty: 1,
      },
    ];

    const result = generatePlcAddressesFromComponents(mockPrList, {
      includeStandardPanelSignals: false,
    });

    const diList = result.entries.filter((e) => e.kind === "DI");

    // 1. Photo Sensor (2 pcs) -> 2 DI
    const photoSensors = diList.filter((e) => e.symbol.startsWith("PHOTO_SENSOR"));
    expect(photoSensors).toHaveLength(2);
    expect(photoSensors[0].description).toContain("OMRON PHOTO SENSOR E3Z-D12");

    // 2. Emergency Stop (1 pc) -> 1 DI
    const estopEntries = diList.filter((e) => e.symbol.startsWith("ESTOP_INPUT"));
    expect(estopEntries).toHaveLength(1);
    expect(estopEntries[0].description).toContain("25MM AVW411ERP (FORD)");

    // 3. Push Button Hijau (3 pcs) -> 3 DI
    const pbHijau = diList.filter((e) => e.symbol.startsWith("PB_HIJAU"));
    expect(pbHijau).toHaveLength(3);

    // 4. Push Button Merah LA115 (2 pcs) -> 2 DI
    const pbMerah = diList.filter((e) => e.symbol.startsWith("PB_MERAH"));
    expect(pbMerah).toHaveLength(2);

    // 5. Laser Sensor (seperti Keyence LR-Z) -> Murni Digital Input (DI / Sinyal 1/0 Diskrit)
    const laserDi = diList.filter((e) => e.symbol.startsWith("LASER_DETECT"));
    expect(laserDi).toHaveLength(1);
    expect(laserDi[0].kind).toBe("DI");

    // Laser sensor tidak menghasilkan AI ataupun register D (karena murni input 1/0 seperti sensor diffuse)
    const aiList = result.entries.filter((e) => e.kind === "AI");
    expect(aiList).toHaveLength(0);

    // 6. Relay Umum (Omron MY2N) -> Masuk ke Output (DO)
    const doList = result.entries.filter((e) => e.kind === "DO");
    const relayDo = doList.filter((e) => e.symbol.startsWith("RELAY_OUT"));
    expect(relayDo).toHaveLength(2);
    expect(relayDo[0].description).toContain("Omron Relay MY2N");

    // 7. Safety Relay (Omron G9SE) -> Masuk ke Input (DI)
    const safetyRelayDi = diList.filter((e) => e.symbol.startsWith("SAFETY_RELAY_FB"));
    expect(safetyRelayDi).toHaveLength(1);
    expect(safetyRelayDi[0].description).toContain("Omron G9SE-201");
  });
});
