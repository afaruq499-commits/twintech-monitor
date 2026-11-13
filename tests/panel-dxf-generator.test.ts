import { describe, expect, it } from "vitest";
import {
  extractPanelFeatures,
  generatePanelLayoutDxf,
} from "../src/lib/export/panel-dxf-generator";
import type { PanelLayoutItem } from "../src/lib/panel-layout-template";

describe("panel-dxf-generator", () => {
  it("mengekstrak lubang potong HMI 191x137 mm dan 10 lubang tombol Ø22 mm persis seperti gambar PDF", () => {
    const plateWidth = 350;
    const plateHeight = 350;

    // Buat 1 HMI 7-inch di bagian atas tengah
    const hmiItem: PanelLayoutItem = {
      id: "hmi-1",
      type: "COMPONENT",
      name: "Mitsubishi GS2107-WTBD-N (7 Inch)",
      category: "HMI",
      specificModel: "HMI_7INCH",
      xMm: 72,
      yMm: 40,
      widthMm: 206,
      heightMm: 152,
      tagLabel: "GS2107",
    };

    // Buat 10 push button Ø22mm (2 baris x 5 kolom)
    const buttonItems: PanelLayoutItem[] = [];
    const rowY = [245, 300]; // Dalam koordinat SVG (dari atas)
    const colX = [40, 100, 160, 220, 280];

    for (let r = 0; r < rowY.length; r++) {
      for (let c = 0; c < colX.length; c++) {
        buttonItems.push({
          id: `pb-${r}-${c}`,
          type: "COMPONENT",
          name: `Push Button Ø22mm #${r * 5 + c + 1}`,
          category: "PUSH_BUTTON",
          specificModel: "PB_START_22MM",
          xMm: colX[c] - 20,
          yMm: rowY[r] - 18,
          widthMm: 40,
          heightMm: 55,
          tagLabel: `PB${r * 5 + c + 1}`,
        });
      }
    }

    const items = [hmiItem, ...buttonItems];

    const features = extractPanelFeatures(
      plateWidth,
      plateHeight,
      items,
      "HMI"
    );

    // Verifikasi ekstraksi cutout HMI
    expect(features.cutouts.length).toBe(1);
    expect(features.cutouts[0].widthMm).toBe(191);
    expect(features.cutouts[0].heightMm).toBe(137);

    // Verifikasi ekstraksi lubang tombol
    expect(features.holes.length).toBe(10);
    expect(features.holes[0].diameter).toBe(22);
    expect(features.holeLeaderText).toBe("10X %%c 22 THRU");

    // Verifikasi dimensi koordinat datum
    expect(features.xDimensions).toContain(0);
    expect(features.xDimensions).toContain(350);
    expect(features.yDimensions).toContain(0);
    expect(features.yDimensions).toContain(350);
  });

  it("menghasilkan struktur DXF AutoCAD yang valid dengan layer dan entitas lengkap", () => {
    const plateWidth = 350;
    const plateHeight = 350;

    const items: PanelLayoutItem[] = [
      {
        id: "hmi-1",
        type: "COMPONENT",
        name: "HMI 7 Inch",
        category: "HMI",
        specificModel: "HMI_7INCH",
        xMm: 72,
        yMm: 40,
        widthMm: 206,
        heightMm: 152,
      },
      {
        id: "pb-1",
        type: "COMPONENT",
        name: "Push Button 22mm",
        category: "PUSH_BUTTON",
        xMm: 50,
        yMm: 240,
        widthMm: 40,
        heightMm: 55,
      },
    ];

    const features = extractPanelFeatures(
      plateWidth,
      plateHeight,
      items,
      "HMI"
    );

    const dxf = generatePanelLayoutDxf(
      features,
      {
        kode: "26-TBD-0513",
        nama: "MODIFIKASI RATCHET X ROAD TAKING,PIN X BASE STAKING",
        partName: "DUMMY OP PANEL",
        drawnBy: "DEDI",
        checkedBy: "IVAN",
        approvedBy: "IVAN",
        dateStr: "12/11/2026",
      },
      "HMI"
    );

    // Cek header DXF
    expect(dxf).toContain("SECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009");
    expect(dxf).toContain("SECTION\n2\nTABLES");
    expect(dxf).toContain("SECTION\n2\nENTITIES");
    expect(dxf).toContain("EOF");

    // Cek Layer AutoCAD
    expect(dxf).toContain("0_PLATE_OUTLINE");
    expect(dxf).toContain("1_CUTOUT_HMI");
    expect(dxf).toContain("2_DRILL_HOLES");
    expect(dxf).toContain("3_CENTER_LINES");
    expect(dxf).toContain("6_DIMENSIONS");
    expect(dxf).toContain("7_TITLE_BLOCK");

    // Cek entitas lingkaran dan garis
    expect(dxf).toContain("CIRCLE");
    expect(dxf).toContain("LINE");
    expect(dxf).toContain("TEXT");

    // Cek Kop Gambar Twintech Precision
    expect(dxf).toContain("Twintech Precision");
    expect(dxf).toContain("MODIFIKASI RATCHET X ROAD TAKING");
    expect(dxf).toContain("DUMMY OP PANEL");
    expect(dxf).toContain("26-TBD-0513");
    expect(dxf).toContain("DEDI");
    expect(dxf).toContain("IVAN");
  });

  it("menangani berbagai ukuran lubang (Ø16mm, Ø22mm, Ø30mm) dan ukuran HMI (4.3, 7, 10 inch) secara akurat", () => {
    const plateWidth = 600;
    const plateHeight = 500;

    const items: PanelLayoutItem[] = [
      {
        id: "hmi-10",
        type: "COMPONENT",
        name: "Mitsubishi GS2110 10 Inch",
        category: "HMI",
        specificModel: "HMI_10INCH",
        xMm: 100,
        yMm: 50,
        widthMm: 272,
        heightMm: 214,
      },
      {
        id: "pb-16",
        type: "COMPONENT",
        name: "Pilot Lamp 16mm",
        category: "PILOT_LAMP",
        specificModel: "LAMP_16MM",
        xMm: 50,
        yMm: 350,
        widthMm: 30,
        heightMm: 40,
      },
      {
        id: "pb-30",
        type: "COMPONENT",
        name: "Main Switch 30mm",
        category: "MAIN_SWITCH",
        specificModel: "SWITCH_30MM",
        xMm: 450,
        yMm: 350,
        widthMm: 60,
        heightMm: 60,
      },
    ];

    const feats = extractPanelFeatures(plateWidth, plateHeight, items, "HMI");

    // Cutout HMI 10" adalah 258x199mm
    expect(feats.cutouts.length).toBe(1);
    expect(feats.cutouts[0].widthMm).toBe(258);
    expect(feats.cutouts[0].heightMm).toBe(199);

    // Lubang 16mm dan 30mm
    const dia16 = feats.holes.find((h) => h.diameter === 16);
    const dia30 = feats.holes.find((h) => h.diameter === 30);
    expect(dia16).toBeDefined();
    expect(dia30).toBeDefined();
  });
});
