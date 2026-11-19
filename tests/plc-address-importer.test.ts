import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parsePlcAddressWorkbook } from "@/lib/export/plc-address-importer";
import { exportPlcAddressesToBuffer } from "@/lib/export/plc-address-exporter";
import type { PlcAddressEntry } from "@/lib/plc-address-allocator";

describe("PLC Address Excel Importer", () => {
  it("dapat membaca file Excel I/O PLC POKAYOKE RECLINING yang diunggah pengguna", async () => {
    const filePath = "C:/Users/akiyo/.gemini/antigravity/brain/e228d3ee-6f55-4190-8e92-b443a47a06b3/.user_uploaded/media_1795054165162_8a57058c.xlsx";
    if (!fs.existsSync(filePath)) {
      console.warn("File contoh tidak ditemukan pada path spesifik, lewati uji berkas lokal.");
      return;
    }

    const buffer = fs.readFileSync(filePath);
    const result = await parsePlcAddressWorkbook(buffer, "Tabel_IO_PLC_POKAYOKE_RECLINING.xlsx");

    expect(result.summary.total).toBe(19);
    expect(result.summary.totalDi).toBe(9);
    expect(result.summary.totalDo).toBe(4);
    expect(result.summary.totalM).toBe(2);
    expect(result.summary.totalD).toBe(4);

    // Cek item DI pertama (X0 - PB_START)
    const diFirst = result.entries.find((e) => e.address === "X0");
    expect(diFirst).toBeDefined();
    expect(diFirst?.kind).toBe("DI");
    expect(diFirst?.symbol).toBe("PB_START");
    expect(diFirst?.wireNo).toBe("W001");
    expect(diFirst?.dataType).toBe("BOOL");
    expect(diFirst?.description).toContain("Push Button Siklus Otomatis");

    // Cek item DO pertama (Y0 - TL_RED_ALARM)
    const doFirst = result.entries.find((e) => e.address === "Y0");
    expect(doFirst).toBeDefined();
    expect(doFirst?.kind).toBe("DO");
    expect(doFirst?.symbol).toBe("TL_RED_ALARM");
    expect(doFirst?.wireNo).toBe("W101");

    // Cek item M pertama (M0 - SYS_ALL_HOME_DONE)
    const mFirst = result.entries.find((e) => e.address === "M0");
    expect(mFirst).toBeDefined();
    expect(mFirst?.kind).toBe("M");
    expect(mFirst?.symbol).toBe("SYS_ALL_HOME_DONE");

    // Cek item D pertama (D100 - SYS_PRODUCT_COUNTER)
    const dFirst = result.entries.find((e) => e.address === "D100");
    expect(dFirst).toBeDefined();
    expect(dFirst?.kind).toBe("D");
    expect(dFirst?.dataType).toBe("WORD_16");

    // Cek metadata header yang terdeteksi
    expect(result.detectedMetadata?.projectName).toBe("POKAYOKE RECLINING");
    expect(result.detectedMetadata?.client).toBe("PT TOYOTA BOSHOKU INDONESIA");
    expect(result.detectedMetadata?.kode).toBe("26-TBI-1116");
    expect(result.detectedMetadata?.system).toBe("MITSUBISHI_FX5U_OCTAL");
  });

  it("dapat membaca file Excel hasil export dari aplikasi dan memuat kembali semua data secara simetris (round-trip)", async () => {
    const mockEntries: PlcAddressEntry[] = [
      {
        id: "mock-1",
        kind: "DI",
        address: "X0",
        numericIndex: 0,
        symbol: "SENSOR_TEST",
        wireNo: "W-S1",
        description: "Sensor Test Deteksi",
        dataType: "BOOL",
        moduleRole: "Sensor Input",
      },
      {
        id: "mock-2",
        kind: "DO",
        address: "Y0",
        numericIndex: 0,
        symbol: "SOLENOID_CLAMP",
        wireNo: "W-SOL1",
        description: "Solenoid Silinder Clamp",
        dataType: "BOOL",
        moduleRole: "Pneumatic Valve",
      },
    ];

    const buffer = await exportPlcAddressesToBuffer(
      {
        system: "MITSUBISHI_FX5U_OCTAL",
        entries: mockEntries,
        summary: {
          totalDi: 1,
          totalDo: 1,
          totalAi: 0,
          totalAo: 0,
          totalM: 0,
          totalD: 0,
          cpuBuiltInDiCapacity: 40,
          cpuBuiltInDoCapacity: 40,
          expansionDiRequired: 0,
          expansionDoRequired: 0,
        },
        options: {
          system: "MITSUBISHI_FX5U_OCTAL",
        },
      },
      {
        nama: "Test Proyek Mesin",
        client: "PT Test Client",
        kode: "TEST-001",
      }
    );

    const parsed = await parsePlcAddressWorkbook(buffer, "test-exported.xlsx");
    expect(parsed.summary.total).toBe(2);
    expect(parsed.summary.totalDi).toBe(1);
    expect(parsed.summary.totalDo).toBe(1);

    const x0 = parsed.entries.find((e) => e.address === "X0");
    expect(x0).toBeDefined();
    expect(x0?.symbol).toBe("SENSOR_TEST");
    expect(x0?.wireNo).toBe("W-S1");

    const y0 = parsed.entries.find((e) => e.address === "Y0");
    expect(y0).toBeDefined();
    expect(y0?.symbol).toBe("SOLENOID_CLAMP");
    expect(y0?.wireNo).toBe("W-SOL1");
  });
});
