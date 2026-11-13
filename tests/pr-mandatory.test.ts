import { describe, expect, it } from "vitest";
import {
  DEFAULT_PR_CATALOG,
  formatCatalogItemForPr,
} from "@/lib/pr-catalog-default";
import {
  MANDATORY_PR_COMPONENTS,
  MANDATORY_PR_GROUP,
  buildPrSubmissionItems,
  matchMandatoryKey,
  mergeMandatoryPrRows,
  type MandatoryMergeRowInput,
} from "@/lib/pr-mandatory";
import {
  classifyPrComponent,
  inferComponentVisual,
  isHmiPanelComponent,
  isNameplateOrEnclosureShell,
  isSensorOrFieldComponent,
} from "@/lib/panel-layout-template";
import {
  ARRIVED_PURCHASE_STATUSES,
  PURCHASE_STATUSES,
  PURCHASE_STATUS_LABELS,
  filterExportablePrItems,
  isExcludedFromPrExport,
} from "@/lib/constants";
import { searchCatalogComponents } from "@/lib/catalog-search";

function makeRowFromSpec(
  spec: (typeof MANDATORY_PR_COMPONENTS)[number],
  index: number
): MandatoryMergeRowInput {
  return {
    kelompok: spec.kelompok,
    noPr: String(index),
    partType: spec.partType,
    partName: spec.partName,
    supplier: spec.supplier,
    qty: spec.defaultQty,
    unit: spec.unit,
    catatanPr: spec.catatanPr,
    tanggalPakai: "",
    hargaSatuan: String(spec.hargaSatuan),
    mandatoryKey: spec.key,
  };
}

describe("Komponen Wajib PR (pr-mandatory)", () => {
  it("menyediakan seluruh komponen wajib termasuk kabel 0.34, 0.75, 2.5, 6, kabel core 0.34 & 0.75, ducting, din rail, tag panel, skun y, kabel bakar", () => {
    const keys = MANDATORY_PR_COMPONENTS.map((c) => c.key);
    expect(keys).toEqual([
      "kabel-034",
      "kabel-075",
      "kabel-25",
      "kabel-6",
      "kabel-core-034",
      "kabel-core-075",
      "ducting-30x30",
      "ducting-30x40",
      "ducting-30x60",
      "ducting-40x40",
      "ducting-40x60",
      "ducting-60x60",
      "din-rail",
      "tag-panel",
      "skun-y",
      "kabel-bakar",
    ]);

    for (const spec of MANDATORY_PR_COMPONENTS) {
      expect(spec.defaultQty).toBe(0);
      expect(spec.supplier).toBe("");
      expect(spec.catatanPr).toBe("");
      expect(spec.kelompok).toBe(MANDATORY_PR_GROUP);

      const inCatalog = DEFAULT_PR_CATALOG.some((cat) => {
        const f = formatCatalogItemForPr(cat);
        return (
          f.partType.toLowerCase() === spec.partType.toLowerCase() &&
          f.partName.toLowerCase() === spec.partName.toLowerCase()
        );
      });
      expect(inCatalog).toBe(true);
    }
  });

  it("mengisi PR baru dengan 16 baris wajib bernilai awal 0", () => {
    const rows = mergeMandatoryPrRows([], makeRowFromSpec);
    expect(rows).toHaveLength(16);
    expect(rows.every((r) => r.qty === 0 && r.mandatoryKey)).toBe(true);
  });

  it("mempertahankan qty eksisting saat load proyek tanpa menduplikasi komponen wajib", () => {
    const existing: MandatoryMergeRowInput[] = [
      {
        kelompok: "Panel Utama",
        noPr: "1",
        partType: "Mitsubishi FX5U-32MT/DS",
        partName: "PLC",
        supplier: "Flexindomas",
        qty: 1,
        unit: "pcs",
        catatanPr: "",
        tanggalPakai: "",
        hargaSatuan: "8500000",
      },
      {
        kelompok: "Panel Utama",
        noPr: "2",
        partType: "Bebas / KSS PVC Wiring Duct 30x40 mm (per 2m)",
        partName: "Kabel Duct PVC Berlubang 30x40",
        supplier: "KSS",
        qty: 3,
        unit: "btg",
        catatanPr: "",
        tanggalPakai: "",
        hargaSatuan: "32000",
      },
    ];

    const merged = mergeMandatoryPrRows(existing, makeRowFromSpec);
    // 1 non-wajib (PLC) + 16 wajib (1 dari existing yg ditandai ducting-30x40 + 15 sisanya)
    expect(merged).toHaveLength(17);
    expect(merged[0].mandatoryKey).toBeNull();
    expect(merged[1].mandatoryKey).toBe("ducting-30x40");
    expect(merged[1].qty).toBe(3);

    const ductCount = merged.filter(
      (r) => r.mandatoryKey === "ducting-30x40"
    ).length;
    expect(ductCount).toBe(1);
  });

  it("mengeluarkan komponen wajib bernilai 0 dari payload PR dan memasukkan yang bernilai > 0", () => {
    const rows = mergeMandatoryPrRows(
      [
        {
          kelompok: "Panel Utama",
          noPr: "1",
          partType: "Omron MY2N-D2 24VDC",
          partName: "Relay 24VDC",
          supplier: "Flexindomas",
          qty: 4,
          unit: "pcs",
          catatanPr: "",
          tanggalPakai: "",
          hargaSatuan: "45000",
        },
      ],
      makeRowFromSpec
    );

    // Ubah Kabel 0.75 menjadi 2 (+ custom harga & supplier) dan Kabel Core 0.34 menjadi 15; lainnya tetap 0
    for (const r of rows) {
      if (r.mandatoryKey === "kabel-075") {
        r.qty = 2;
        r.hargaSatuan = "315000";
        r.supplier = "Toko Kabel";
      }
      if (r.mandatoryKey === "kabel-core-034") r.qty = 15;
    }

    const res = buildPrSubmissionItems(rows);
    expect(res.error).toBeNull();
    expect(res.items).toHaveLength(3); // 1 Relay + Kabel 0.75 + Kabel Core 0.34
    expect(res.items?.map((i) => i.partName)).toEqual([
      "Relay 24VDC",
      "Kabel Fleksibel Kontrol NYAF 0.75 mm²",
      "Kabel Core Sinyal 0.34 mm² (Multicore Shielded)",
    ]);
    expect(res.items?.[1]?.hargaSatuan).toBe(315000);
    expect(res.items?.[1]?.supplier).toBe("Toko Kabel");
    expect(res.items?.[2]?.supplier).toBeNull();
  });

  it("menolak simpan/export jika seluruh komponen wajib masih 0 dan tidak ada komponen lain", () => {
    const rows = mergeMandatoryPrRows([], makeRowFromSpec);
    const res = buildPrSubmissionItems(rows);
    expect(res.items).toBeNull();
    expect(res.error).toBeTruthy();
  });

  it("membedakan kabel tunggal, kabel core, grounding, din rail, dan komponen panel biasa secara akurat", () => {
    expect(matchMandatoryKey("NYAF 0.34", "Kabel Kontrol 0.34 mm²")).toBe(
      "kabel-034"
    );
    expect(matchMandatoryKey("Kabel Core 0.34", "Kabel Sinyal")).toBe(
      "kabel-core-034"
    );
    expect(matchMandatoryKey("NYAF 0.75", "Kabel Kontrol 0.75 mm²")).toBe(
      "kabel-075"
    );
    expect(matchMandatoryKey("Kabel Core 0.75 mm²", "Multicore")).toBe(
      "kabel-core-075"
    );
    expect(matchMandatoryKey("NYAF 2.5 mm²", "Kabel Power")).toBe("kabel-25");
    expect(matchMandatoryKey("NYAF 6 mm²", "Kabel Feeder")).toBe("kabel-6");
    expect(
      matchMandatoryKey(
        "NYAF 2.5 mm² Yellow-Green",
        "Kabel Grounding NYAF 2.5 mm²"
      )
    ).toBeNull();
    expect(
      matchMandatoryKey("PVC Wiring Duct 30x30 mm", "Kabel Duct 30x30")
    ).toBe("ducting-30x30");
    expect(
      matchMandatoryKey("PVC Wiring Duct 30x40 mm", "Kabel Duct 30x40")
    ).toBe("ducting-30x40");
    expect(
      matchMandatoryKey("PVC Wiring Duct 30x60 mm", "Kabel Duct 30x60")
    ).toBe("ducting-30x60");
    expect(
      matchMandatoryKey("PVC Wiring Duct 40x40 mm", "Kabel Duct 40x40")
    ).toBe("ducting-40x40");
    expect(
      matchMandatoryKey("PVC Wiring Duct 40x60 mm", "Kabel Duct 40x60")
    ).toBe("ducting-40x60");
    expect(
      matchMandatoryKey("PVC Wiring Duct 60x60 mm", "Kabel Duct 60x60")
    ).toBe("ducting-60x60");
    expect(
      matchMandatoryKey("Skun Y 1.25-3", "Skun Garpu Y")
    ).toBe("skun-y");
    expect(
      matchMandatoryKey("Kabel Bakar", "Heat Shrink Tube")
    ).toBe("kabel-bakar");
    expect(
      matchMandatoryKey("Tag Panel Acrylic", "Nameplate Panel")
    ).toBe("tag-panel");
    expect(
      matchMandatoryKey("DIN Rail 35x7.5mm Slotted", "Aluminium Din Rail 35mm")
    ).toBe("din-rail");
    // Jangan salah mendeteksi MCB/Power Supply/Terminal yg kebetulan menyebut "Din Rail"
    expect(
      matchMandatoryKey(
        "Omron S8VK-G06024",
        "Power Supply SMPS Din Rail 60W 24V"
      )
    ).toBeNull();
    expect(
      matchMandatoryKey("TOGI PTU-20", "Terminal Block Din Rail Control")
    ).toBeNull();
  });

  it("memastikan seluruh 16 komponen wajib tidak masuk otomatis sebagai blok komponen rel DIN panel 2D", () => {
    for (const spec of MANDATORY_PR_COMPONENTS) {
      const skipped =
        isSensorOrFieldComponent(spec.partType, spec.partName, spec.kelompok) ||
        isNameplateOrEnclosureShell(
          spec.partType,
          spec.partName,
          spec.kelompok
        ) ||
        classifyPrComponent(spec.partType, spec.partName, spec.kelompok) ===
          "OTHER";
      expect(skipped).toBe(true);
    }
  });

  it("menyediakan katalog Push Button versi LED serta beragam tipe HUB yang terklasifikasi rapi di layout panel", () => {
    const abwRelated = searchCatalogComponents(DEFAULT_PR_CATALOG, "ABW111EP", {
      limit: 10,
    }).matches;
    expect(abwRelated.some((c) => c.tipeModel.includes("ABW111EP"))).toBe(true);
    expect(abwRelated.some((c) => c.tipeModel.includes("ABL111EP-24V"))).toBe(
      true
    );
    expect(abwRelated.some((c) => c.tipeModel.includes("ABL111EP-220V"))).toBe(
      true
    );

    const hubMatches = searchCatalogComponents(DEFAULT_PR_CATALOG, "HUB", {
      limit: 20,
    }).matches;
    expect(hubMatches.length).toBeGreaterThanOrEqual(7);

    // Panel DIN-rail HUB (termasuk USB HUB) harus masuk layout panel utama sebagai HUB_SWITCH
    expect(
      isHmiPanelComponent(
        "Waveshare / Aten USB-HUB-7P-DIN (Industrial USB HUB)",
        "Industrial USB 3.0 HUB 7-Port DIN Rail (Metal + ESD)",
        "Panel Utama"
      )
    ).toBe(false);
    expect(
      classifyPrComponent(
        "Moxa EDS-205A (Ethernet HUB 5-Port)",
        "Industrial Ethernet HUB / Switch 5-Port (DIN Rail 24VDC)",
        "Panel Utama"
      )
    ).toBe("PLC_CONTROL");
    expect(
      inferComponentVisual(
        "ICP DAS / Waveshare RS485-HUB-4P (4-Channel Isolated HUB)",
        "Industrial RS485 HUB / Splitter 4-Port Isolated (DIN Rail)"
      ).category
    ).toBe("HUB_SWITCH");

    // Push button versi LED terklasifikasi untuk OP / HMI panel
    expect(
      isHmiPanelComponent(
        "FORT ABL111EP-24V (G/R/Y/B)",
        "Push Button Illuminated LED 22mm 24VDC (1NO 1NC)",
        "OP Panel"
      )
    ).toBe(true);
  });

  it("includes MISUMI Economy E-DFAS04P AC Servo Driver with exact technical drawing dimensions (40 x 175 x 156 mm)", () => {
    const servo = DEFAULT_PR_CATALOG.find((item) => item.tipeModel === "E-DFAS04P");
    expect(servo).toBeDefined();
    expect(servo?.merek).toBe("MISUMI Economy");
    expect(servo?.estimasiHarga).toBe(2083626);
    expect(servo?.spesifikasi).toContain("40 × 175 × 156 mm");

    const prName = "AC Servo Driver 400W 1-Phase 220V (Pulse + RS485)";
    const prType = "MISUMI Economy E-DFAS04P";
    expect(isSensorOrFieldComponent(prType, prName, "Panel Utama")).toBe(false);
    expect(classifyPrComponent(prType, prName, "Panel Utama")).toBe("PLC_CONTROL");

    const visual = inferComponentVisual(prType, prName);
    expect(visual.category).toBe("PLC");
    expect(visual.widthMm).toBe(40);
    expect(visual.heightMm).toBe(175);
    expect(visual.specificModel).toBe("SERVO_DRIVE_E_DFAS");

    const found = searchCatalogComponents(DEFAULT_PR_CATALOG, "E-DFAS04P", { limit: 5 }).matches;
    expect(found.some((c) => c.tipeModel === "E-DFAS04P")).toBe(true);
  });

  it("mengecualikan part berstatus Sudah Ada / Sudah Datang / Terpasang saat export PR", () => {
    expect(PURCHASE_STATUSES).toContain("SUDAH_ADA");
    expect(PURCHASE_STATUS_LABELS.SUDAH_ADA).toBe("Sudah Ada");
    expect(ARRIVED_PURCHASE_STATUSES).toEqual(
      expect.arrayContaining(["SUDAH_ADA", "SUDAH_DATANG", "TERPASANG"])
    );

    expect(isExcludedFromPrExport("SUDAH_ADA")).toBe(true);
    expect(isExcludedFromPrExport("SUDAH_DATANG")).toBe(true);
    expect(isExcludedFromPrExport("TERPASANG")).toBe(true);
    expect(isExcludedFromPrExport("BELUM_PR")).toBe(false);
    expect(isExcludedFromPrExport("PR_DIAJUKAN")).toBe(false);
    expect(isExcludedFromPrExport("SUDAH_DIPESAN")).toBe(false);
    expect(isExcludedFromPrExport(null)).toBe(false);

    const mockItems = [
      { id: "1", partName: "BOX PANEL", statusPembelian: "BELUM_PR" },
      { id: "2", partName: "PLC", statusPembelian: "PR_DIAJUKAN" },
      { id: "3", partName: "SAFETY RELAY", statusPembelian: "SUDAH_DATANG" },
      { id: "4", partName: "MCB 6A", statusPembelian: "SUDAH_ADA" },
      { id: "5", partName: "TERMINAL BLOK", statusPembelian: "TERPASANG" },
      { id: "6", partName: "NOISE FILTER", statusPembelian: "SUDAH_DIPESAN" },
    ];

    const filtered = filterExportablePrItems(mockItems);
    expect(filtered.map((i) => i.id)).toEqual(["1", "2", "6"]);
  });
});
