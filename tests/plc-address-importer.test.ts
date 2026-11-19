import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { parsePlcAddressWorkbook } from "@/lib/export/plc-address-importer";
import {
  exportPlcAddressesToBuffer,
  exportPlcAddressesToCsvBuffer,
} from "@/lib/export/plc-address-exporter";
import type { PlcAddressEntry } from "@/lib/plc-address-allocator";

describe("PLC Address Excel & CSV Importer", () => {
  it("dapat membaca file Excel I/O PLC POKAYOKE RECLINING (format 9 kolom lama)", async () => {
    const filePath =
      "C:/Users/akiyo/.gemini/antigravity/brain/e228d3ee-6f55-4190-8e92-b443a47a06b3/.user_uploaded/media_1795054165162_8a57058c.xlsx";
    if (!fs.existsSync(filePath)) {
      console.warn("File contoh lama tidak ditemukan pada path spesifik, lewati.");
      return;
    }

    const buffer = fs.readFileSync(filePath);
    const result = await parsePlcAddressWorkbook(
      buffer,
      "Tabel_IO_PLC_POKAYOKE_RECLINING.xlsx"
    );

    expect(result.summary.total).toBe(19);
    expect(result.summary.totalDi).toBe(9);
    expect(result.summary.totalDo).toBe(4);
    expect(result.summary.totalM).toBe(2);
    expect(result.summary.totalD).toBe(4);

    const diFirst = result.entries.find((e) => e.address === "X0");
    expect(diFirst).toBeDefined();
    expect(diFirst?.kind).toBe("DI");
    expect(diFirst?.symbol).toBe("PB_START");
    expect(diFirst?.wireNo).toBe("W001");
    expect(diFirst?.dataType).toBe("BOOL");

    const doFirst = result.entries.find((e) => e.address === "Y0");
    expect(doFirst).toBeDefined();
    expect(doFirst?.kind).toBe("DO");
    expect(doFirst?.symbol).toBe("TL_RED_ALARM");

    expect(result.detectedMetadata?.projectName).toBe("POKAYOKE RECLINING");
    expect(result.detectedMetadata?.client).toBe("PT TOYOTA BOSHOKU INDONESIA");
    expect(result.detectedMetadata?.kode).toBe("26-TBI-1116");
    expect(result.detectedMetadata?.system).toBe("MITSUBISHI_FX5U_OCTAL");
  });

  it("dapat membaca file Excel I/O PLC FUNCTION TESTER template 5 kolom yang diunggah pengguna", async () => {
    const filePath =
      "C:/Users/akiyo/.gemini/antigravity/brain/e228d3ee-6f55-4190-8e92-b443a47a06b3/.user_uploaded/media_1795092859406_89bcf0fa.xlsx";
    if (!fs.existsSync(filePath)) {
      console.warn("File template pengguna tidak ditemukan pada path spesifik, lewati.");
      return;
    }

    const buffer = fs.readFileSync(filePath);
    const result = await parsePlcAddressWorkbook(
      buffer,
      "Tabel_IO_PLC_FUNCTION_TESTER_(1).xlsx"
    );

    expect(result.summary.total).toBe(86);
    expect(result.summary.totalDi).toBe(32);
    expect(result.summary.totalDo).toBe(21);
    expect(result.summary.totalAi).toBe(0);
    expect(result.summary.totalAo).toBe(0);
    expect(result.summary.totalM).toBe(10);
    expect(result.summary.totalD).toBe(23);

    // Cek item DI pertama (X0) dan terakhir (X37)
    const x0 = result.entries.find((e) => e.address === "X0");
    expect(x0).toBeDefined();
    expect(x0?.kind).toBe("DI");
    expect(x0?.symbol).toBe("PB_START");
    expect(x0?.dataType).toBe("BOOL");

    const x37 = result.entries.find((e) => e.address === "X37");
    expect(x37).toBeDefined();
    expect(x37?.kind).toBe("DI");
    expect(x37?.symbol).toBe("SS_MODE_7");

    // Cek item DO pertama (Y0) dan terakhir (Y24)
    const y0 = result.entries.find((e) => e.address === "Y0");
    expect(y0).toBeDefined();
    expect(y0?.kind).toBe("DO");
    expect(y0?.symbol).toBe("TL_RED_ALARM");

    const y24 = result.entries.find((e) => e.address === "Y24");
    expect(y24).toBeDefined();
    expect(y24?.kind).toBe("DO");
    expect(y24?.symbol).toBe("SV2_ALARM_RESET");

    // Cek item M pertama (M0)
    const m0 = result.entries.find((e) => e.address === "M0");
    expect(m0).toBeDefined();
    expect(m0?.kind).toBe("M");
    expect(m0?.symbol).toBe("HMI_SV1_JOG_FWD");

    // Cek item D pertama (D100) dan terakhir (D122)
    const d100 = result.entries.find((e) => e.address === "D100");
    expect(d100).toBeDefined();
    expect(d100?.kind).toBe("D");
    expect(d100?.symbol).toBe("HMI_RECIPE_NO");
    expect(d100?.dataType).toBe("WORD_16");

    const d122 = result.entries.find((e) => e.address === "D122");
    expect(d122).toBeDefined();
    expect(d122?.kind).toBe("D");
    expect(d122?.symbol).toBe("SYS_RECIPE_ACTIVE");

    // Cek metadata header
    expect(result.detectedMetadata?.projectName).toBe("FUNCTION TESTER");
    expect(result.detectedMetadata?.client).toBe("PT TOYOTA BOSHOKU INDONESIA");
    expect(result.detectedMetadata?.kode).toBe("26-TBI-1023");
    expect(result.detectedMetadata?.system).toBe("MITSUBISHI_FX5U_OCTAL");
  });

  it("dapat membaca berkas CSV teks persis seperti yang diberikan pengguna", async () => {
    const csvContent = `,,,,,
,PT. TWINTECH PRECISION — TABEL PENGELAMATAN I/O & REGISTER PLC,,,,
,Proyek: FUNCTION TESTER | Client: PT TOYOTA BOSHOKU INDONESIA | Kode: 26-TBI-1023 | Format: Mitsubishi FX5U (Oktal),,,,
,,,,,
,Total I/O: 3 DI  |  2 DO  |  0 AI  |  0 AO  |  1 Bit M  |  1 Register D,,,,
,,,,,
,NO,ALAMAT PLC,SIMBOL / TAG NAME,TIPE DATA,FUNGSI & DESKRIPSI
,BAGIAN 1: DIGITAL INPUT (DI) — SINYAL MASUKAN DIGITAL PLC (3 Item),,,,
,1,X0,PB_START,BOOL,Tombol Mulai Mesin
,2,X1,PB_STOP,BOOL,Tombol Berhenti
,3,X2,PB_RESET,BOOL,Tombol Reset
,BAGIAN 2: DIGITAL OUTPUT (DO) — SINYAL KELUARAN AKTUATOR (2 Item),,,,
,4,Y0,TL_RED_ALARM,BOOL,Tower Lamp Merah
,5,Y1,TL_GREEN_RUN,BOOL,Tower Lamp Hijau
,BAGIAN 5: INTERNAL RELAY / HMI BITS (M) (1 Item),,,,
,6,M0,SYS_AUTO_RUN,BOOL,Bit Status Auto
,BAGIAN 6: DATA REGISTER (D) (1 Item),,,,
,7,D100,PROD_COUNTER,WORD_16,Counter Produksi
`;

    const buffer = Buffer.from(csvContent, "utf-8");
    const parsed = await parsePlcAddressWorkbook(buffer, "sample_io.csv");

    expect(parsed.summary.total).toBe(7);
    expect(parsed.summary.totalDi).toBe(3);
    expect(parsed.summary.totalDo).toBe(2);
    expect(parsed.summary.totalM).toBe(1);
    expect(parsed.summary.totalD).toBe(1);

    expect(parsed.detectedMetadata?.projectName).toBe("FUNCTION TESTER");
    expect(parsed.detectedMetadata?.client).toBe("PT TOYOTA BOSHOKU INDONESIA");

    const x0 = parsed.entries.find((e) => e.address === "X0");
    expect(x0?.symbol).toBe("PB_START");
    expect(x0?.description).toBe("Tombol Mulai Mesin");

    const y0 = parsed.entries.find((e) => e.address === "Y0");
    expect(y0?.kind).toBe("DO");
    expect(y0?.symbol).toBe("TL_RED_ALARM");
    expect(y0?.description).toBe("Tower Lamp Merah");
  });

  it("dapat membaca file Excel 5-kolom hasil export aplikasi dan memuat kembali semua data secara simetris (round-trip)", async () => {
    const mockEntries: PlcAddressEntry[] = [
      {
        id: "mock-1",
        kind: "DI",
        address: "X0",
        numericIndex: 0,
        symbol: "SENSOR_TEST",
        wireNo: "-",
        description: "Sensor Test Deteksi",
        dataType: "BOOL",
      },
      {
        id: "mock-2",
        kind: "DO",
        address: "Y0",
        numericIndex: 0,
        symbol: "SOLENOID_CLAMP",
        wireNo: "-",
        description: "Solenoid Silinder Clamp",
        dataType: "BOOL",
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
        } as any,
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
    expect(x0?.dataType).toBe("BOOL");
    expect(x0?.description).toBe("Sensor Test Deteksi");

    const y0 = parsed.entries.find((e) => e.address === "Y0");
    expect(y0).toBeDefined();
    expect(y0?.symbol).toBe("SOLENOID_CLAMP");
    expect(y0?.dataType).toBe("BOOL");
    expect(y0?.description).toBe("Solenoid Silinder Clamp");
  });

  it("dapat melakukan export ke CSV dan membaca kembali dengan akurat (round-trip CSV)", async () => {
    const mockEntries: PlcAddressEntry[] = [
      {
        id: "mock-di-1",
        kind: "DI",
        address: "X10",
        numericIndex: 10,
        symbol: "PROX_CYL_EXT",
        wireNo: "-",
        description: "Sensor Maju Silinder",
        dataType: "BOOL",
      },
      {
        id: "mock-do-1",
        kind: "DO",
        address: "Y10",
        numericIndex: 10,
        symbol: "VALVE_CYL_FWD",
        wireNo: "-",
        description: "Katup Solenoid Maju",
        dataType: "BOOL",
      },
    ];

    const csvBuffer = await exportPlcAddressesToCsvBuffer(
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
        } as any,
      },
      {
        nama: "Mesin Otomasi",
        client: "PT Klien CSV",
        kode: "CSV-001",
      }
    );

    const parsed = await parsePlcAddressWorkbook(csvBuffer, "export.csv");
    expect(parsed.summary.total).toBe(2);
    expect(parsed.summary.totalDi).toBe(1);
    expect(parsed.summary.totalDo).toBe(1);

    const x10 = parsed.entries.find((e) => e.address === "X10");
    expect(x10?.symbol).toBe("PROX_CYL_EXT");
    expect(x10?.description).toBe("Sensor Maju Silinder");

    const y10 = parsed.entries.find((e) => e.address === "Y10");
    expect(y10?.symbol).toBe("VALVE_CYL_FWD");
    expect(y10?.description).toBe("Katup Solenoid Maju");
  });
});
