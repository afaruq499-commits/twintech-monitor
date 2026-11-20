import { describe, expect, it } from "vitest";
import {
  alignSelectedPanelItems,
  buildStandardPanelLayoutFromComponents,
  classifyHmiPrComponent,
  classifyPrComponent,
  createDefaultOuterPanelLayout,
  createStandardOpMountingLayout,
  createStandardSpmLayout,
  detectOuterPanelPrFeatures,
  detectPrDuctProfile,
  inferComponentVisual,
  isHmiPanelComponent,
  isNameplateOrEnclosureShell,
  isSensorOrFieldComponent,
  moveSelectedPanelItems,
  parseDualPanelLayoutJson,
  serializeDualPanelLayoutPayload,
  shouldAutoSyncPanelLayout,
  toggleSelectionId,
  type PanelComponentInput,
  type PanelLayoutItem,
} from "../src/lib/panel-layout-template";
import { generateOuterPanelDxf } from "../src/lib/export/panel-dxf-generator";
import {
  DEFAULT_PR_CATALOG,
  FR_EG_EP_006_PDF_COMPONENTS,
} from "../src/lib/pr-catalog-default";

function makeComp(
  id: string,
  partType: string,
  partName: string,
  qty = 1,
  kelompok = "Komponen Panel"
): PanelComponentInput {
  return {
    id,
    partType,
    partName,
    qty,
    kelompok,
  };
}

describe("FR-EG-EP-006 Panel Layout Auto-Template", () => {
  it("tidak salah memfilter panel fan, stopper din rail, dan mengecualikan nameplate / box panel", () => {
    expect(isSensorOrFieldComponent("FAN-12CM", "Exhaust Fan Cooling Panel 12CM", "Panel")).toBe(false);
    expect(isSensorOrFieldComponent("FAN-9CM", "Cooling Fan Box OP 9CM", "Panel")).toBe(false);
    expect(isSensorOrFieldComponent("HDV-1", "Stopper DIN Rail End Clamp", "Panel")).toBe(false);

    // Sensor / aktuator lapangan tetap terfilter
    expect(isSensorOrFieldComponent("E2E-X5ME1", "Proximity Sensor M12", "Sensor")).toBe(true);
    expect(isSensorOrFieldComponent("CDQ2B20-20DCZ", "Cylinder Pneumatic Stopper", "Pneumatic")).toBe(true);

    // Nameplate, box panel, dan cooling fan ventilasi bodi tidak dimasukkan ke layout plat dasar
    expect(isNameplateOrEnclosureShell("TAG-EMG", "Name Tag Legend Plate", "Panel")).toBe(true);
    expect(isNameplateOrEnclosureShell("BOX-MAIN", "Main Panel Box 700x900x315", "Panel")).toBe(true);
    expect(isNameplateOrEnclosureShell("FORT XF1232ASH", "FAN 12CM", "Panel")).toBe(true);
    expect(isNameplateOrEnclosureShell("FAN-12CM", "Cooling Fan 120mm", "Aksesoris")).toBe(true);
  });

  it("mendeteksi visual komponen iQ-R, MCCB, Main Switch, NS-205, Tower Lamp, dan Terminal OP", () => {
    expect(inferComponentVisual("EZC100B3040", "MCCB 3P 40A Schneider")).toMatchObject({
      category: "MCCB",
      widthMm: 75,
      heightMm: 130,
    });
    expect(inferComponentVisual("EZAROTE", "Main Switch Rotary Disconnect")).toMatchObject({
      category: "MAIN_SWITCH",
    });
    expect(inferComponentVisual("R35B", "Base Rack 5 Slot Mitsubishi")).toMatchObject({
      category: "PLC",
      specificModel: "PLC_BASE_RACK",
    });
    expect(inferComponentVisual("R61P", "Power Supply PLC iQ-R")).toMatchObject({
      category: "PLC",
      specificModel: "PLC_POWER_MODULE",
    });
    expect(inferComponentVisual("R04CPU", "CPU Module iQ-R")).toMatchObject({
      category: "PLC",
      specificModel: "PLC_CPU_MODULE",
    });
    expect(inferComponentVisual("NS-205", "Industrial Hub Switch 5 Port")).toMatchObject({
      category: "HUB_SWITCH",
    });
    expect(inferComponentVisual("PTE-APZ-302", "Tower Lamp 3 Stack LED")).toMatchObject({
      category: "TOWER_LAMP",
    });
    expect(inferComponentVisual("PTU-20", "Terminal Block 20A")).toMatchObject({
      category: "TERMINAL",
    });
  });

  it("menyusun BOM lengkap FR-EG-EP-006 otomatis ke 3 panel (Main, Pintu OP, Mounting OP)", () => {
    const bom: PanelComponentInput[] = [
      // Page 1 / Main Enclosure & Door / Accessories
      makeComp("box1", "BOX-700X900", "Main Panel Enclosure 700x900x315", 1),
      makeComp("tag1", "NAMEPLATE", "Name Tag Legend Plate", 10),
      makeComp("fan1", "FAN-12CM", "Fan 12CM Panel Utama", 1),
      makeComp("ms1", "EZAROTE", "Main Switch Door Interlock", 1),
      makeComp("tw1", "PTE-APZ-302", "Tower Lamp 3 Warna", 1),

      // Page 2 / Main Panel Mounting Plate (600x800)
      makeComp("mccb1", "EZC100B3040", "MCCB 3P 40A", 1),
      makeComp("nf1", "RSAL-2006", "TDK Noise Filter 6A", 1),
      makeComp("psu1", "S8VK-G24024", "Power Supply 24VDC 10A", 1),
      makeComp("mcb1", "A9F74206", "MCB 2P 6A", 3),
      makeComp("rack1", "R35B", "PLC Base Rack 5 Slot", 1),
      makeComp("pws1", "R61P", "PLC Power Supply Module", 1),
      makeComp("cpu1", "R04CPU", "PLC CPU Module", 1),
      makeComp("in1", "RX42C4", "PLC DC Input 64Pt", 1),
      makeComp("out1", "RY42NT2P", "PLC Transistor Output 64Pt", 1),
      makeComp("ccl1", "RJ61BT11", "CC-Link IE Module", 1),
      makeComp("sr1", "G9SA-301", "Safety Relay Unit", 1),
      makeComp("rel1", "MY4N-GS-24DC", "Relay 24VDC", 6),
      makeComp("sock1", "PYF14A", "Relay Socket PYF14A", 6),
      makeComp("hub1", "NS-205", "Ethernet Hub Switch 5 Port", 1),
      makeComp("tb1", "PTW-SS10", "Power Terminal Block 10P", 2),
      makeComp("tb2", "PTU-20", "Control Terminal Block 20A", 3),
      makeComp("hdv1", "HDV-1", "Stopper DIN Rail End Clamp", 4),

      // Page 3 / OP Panel Door (430x440) — 10 item matriks V (1:4) + HMI + Tower + Buzzer
      makeComp("hmi1", "GS2110-WTBD", "HMI Touchscreen 10 Inch", 1, "HMI & OP"),
      makeComp("emg1", "YW1B-V4E02R", "Emergency Stop Push Button", 1, "HMI & OP"),
      makeComp("pb0", "YW1L-MF2E11Q-B", "Push Button Master On (Blue)", 1, "HMI & OP"),
      makeComp("pb1", "YW1B-M1E10W", "Push Button Origin (Orange)", 1, "HMI & OP"),
      makeComp("pb2", "YW1B-M1E10S", "Push Button Reset Fault (Yellow)", 1, "HMI & OP"),
      makeComp("pb3", "YW1B-M1E10B", "Push Button Auto Start (Green)", 1, "HMI & OP"),
      makeComp("pb4", "YW1B-M1E10R", "Push Button Auto Stop (Red)", 1, "HMI & OP"),
      makeComp("pb5", "YW1B-M1E10K", "Push Button Pick WP (Black)", 1, "HMI & OP"),
      makeComp("sw1", "YW1S-2E11", "Selector Switch Mode", 1, "HMI & OP"),
      makeComp("lp1", "YW1P-2EQ24W", "Pilot Lamp Power & Ready", 2, "HMI & OP"),
      makeComp("bz1", "BUZZER-24V", "Buzzer Alarm 24VDC", 1, "HMI & OP"),

      // Page 4 / OP Mounting Plate (350x300)
      makeComp("op-tb", "PTU-10", "Terminal Block OP Panel 10A", 4, "OP Panel"),
    ];

    const layout = buildStandardPanelLayoutFromComponents(bom);

    expect(layout.autoGenerated).toBe(true);
    expect(layout.templateCode).toBe("FR-EG-EP-006");

    // Enclosure sizes match FR-EG-EP-006
    expect(layout.main.enclosure.widthMm).toBe(600);
    expect(layout.main.enclosure.heightMm).toBe(800);
    expect(layout.hmi.enclosure.widthMm).toBe(430);
    expect(layout.hmi.enclosure.heightMm).toBe(440);
    expect(layout.opMounting.enclosure.widthMm).toBe(350);
    expect(layout.opMounting.enclosure.heightMm).toBe(300);

    // No enclosure shell / nameplate accidentally placed as component
    const allComps = [
      ...layout.main.items,
      ...layout.hmi.items,
      ...layout.opMounting.items,
    ].filter((it) => it.type === "COMPONENT");

    expect(allComps.some((it) => it.componentId === "box1")).toBe(false);
    expect(allComps.some((it) => it.componentId === "tag1")).toBe(false);

    // Main panel has MCCB, Main Switch, PLC Rack + 5 iQ-R modules, Filter, PSU, MCBs, G9SA, Relays, Hub, Main Terminals
    const mainComps = layout.main.items.filter((it) => it.type === "COMPONENT");
    expect(mainComps.some((it) => it.componentId === "mccb1")).toBe(true);
    expect(mainComps.some((it) => it.componentId === "ms1")).toBe(true);
    expect(mainComps.some((it) => it.componentId === "rack1")).toBe(true);
    expect(mainComps.some((it) => it.componentId === "cpu1")).toBe(true);
    expect(mainComps.some((it) => it.componentId === "hub1")).toBe(true);
    expect(mainComps.filter((it) => it.componentId === "mcb1").length).toBe(3);

    // Relays & Sockets paired or placed cleanly without negative positions
    for (const it of [...layout.main.items, ...layout.hmi.items, ...layout.opMounting.items]) {
      expect(it.xMm).toBeGreaterThanOrEqual(0);
      expect(it.yMm).toBeGreaterThanOrEqual(0);
    }

    // HMI Door has HMI, E-Stop, PBs, Selector, Lamps, Tower Lamp
    const hmiComps = layout.hmi.items.filter((it) => it.type === "COMPONENT");
    expect(hmiComps.some((it) => it.componentId === "hmi1")).toBe(true);
    expect(hmiComps.some((it) => it.componentId === "emg1")).toBe(true);
    expect(hmiComps.some((it) => it.componentId === "tw1")).toBe(true);
    expect(hmiComps.some((it) => it.componentId === "sw1")).toBe(true);
    expect(hmiComps.filter((it) => it.category === "PUSH_BUTTON").length).toBeGreaterThanOrEqual(5);

    // OP Mounting has 32x32 ducts, vertical center DIN rail, and OP terminals
    const opRails = layout.opMounting.items.filter((it) => it.type === "DIN_RAIL");
    expect(opRails.length).toBeGreaterThanOrEqual(1);
    expect(opRails[0].heightMm).toBeGreaterThan(opRails[0].widthMm); // Vertikal
    const opComps = layout.opMounting.items.filter((it) => it.type === "COMPONENT");
    expect(opComps.some((it) => it.componentId === "op-tb")).toBe(true);
  });

  it("mengatur overflow komponen jumlah banyak secara rapi dan memperluas rel / plat jika perlu", () => {
    const denseBom: PanelComponentInput[] = [
      makeComp("plc", "FX5U-64MT/ES", "PLC Mitsubishi 64 I/O", 1),
      makeComp("mcb", "A9F74206", "MCB 2P 6A", 14),
      makeComp("rel", "MY2N-GS-24DC", "Relay 24VDC + Socket", 18),
      makeComp("pb", "PB-START", "Push Button Operator", 12, "HMI & OP"),
    ];

    const layout = buildStandardPanelLayoutFromComponents(denseBom);
    const mainMcb = layout.main.items.filter((i) => i.componentId === "mcb");
    const mainRel = layout.main.items.filter((i) => i.componentId === "rel");
    const hmiPbs = layout.hmi.items.filter((i) => i.componentId === "pb");

    expect(mainMcb.length).toBe(14);
    expect(mainRel.length).toBe(18);
    expect(hmiPbs.length).toBe(12);

    // Pastikan semua berada di dalam batas plat (plat boleh otomatis membesar bila melebihi 800mm)
    for (const item of layout.main.items) {
      expect(item.xMm + item.widthMm).toBeLessThanOrEqual(layout.main.enclosure.widthMm);
      expect(item.yMm + item.heightMm).toBeLessThanOrEqual(layout.main.enclosure.heightMm);
    }
    for (const item of layout.hmi.items) {
      expect(item.yMm + item.heightMm).toBeLessThanOrEqual(layout.hmi.enclosure.heightMm);
    }
  });

  it("menjaga tata letak manual user (autoGenerated: false) tidak tertimpa sinkronisasi PR", () => {
    expect(shouldAutoSyncPanelLayout(null)).toBe(true);
    expect(shouldAutoSyncPanelLayout("")).toBe(true);
    expect(shouldAutoSyncPanelLayout("invalid json")).toBe(true);

    // Template kosong lama (hanya duct & rel tanpa komponen) -> wajib auto-sync
    const emptyShell = createStandardSpmLayout();
    expect(
      shouldAutoSyncPanelLayout(
        JSON.stringify({
          enclosure: emptyShell.enclosure,
          items: emptyShell.items,
          main: emptyShell,
        })
      )
    ).toBe(true);

    const autoLayout = buildStandardPanelLayoutFromComponents([
      makeComp("c1", "A9F74206", "MCB 2P 6A", 2),
    ]);
    expect(
      shouldAutoSyncPanelLayout(
        serializeDualPanelLayoutPayload({ ...autoLayout, autoGenerated: true })
      )
    ).toBe(true);

    // Jika user sudah memindahkan & menyimpan manual (autoGenerated: false) -> JANGAN timpa
    const customPayload = serializeDualPanelLayoutPayload({
      ...autoLayout,
      autoGenerated: false,
    });
    expect(shouldAutoSyncPanelLayout(customPayload)).toBe(false);

    // Round-trip parse mempertahankan flag & ke-3 panel
    const parsed = parseDualPanelLayoutJson(customPayload, []);
    expect(parsed.autoGenerated).toBe(false);
    expect(parsed.main.enclosure.widthMm).toBe(600);
    expect(parsed.hmi.enclosure.widthMm).toBe(430);
    expect(parsed.opMounting.enclosure.widthMm).toBe(350);
  });

  it("menempatkan OP panel mounting standar 350x300 dan mengklasifikasikan PR dengan konsisten", () => {
    const opDefault = createStandardOpMountingLayout();
    expect(opDefault.enclosure).toMatchObject({ widthMm: 350, heightMm: 300 });
    expect(opDefault.items.filter((i) => i.type === "DUCT_HORIZONTAL").length).toBe(2);
    expect(opDefault.items.filter((i) => i.type === "DUCT_VERTICAL").length).toBe(2);
    expect(opDefault.items.filter((i) => i.type === "DIN_RAIL").length).toBe(1);

    expect(classifyPrComponent("R04CPU", "PLC CPU Module", "Kontrol")).toBe("PLC_CONTROL");
    expect(classifyPrComponent("EZC100B3040", "MCCB 3P 40A", "Power")).toBe("POWER_PROTECTION");
    expect(isHmiPanelComponent("GS2110", "Touchscreen HMI 10\"", "HMI")).toBe(true);
    expect(classifyHmiPrComponent("PTE-APZ-302", "Tower Lamp", "Panel")).toBe("INDICATOR_ALARM");
  });

  it("daftar komponen PDF FR-EG-EP-006 lengkap untuk PR dan otomatis terlayout sempurna", () => {
    expect(FR_EG_EP_006_PDF_COMPONENTS.length).toBeGreaterThanOrEqual(40);
    const pages = new Set(FR_EG_EP_006_PDF_COMPONENTS.map((p) => p.page));
    expect(Array.from(pages).sort()).toEqual([1, 2, 3, 4]);

    // Setiap item PDF harus punya kecocokan lookupKeyword di DEFAULT_PR_CATALOG
    for (const preset of FR_EG_EP_006_PDF_COMPONENTS) {
      const needle = preset.lookupKeyword.toLowerCase();
      const matched = DEFAULT_PR_CATALOG.find((c) =>
        `${c.merek} ${c.tipeModel} ${c.nama}`.toLowerCase().includes(needle)
      );
      expect(matched, `Katalog belum punya ${preset.partType} (${preset.lookupKeyword})`).toBeDefined();
    }

    const prInput: PanelComponentInput[] = FR_EG_EP_006_PDF_COMPONENTS.map((p) => ({
      id: p.id,
      partType: p.partType,
      partName: p.partName,
      qty: p.defaultQty,
      kelompok: p.kelompok,
      catatanPr: p.catatanPr,
      statusImport: "BARU",
    }));

    const layout = buildStandardPanelLayoutFromComponents(prInput);
    expect(layout.main.enclosure).toMatchObject({ widthMm: 600, heightMm: 800 });
    expect(layout.hmi.enclosure).toMatchObject({ widthMm: 430, heightMm: 440 });
    expect(layout.opMounting.enclosure).toMatchObject({ widthMm: 350, heightMm: 300 });

    const mainComps = layout.main.items.filter((i) => i.type === "COMPONENT");
    expect(mainComps.some((i) => i.componentId === "pdf-p2-rx42c4")).toBe(true);
    expect(mainComps.some((i) => i.componentId === "pdf-p2-rx41c4")).toBe(true);
    expect(mainComps.find((i) => i.componentId === "pdf-p2-nf-rob")?.specificModel).toBe("NOISE_FILTER_3P");

    const hmiComps = layout.hmi.items.filter((i) => i.type === "COMPONENT");
    expect(hmiComps.find((i) => i.componentId === "pdf-p3-hmi")?.specificModel).toBe("HMI_10INCH");
    expect(hmiComps.find((i) => i.componentId === "pdf-p3-tower")?.specificModel).toBe("TOWER_LAMP_RYG");
    expect(hmiComps.some((i) => i.componentId === "pdf-p3-10-pick")).toBe(true);

    const opComps = layout.opMounting.items.filter((i) => i.type === "COMPONENT");
    expect(opComps.some((i) => i.componentId === "pdf-p4-ptu10")).toBe(true);
    expect(opComps.some((i) => i.componentId === "pdf-p4-ptwss10")).toBe(true);
    expect(opComps.some((i) => i.componentId === "pdf-p4-hdv1")).toBe(true);
  });

  it("tidak memblokir Power Supply / Terminal / Socket / Safety Controller bertuliskan Din Rail dan menempatkan PSU di panel", () => {
    // Power Supply SMPS Din Rail & variannya tidak boleh tersaring sebagai bare DIN rail shell
    expect(
      isNameplateOrEnclosureShell("Omron S8VK-C24024", "Power Supply SMPS Din Rail 240W 24V", "Panel Utama")
    ).toBe(false);
    expect(
      isNameplateOrEnclosureShell("Autonics SPB-120-24", "Power Supply SMPS Din Rail 120W 24V", "Panel Utama")
    ).toBe(false);
    expect(
      isNameplateOrEnclosureShell("FORT TBD-10A", "Terminal Block Din Rail 10A", "Panel Utama")
    ).toBe(false);
    expect(
      isNameplateOrEnclosureShell("P2RF-08-E", "Socket Relay 8-Pin Din Rail", "Panel Utama")
    ).toBe(false);
    expect(
      isNameplateOrEnclosureShell("1 Hole SN-016", "Stop Kontak DIN Rail 1 Lubang", "Panel Utama")
    ).toBe(false);

    // Bare DIN rail & cable duct tetap tersaring dari daftar komponen PR
    expect(isNameplateOrEnclosureShell("TS35", "DIN Rail Aluminium 1 Meter", "Panel Utama")).toBe(true);

    // Klasifikasi akurat tanpa false-positive substring (PLC / TOR / ROLLER / ISOLASI / OP PANEL)
    expect(classifyPrComponent("S8VK-C24024-Omron", "Power Supply PLC 24VDC 10A", "Panel Utama")).toBe("POWER_PROTECTION");
    expect(classifyPrComponent("Schneider A9F74206", "MCB PLC Control Schneider", "Panel Utama")).toBe("POWER_PROTECTION");
    expect(classifyPrComponent("RSAL-2006-TDK", "Noise Filter PLC 1-Phase 6A", "Panel Utama")).toBe("POWER_PROTECTION");
    expect(classifyPrComponent("Schneider VCF1 / EZAROTE", "Main Switch Rotary Isolator (LOTO)", "Panel Utama")).toBe("POWER_PROTECTION");
    expect(classifyPrComponent("R61P-MITSUBISHI", "Power Supply PLC Module iQ-R", "Panel Utama")).toBe("PLC_CONTROL");

    expect(
      isSensorOrFieldComponent("G9SA-TH301 AC/DC24", "Safety Relay Unit Two-Hand Controller", "Panel Utama")
    ).toBe(false);
    expect(
      isSensorOrFieldComponent("Trafo Step-Down 1 kVA", "Trafo Isolasi 1 Phasa 1000VA", "Panel Utama")
    ).toBe(false);
    expect(isHmiPanelComponent("MCB Chint NXB-63 2P 6A", "MCB", "OP Panel")).toBe(false);
    expect(isHmiPanelComponent("1 Hole SN-016", "Stop Kontak", "OP Panel")).toBe(false);

    const layout = buildStandardPanelLayoutFromComponents([
      makeComp("ms1", "Schneider VCF1 / EZAROTE", "Main Switch Rotary Isolator (LOTO)", 1, "Panel Utama"),
      makeComp("mcb1", "MCB Chint NXB-63 2P 6A", "MCB", 2, "Panel Utama"),
      makeComp("psu1", "Omron S8VK-C24024", "Power Supply SMPS Din Rail 240W 24V", 1, "Panel Utama"),
      makeComp("nf3", "ENF-RTEN-5020D-TDK", "Noise Filter Robot 3-Phase 20A", 1, "Panel Utama"),
      makeComp("tb1", "FORT TBD-10A", "Terminal Block Din Rail 10A", 1, "Panel Utama"),
    ]);
    const mainComps = layout.main.items.filter((i) => i.type === "COMPONENT");
    expect(mainComps.some((i) => i.componentId === "psu1" && i.category === "POWER_SUPPLY")).toBe(true);
    expect(mainComps.some((i) => i.componentId === "ms1" && i.category === "MAIN_SWITCH")).toBe(true);
    expect(mainComps.some((i) => i.componentId === "nf3" && i.specificModel === "NOISE_FILTER_3P")).toBe(true);
    expect(mainComps.some((i) => i.componentId === "tb1" && i.category === "TERMINAL")).toBe(true);
  });

  it("mendukung multi-select Ctrl+Klik (toggleSelectionId), geser grup, dan perataan item terpilih", () => {
    // 1. Toggle multi-select
    let selected: string[] = [];
    selected = toggleSelectionId(selected, "item-1", false);
    expect(selected).toEqual(["item-1"]);

    selected = toggleSelectionId(selected, "item-2", true);
    selected = toggleSelectionId(selected, "item-3", true);
    expect(selected).toEqual(["item-1", "item-2", "item-3"]);

    // Klik Ctrl pada item yg sudah terpilih -> unselect item tsb tanpa menghapus yang lain
    selected = toggleSelectionId(selected, "item-2", true);
    expect(selected).toEqual(["item-1", "item-3"]);

    // Klik biasa tanpa Ctrl -> reset ke 1 item saja
    selected = toggleSelectionId(selected, "item-2", false);
    expect(selected).toEqual(["item-2"]);

    // 2. Group drag tetap menjaga jarak relatif & dibatasi ukuran plat
    const sampleItems: PanelLayoutItem[] = [
      { id: "a", type: "COMPONENT", category: "MCB", name: "MCB 1", xMm: 60, yMm: 100, widthMm: 36, heightMm: 85 },
      { id: "b", type: "COMPONENT", category: "MCB", name: "MCB 2", xMm: 102, yMm: 112, widthMm: 36, heightMm: 85 },
      { id: "c", type: "COMPONENT", category: "RELAY", name: "Relay", xMm: 300, yMm: 200, widthMm: 28, heightMm: 72 },
    ];
    const moved = moveSelectedPanelItems(
      sampleItems,
      ["a", "b"],
      { a: { xMm: 60, yMm: 100 }, b: { xMm: 102, yMm: 112 } },
      40,
      -20,
      { widthMm: 600, heightMm: 800 }
    );
    expect(moved.find((i) => i.id === "a")).toMatchObject({ xMm: 100, yMm: 80 });
    expect(moved.find((i) => i.id === "b")).toMatchObject({ xMm: 142, yMm: 92 });
    expect(moved.find((i) => i.id === "c")).toMatchObject({ xMm: 300, yMm: 200 });

    // Clamping saat mentok tepi kiri (min 5mm) harus menggeser semua dengan delta sama
    const clampedLeft = moveSelectedPanelItems(
      sampleItems,
      ["a", "b"],
      { a: { xMm: 60, yMm: 100 }, b: { xMm: 102, yMm: 112 } },
      -200,
      0,
      { widthMm: 600, heightMm: 800 }
    );
    expect(clampedLeft.find((i) => i.id === "a")?.xMm).toBe(5);
    expect(clampedLeft.find((i) => i.id === "b")?.xMm).toBe(47);

    // 3. Sejajarkan (Align) item terpilih
    const alignedTop = alignSelectedPanelItems(sampleItems, ["a", "b"], "TOP", {
      widthMm: 600,
      heightMm: 800,
    });
    expect(alignedTop.find((i) => i.id === "a")?.yMm).toBe(100);
    expect(alignedTop.find((i) => i.id === "b")?.yMm).toBe(100);
  });

  it("merekonsiliasi componentId yang usang setelah PR di-replace tanpa menimpa posisi layout manual", () => {
    const oldComps: PanelComponentInput[] = [
      makeComp("old-safety", "Omron G9SA-TH301 AC DC24", "SAFETY RELAY", 1),
      makeComp("old-relay", "Omron MY2N-D2 24VDC", "Industrial Relay 8-Pin 24VDC", 8),
      makeComp("old-tb", "FORT TBD-10A (1 Lusin / 12 pcs)", "Terminal Block Din Rail 10A", 1),
      makeComp("old-sock", "1 Hole SN-016", "Stop Kontak", 1),
    ];

    const initialLayout = buildStandardPanelLayoutFromComponents(oldComps);
    // Simulasi user menggeser posisi Safety Relay secara manual dan menyimpan layout
    const manualMain = {
      ...initialLayout.main,
      items: initialLayout.main.items.map((it) =>
        it.componentId === "old-safety" ? { ...it, xMm: 315, yMm: 222 } : it
      ),
    };
    const savedPayload = serializeDualPanelLayoutPayload({
      ...initialLayout,
      main: manualMain,
      autoGenerated: false,
    });

    // Simulasi save-web mode replace / re-import PR: semua ID berubah jadi new-* dan tambah 1 item baru
    const newComps: PanelComponentInput[] = [
      makeComp("new-safety", "Omron G9SA-TH301 AC DC24", "SAFETY RELAY", 1),
      makeComp("new-relay", "Omron MY2N-D2 24VDC", "Industrial Relay 8-Pin 24VDC", 9),
      makeComp("new-tb", "FORT TBD-10A (1 Lusin / 12 pcs)", "Terminal Block Din Rail 10A", 1),
      makeComp("new-sock", "1 Hole SN-016", "Stop Kontak", 1),
      makeComp("new-sock2", "Uticon / Hager 1-Hole SN-016", "Stop Kontak 1 Lubang Din Rail / Panel", 1),
    ];

    const parsed = parseDualPanelLayoutJson(savedPayload, newComps);
    expect(parsed.autoGenerated).toBe(false);

    // Posisi manual tetap terjaga & componentId otomatis tersambung ke ID baru
    const safetyOnCanvas = parsed.main.items.find((i) => i.partType === "Omron G9SA-TH301 AC DC24");
    expect(safetyOnCanvas?.xMm).toBe(315);
    expect(safetyOnCanvas?.yMm).toBe(222);
    expect(safetyOnCanvas?.componentId).toBe("new-safety");

    const relaysOnCanvas = parsed.main.items.filter((i) => i.componentId === "new-relay");
    expect(relaysOnCanvas.length).toBe(8);

    const oldSocketOnCanvas = parsed.main.items.filter((i) => i.componentId === "new-sock");
    const newSocketOnCanvas = parsed.main.items.filter((i) => i.componentId === "new-sock2");
    expect(oldSocketOnCanvas.length).toBe(1);
    expect(newSocketOnCanvas.length).toBe(0);
  });

  it("includes and classifies all 10 TBINA PE-STD-003 standard push switches accurately for OP Panel", () => {
    const tbinaItems = DEFAULT_PR_CATALOG.filter((item) => item.noUrut >= 197 && item.noUrut <= 206);
    expect(tbinaItems).toHaveLength(10);

    const expected: Record<
      number,
      {
        hmiClass: ReturnType<typeof classifyHmiPrComponent>;
        category: string;
        specificModel: string;
        defaultTag: string;
      }
    > = {
      197: {
        hmiClass: "EMG_BUTTON",
        category: "EMERGENCY_STOP",
        specificModel: "EMERGENCY_STOP_22MM",
        defaultTag: "E-STOP",
      },
      198: {
        hmiClass: "SWITCH_KEY",
        category: "SELECTOR_SWITCH",
        specificModel: "SELECTOR_2POS_22MM",
        defaultTag: "POWER",
      },
      199: {
        hmiClass: "EMG_BUTTON",
        category: "PUSH_BUTTON",
        specificModel: "PB_START_22MM",
        defaultTag: "MASTER ON",
      },
      200: {
        hmiClass: "SWITCH_KEY",
        category: "SELECTOR_SWITCH",
        specificModel: "KEY_SWITCH_22MM",
        defaultTag: "MNL/AUTO",
      },
      201: {
        hmiClass: "SWITCH_KEY",
        category: "SELECTOR_SWITCH",
        specificModel: "KEY_SWITCH_22MM",
        defaultTag: "KEY RESET",
      },
      202: {
        hmiClass: "EMG_BUTTON",
        category: "PUSH_BUTTON",
        specificModel: "PB_RESET_YELLOW_22MM",
        defaultTag: "FAULT RST",
      },
      203: {
        hmiClass: "EMG_BUTTON",
        category: "PUSH_BUTTON",
        specificModel: "PB_START_22MM",
        defaultTag: "HOME RTN",
      },
      204: {
        hmiClass: "SWITCH_KEY",
        category: "SELECTOR_SWITCH",
        specificModel: "SELECTOR_2POS_22MM",
        defaultTag: "ADV/RET",
      },
      205: {
        hmiClass: "EMG_BUTTON",
        category: "PUSH_BUTTON",
        specificModel: "PB_YELLOW_22MM",
        defaultTag: "LAMP CHK",
      },
      206: {
        hmiClass: "EMG_BUTTON",
        category: "PUSH_BUTTON",
        specificModel: "PB_BLACK_22MM",
        defaultTag: "MNL ASST",
      },
    };

    for (const item of tbinaItems) {
      const partName = `${item.nama} ${item.spesifikasi}`;
      expect(isHmiPanelComponent(item.tipeModel, partName, item.kategori)).toBe(true);
      expect(
        { noUrut: item.noUrut, cls: classifyHmiPrComponent(item.tipeModel, partName, item.kategori) },
      ).toEqual({ noUrut: item.noUrut, cls: expected[item.noUrut].hmiClass });

      const visual = inferComponentVisual(item.tipeModel, partName);
      expect(visual.category).toBe(expected[item.noUrut].category);
      expect(visual.specificModel).toBe(expected[item.noUrut].specificModel);
      expect(visual.defaultTag).toBe(expected[item.noUrut].defaultTag);
    }
  });

  describe("Outer Panel (Box Enclosure 2D Depan & Samping)", () => {
    it("mendeteksi otomatis LOTO dan Fan dari part list PR", () => {
      const prWithFeatures: PanelComponentInput[] = [
        makeComp("c1", "VCF02", "Main Rotary Switch Disconnect LOTO 3P 32A"),
        makeComp("c2", "FORT XF1232ASH", "Cooling Fan Filter Panel 120x120mm"),
      ];

      const detected = detectOuterPanelPrFeatures(prWithFeatures);
      expect(detected.hasLoto).toBe(true);
      expect(detected.hasFan).toBe(true);
      expect(detected.fanSizeMm).toBe(120);

      const prWithoutFeatures: PanelComponentInput[] = [
        makeComp("c3", "FX5U-32MT/ES", "PLC CPU"),
        makeComp("c4", "S8VK-C24024", "Power Supply 24V"),
      ];

      const detectedEmpty = detectOuterPanelPrFeatures(prWithoutFeatures);
      expect(detectedEmpty.hasLoto).toBe(false);
      expect(detectedEmpty.hasFan).toBe(false);
    });

    it("membuat default outer panel dengan Lock Door selalu aktif dan ukuran enclosure yang tepat", () => {
      const pr: PanelComponentInput[] = [
        makeComp("c1", "LOTO Switch", "Lockout Disconnect Switch 32A"),
        makeComp("c2", "XF1232", "Fan Exhaust 12CM"),
      ];

      const outer = createDefaultOuterPanelLayout(pr, 600, 800);
      expect(outer.enclosure.widthMm).toBe(700);
      expect(outer.enclosure.heightMm).toBe(900);
      expect(outer.enclosure.depthMm).toBe(265);
      expect(outer.features.hasLockDoor).toBe(true);
      expect(outer.features.hasLoto).toBe(true);
      expect(outer.features.hasFan).toBe(true);
      expect(outer.features.fanSizeMm).toBe(120);
    });

    it("melakukan round-trip serialization dan parsing outer panel di JSON payload", () => {
      const pr: PanelComponentInput[] = [
        makeComp("c1", "LOTO Switch", "Lockout Disconnect Switch 32A"),
      ];
      const initial = buildStandardPanelLayoutFromComponents(pr);
      expect(initial.outerPanel).toBeDefined();
      expect(initial.outerPanel?.features.hasLoto).toBe(true);

      const serialized = serializeDualPanelLayoutPayload(initial);
      const parsed = parseDualPanelLayoutJson(serialized, pr);

      expect(parsed.outerPanel).toBeDefined();
      expect(parsed.outerPanel?.enclosure.widthMm).toBe(initial.outerPanel?.enclosure.widthMm);
      expect(parsed.outerPanel?.features.hasLockDoor).toBe(true);
      expect(parsed.outerPanel?.features.hasLoto).toBe(true);
    });

    it("menghasilkan file DXF AutoCAD 2D untuk Box Enclosure Tampak Depan & Tampak Samping dengan Title Block standar Twintech", () => {
      const pr: PanelComponentInput[] = [
        makeComp("c1", "Schneider EZAROTE", "Main Switch Rotary Isolator LOTO 32A"),
        makeComp("c2", "FORT XF1232ASH", "Cooling Fan Filter 120x120mm"),
      ];
      const outer = createDefaultOuterPanelLayout(pr, 700, 600);

      const dxf = generateOuterPanelDxf(outer, {
        kode: "26-TBD-0513",
        nama: "FUNCTION TESTER",
        pic: "Faruk",
      });

      expect(dxf).toContain("SECTION");
      expect(dxf).toContain("0_BORDER");
      expect(dxf).toContain("1_DOOR");
      expect(dxf).toContain("2_LOCK_DOOR");
      expect(dxf).toContain("3_LOTO");
      expect(dxf).toContain("4_FAN_GRILL");
      expect(dxf).toContain("5_DIMENSIONS");
      expect(dxf).toContain("6_LEADERS");
      expect(dxf).toContain("7_TITLE_BLOCK");
      expect(dxf).toContain("Twintech Precision");
      expect(dxf).toContain("TAMPAK DEPAN (FRONT VIEW)");
      expect(dxf).toContain("TAMPAK SAMPING (SIDE VIEW)");
      expect(dxf).toContain("EOF");
    });
  });

  describe("Auto-Layout PR dengan Adaptasi Ukuran Kabel Duct", () => {
    it("mendeteksi profil ducting dari komponen PR (30x40, 40x60, dll)", () => {
      const prDuct4060: PanelComponentInput[] = [
        makeComp("d1", "PVC Wiring Duct 40x60 mm (per 2m)", "Kabel Duct PVC Berlubang 40x60"),
      ];
      const config4060 = detectPrDuctProfile(prDuct4060);
      expect(config4060.code).toBe("40x60");
      expect(config4060.horizontalHeightMm).toBe(40);
      expect(config4060.verticalRightWidthMm).toBe(60);
      expect(config4060.tagHorizontal).toBe("DUCT 40x60");

      const prDuct3040: PanelComponentInput[] = [
        makeComp("d2", "PVC Wiring Duct 30x40 mm (per 2m)", "Kabel Duct PVC 30x40"),
      ];
      const config3040 = detectPrDuctProfile(prDuct3040);
      expect(config3040.code).toBe("30x40");
      expect(config3040.horizontalHeightMm).toBe(30);
      expect(config3040.tagHorizontal).toBe("DUCT 30x40");
    });

    it("menyesuaikan jarak antar kabel duct secara otomatis agar komponen tinggi (PSU S8VK) tidak menabrak duct", () => {
      const prWithTallPsu: PanelComponentInput[] = [
        makeComp("psu", "S8VK-C24024", "POWER SUPPLY 24V 240W", 1),
        makeComp("mcb1", "Chint NX5-63 2P 6A", "MCB 2P 6A", 4),
        makeComp("duct", "PVC Wiring Duct 40x60 mm (per 2m)", "Kabel Duct PVC 40x60", 4),
      ];

      const layout = buildStandardPanelLayoutFromComponents(prWithTallPsu);
      const items = layout.main.items;

      const psuItem = items.find((i) => i.componentId === "psu");
      expect(psuItem).toBeDefined();

      const ductTop = items.find((i) => i.id === "duct-top");
      const ductMid1 = items.find((i) => i.id === "duct-mid-1");
      expect(ductTop).toBeDefined();
      expect(ductMid1).toBeDefined();

      // Pastikan PSU berada di antara duct-top dan duct-mid-1 dengan ruang bebas aman (tidak menabrak)
      const psuTop = psuItem!.yMm;
      const psuBottom = psuItem!.yMm + psuItem!.heightMm;
      const ductTopBottom = ductTop!.yMm + ductTop!.heightMm;
      const ductMid1Top = ductMid1!.yMm;

      expect(psuTop).toBeGreaterThanOrEqual(ductTopBottom);
      expect(psuBottom).toBeLessThanOrEqual(ductMid1Top);

      // Label ducting harus memakai ukuran yang terdeteksi dari PR
      expect(ductTop!.tagLabel).toBe("DUCT 40x60");
      expect(ductMid1!.tagLabel).toBe("DUCT 40x60");
    });

    it("menghasilkan layout kompak & ngepress sesuai box panel di PR (misal 550x450 mm)", () => {
      const mtmLikePr: PanelComponentInput[] = [
        makeComp("box", "BOX PANEL_550 x 450 x 200", "BOX PANEL", 1),
        makeComp("plc", "PLC_FX5U-32MR/ES", "PLC", 1),
        makeComp("mcb1", "MCB Chint NXB-63 2P 6A", "MCB", 4),
        makeComp("psu", "S8VK-C24024", "POWER SUPLAY", 1),
        makeComp("relay", "Omron MY2N-D2 24VDC", "Relay", 2),
        makeComp("tb", "FORT TBD-10A", "Terminal Block", 12),
      ];

      const layout = buildStandardPanelLayoutFromComponents(mtmLikePr);
      // Plat dasar kompak ~400mm x 600-700mm, BUKAN 600x800 raksasa
      expect(layout.main.enclosure.widthMm).toBeLessThanOrEqual(450);
      expect(layout.main.enclosure.heightMm).toBeLessThanOrEqual(700);

      // Celah antar baris rapi dan ngepress (jarak dari komponen ke duct < 25mm)
      const psu = layout.main.items.find((i) => i.componentId === "psu");
      const ductTop = layout.main.items.find((i) => i.id === "duct-top");
      expect(psu).toBeDefined();
      expect(ductTop).toBeDefined();
      const topGap = psu!.yMm - (ductTop!.yMm + ductTop!.heightMm);
      expect(topGap).toBeGreaterThanOrEqual(5);
      expect(topGap).toBeLessThanOrEqual(25);
    });

    it("Auto-Layout PR menyesuaikan ukuran plat yang sudah ditentukan (targetDimensions)", () => {
      const bom: PanelComponentInput[] = [
        makeComp("mcb1", "Schneider Acti9 iC60N 2P 10A", "MCB 2P", 3, "Panel Utama"),
        makeComp("psu1", "Omron S8VK-C24024", "Power Supply 24V 240W", 1, "Panel Utama"),
        makeComp("plc1", "Mitsubishi FX5U-32MT/ES", "PLC CPU FX5U", 1, "Panel Utama"),
        makeComp("hmi1", "Mitsubishi GS2107-WTBD-N", "HMI 7 Inch", 1, "Panel HMI"),
        makeComp("pb1", "IDEC YW1B-M1E10G", "Push Button Hijau", 2, "Panel HMI"),
      ];

      const customPlate = buildStandardPanelLayoutFromComponents(bom, {
        main: { widthMm: 500, heightMm: 600 },
        hmi: { widthMm: 400, heightMm: 350, depthMm: 160 },
      });

      expect(customPlate.main.enclosure.widthMm).toBe(500);
      expect(customPlate.main.enclosure.heightMm).toBe(600);
      expect(customPlate.hmi.enclosure.widthMm).toBe(400);
      expect(customPlate.hmi.enclosure.heightMm).toBe(350);
      expect(customPlate.hmi.enclosure.depthMm).toBe(160);

      // Pastikan duct dan rel pas di dalam 500 x 600
      const ductRight = customPlate.main.items.find((i) => i.id === "duct-right");
      const ductBottom = customPlate.main.items.find((i) => i.id === "duct-bottom");
      expect(ductRight).toBeDefined();
      expect(ductBottom).toBeDefined();
      expect(ductRight!.xMm + ductRight!.widthMm).toBe(500);
      expect(ductBottom!.yMm + ductBottom!.heightMm).toBe(600);
    });

    it("menjamin tidak ada benturan vertikal, tidak over range ke duct kanan, dan ada space aman antar-komponen", () => {
      // BOM seperti pada screenshot pengguna (Jig Insert Collar / Box Panel kompak)
      const userScreenshotBom: PanelComponentInput[] = [
        makeComp("mcb-4a-1", "Schneider Acti9 iC60N 2P 4A", "MCB 4A", 1),
        makeComp("mcb-4a-2", "Schneider Acti9 iC60N 2P 4A", "MCB 4A", 1),
        makeComp("mcb-6a-1", "Schneider Acti9 iC60N 2P 6A", "MCB 6A", 1),
        makeComp("mcb-6a-2", "Schneider Acti9 iC60N 2P 6A", "MCB 6A", 1),
        makeComp("psu", "Omron S8VK-C12024", "S8VK 120W POWER", 1),
        makeComp("plc", "Mitsubishi FX5U-32MR/ES", "Mitsubishi FX5U-32MR/ES", 1),
        makeComp("nf1", "TDK RSAL-2006", "RSAL 6A FILTER 6A", 1),
        makeComp("nf2", "TDK RSAL-2006", "RSAL 6A FILTER 6A", 1),
        makeComp("nf3", "TDK RSAL-2006", "RSAL 6A FILTER 6A", 1),
        makeComp("rel1", "Omron MY2N-GS-24VDC", "Relay MY2N", 5),
        makeComp("uticon", "Stop Kontak Uticon 2 Lubang SN-016", "UTICON STOP KONTAK", 2),
        makeComp("tb", "FORT TBD-10A", "Terminal Block TBD-10A", 1),
        makeComp("duct", "PVC Wiring Duct 40x60 mm (per 2m)", "Kabel Duct PVC 40x60", 4),
      ];

      const layout = buildStandardPanelLayoutFromComponents(userScreenshotBom, {
        main: { widthMm: 400, heightMm: 500 },
      });

      const items = layout.main.items;
      const ductTop = items.find((i) => i.id === "duct-top")!;
      const ductMid1 = items.find((i) => i.id === "duct-mid-1")!;
      const ductMid2 = items.find((i) => i.id === "duct-mid-2")!;
      const ductMid3 = items.find((i) => i.id === "duct-mid-3")!;
      const ductBottom = items.find((i) => i.id === "duct-bottom")!;
      const ductRight = items.find((i) => i.id === "duct-right")!;

      expect(ductTop).toBeDefined();
      expect(ductMid1).toBeDefined();
      expect(ductMid2).toBeDefined();
      expect(ductMid3).toBeDefined();
      expect(ductBottom).toBeDefined();
      expect(ductRight).toBeDefined();

      const psuItem = items.find((i) => i.componentId === "psu")!;
      const plcItem = items.find((i) => i.componentId === "plc")!;
      const relayItems = items.filter((i) => i.componentId === "rel1");
      const uticonItems = items.filter((i) => i.componentId === "uticon");

      expect(psuItem).toBeDefined();
      expect(plcItem).toBeDefined();
      expect(relayItems.length).toBe(5);
      expect(uticonItems.length).toBe(2);

      // 1. Verifikasi Vertikal: Komponen TIDAK MENEMBUS DUCTING (Celah aman >= 6mm)
      // Baris 1: S8VK (125mm) harus pas di antara duct-top dan duct-mid-1
      expect(psuItem.yMm).toBeGreaterThanOrEqual(ductTop.yMm + ductTop.heightMm + 6);
      expect(psuItem.yMm + psuItem.heightMm).toBeLessThanOrEqual(ductMid1.yMm - 6);

      // Baris 2: PLC FX5U (90mm) harus pas di antara duct-mid-1 dan duct-mid-2
      expect(plcItem.yMm).toBeGreaterThanOrEqual(ductMid1.yMm + ductMid1.heightMm + 6);
      expect(plcItem.yMm + plcItem.heightMm).toBeLessThanOrEqual(ductMid2.yMm - 6);

      // Baris 3: Relay & Uticon harus pas di antara duct-mid-2 dan duct-mid-3
      for (const rel of relayItems) {
        expect(rel.yMm).toBeGreaterThanOrEqual(ductMid2.yMm + ductMid2.heightMm + 6);
        expect(rel.yMm + rel.heightMm).toBeLessThanOrEqual(ductMid3.yMm - 6);
      }
      for (const ut of uticonItems) {
        expect(ut.yMm).toBeGreaterThanOrEqual(ductMid2.yMm + ductMid2.heightMm + 6);
        expect(ut.yMm + ut.heightMm).toBeLessThanOrEqual(ductMid3.yMm - 6);
      }

      // 2. Verifikasi Horizontal: TIDAK OVER RANGE KE DUCTING KANAN
      const rightBoundary = ductRight.xMm;
      const comps = items.filter((i) => i.type === "COMPONENT");
      for (const c of comps) {
        expect(c.xMm + c.widthMm).toBeLessThanOrEqual(rightBoundary);
      }

      // 3. Verifikasi Spacing: Ada Space yang rapi antar part (tidak menempel 0/2mm)
      // Antar Relay sejenis: gap >= 4mm
      for (let i = 0; i < relayItems.length - 1; i++) {
        const gap = relayItems[i + 1].xMm - (relayItems[i].xMm + relayItems[i].widthMm);
        expect(gap).toBeGreaterThanOrEqual(4);
      }

      // Antar Relay ke Uticon (beda kategori): gap >= 10mm
      const lastRelay = relayItems[relayItems.length - 1];
      const firstUticon = uticonItems[0];
      const interCatGap = firstUticon.xMm - (lastRelay.xMm + lastRelay.widthMm);
      expect(interCatGap).toBeGreaterThanOrEqual(10);
    });
  });
});
