import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  componentUpdateSchema,
  prImportCommitSchema,
} from "@/lib/validation/schemas";
import {
  appendPrComponents,
  applyDuplicateResolutions,
  detectDuplicates,
  mergePrComponents,
  parsePrice,
  parsePrWorkbook,
  type ExistingComponentRecord,
} from "@/lib/pr-parser";
import {
  buildPrExportFilename,
  exportPrToBuffer,
} from "@/lib/export/pr-exporter";
import {
  DEFAULT_PR_CATALOG,
  formatCatalogItemForPr,
} from "@/lib/pr-catalog-default";
import {
  searchCatalogComponents,
  splitHighlightSegments,
} from "@/lib/catalog-search";

const FILE_1_PATH = path.resolve(
  __dirname,
  "../docs/reference/PURCHASE REQUISITION - JIG INSERT COLLAR 23MJ2 (10-21-26).xlsx"
);

describe("Parser Harga PR (parsePrice)", () => {
  it('mem-parse "16.800.00 x 3" menjadi unit 16800, total 50400, dan menandai perluDicek', () => {
    const res = parsePrice("16.800.00 x 3", 3);
    expect(res.unit).toBe(16800);
    expect(res.total).toBe(50400);
    expect(res.needsCheck).toBe(true);
    expect(res.raw).toBe("16.800.00 x 3");
  });

  it('mem-parse "3.250 x 12" dengan qty=1 lsn menjadi 39000/lsn dan menandai perluDicek', () => {
    const res = parsePrice("3.250 x 12", 1);
    expect(res.unit).toBe(39000);
    expect(res.total).toBe(39000);
    expect(res.needsCheck).toBe(true);
    expect(res.raw).toBe("3.250 x 12");
  });

  it('mem-parse "350.00" menjadi 350000 (keputusan user) dan menandai perluDicek', () => {
    const res = parsePrice("350.00", 1);
    expect(res.unit).toBe(350000);
    expect(res.total).toBe(350000);
    expect(res.needsCheck).toBe(true);
  });

  it("menerima harga kosong sebagai valid tanpa perluDicek", () => {
    const emptyStr = parsePrice("", 5);
    expect(emptyStr.unit).toBeNull();
    expect(emptyStr.total).toBeNull();
    expect(emptyStr.needsCheck).toBe(false);

    const emptyNull = parsePrice(null, 5);
    expect(emptyNull.unit).toBeNull();
    expect(emptyNull.total).toBeNull();
    expect(emptyNull.needsCheck).toBe(false);
  });

  it('mem-parse "206.888 x 2" (qty 2) tanpa perluDicek', () => {
    const res = parsePrice("206.888 x 2", 2);
    expect(res.unit).toBe(206888);
    expect(res.total).toBe(413776);
    expect(res.needsCheck).toBe(false);
  });

  it("mem-parse angka murni dan menghitung total = unit x qty", () => {
    const res = parsePrice(5665000, 1);
    expect(res.unit).toBe(5665000);
    expect(res.total).toBe(5665000);
    expect(res.needsCheck).toBe(false);
  });
});

describe("Import File 1 Referensi Nyata & Deteksi Duplikat", () => {
  it("membaca File 1 secara utuh: 26 baris, 3 kelompok, merged cell, footer, dan tanggal revisi", async () => {
    const buf = fs.readFileSync(FILE_1_PATH);
    const parsed = await parsePrWorkbook(
      buf,
      "PURCHASE REQUISITION - JIG INSERT COLLAR 23MJ2 (10-21-26).xlsx"
    );

    expect(parsed.revisionDate).toBe("2026-10-21");
    expect(parsed.header.department).toBe("ENGINEERING");
    expect(parsed.header.prepared).toBe("FARUQ");
    expect(parsed.header.checked).toBe("IVAN");
    expect(parsed.header.purchasing).toBe("TETI NURBAETI");

    expect(parsed.footer.partsName).toBe(
      "JIG INSERT COLLAR 23MJ2 ( FULL ELEKTRIK )"
    );
    expect(parsed.footer.customer).toBe("PT ROKI INDONESIA");
    expect(parsed.footer.jobNumber).toBeNull(); // Kosong di File 1 -> wajib isi manual di preview

    expect(parsed.groups).toEqual([
      "Panel Utama",
      "OP Panel",
      "Sensor & Push Button",
    ]);

    expect(parsed.counts.total).toBe(26);
    expect(parsed.counts.error).toBe(0);
    // 4 baris perlu dicek: R12 (16.800.00 x 3), R16 (3.250 x 12), R17 (PARTS NAME kosong), R26 (350.00)
    expect(parsed.counts.check).toBe(4);
    expect(parsed.counts.ok).toBe(22);

    // Cek pembacaan merged cell B:C, D:F, J:K pada baris pertama (R9)
    const first = parsed.rows[0];
    expect(first.partType).toBe("BOX PANEL_400 x 300 x 200 ( CUSTOM )");
    expect(first.partName).toBe("BOX PANEL");
    expect(first.catatanPr).toBe("Ukuran cukup ? Cukup");
    expect(first.total).toBe(5665000);
  });

  it("mendeteksi 2 pasangan duplikat di File 1 dan mendukung opsi gabungkan qty / biarkan terpisah", async () => {
    const buf = fs.readFileSync(FILE_1_PATH);
    const parsed = await parsePrWorkbook(buf, path.basename(FILE_1_PATH));

    const dupes = detectDuplicates(parsed.rows);
    expect(dupes).toHaveLength(2);

    const mcb = dupes.find((d) => d.partType.includes("A9N61524"));
    const tb = dupes.find((d) => d.partType.includes("TBD-10A"));
    expect(mcb).toBeDefined();
    expect(mcb?.totalQty).toBe(2); // 1 + 1
    expect(tb).toBeDefined();
    expect(tb?.totalQty).toBe(3); // 1 + 2

    // Opsi "gabungkan qty" pada keduanya -> jumlah baris berkurang dari 26 menjadi 24
    const mergedRows = applyDuplicateResolutions(parsed.rows, {
      [mcb!.key]: "MERGE",
      [tb!.key]: "MERGE",
    });
    expect(mergedRows).toHaveLength(24);
    const mergedMcb = mergedRows.find((r) => r.partType?.includes("A9N61524"));
    expect(mergedMcb?.qty).toBe(2);
    expect(mergedMcb?.hargaSatuan).toBe(1089000);
    expect(mergedMcb?.total).toBe(2178000);

    // Opsi "biarkan terpisah" -> tetap 26 baris
    const keptRows = applyDuplicateResolutions(parsed.rows, {
      [mcb!.key]: "KEEP",
      [tb!.key]: "KEEP",
    });
    expect(keptRows).toHaveLength(26);
  });
});

describe("Mode MERGE Import Ulang PR Revisi", () => {
  it("mempertahankan status pembelian user, menandai komponen BARU, dan menandai HILANG_DI_REVISI tanpa menghapus", () => {
    const existing: ExistingComponentRecord[] = [
      {
        id: "c-plc",
        urutan: 1,
        kelompok: "Panel Utama",
        noPr: "2",
        partType: "PLC_FX5U-32MR/ES ( MITSUBISHI )",
        partName: "PLC",
        supplier: "Flexindomas",
        qty: 1,
        unit: "pcs",
        catatanPr: null,
        tanggalPakai: null,
        hargaSatuan: 5665000,
        hargaRaw: "5665000",
        total: 5665000,
        statusPembelian: "SUDAH_DATANG",
        estimasiTiba: "2026-10-28",
        perluDicek: false,
        alasanDicek: null,
        statusImport: "NORMAL",
        catatan: "Sudah dicek serial number OK",
      },
      {
        id: "c-old-relay",
        urutan: 2,
        kelompok: "Panel Utama",
        noPr: "5",
        partType: "RELAY_LAMA_24V",
        partName: "RELAY",
        supplier: "Flexindomas",
        qty: 4,
        unit: "pcs",
        catatanPr: null,
        tanggalPakai: null,
        hargaSatuan: 25000,
        hargaRaw: "25000",
        total: 100000,
        statusPembelian: "SUDAH_DIPESAN",
        estimasiTiba: "2026-11-05",
        perluDicek: false,
        alasanDicek: null,
        statusImport: "NORMAL",
        catatan: "PO #123",
      },
    ];

    const incoming = [
      {
        tempId: "r1",
        rowNumber: 10,
        kelompok: "Panel Utama",
        noPr: "2",
        partType: "PLC_FX5U-32MR/ES ( MITSUBISHI )",
        partName: "PLC",
        supplier: "Flexindomas",
        qty: 2, // Revisi naik jadi 2 unit
        unit: "pcs",
        catatanPr: "Tambah 1 unit cadangan",
        tanggalPakai: null,
        hargaSatuan: 5665000,
        hargaRaw: "5665000",
        total: 11330000,
        perluDicek: false,
        alasan: [],
        state: "OK" as const,
      },
      {
        tempId: "r2",
        rowNumber: 11,
        kelompok: "Panel Utama",
        noPr: "99",
        partType: "SERVO_MR-J4-40A",
        partName: "SERVO AMPLIFIER",
        supplier: "Flexindomas",
        qty: 1,
        unit: "pcs",
        catatanPr: null,
        tanggalPakai: null,
        hargaSatuan: 6500000,
        hargaRaw: "6500000",
        total: 6500000,
        perluDicek: false,
        alasan: [],
        state: "OK" as const,
      },
    ];

    const merged = mergePrComponents(existing, incoming);
    expect(merged.summary).toEqual({
      updated: 1,
      inserted: 1,
      missingInRevision: 1,
    });

    const plc = merged.items.find((i) => i.existingId === "c-plc")!;
    expect(plc.action).toBe("UPDATE");
    expect(plc.qty).toBe(2);
    expect(plc.statusPembelian).toBe("SUDAH_DATANG"); // Dipertahankan!
    expect(plc.catatan).toBe("Sudah dicek serial number OK"); // Dipertahankan!
    expect(plc.statusImport).toBe("NORMAL");

    const servo = merged.items.find((i) => i.partType === "SERVO_MR-J4-40A")!;
    expect(servo.action).toBe("INSERT");
    expect(servo.statusImport).toBe("BARU");
    expect(servo.statusPembelian).toBe("BELUM_PR");

    const oldRelay = merged.items.find((i) => i.existingId === "c-old-relay")!;
    expect(oldRelay.action).toBe("MARK_MISSING");
    expect(oldRelay.statusImport).toBe("HILANG_DI_REVISI"); // Tidak dihapus otomatis!
    expect(oldRelay.statusPembelian).toBe("SUDAH_DIPESAN");
  });

  it("mode APPEND menambahkan komponen dari file Excel berbeda tanpa menandai HILANG komponen lama", () => {
    const existing: ExistingComponentRecord[] = [
      {
        id: "c-1",
        urutan: 1,
        kelompok: "Panel Utama",
        noPr: "PR-001",
        partType: "MCB 1P 6A",
        partName: "Schneider MCB",
        supplier: "PT Jaya",
        qty: 4,
        unit: "pcs",
        catatanPr: null,
        tanggalPakai: null,
        hargaSatuan: 50000,
        hargaRaw: "50000",
        total: 200000,
        statusPembelian: "SUDAH_DIPESAN",
        estimasiTiba: null,
        perluDicek: false,
        alasanDicek: null,
        statusImport: "NORMAL",
        catatan: null,
      },
    ];

    const incomingFromDifferentExcel = [
      {
        tempId: "row-diff-1",
        rowNumber: 2,
        kelompok: "Pneumatic",
        noPr: "PR-002",
        partType: "SMC Cylinder CDQ2B20-30DZ",
        partName: "Compact Cylinder",
        supplier: "PT Pneumatic",
        qty: 2,
        unit: "pcs",
        catatanPr: null,
        tanggalPakai: null,
        hargaSatuan: 350000,
        hargaRaw: "350.000",
        total: 700000,
        perluDicek: false,
        alasan: [],
        state: "OK" as const,
      },
    ];

    const result = appendPrComponents(existing, incomingFromDifferentExcel);

    // Memastikan summary: 0 updated, 1 inserted, 0 missing
    expect(result.summary).toEqual({
      updated: 0,
      inserted: 1,
      missingInRevision: 0,
    });

    // Komponen baru mendapat urutan berlanjut dari komponen lama (urutan 2)
    expect(result.items.length).toBe(1);
    const newItem = result.items[0];
    expect(newItem.action).toBe("INSERT");
    expect(newItem.urutan).toBe(2);
    expect(newItem.partType).toBe("SMC Cylinder CDQ2B20-30DZ");
    expect(newItem.statusImport).toBe("NORMAL"); // Komponen dari excel berbeda masuk sebagai NORMAL
  });

  it("skema validasi mendukung mode APPEND dan pemulihan statusImport HILANG_DI_REVISI menjadi NORMAL", () => {
    // 1. Validasi prImportCommitSchema dengan mode APPEND
    const commitParsed = prImportCommitSchema.safeParse({
      targetMode: "EXISTING_PROJECT",
      projectId: "proj-123",
      importMode: "APPEND",
      namaFile: "PR_Tambahan_Mekanik.xlsx",
      duplicateResolutions: {},
      rows: [],
    });
    expect(commitParsed.success).toBe(true);

    // 2. Validasi componentUpdateSchema dengan statusImport NORMAL
    const updateNormalParsed = componentUpdateSchema.safeParse({
      statusImport: "NORMAL",
    });
    expect(updateNormalParsed.success).toBe(true);
    expect(updateNormalParsed.data?.statusImport).toBe("NORMAL");

    // 3. Validasi statusImport BARU dan HILANG_DI_REVISI
    const updateMissingParsed = componentUpdateSchema.safeParse({
      statusImport: "HILANG_DI_REVISI",
    });
    expect(updateMissingParsed.success).toBe(true);
  });
});

describe("Master Katalog Komponen & Round-Trip Export -> Import PR Excel", () => {
  it("memuat lengkap katalog komponen otomasi termasuk varian kabel panel 0.5, 0.75, dan 2.5 mm²", () => {
    expect(DEFAULT_PR_CATALOG.length).toBeGreaterThanOrEqual(107);
    expect(DEFAULT_PR_CATALOG[0].noUrut).toBe(1);
    expect(DEFAULT_PR_CATALOG[0].merek).toBe("IDEC");

    // Memastikan item skun & varian kabel lengkap terdaftar
    const skunItem = DEFAULT_PR_CATALOG.find((c) => c.nama.includes("Skun Garpu Y"));
    expect(skunItem).toBeDefined();

    const nyaf05 = DEFAULT_PR_CATALOG.find((c) => c.tipeModel.includes("0.5 mm²"));
    expect(nyaf05).toBeDefined();

    const nyaf075 = DEFAULT_PR_CATALOG.find((c) => c.tipeModel.includes("0.75 mm²"));
    expect(nyaf075).toBeDefined();

    const nyaf25 = DEFAULT_PR_CATALOG.find((c) => c.tipeModel.includes("2.5 mm²"));
    expect(nyaf25).toBeDefined();

    const plcItem = DEFAULT_PR_CATALOG.find((c) => c.noUrut === 50)!;
    const formatted = formatCatalogItemForPr(plcItem);
    expect(formatted.partType).toBe("FX5U-32MR/ES");
    expect(formatted.partName).toBe("Compact PLC CPU Unit (FX5U Series)");
    expect(formatted.hargaSatuan).toBe(5665000);
    expect(formatted.unit).toBe("pcs");
  });

  it("menghasilkan file Excel PR yang 100% sesuai format Import PR (round-trip tanpa error)", async () => {
    const plc = formatCatalogItemForPr(
      DEFAULT_PR_CATALOG.find((c) => c.noUrut === 50)!
    );
    const hmi = formatCatalogItemForPr(
      DEFAULT_PR_CATALOG.find((c) => c.noUrut === 61)!
    );
    const pb = formatCatalogItemForPr(
      DEFAULT_PR_CATALOG.find((c) => c.noUrut === 1)!
    );

    const filename = buildPrExportFilename("ROBOT CELL AICC", "2026-10-29");
    expect(filename).toBe("PURCHASE REQUISITION - ROBOT CELL AICC (10-29-26).xlsx");

    const buf = await exportPrToBuffer({
      header: {
        department: "ENGINEERING",
        noteCategory: "NEW PROJECT",
        prepared: "FARUQ",
        checked: "IVAN",
        purchasing: "TETI NURBAETI",
        approved: "MANAGER",
        tanggalPr: "2026-10-29",
      },
      footer: {
        partsName: "ROBOT CELL AICC",
        partsNumber: "SPM-01",
        jobNumber: "26 TWT 088",
        customer: "PT ASTRA",
      },
      items: [
        {
          kelompok: "Panel Utama",
          noPr: "1",
          partType: plc.partType,
          partName: plc.partName,
          supplier: "Flexindomas",
          qty: 1,
          unit: plc.unit,
          catatanPr: "CPU utama",
          tanggalPakai: "2026-11-10",
          hargaSatuan: plc.hargaSatuan,
        },
        {
          kelompok: "OP Panel",
          noPr: "2",
          partType: hmi.partType,
          partName: hmi.partName,
          supplier: "Flexindomas",
          qty: 1,
          unit: hmi.unit,
          catatanPr: "Display pintu OP",
          tanggalPakai: null,
          hargaSatuan: hmi.hargaSatuan,
        },
        {
          kelompok: "Panel Robot Custom",
          noPr: "3",
          partType: pb.partType,
          partName: pb.partName,
          supplier: "Flexindomas",
          qty: 4,
          unit: pb.unit,
          catatanPr: "Warna Hijau & Merah",
          tanggalPakai: null,
          hargaSatuan: pb.hargaSatuan,
        },
      ],
    });

    // Import kembali buffer hasil export menggunakan parsePrWorkbook!
    const reparsed = await parsePrWorkbook(buf, filename);

    expect(reparsed.revisionDate).toBe("2026-10-29");
    expect(reparsed.header.department).toBe("ENGINEERING");
    expect(reparsed.header.prepared).toBe("FARUQ");
    expect(reparsed.header.checked).toBe("IVAN");
    expect(reparsed.header.purchasing).toBe("TETI NURBAETI");
    expect(reparsed.header.approved).toBe("MANAGER");

    expect(reparsed.footer.partsName).toBe("ROBOT CELL AICC");
    expect(reparsed.footer.partsNumber).toBe("SPM-01");
    expect(reparsed.footer.jobNumber).toBe("26 TWT 088");
    expect(reparsed.footer.customer).toBe("PT ASTRA");

    expect(reparsed.groups).toEqual([
      "Panel Utama",
      "OP Panel",
      "Panel Robot Custom",
    ]);

    expect(reparsed.counts.total).toBe(3);
    expect(reparsed.counts.error).toBe(0);
    expect(reparsed.counts.check).toBe(0);
    expect(reparsed.counts.ok).toBe(3);

    expect(reparsed.rows[0].partType).toBe("FX5U-32MR/ES");
    expect(reparsed.rows[0].tanggalPakai).toBe("2026-11-10");
    expect(reparsed.rows[0].total).toBe(5665000);

    expect(reparsed.rows[2].kelompok).toBe("Panel Robot Custom");
    expect(reparsed.rows[2].qty).toBe(4);
    expect(reparsed.rows[2].hargaSatuan).toBe(40000);
    expect(reparsed.rows[2].total).toBe(160000);
  });

  it("mencari dan mengurutkan pilihan katalog sesuai key search (1 huruf, singkatan, & multi-kata)", () => {
    // 1. Key search 1 huruf "P" -> memunculkan komponen berawalan P di urutan teratas
    const resP = searchCatalogComponents(DEFAULT_PR_CATALOG, "P", {
      limit: 15,
      preferField: "partType",
    });
    expect(resP.matches.length).toBe(15);
    expect(resP.totalMatches).toBeGreaterThan(15);
    const firstP = formatCatalogItemForPr(resP.matches[0]);
    expect(
      firstP.partType.toLowerCase().startsWith("p") ||
        firstP.partName.toLowerCase().startsWith("p")
    ).toBe(true);

    // 2. Multi-kata & singkatan otomasi "pb idec" -> menemukan Push Button IDEC
    const resPbIdec = searchCatalogComponents(DEFAULT_PR_CATALOG, "pb idec", {
      limit: 10,
    });
    expect(resPbIdec.matches.length).toBeGreaterThan(0);
    expect(resPbIdec.matches[0].merek).toBe("IDEC");
    expect(resPbIdec.matches[0].nama.toLowerCase()).toContain("push button");

    // 3. Multi-kata lintas kolom "plc fx5u" -> menemukan Mitsubishi FX5U di urutan pertama
    const resPlc = searchCatalogComponents(DEFAULT_PR_CATALOG, "plc fx5u", {
      limit: 10,
    });
    expect(resPlc.matches.length).toBeGreaterThan(0);
    expect(resPlc.matches[0].tipeModel).toContain("FX5U");

    // 4. Highlight segmen kata kunci
    const segs = splitHighlightSegments("Mitsubishi FX5U-32MR/ES", [
      "fx5u",
      "es",
    ]);
    const highlighted = segs.filter((s) => s.highlighted).map((s) => s.text);
    expect(highlighted).toEqual(["FX5U", "ES"]);
  });

  it("mencakup semua komponen Mitsubishi MELSEC iQ-R Series termasuk modul EtherNet/IP RJ71EIP91", () => {
    // 1. Verifikasi keberadaan RJ71EIP91
    const rj71eip = DEFAULT_PR_CATALOG.find((c) => c.tipeModel === "RJ71EIP91");
    expect(rj71eip).toBeDefined();
    expect(rj71eip?.merek).toBe("Mitsubishi");
    expect(rj71eip?.kategori).toBe("PLC & Modul Kontrol");
    expect(rj71eip?.defaultUnit).toBe("unit");
    expect(rj71eip?.estimasiHarga).toBe(9800000);

    // 2. Format untuk PR Excel
    const formatted = formatCatalogItemForPr(rj71eip!);
    expect(formatted.partType).toBe("RJ71EIP91");
    expect(formatted.partName).toContain("EtherNet/IP Communication Module");
    expect(formatted.unit).toBe("unit");

    // 3. Pencarian via query "RJ71EIP91" dan alias "ethernet ip"
    const searchExact = searchCatalogComponents(DEFAULT_PR_CATALOG, "RJ71EIP91");
    expect(searchExact.matches.length).toBeGreaterThan(0);
    expect(searchExact.matches[0].tipeModel).toBe("RJ71EIP91");

    const searchEip = searchCatalogComponents(DEFAULT_PR_CATALOG, "ethernet ip rj71");
    expect(searchEip.matches.length).toBeGreaterThan(0);
    expect(searchEip.matches.some((m) => m.tipeModel === "RJ71EIP91")).toBe(true);

    // 4. Verifikasi modul-modul penting R Series lainnya
    const requiredModels = [
      "R00CPU", "R01CPU", "R02CPU", "R04CPU", "R08CPU", "R16CPU", "R32CPU", "R120CPU",
      "R04ENCPU", "R08ENCPU", "R16ENCPU", "R32ENCPU", "R08SFCPU-SET",
      "R33B", "R35B", "R38B", "R310B", "R312B", "R65B", "R68B", "R612B",
      "RC06B", "RC12B", "RC30B",
      "R61P", "R62P", "R63P", "R64P", "R61P-S1",
      "RX10", "RX40C7", "RX40PC6H", "RX40NC6H", "RX41C4", "RX42C4",
      "RY10R2", "RY18R2A", "RY40PT5P", "RY40NT5P", "RY41NT2P", "RY41PT1P", "RY42NT2P", "RY42PT1P",
      "RH42C4NT2P", "RH42C4PT1P",
      "R60AD4", "R60AD8-G", "R60AD16-G", "R60ADH4", "R60DA4", "R60DA8-G", "R60TD8-G", "R60RD8-G", "R60TCRT4",
      "RD62P2", "RD62D2", "RD75P2", "RD75P4", "RD75D4", "RD77MS2", "RD77MS4", "RD77MS8", "RD77MS16",
      "RD78G4", "RD78G8", "RD78G16",
      "RJ71EIP91", "RJ71GP21-SX", "RJ71GF11-T2", "RJ71GN11-T2", "RJ71C24", "RJ71C24-R2", "RJ71C24-R4", "RJ71PB91V", "RJ71DN91", "RJ71OP10", "RJ71MES96",
      "RG60", "NZ1MEM-4GBSD", "NZ1MEM-16GBSD"
    ];

    for (const model of requiredModels) {
      const exists = DEFAULT_PR_CATALOG.some((c) => c.tipeModel === model);
      expect(exists).toBe(true);
    }
  });

  it("memisahkan kelompok OP Panel dan Sensor secara cerdas saat nomor urut reset kembali ke 1 tanpa baris kosong", async () => {
    // Simulasi tabel PR Excel seperti kasus mtm.xlsx:
    // Baris 1-8: HMI & tombol operator (No. 1 s.d. 8)
    // Baris 9-10: Sensor proximity (No. 1 s.d. 2) langsung menyambung tanpa baris kosong
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("PR Test");

    // Header blok
    ws.getCell("B8").value = "PART TYPE";
    ws.getCell("D8").value = "PARTS NAME";
    ws.getCell("A8").value = "NO.";
    ws.getCell("G8").value = "QTY";
    ws.getCell("I8").value = "HARGA";

    // Bagian 1: OP Panel (No 1..3)
    ws.getCell("A9").value = 1;
    ws.getCell("B9").value = "HMI_GS2107-WTBD-N (MITSUBISHI)";
    ws.getCell("D9").value = "HMI";
    ws.getCell("G9").value = 1;

    ws.getCell("A10").value = 2;
    ws.getCell("B10").value = "Push Button HIJAU Φ22";
    ws.getCell("D10").value = "PUSH BOTTON";
    ws.getCell("G10").value = 5;

    ws.getCell("A11").value = 3;
    ws.getCell("B11").value = "25MM AVW411ERP (FORT)";
    ws.getCell("D11").value = "MERGENCY STOP";
    ws.getCell("G11").value = 1;

    // Bagian 2: Sensor (No 1..2 langsung tanpa baris kosong)
    ws.getCell("A12").value = 1;
    ws.getCell("B12").value = "E2E-X8MD1 2M OMS";
    ws.getCell("D12").value = "SENSOR PROXYMITY";
    ws.getCell("G12").value = 2;

    ws.getCell("A13").value = 2;
    ws.getCell("B13").value = "TL-W20ME1";
    ws.getCell("D13").value = "SENSOR PROXYMITY";
    ws.getCell("G13").value = 1;

    // Footer
    ws.getCell("D15").value = "PARTS NAME";

    const { parsePrWorksheet } = await import("@/lib/pr-parser/parse-workbook");
    const parsed = parsePrWorksheet(ws, "test-split.xlsx");

    expect(parsed.groups).toEqual(["OP Panel", "Sensor & Push Button"]);
    expect(parsed.rows.filter((r) => r.kelompok === "OP Panel").length).toBe(3);
    expect(parsed.rows.filter((r) => r.kelompok === "Sensor & Push Button").length).toBe(2);
    expect(parsed.rows[0].partName).toBe("HMI");
    expect(parsed.rows[0].kelompok).toBe("OP Panel");
  });

  it("merapikan format PR katalog: Part Code = tipeModel, Part Name = nama, Deskripsi = merek, Note = spesifikasi", () => {
    const nxm63 = DEFAULT_PR_CATALOG.find((c) => c.tipeModel === "NXM-63S")!;
    expect(nxm63).toBeDefined();
    expect(formatCatalogItemForPr(nxm63)).toMatchObject({
      partType: "NXM-63S",
      partName: "MCCB",
      merek: "CHINT",
      spesifikasi: "3 Pole 63 Ampere",
    });

    const nxm125 = DEFAULT_PR_CATALOG.find((c) => c.tipeModel === "NXM-125S")!;
    expect(nxm125).toBeDefined();
    expect(formatCatalogItemForPr(nxm125)).toMatchObject({
      partType: "NXM-125S",
      partName: "MCCB",
      merek: "CHINT",
      spesifikasi: "3 Pole 80 Ampere",
    });

    const cp32 = DEFAULT_PR_CATALOG.find((c) => c.tipeModel === "CP32D/5")!;
    expect(cp32).toBeDefined();
    expect(formatCatalogItemForPr(cp32)).toMatchObject({
      partType: "CP32D/5",
      partName: "Circuit Protector",
      merek: "FUJI",
      spesifikasi: "2 Pole 5 Ampere",
    });

    const nxbVariants = DEFAULT_PR_CATALOG.filter((c) => c.tipeModel === "NXB-63");
    expect(nxbVariants.length).toBeGreaterThanOrEqual(7);
    expect(nxbVariants.every((v) => v.nama === "MCB" && v.merek === "CHINT")).toBe(true);
    const specs = nxbVariants.map((v) => v.spesifikasi);
    expect(specs).toContain("3 Pole 10 Ampere");
    expect(specs).toContain("2 Pole 32 Ampere");
    expect(specs).toContain("2 Pole 25 Ampere");

    // Pastikan merek "Bebas" / "-" tidak masuk ke Deskripsi
    const bebasItem = DEFAULT_PR_CATALOG.find((c) => c.merek === "Bebas");
    if (bebasItem) {
      expect(formatCatalogItemForPr(bebasItem).merek).toBe("");
    }
  });
});
