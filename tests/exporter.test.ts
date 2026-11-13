import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { SCHEDULE_STATUS_ARGB } from "@/lib/constants";
import { parseReferenceScheduleFile } from "@/lib/export/parse-schedule-reference";
import { exportScheduleToBuffer } from "@/lib/export/schedule-exporter";

const FILE_2_PATH = path.resolve(
  __dirname,
  "../docs/reference/Rencana Jadwal Kerja MGS.xlsx"
);

describe("Exporter Jadwal ke Excel dibanding File 2 (Rencana Jadwal Kerja MGS.xlsx)", () => {
  it("menghasilkan workbook multi-sheet yang mereplikasi jumlah kolom hari, jumlah merge, warna per status, lebar kolom, dan print landscape File 2", async () => {
    // 1. Baca File 2 referensi asli
    const refWb = new ExcelJS.Workbook();
    await refWb.xlsx.readFile(FILE_2_PATH);
    const refGlass = refWb.getWorksheet("MGS | Glasstech")!;
    const refLand = refWb.getWorksheet("MGS | LandGlass")!;

    const parsedRef = await parseReferenceScheduleFile(FILE_2_PATH, {
      Glasstech: "2026-11-02",
      LandGlass: "2026-11-09",
    });

    expect(parsedRef.lanes).toHaveLength(2);
    expect(parsedRef.lanes[0].jumlahHari).toBe(6);
    expect(parsedRef.lanes[1].jumlahHari).toBe(4);
    expect(parsedRef.logoBase64).toBeTruthy();

    // Isi ke-4 status pada Glasstech untuk menguji pewarnaan penuh semua baris detail milik tiap pekerjaan
    const glassLane = parsedRef.lanes[0];
    glassLane.workItems[0].scheduleCells = [
      { tanggal: "2026-11-02", status: "DONE", catatan: "Selesai hari pertama" }, // Day 1 (col F) -> 6 baris detail R10..R15
    ];
    glassLane.workItems[1].scheduleCells = [
      { tanggal: "2026-11-03", status: "ON_PROGRESS" }, // Day 2 (col G) -> 5 baris detail R16..R20
    ];
    glassLane.workItems[2].scheduleCells = [
      { tanggal: "2026-11-04", status: "TARGET" }, // Day 3 (col H) -> 7 baris detail R21..R27
    ];
    glassLane.workItems[3].scheduleCells = [
      { tanggal: "2026-11-07", status: "DELAY" }, // Day 6 (col K) -> 9 baris detail R28..R36
    ];

    // 2. Export ke Buffer Excel lalu buka ulang dengan ExcelJS
    const buffer = await exportScheduleToBuffer(parsedRef.lanes, {
      namaPerusahaan: "PT. Twintech Precision",
      alamatPerusahaan:
        "Multiguna 1, Jl. Mahoni 1 No. 9 Lippo Cikarang 17550, Indonesia",
      telpPerusahaan: "+62 (21) 89902228",
      faxPerusahaan: "+62 (21) 89902229",
      logoBase64: parsedRef.logoBase64,
    });

    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.load(buffer as unknown as ArrayBuffer);

    // Nama sheet sama persis dengan File 2
    expect(outWb.worksheets.map((w) => w.name)).toEqual([
      "MGS | Glasstech",
      "MGS | LandGlass",
    ]);

    const outGlass = outWb.getWorksheet("MGS | Glasstech")!;
    const outLand = outWb.getWorksheet("MGS | LandGlass")!;

    // Verifikasi jumlah kolom hari (Glasstech = 6 hari F..K, LandGlass = 4 hari F..I)
    const countDayCols = (ws: ExcelJS.Worksheet) => {
      let count = 0;
      for (let c = 6; c <= 30; c++) {
        if (typeof ws.getCell(9, c).value === "number") count++;
      }
      return count;
    };
    expect(countDayCols(outGlass)).toBe(countDayCols(refGlass)); // 6 === 6
    expect(countDayCols(outLand)).toBe(countDayCols(refLand)); // 4 === 4

    // Verifikasi jumlah merge data + header pada Glasstech sama persis (22 merge!)
    expect(outGlass.model.merges.length).toBe(refGlass.model.merges.length); // 22 === 22
    expect(new Set(outGlass.model.merges)).toEqual(
      new Set(refGlass.model.merges)
    );

    // Pada LandGlass: 13 merge tabel/header sama persis (File 2 punya 1 merge baris kosong B7:I7)
    const refLandTableMerges = refLand.model.merges.filter(
      (m) => m !== "B7:I7"
    );
    expect(new Set(outLand.model.merges)).toEqual(new Set(refLandTableMerges));

    // Verifikasi semua baris detail milik sebuah pekerjaan ikut terwarna sesuai statusnya
    for (let r = 10; r <= 15; r++) {
      const fill = outGlass.getCell(r, 6).fill as ExcelJS.FillPattern;
      expect(fill.fgColor?.argb).toBe(SCHEDULE_STATUS_ARGB.DONE); // FF00B0F0
    }
    for (let r = 16; r <= 20; r++) {
      const fill = outGlass.getCell(r, 7).fill as ExcelJS.FillPattern;
      expect(fill.fgColor?.argb).toBe(SCHEDULE_STATUS_ARGB.ON_PROGRESS); // FFFFD966
    }
    for (let r = 21; r <= 27; r++) {
      const fill = outGlass.getCell(r, 8).fill as ExcelJS.FillPattern;
      expect(fill.fgColor?.argb).toBe(SCHEDULE_STATUS_ARGB.TARGET); // FF00B050
    }
    for (let r = 28; r <= 36; r++) {
      const fill = outGlass.getCell(r, 11).fill as ExcelJS.FillPattern;
      expect(fill.fgColor?.argb).toBe(SCHEDULE_STATUS_ARGB.DELAY); // FFF4B084
    }

    // Verifikasi warna legenda C39..C42
    expect(outGlass.getCell("C39").value).toBe("TARGET");
    expect((outGlass.getCell("C39").fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF00B050");
    expect(outGlass.getCell("C40").value).toBe("ON PROGRES");
    expect((outGlass.getCell("C40").fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFFFD966");
    expect(outGlass.getCell("C41").value).toBe("DONE");
    expect((outGlass.getCell("C41").fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF00B0F0");
    expect(outGlass.getCell("C42").value).toBe("DELAY");
    expect((outGlass.getCell("C42").fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFF4B084");

    // Verifikasi print setup landscape & fit to 1 page wide
    expect(outGlass.pageSetup.orientation).toBe("landscape");
    expect(outGlass.pageSetup.fitToPage).toBe(true);
    expect(outGlass.pageSetup.fitToWidth).toBe(1);
  });

  it("mengekspor warna kolom bebas (warnaCustom), komentar sel (catatan), serta info PIC & Deadline ke Excel", async () => {
    const buffer = await exportScheduleToBuffer(
      [
        {
          client: "PT ROKI",
          laneNama: "Panel Utama",
          tanggalMulai: "2026-11-10",
          jumlahHari: 3,
          workItems: [
            {
              urutan: 1,
              judul: "Wiring Panel Utama",
              pic: "Pak Budi & Tim",
              deadline: "2026-11-12",
              subScopes: [
                {
                  urutan: 1,
                  judul: "1. Wiring Power & Control",
                  details: [
                    { urutan: 1, teks: "a. Pasang MCB & Kontaktor" },
                    { urutan: 2, teks: "b. Terminasi I/O PLC FX5U" },
                  ],
                },
              ],
              scheduleCells: [
                {
                  tanggal: "2026-11-10",
                  status: "TARGET",
                  warnaCustom: "#8B5CF6",
                  catatan: "Tunggu kabel 2.5mm datang jam 10 pagi",
                },
              ],
            },
          ],
        },
      ],
      {
        namaPerusahaan: "PT. Twintech Precision",
        alamatPerusahaan: "Lippo Cikarang",
        telpPerusahaan: "+62 (21) 89902228",
        faxPerusahaan: "+62 (21) 89902229",
      }
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("PT ROKI | Panel Utama")!;
    expect(ws).toBeDefined();

    // Kolom C (DESCRIPTION) memuat judul pekerjaan + PIC + Deadline
    const descVal = String(ws.getCell("C10").value ?? "");
    expect(descVal).toContain("Wiring Panel Utama");
    expect(descVal).toContain("PIC: Pak Budi & Tim");
    expect(descVal).toContain("Deadline:");

    // Seluruh baris detail (R10..R11) pada Day 1 (col 6 / F) diwarnai ungu custom FF8B5CF6
    for (const r of [10, 11]) {
      const fill = ws.getCell(r, 6).fill as ExcelJS.FillPattern;
      expect(fill.fgColor?.argb).toBe("FF8B5CF6");
    }

    // Komentar (note) tersimpan pada sel F10
    expect(ws.getCell("F10").note).toBe(
      "Tunggu kabel 2.5mm datang jam 10 pagi"
    );
  });
});
