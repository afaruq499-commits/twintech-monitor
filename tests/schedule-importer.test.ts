import { describe, expect, it } from "vitest";
import {
  exportScheduleToBuffer,
  type ExportLaneInput,
} from "@/lib/export/schedule-exporter";
import { parseScheduleWorkbookBuffer } from "@/lib/export/schedule-importer";

describe("Schedule Importer (Round-Trip Export & Import)", () => {
  it("dapat membaca file Excel yang diexport dengan format yang sama persis termasuk sub-scope, detail, warna status, warna custom, dan catatan", async () => {
    // 1. Siapkan mock data lane yang lengkap
    const mockLanes: ExportLaneInput[] = [
      {
        client: "PT. Maju Gemilang",
        laneNama: "Glasstech Line 1",
        subjudul: "(Timeline Commissioning Onsite)",
        tanggalMulai: "2026-11-02",
        jumlahHari: 6,
        workItems: [
          {
            urutan: 1,
            judul: "Instalasi Motor Rotary",
            pic: "Ahmad",
            deadline: "2026-11-05",
            subScopes: [
              {
                urutan: 1,
                judul: "1. Mechanical Alignment",
                details: [
                  { urutan: 1, teks: "a. Pasang bracket dudukan motor frame" },
                  { urutan: 2, teks: "b. Pengecekan putaran manual poros" },
                ],
              },
              {
                urutan: 2,
                judul: "2. Electrical Wiring",
                details: [
                  { urutan: 1, teks: "a. Penarikan kabel power & encoder servo" },
                ],
              },
            ],
            scheduleCells: [
              {
                tanggal: "2026-11-02",
                status: "DONE",
                catatan: "Selesai tepat waktu di hari pertama",
              },
              {
                tanggal: "2026-11-03",
                status: "ON_PROGRESS",
              },
            ],
          },
          {
            urutan: 2,
            judul: "Commissioning Sensor & Safety",
            pic: "Budi",
            subScopes: [
              {
                urutan: 1,
                judul: "1. Sensor Testing",
                details: [
                  { urutan: 1, teks: "a. Testing proximity sensor & light curtain" },
                ],
              },
            ],
            scheduleCells: [
              {
                tanggal: "2026-11-04",
                status: "TARGET",
                warnaCustom: "#6366F1", // Custom Indigo color
                catatan: "Gunakan warna custom ungu-indigo",
              },
              {
                tanggal: "2026-11-05",
                status: "DELAY",
                catatan: "Menunggu kiriman part pengganti",
              },
            ],
          },
        ],
      },
      {
        client: "PT. Maju Gemilang",
        laneNama: "LandGlass Line 2",
        subjudul: "(Assembly & Wiring)",
        tanggalMulai: "2026-11-09",
        jumlahHari: 4,
        workItems: [
          {
            urutan: 1,
            judul: "Wiring Panel Utama",
            subScopes: [
              {
                urutan: 1,
                judul: "1. Power Distribution",
                details: [
                  { urutan: 1, teks: "a. Wiring MCB, PSU & Safety Relay G9SP" },
                ],
              },
            ],
            scheduleCells: [
              {
                tanggal: "2026-11-09",
                status: "TARGET",
              },
            ],
          },
        ],
      },
    ];

    // 2. Export ke Excel buffer
    const exportedBuffer = await exportScheduleToBuffer(mockLanes, {
      namaPerusahaan: "PT. Twintech Precision",
      alamatPerusahaan: "Lippo Cikarang 17550",
      telpPerusahaan: "+62 21 89902228",
      faxPerusahaan: "+62 21 89902229",
    });

    // 3. Import kembali buffer tersebut dengan schedule-importer
    const parsed = await parseScheduleWorkbookBuffer(
      exportedBuffer,
      "Rencana_Jadwal_Export.xlsx",
      {
        "Glasstech Line 1": "2026-11-02",
        "LandGlass Line 2": "2026-11-09",
      }
    );

    expect(parsed.lanes).toHaveLength(2);

    // Verifikasi Sheet 1
    const lane1 = parsed.lanes[0];
    expect(lane1.client).toBe("PT. Maju Gemilang");
    expect(lane1.laneNama).toBe("Glasstech Line 1");
    expect(lane1.jumlahHari).toBe(6);
    expect(lane1.workItems).toHaveLength(2);

    // Work item 1
    const wi1 = lane1.workItems[0];
    expect(wi1.judul).toBe("Instalasi Motor Rotary");
    expect(wi1.pic).toBe("Ahmad");
    expect(wi1.subScopes).toHaveLength(2);
    expect(wi1.subScopes[0].judul).toBe("1. Mechanical Alignment");
    expect(wi1.subScopes[0].details).toHaveLength(2);
    expect(wi1.subScopes[0].details[0].teks).toBe("a. Pasang bracket dudukan motor frame");

    // Schedule cells item 1 (terpetakan per sub-scope)
    expect(wi1.scheduleCells.length).toBeGreaterThanOrEqual(2);
    const sub1Cells = wi1.scheduleCells.filter((sc) => sc.subScopeUrutan === 1);
    expect(sub1Cells[0].dayIndex).toBe(1);
    expect(sub1Cells[0].status).toBe("DONE");
    expect(sub1Cells[0].catatan).toBe("Selesai tepat waktu di hari pertama");

    expect(sub1Cells[1].dayIndex).toBe(2);
    expect(sub1Cells[1].status).toBe("ON_PROGRESS");

    // Work item 2 (Custom color & Delay)
    const wi2 = lane1.workItems[1];
    expect(wi2.judul).toBe("Commissioning Sensor & Safety");
    expect(wi2.pic).toBe("Budi");
    expect(wi2.scheduleCells).toHaveLength(2);

    // Day 3 (Target dengan custom color)
    expect(wi2.scheduleCells[0].dayIndex).toBe(3);
    expect(wi2.scheduleCells[0].status).toBe("TARGET");
    expect(wi2.scheduleCells[0].warnaCustom).toBe("#6366F1");
    expect(wi2.scheduleCells[0].catatan).toBe("Gunakan warna custom ungu-indigo");

    // Day 4 (Delay dengan note)
    expect(wi2.scheduleCells[1].dayIndex).toBe(4);
    expect(wi2.scheduleCells[1].status).toBe("DELAY");
    expect(wi2.scheduleCells[1].catatan).toBe("Menunggu kiriman part pengganti");

    // Verifikasi Sheet 2 (LandGlass)
    const lane2 = parsed.lanes[1];
    expect(lane2.laneNama).toBe("LandGlass Line 2");
    expect(lane2.jumlahHari).toBe(4);
    expect(lane2.workItems).toHaveLength(1);
    expect(lane2.workItems[0].scheduleCells[0].status).toBe("TARGET");
  });

  it("dapat membaca file Excel referensi asli File 2 (Rencana Jadwal Kerja MGS.xlsx)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file2Path = path.resolve(
      __dirname,
      "../docs/reference/Rencana Jadwal Kerja MGS.xlsx"
    );
    const buffer = await fs.readFile(file2Path);

    const parsed = await parseScheduleWorkbookBuffer(
      buffer,
      "Rencana Jadwal Kerja MGS.xlsx"
    );

    expect(parsed.lanes).toHaveLength(2);

    const glasstech = parsed.lanes.find((l) => l.laneNama.includes("Glasstech"));
    expect(glasstech).toBeDefined();
    expect(glasstech!.jumlahHari).toBe(6);
    expect(glasstech!.workItems.length).toBeGreaterThanOrEqual(4);

    const landglass = parsed.lanes.find((l) => l.laneNama.includes("LandGlass"));
    expect(landglass).toBeDefined();
    expect(landglass!.jumlahHari).toBe(4);
    expect(landglass!.workItems.length).toBeGreaterThanOrEqual(1);
  });
});
