import { describe, expect, it } from "vitest";
import {
  alignSelectedPanelItems,
  buildStandardPanelLayoutFromComponents,
  classifyHmiPrComponent,
  classifyPrComponent,
  createStandardOpMountingLayout,
  createStandardSpmLayout,
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
});
