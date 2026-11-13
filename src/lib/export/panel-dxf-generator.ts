/**
 * Generator DXF AutoCAD 2D untuk Layout Panel & HMI PT. Twintech Precision.
 * Format: AutoCAD R12 / 2000 ASCII DXF (Universal, 100% kompatibel AutoCAD, SolidWorks, CNC Laser Cutting CypCut).
 *
 * Mengikuti standar lembar gambar teknik Twintech Precision:
 * - Datum (0,0) di pojok kiri bawah plat
 * - Layer terpisah untuk plat luar, lubang cutout HMI, lubang bor tombol (Ø22), garis sumbu, dimensi, dan kop etiket
 * - Leader teks lubang (misal: "10X %%c 22 THRU")
 * - Dimensi koordinat baseline (X dan Y)
 */

import type { PanelLayoutItem } from "@/lib/panel-layout-template";

export interface DxfProjectMetadata {
  kode: string; // e.g. "26-TBI-1023" atau "26-TBD-0513"
  nama: string; // e.g. "FUNCTION TESTER"
  client?: string | null;
  pic?: string | null;
  partName?: string; // e.g. "DUMMY OP PANEL" / "MOUNTING PLATE PANEL UTAMA"
  material?: string; // e.g. "SPCC t=2.0mm"
  dateStr?: string; // e.g. "12/11/2026"
  drawnBy?: string;
  checkedBy?: string;
  approvedBy?: string;
}

export interface DxfHoleFeature {
  cx: number; // CAD X (dari kiri)
  cy: number; // CAD Y (dari bawah)
  diameter: number; // mm
  label: string;
}

export interface DxfCutoutFeature {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
  label: string;
}

export interface DxfDuctFeature {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
  label: string;
}

export interface DxfRailFeature {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
  label: string;
}

export interface ExtractedPanelFeatures {
  plateWidth: number;
  plateHeight: number;
  holes: DxfHoleFeature[];
  cutouts: DxfCutoutFeature[];
  ducts: DxfDuctFeature[];
  rails: DxfRailFeature[];
  otherComponents: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    label: string;
  }[];
  // Dimensi unik koordinat datum
  xDimensions: number[];
  yDimensions: number[];
  holeLeaderText: string | null;
}

/**
 * Ekstraksi fitur mekanik (lubang potong, lubang bor, garis sumbu) dari items layout.
 * Mengubah koordinat SVG (origin top-left) ke koordinat CAD (origin bottom-left).
 */
export function extractPanelFeatures(
  plateWidth: number,
  plateHeight: number,
  items: PanelLayoutItem[],
  _mode?: "HMI" | "MAIN" | "OP_MOUNTING"
): ExtractedPanelFeatures {
  const holes: DxfHoleFeature[] = [];
  const cutouts: DxfCutoutFeature[] = [];
  const ducts: DxfDuctFeature[] = [];
  const rails: DxfRailFeature[] = [];
  const otherComponents: ExtractedPanelFeatures["otherComponents"] = [];

  const roundCategories = [
    "PUSH_BUTTON",
    "EMERGENCY_STOP",
    "SELECTOR_SWITCH",
    "PILOT_LAMP",
    "BUZZER",
    "MAIN_SWITCH",
  ];

  for (const it of items) {
    if (it.category === "HMI") {
      // Hitung ukuran lubang potong (cutout) HMI
      let cutoutW = Math.max(50, it.widthMm - 15);
      let cutoutH = Math.max(40, it.heightMm - 15);

      const modelUp = (it.specificModel || "").toUpperCase();
      const nameLower = (it.name || "").toLowerCase();

      if (modelUp.includes("7INCH") || nameLower.includes("7 inch") || nameLower.includes("gs2107") || nameLower.includes("nb7w")) {
        cutoutW = 191;
        cutoutH = 137;
      } else if (modelUp.includes("10INCH") || nameLower.includes("10 inch") || nameLower.includes("gs2110")) {
        cutoutW = 258;
        cutoutH = 199;
      } else if (modelUp.includes("4INCH") || nameLower.includes("4.3") || nameLower.includes("4 inch")) {
        cutoutW = 119;
        cutoutH = 93;
      }

      // Pusatkan cutout di dalam kotak bezel HMI
      const cxSvg = it.xMm + it.widthMm / 2;
      const cySvg = it.yMm + it.heightMm / 2;

      const minX = Math.round((cxSvg - cutoutW / 2) * 10) / 10;
      const maxX = Math.round((cxSvg + cutoutW / 2) * 10) / 10;
      // Konversi Y ke CAD (dari bawah)
      const cadCenterY = plateHeight - cySvg;
      const minY = Math.round((cadCenterY - cutoutH / 2) * 10) / 10;
      const maxY = Math.round((cadCenterY + cutoutH / 2) * 10) / 10;

      cutouts.push({
        minX,
        maxX,
        minY,
        maxY,
        widthMm: cutoutW,
        heightMm: cutoutH,
        label: it.tagLabel || it.name || "HMI CUTOUT",
      });
    } else if (roundCategories.includes(it.category)) {
      // Komponen berlubang bulat pintu panel (tombol, selector, emergency stop, lampu)
      let diameter = 22; // Standar industri 22mm
      const modelUp = (it.specificModel || "").toUpperCase();
      if (modelUp.includes("30MM") || (it.name || "").includes("30mm")) diameter = 30;
      if (modelUp.includes("16MM") || (it.name || "").includes("16mm")) diameter = 16;

      const cxSvg = it.xMm + it.widthMm / 2;
      // Di layout editor: jika komponen bertipe tombol berlegend plate (tinggi >= 45), pusat lubang di Y = yMm + 18
      const cySvg =
        it.category === "EMERGENCY_STOP" || it.heightMm <= 40
          ? it.yMm + it.heightMm / 2
          : it.yMm + 18;

      const cadX = Math.round(cxSvg * 10) / 10;
      const cadY = Math.round((plateHeight - cySvg) * 10) / 10;

      holes.push({
        cx: cadX,
        cy: cadY,
        diameter,
        label: it.tagLabel || it.name || "PB",
      });
    } else if (it.type === "DUCT_HORIZONTAL" || it.type === "DUCT_VERTICAL") {
      const minX = it.xMm;
      const maxX = it.xMm + it.widthMm;
      const maxY = plateHeight - it.yMm;
      const minY = plateHeight - (it.yMm + it.heightMm);
      ducts.push({
        minX,
        maxX,
        minY,
        maxY,
        widthMm: it.widthMm,
        heightMm: it.heightMm,
        label: it.tagLabel || `DUCT ${it.profileSize || ""}`,
      });
    } else if (it.type === "DIN_RAIL") {
      const minX = it.xMm;
      const maxX = it.xMm + it.widthMm;
      const maxY = plateHeight - it.yMm;
      const minY = plateHeight - (it.yMm + it.heightMm);
      rails.push({
        minX,
        maxX,
        minY,
        maxY,
        widthMm: it.widthMm,
        heightMm: it.heightMm,
        label: it.tagLabel || "DIN RAIL",
      });
    } else {
      const minX = it.xMm;
      const maxX = it.xMm + it.widthMm;
      const maxY = plateHeight - it.yMm;
      const minY = plateHeight - (it.yMm + it.heightMm);
      otherComponents.push({
        minX,
        maxX,
        minY,
        maxY,
        label: it.tagLabel || it.name,
      });
    }
  }

  // Kumpulkan titik koordinat unik untuk dimensi datum (X dan Y)
  const xSet = new Set<number>();
  const ySet = new Set<number>();

  // Titik awal & akhir plat
  xSet.add(0);
  xSet.add(plateWidth);
  ySet.add(0);
  ySet.add(plateHeight);

  // Titik lubang
  for (const h of holes) {
    xSet.add(h.cx);
    ySet.add(h.cy);
  }

  // Titik cutout
  for (const c of cutouts) {
    xSet.add(c.minX);
    xSet.add(c.maxX);
    ySet.add(c.minY);
    ySet.add(c.maxY);
  }

  // Untuk panel utama: tambahkan titik garis sumbu din rail & duct
  for (const r of rails) {
    const midY = Math.round((r.minY + r.maxY) / 2);
    ySet.add(midY);
  }
  for (const d of ducts) {
    xSet.add(d.minX);
    xSet.add(d.maxX);
    ySet.add(d.minY);
    ySet.add(d.maxY);
  }

  const xDimensions = Array.from(xSet).sort((a, b) => a - b);
  const yDimensions = Array.from(ySet).sort((a, b) => a - b);

  // Hitung leader text untuk lubang (seperti di PDF: "10X ⌀ 22 THRU")
  let holeLeaderText: string | null = null;
  if (holes.length > 0) {
    // Cari diameter paling dominan
    const countByDia: Record<number, number> = {};
    for (const h of holes) {
      countByDia[h.diameter] = (countByDia[h.diameter] || 0) + 1;
    }
    const dominantDia = Object.keys(countByDia).reduce((a, b) =>
      countByDia[Number(a)] > countByDia[Number(b)] ? a : b
    );
    const dominantCount = countByDia[Number(dominantDia)];
    holeLeaderText = `${dominantCount}X %%c ${dominantDia} THRU`;
  }

  return {
    plateWidth,
    plateHeight,
    holes,
    cutouts,
    ducts,
    rails,
    otherComponents,
    xDimensions,
    yDimensions,
    holeLeaderText,
  };
}

/**
 * Format string angka desimal untuk CAD (ganti titik dengan koma jika diminta, atau desimal standar).
 */
function fmtCoord(val: number): string {
  // Angka bulat tampil tanpa desimal, angka berkoma tampil dengan 1 desimal
  const rounded = Math.round(val * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

/**
 * Generator File DXF Lengkap (AutoCAD R12 / 2000).
 */
export function generatePanelLayoutDxf(
  features: ExtractedPanelFeatures,
  metadata: DxfProjectMetadata,
  mode: "HMI" | "MAIN" | "OP_MOUNTING"
): string {
  const {
    plateWidth,
    plateHeight,
    holes,
    cutouts,
    ducts,
    rails,
    otherComponents,
    xDimensions,
    yDimensions,
    holeLeaderText,
  } = features;

  const lines: string[] = [];

  function add(tag: number | string, val: string | number) {
    lines.push(typeof tag === "number" ? tag.toString() : tag);
    lines.push(val.toString());
  }

  function addLine(
    layer: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color?: number
  ) {
    add(0, "LINE");
    add(8, layer);
    if (color !== undefined) add(62, color);
    add(10, fmtCoord(x1));
    add(20, fmtCoord(y1));
    add(30, "0.0");
    add(11, fmtCoord(x2));
    add(21, fmtCoord(y2));
    add(31, "0.0");
  }

  function addCircle(
    layer: string,
    cx: number,
    cy: number,
    radius: number,
    color?: number
  ) {
    add(0, "CIRCLE");
    add(8, layer);
    if (color !== undefined) add(62, color);
    add(10, fmtCoord(cx));
    add(20, fmtCoord(cy));
    add(30, "0.0");
    add(40, fmtCoord(radius));
  }

  function addText(
    layer: string,
    x: number,
    y: number,
    height: number,
    text: string,
    rotation: number = 0,
    color?: number,
    alignH: number = 0 // 0=Left, 1=Center, 2=Right
  ) {
    add(0, "TEXT");
    add(8, layer);
    if (color !== undefined) add(62, color);
    add(10, fmtCoord(x));
    add(20, fmtCoord(y));
    add(30, "0.0");
    add(40, height);
    add(1, text);
    if (rotation !== 0) add(50, rotation);
    if (alignH !== 0) {
      add(72, alignH);
      add(11, fmtCoord(x));
      add(21, fmtCoord(y));
      add(31, "0.0");
    }
  }

  function addRect(
    layer: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color?: number
  ) {
    addLine(layer, x1, y1, x2, y1, color);
    addLine(layer, x2, y1, x2, y2, color);
    addLine(layer, x2, y2, x1, y2, color);
    addLine(layer, x1, y2, x1, y1, color);
  }

  // ==================== 1. HEADER SECTION ====================
  add(0, "SECTION");
  add(2, "HEADER");
  add(9, "$ACADVER");
  add(1, "AC1009"); // DXF R12 standard (universal compatibility)
  add(9, "$MEASUREMENT");
  add(70, 1); // 1 = Metric (mm)
  add(9, "$INSUNITS");
  add(70, 4); // 4 = Millimeters
  add(9, "$EXTMIN");
  add(10, "-100.0");
  add(20, "-100.0");
  add(30, "0.0");
  add(9, "$EXTMAX");
  add(10, `${plateWidth + 150}`);
  add(20, `${plateHeight + 150}`);
  add(30, "0.0");
  add(0, "ENDSEC");

  // ==================== 2. TABLES SECTION ====================
  add(0, "SECTION");
  add(2, "TABLES");

  // Linetypes
  add(0, "TABLE");
  add(2, "LTYPE");
  add(70, 3);

  add(0, "LTYPE");
  add(2, "CONTINUOUS");
  add(70, 64);
  add(3, "Solid line");
  add(72, 65);
  add(73, 0);
  add(40, "0.0");

  add(0, "LTYPE");
  add(2, "CENTER");
  add(70, 64);
  add(3, "Center line ____ _ ____ _");
  add(72, 65);
  add(73, 4);
  add(40, "31.75");
  add(49, "19.05");
  add(49, "-6.35");
  add(49, "6.35");
  add(49, "-6.35");

  add(0, "LTYPE");
  add(2, "DASHED");
  add(70, 64);
  add(3, "Dashed line __ __ __");
  add(72, 65);
  add(73, 2);
  add(40, "19.05");
  add(49, "12.7");
  add(49, "-6.35");

  add(0, "ENDTAB");

  // Layers Definition with Industry Colors
  add(0, "TABLE");
  add(2, "LAYER");
  add(70, 8);

  const layerDefs = [
    { name: "0_PLATE_OUTLINE", color: 7 }, // White / Continuous
    { name: "1_CUTOUT_HMI", color: 1 }, // Red
    { name: "2_DRILL_HOLES", color: 4 }, // Cyan
    { name: "3_CENTER_LINES", color: 1 }, // Red (Garis Sumbu)
    { name: "4_DIN_RAILS", color: 2 }, // Yellow
    { name: "5_WIRING_DUCTS", color: 8 }, // Gray
    { name: "6_DIMENSIONS", color: 3 }, // Green
    { name: "7_TITLE_BLOCK", color: 7 }, // White
  ];

  for (const l of layerDefs) {
    add(0, "LAYER");
    add(2, l.name);
    add(70, 64);
    add(62, l.color);
    add(6, "CONTINUOUS");
  }

  add(0, "ENDTAB");
  add(0, "ENDSEC");

  // ==================== 3. ENTITIES SECTION ====================
  add(0, "SECTION");
  add(2, "ENTITIES");

  // A. KONTUR PLAT LUAR (PLATE OUTLINE)
  addRect("0_PLATE_OUTLINE", 0, 0, plateWidth, plateHeight, 7);

  // B. LUBANG CUTOUT HMI
  for (const c of cutouts) {
    addRect("1_CUTOUT_HMI", c.minX, c.minY, c.maxX, c.maxY, 1);
    // Label teks di dalam cutout
    const textX = (c.minX + c.maxX) / 2;
    const textY = (c.minY + c.maxY) / 2;
    addText(
      "1_CUTOUT_HMI",
      textX,
      textY,
      6.0,
      `CUTOUT ${c.widthMm}x${c.heightMm}`,
      0,
      1,
      1
    );
  }

  // C. LUBANG BOR TOMBOL (DRILL HOLES Ø22 / Ø30)
  for (const h of holes) {
    const r = h.diameter / 2;
    addCircle("2_DRILL_HOLES", h.cx, h.cy, r, 4);

    // Garis sumbu crosshair (+)
    const arm = r + 4;
    addLine("3_CENTER_LINES", h.cx - arm, h.cy, h.cx + arm, h.cy, 1);
    addLine("3_CENTER_LINES", h.cx, h.cy - arm, h.cx, h.cy + arm, 1);
  }

  // D. LEADER CALLOUT UNTUK LUBANG (seperti di PDF: "10X ⌀ 22 THRU")
  if (holes.length > 0 && holeLeaderText) {
    // Pilih lubang paling kanan untuk ditarik panah leader
    const targetHole = holes.reduce((prev, curr) =>
      curr.cx > prev.cx ? curr : prev
    );
    const startX = targetHole.cx + targetHole.diameter / 2;
    const startY = targetHole.cy + targetHole.diameter / 4;
    const elbowX = startX + 25;
    const elbowY = startY + 20;
    const endX = elbowX + 35;

    // Garis panah leader
    addLine("6_DIMENSIONS", startX, startY, elbowX, elbowY, 3);
    addLine("6_DIMENSIONS", elbowX, elbowY, endX, elbowY, 3);

    // Mata panah (2 garis kecil membentuk arrow)
    const arrowLen = 3.5;
    addLine(
      "6_DIMENSIONS",
      startX,
      startY,
      startX + arrowLen * 0.9,
      startY + arrowLen * 0.5,
      3
    );
    addLine(
      "6_DIMENSIONS",
      startX,
      startY,
      startX + arrowLen * 0.5,
      startY + arrowLen * 0.9,
      3
    );

    // Teks leader
    addText(
      "6_DIMENSIONS",
      elbowX + 2,
      elbowY + 2.5,
      5.5,
      holeLeaderText,
      0,
      7,
      0
    );
  }

  // E. DIN RAILS & WIRING DUCTS (Khusus Panel Utama)
  for (const d of ducts) {
    addRect("5_WIRING_DUCTS", d.minX, d.minY, d.maxX, d.maxY, 8);
    const midX = (d.minX + d.maxX) / 2;
    const midY = (d.minY + d.maxY) / 2;
    const rot = d.heightMm > d.widthMm ? 90 : 0;
    addText("5_WIRING_DUCTS", midX, midY, 5.0, d.label, rot, 8, 1);
  }

  for (const r of rails) {
    addRect("4_DIN_RAILS", r.minX, r.minY, r.maxX, r.maxY, 2);
    const midY = (r.minY + r.maxY) / 2;
    // Garis sumbu tengah rel
    addLine("3_CENTER_LINES", r.minX, midY, r.maxX, midY, 1);
  }

  for (const oc of otherComponents) {
    addRect("0_PLATE_OUTLINE", oc.minX, oc.minY, oc.maxX, oc.maxY, 3);
    addText(
      "0_PLATE_OUTLINE",
      (oc.minX + oc.maxX) / 2,
      (oc.minY + oc.maxY) / 2,
      4.5,
      oc.label,
      0,
      3,
      1
    );
  }

  // F. DIMENSI ORDINAT / BASELINE (Persis seperti di PDF lampiran)
  // 1. Dimensi Sumbu X (Garis ukur horizontal di atas plat)
  const dimTopY = plateHeight + 25;
  // Garis baseline horizontal atas
  addLine("6_DIMENSIONS", 0, dimTopY, plateWidth, dimTopY, 3);
  // Panah di ujung 0 dan lebar plat
  addLine("6_DIMENSIONS", 0, dimTopY - 3, 0, dimTopY + 3, 3);
  addLine("6_DIMENSIONS", plateWidth, dimTopY - 3, plateWidth, dimTopY + 3, 3);

  for (const xVal of xDimensions) {
    // Garis proyeksi (extension line) dari plat/fitur ke garis dimensi atas
    addLine("6_DIMENSIONS", xVal, plateHeight, xVal, dimTopY + 5, 3);
    // Teks angka dimensi tegak lurus (rotasi 90 derajat seperti di PDF)
    addText("6_DIMENSIONS", xVal - 1.5, dimTopY + 8, 6.0, fmtCoord(xVal), 90, 7, 0);
  }

  // 2. Dimensi Sumbu Y (Garis ukur vertikal di sebelah kiri plat)
  const dimLeftX = -25;
  // Garis baseline vertikal kiri
  addLine("6_DIMENSIONS", dimLeftX, 0, dimLeftX, plateHeight, 3);
  addLine("6_DIMENSIONS", dimLeftX - 3, 0, dimLeftX + 3, 0, 3);
  addLine("6_DIMENSIONS", dimLeftX - 3, plateHeight, dimLeftX + 3, plateHeight, 3);

  for (const yVal of yDimensions) {
    // Garis proyeksi dari plat/fitur ke garis dimensi kiri
    addLine("6_DIMENSIONS", 0, yVal, dimLeftX - 5, yVal, 3);
    // Teks angka dimensi horizontal
    addText("6_DIMENSIONS", dimLeftX - 8, yVal - 2, 6.0, fmtCoord(yVal), 0, 7, 2);
  }

  // G. TITLE BLOCK (KOP GAMBAR TWINTECH PRECISION)
  // Diletakkan rapi di pojok kanan bawah dari gambar
  const tbWidth = 220;
  const tbHeight = 65;
  const tbX = Math.max(plateWidth + 10, 180);
  const tbY = -tbHeight - 20;

  // Kotak luar title block
  addRect("7_TITLE_BLOCK", tbX, tbY, tbX + tbWidth, tbY + tbHeight, 7);

  // Garis-garis kolom internal title block
  const row1 = tbY + 45;
  const row2 = tbY + 25;
  addLine("7_TITLE_BLOCK", tbX, row1, tbX + tbWidth, row1, 7);
  addLine("7_TITLE_BLOCK", tbX, row2, tbX + tbWidth, row2, 7);

  // Logo & Nama Perusahaan
  addText("7_TITLE_BLOCK", tbX + 8, tbY + 51, 6.5, "Twintech Precision", 0, 7);
  addText(
    "7_TITLE_BLOCK",
    tbX + 8,
    tbY + 47,
    3.0,
    "pcb dies, precision part, jig and checking fixture",
    0,
    7
  );

  // Baris Proyek & Part Name
  addText("7_TITLE_BLOCK", tbX + 8, tbY + 37, 3.5, "Project Name :", 0, 7);
  addText(
    "7_TITLE_BLOCK",
    tbX + 8,
    tbY + 30,
    5.0,
    (metadata.nama || "PROJECT AUTOMATION").substring(0, 35),
    0,
    7
  );

  // Kolom Part Name
  addText("7_TITLE_BLOCK", tbX + 130, tbY + 37, 3.5, "Part Name :", 0, 7);
  addText(
    "7_TITLE_BLOCK",
    tbX + 130,
    tbY + 30,
    5.0,
    (metadata.partName || (mode === "HMI" ? "OP PANEL DOOR" : "PANEL MOUNTING PLATE")).substring(0, 20),
    0,
    7
  );

  // Baris Info Teknis Bawah
  const colW = tbWidth / 5;
  for (let i = 1; i < 5; i++) {
    addLine("7_TITLE_BLOCK", tbX + i * colW, tbY, tbX + i * colW, row2, 7);
  }

  addText("7_TITLE_BLOCK", tbX + 4, tbY + 18, 3.0, "Job Order :", 0, 7);
  addText("7_TITLE_BLOCK", tbX + 4, tbY + 7, 4.0, metadata.kode || "-", 0, 7);

  addText("7_TITLE_BLOCK", tbX + colW + 4, tbY + 18, 3.0, "Drawn :", 0, 7);
  addText("7_TITLE_BLOCK", tbX + colW + 4, tbY + 7, 4.0, metadata.drawnBy || metadata.pic || "DEDI", 0, 7);

  addText("7_TITLE_BLOCK", tbX + 2 * colW + 4, tbY + 18, 3.0, "Checked :", 0, 7);
  addText("7_TITLE_BLOCK", tbX + 2 * colW + 4, tbY + 7, 4.0, metadata.checkedBy || "IVAN", 0, 7);

  addText("7_TITLE_BLOCK", tbX + 3 * colW + 4, tbY + 18, 3.0, "Date :", 0, 7);
  addText("7_TITLE_BLOCK", tbX + 3 * colW + 4, tbY + 7, 3.8, metadata.dateStr || new Date().toLocaleDateString("en-GB"), 0, 7);

  addText("7_TITLE_BLOCK", tbX + 4 * colW + 4, tbY + 18, 3.0, "Scale :", 0, 7);
  addText("7_TITLE_BLOCK", tbX + 4 * colW + 4, tbY + 7, 4.0, "1:1 (NTS)", 0, 7);

  // ==================== 4. END OF DXF ====================
  add(0, "ENDSEC");
  add(0, "EOF");

  return lines.join("\n") + "\n";
}

/**
 * Trigger download file DXF di browser client-side.
 */
export function downloadDxfFile(filename: string, dxfContent: string) {
  const blob = new Blob([dxfContent], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".dxf") ? filename : `${filename}.dxf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
