import { describe, it, expect } from "vitest";
import {
  calculateSmartMagneticSnap,
  centerItemOnPlate,
  centerItemUnderHmi,
  distributeSelectedItemsHorizontally,
} from "../src/lib/panel-magnetic-guide";
import type { PanelEnclosure, PanelLayoutItem } from "../src/lib/panel-layout-template";

describe("panel-magnetic-guide - Smart Alignment & Center Snapping", () => {
  const enclosure: PanelEnclosure = {
    name: "OP Panel Box",
    widthMm: 350,
    heightMm: 300,
    depthMm: 200,
  };

  const sampleHmi: PanelLayoutItem = {
    id: "hmi-1",
    type: "COMPONENT",
    category: "HMI",
    tagLabel: "MITSUBISHI GOT",
    name: "GS2107-WTBD",
    xMm: 75,
    yMm: 30,
    widthMm: 200, // Center X = 75 + 100 = 175 (matches plate center 350 / 2 = 175)
    heightMm: 140,
    rotation: 0,
  };

  const btnStart: PanelLayoutItem = {
    id: "btn-start",
    type: "COMPONENT",
    category: "PUSH_BUTTON",
    tagLabel: "START",
    name: "PB Green",
    xMm: 155,
    yMm: 220,
    widthMm: 40, // Center X = 175, Center Y = 240
    heightMm: 40,
    rotation: 0,
  };

  const btnReset: PanelLayoutItem = {
    id: "btn-reset",
    type: "COMPONENT",
    category: "PUSH_BUTTON",
    tagLabel: "RESET",
    name: "PB Blue",
    xMm: 220,
    yMm: 220,
    widthMm: 40, // Center Y = 240
    heightMm: 40,
    rotation: 0,
  };

  it("snaps component to horizontal and vertical plate center (Center X: 175, Center Y: 150)", () => {
    const itemToDrag: PanelLayoutItem = {
      id: "btn-test",
      type: "COMPONENT",
      category: "PUSH_BUTTON",
      tagLabel: "TEST",
      name: "PB",
      xMm: 152, // Center would be 152 + 20 = 172 (diff 3mm to plate center 175)
      yMm: 128, // Center would be 128 + 20 = 148 (diff 2mm to plate center 150)
      widthMm: 40,
      heightMm: 40,
      rotation: 0,
    };

    const result = calculateSmartMagneticSnap({
      rawX: 152,
      rawY: 128,
      draggedItem: itemToDrag,
      allItems: [],
      dragIds: [itemToDrag.id],
      enclosure,
      thresholdMm: 6,
    });

    expect(result.snappedAxisX).toBe(true);
    expect(result.snappedAxisY).toBe(true);
    expect(result.snappedX).toBe(155); // 175 - 20 = 155
    expect(result.snappedY).toBe(130); // 150 - 20 = 130
    expect(result.guides.length).toBe(2);
    expect(result.guides.some((g) => g.label.includes("Tengah Plat (X: 175 mm)"))).toBe(true);
    expect(result.guides.some((g) => g.label.includes("Tengah Plat (Y: 150 mm)"))).toBe(true);
  });

  it("snaps button to row symmetry (matching Center Y of another button)", () => {
    const newBtn: PanelLayoutItem = {
      id: "btn-stop",
      type: "COMPONENT",
      category: "PUSH_BUTTON",
      tagLabel: "STOP",
      name: "PB Red",
      xMm: 90,
      yMm: 223, // Center Y = 223 + 20 = 243 (diff 3mm from btnStart's center Y 240)
      widthMm: 40,
      heightMm: 40,
      rotation: 0,
    };

    const result = calculateSmartMagneticSnap({
      rawX: 90,
      rawY: 223,
      draggedItem: newBtn,
      allItems: [sampleHmi, btnStart, btnReset],
      dragIds: [newBtn.id],
      enclosure,
      thresholdMm: 6,
    });

    expect(result.snappedAxisY).toBe(true);
    expect(result.snappedY).toBe(220); // Center Y 240 - 20 = 220
    expect(result.guides.some((g) => g.label.includes("Sejajar Pusat Tombol"))).toBe(true);
  });

  it("snaps button directly under HMI center (Center X of HMI: 175 mm)", () => {
    const itemUnderHmi: PanelLayoutItem = {
      id: "btn-middle",
      type: "COMPONENT",
      category: "PUSH_BUTTON",
      tagLabel: "MIDDLE",
      name: "PB",
      xMm: 153, // Center X = 173 (diff 2mm from HMI center 175)
      yMm: 215,
      widthMm: 40,
      heightMm: 40,
      rotation: 0,
    };

    const result = calculateSmartMagneticSnap({
      rawX: 153,
      rawY: 215,
      draggedItem: itemUnderHmi,
      allItems: [sampleHmi],
      dragIds: [itemUnderHmi.id],
      enclosure,
      thresholdMm: 6,
    });

    expect(result.snappedAxisX).toBe(true);
    expect(result.snappedX).toBe(155); // 175 - 20 = 155
    expect(result.guides.some((g) => g.label.includes("Tengah Layar HMI"))).toBe(true);
  });

  it("snaps equal spacing pitch between consecutive buttons in a row", () => {
    // btnStart: x=155, w=40 -> right=195
    // btnReset: x=220, w=40 -> left=220. Gap = 220 - 195 = 25mm.
    // Next button placed to the right of btnReset (x=220, right=260):
    // Expected next X = 260 + 25 = 285mm.
    const thirdBtn: PanelLayoutItem = {
      id: "btn-buzzer",
      type: "COMPONENT",
      category: "PUSH_BUTTON",
      tagLabel: "BUZZER",
      name: "Buzzer",
      xMm: 283, // diff 2mm to 285
      yMm: 220,
      widthMm: 40,
      heightMm: 40,
      rotation: 0,
    };

    const result = calculateSmartMagneticSnap({
      rawX: 283,
      rawY: 220,
      draggedItem: thirdBtn,
      allItems: [btnStart, btnReset],
      dragIds: [thirdBtn.id],
      enclosure,
      thresholdMm: 6,
    });

    expect(result.snappedAxisX).toBe(true);
    expect(result.snappedX).toBe(285);
    expect(result.guides.some((g) => g.label.includes("Spasi Simetris (25 mm)"))).toBe(true);
  });

  it("centers an item on plate with centerItemOnPlate", () => {
    const items = [btnStart];
    const centered = centerItemOnPlate(items, "btn-start", "BOTH", enclosure);
    const item = centered.find((i) => i.id === "btn-start");
    expect(item?.xMm).toBe(Math.round((350 - 40) / 2)); // 155
    expect(item?.yMm).toBe(Math.round((300 - 40) / 2)); // 130
  });

  it("centers an item directly under HMI with centerItemUnderHmi", () => {
    const items = [sampleHmi, { ...btnStart, xMm: 30 }];
    const aligned = centerItemUnderHmi(items, "btn-start", enclosure);
    const item = aligned.find((i) => i.id === "btn-start");
    expect(item?.xMm).toBe(155); // HMI center 175 - 20 = 155
  });

  it("distributes selected items horizontally with equal gaps and aligned center Y", () => {
    const items: PanelLayoutItem[] = [
      { ...btnStart, id: "b1", xMm: 50, yMm: 215 },
      { ...btnStart, id: "b2", xMm: 110, yMm: 225 },
      { ...btnStart, id: "b3", xMm: 290, yMm: 220 }, // span = 50 to 330 (span=280), 3 items, 2 gaps
    ];

    const distributed = distributeSelectedItemsHorizontally(
      items,
      ["b1", "b2", "b3"],
      enclosure,
      true
    );

    const b1 = distributed.find((i) => i.id === "b1")!;
    const b2 = distributed.find((i) => i.id === "b2")!;
    const b3 = distributed.find((i) => i.id === "b3")!;

    // Total width = 40*3 = 120. Total span = 280. Total gap = 160. Gap each = 80.
    expect(b1.xMm).toBe(50);
    expect(b2.xMm).toBe(50 + 40 + 80); // 170
    expect(b3.xMm).toBe(170 + 40 + 80); // 290
    // Center Y aligned
    expect(b1.yMm).toBe(b2.yMm);
    expect(b2.yMm).toBe(b3.yMm);
  });

  it("distributes 5 door buttons symmetrically with exact 23mm gap and centers on 350mm door", () => {
    // Skenario nyata permintaan user: Box Door 350mm, 5 tombol (E-Stop 50mm + 4 PB 40mm)
    const doorItems: PanelLayoutItem[] = [
      {
        id: "estop",
        type: "COMPONENT",
        category: "EMERGENCY_STOP",
        tagLabel: "E-STOP",
        name: "Emergency Stop",
        xMm: 30,
        yMm: 200,
        widthMm: 50,
        heightMm: 65,
        rotation: 0,
      },
      {
        id: "keysw",
        type: "COMPONENT",
        category: "SELECTOR_SWITCH",
        tagLabel: "KEY SW",
        name: "Key Switch",
        xMm: 90,
        yMm: 210,
        widthMm: 40,
        heightMm: 55,
        rotation: 0,
      },
      {
        id: "start",
        type: "COMPONENT",
        category: "PUSH_BUTTON",
        tagLabel: "START",
        name: "PB Start",
        xMm: 150,
        yMm: 212,
        widthMm: 40,
        heightMm: 55,
        rotation: 0,
      },
      {
        id: "reset",
        type: "COMPONENT",
        category: "PUSH_BUTTON",
        tagLabel: "RESET",
        name: "PB Reset",
        xMm: 210,
        yMm: 205,
        widthMm: 40,
        heightMm: 55,
        rotation: 0,
      },
      {
        id: "buzzer",
        type: "COMPONENT",
        category: "BUZZER",
        tagLabel: "BUZZER",
        name: "Buzzer Alarm",
        xMm: 270,
        yMm: 215,
        widthMm: 40,
        heightMm: 55,
        rotation: 0,
      },
    ];

    const result = distributeSelectedItemsHorizontally(
      doorItems,
      ["estop", "keysw", "start", "reset", "buzzer"],
      enclosure, // widthMm: 350
      true, // alignCenterY
      23, // exact gap 23mm
      true // centerOnEnclosure
    );

    const estop = result.find((i) => i.id === "estop")!;
    const keysw = result.find((i) => i.id === "keysw")!;
    const start = result.find((i) => i.id === "start")!;
    const reset = result.find((i) => i.id === "reset")!;
    const buzzer = result.find((i) => i.id === "buzzer")!;

    // Total width = 50 + 40*4 = 210. 4 gaps * 23 = 92. Total = 302.
    // Margin start = (350 - 302) / 2 = 24 mm.
    expect(estop.xMm).toBe(24);
    expect(keysw.xMm).toBe(24 + 50 + 23); // 97
    expect(start.xMm).toBe(97 + 40 + 23); // 160
    expect(reset.xMm).toBe(160 + 40 + 23); // 223
    expect(buzzer.xMm).toBe(223 + 40 + 23); // 286

    // Gap antar PB semuanya tepat 23 mm
    expect(keysw.xMm - (estop.xMm + estop.widthMm)).toBe(23);
    expect(start.xMm - (keysw.xMm + keysw.widthMm)).toBe(23);
    expect(reset.xMm - (start.xMm + start.widthMm)).toBe(23);
    expect(buzzer.xMm - (reset.xMm + reset.widthMm)).toBe(23);

    // Margin kanan juga tepat 24 mm (simetris sempurna kiri & kanan)
    expect(enclosure.widthMm - (buzzer.xMm + buzzer.widthMm)).toBe(24);

    // Titik tengah lubang bor (hole center Y) semuanya sejajar persis
    // Untuk PB/Key/Buzzer (height 55): hole center di y + (55 - 18) = y + 37
    // Untuk E-Stop (height 65): hole center di y + 65/2 = y + 32.5
    const holeEstop = estop.yMm + estop.heightMm / 2;
    const holeStart = start.yMm + (start.heightMm - 18);
    const holeReset = reset.yMm + (reset.heightMm - 18);
    const holeKeysw = keysw.yMm + (keysw.heightMm - 18);
    const holeBuzzer = buzzer.yMm + (buzzer.heightMm - 18);

    expect(Math.abs(holeEstop - holeStart)).toBeLessThanOrEqual(1);
    expect(holeStart).toBe(holeReset);
    expect(holeReset).toBe(holeKeysw);
    expect(holeKeysw).toBe(holeBuzzer);
  });
});
