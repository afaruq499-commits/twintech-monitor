/**
 * panel-magnetic-guide.ts
 *
 * Smart Magnetic Alignment & Center Snapping System untuk Editor Layout Panel & HMI Twintech.
 *
 * Fitur:
 * 1. Snap ke Garis Tengah Plat (Center X: width/2, Center Y: height/2) dengan visual garis magnet.
 * 2. Snap ke Garis Tengah HMI (Center X Layar HMI) agar tombol simetris tepat di bawah HMI.
 * 3. Snap ke Garis Tengah Komponen Lain (Center Y sebaris / Center X sekolom) untuk meluruskan deretan tombol.
 * 4. Snap Jarak Spasi Antar Tombol (Equal Gap / Pitch Spacing) agar jarak antar tombol identik.
 * 5. Fungsi Utility Distribusi & Alignment Simetris 1-Klik:
 *    - centerItemOnPlate (Horizontal / Vertikal)
 *    - centerItemUnderHmi
 *    - distributeSelectedItemsHorizontally
 */

import type { PanelEnclosure, PanelLayoutItem } from "./panel-layout-template";

export interface SpacingIndicator {
  x1: number;
  x2: number;
  y: number;
  gapMm: number;
}

export interface MagneticGuide {
  id: string;
  type: "VERTICAL" | "HORIZONTAL";
  positionMm: number; // Garis X untuk VERTICAL, Garis Y untuk HORIZONTAL
  startMm: number;    // Batas awal (Y untuk vertikal, X untuk horizontal)
  endMm: number;      // Batas akhir (Y untuk vertikal, X untuk horizontal)
  label: string;
  color: string;      // Warna garis magnet (Magenta: smart component, Cyan: center plat, Biru: center HMI)
  isPlateCenter?: boolean;
  isComponentCenter?: boolean;
  isHmiCenter?: boolean;
  spacingIndicator?: SpacingIndicator;
}

export interface SmartSnapResult {
  snappedX: number;
  snappedY: number;
  guides: MagneticGuide[];
  snappedAxisX: boolean;
  snappedAxisY: boolean;
}

export const DEFAULT_SNAP_THRESHOLD_MM = 6;

/**
 * Menghitung posisi snap magnetik dan menghasilkan garis bantu visual (magnetic smart guides).
 */
export function calculateSmartMagneticSnap(params: {
  rawX: number;
  rawY: number;
  draggedItem: PanelLayoutItem;
  allItems: PanelLayoutItem[];
  dragIds: string[];
  enclosure: PanelEnclosure;
  thresholdMm?: number;
  enabled?: boolean;
}): SmartSnapResult {
  const {
    rawX,
    rawY,
    draggedItem,
    allItems,
    dragIds,
    enclosure,
    thresholdMm = DEFAULT_SNAP_THRESHOLD_MM,
    enabled = true,
  } = params;

  if (!enabled) {
    return {
      snappedX: rawX,
      snappedY: rawY,
      guides: [],
      snappedAxisX: false,
      snappedAxisY: false,
    };
  }

  const w = draggedItem.widthMm;
  const h = draggedItem.heightMm;

  let nextX = rawX;
  let nextY = rawY;
  const guides: MagneticGuide[] = [];

  const otherItems = allItems.filter((i) => !dragIds.includes(i.id));

  // =========================================================================
  // 1. SNAP SUMBU Y (ROW ALIGNMENT & PLAT CENTER Y)
  // =========================================================================
  let bestYDiff = Infinity;
  let bestSnappedY: number | null = null;
  let bestYGuide: MagneticGuide | null = null;

  const candCenterY = rawY + h / 2;
  const candTopY = rawY;
  const candBottomY = rawY + h;

  // A. Cek Pusat Plat Y
  const plateCenterY = enclosure.heightMm / 2;
  const diffPlateY = Math.abs(candCenterY - plateCenterY);
  if (diffPlateY <= thresholdMm && diffPlateY < bestYDiff) {
    bestYDiff = diffPlateY;
    bestSnappedY = Math.round(plateCenterY - h / 2);
    bestYGuide = {
      id: "guide-plate-cy",
      type: "HORIZONTAL",
      positionMm: plateCenterY,
      startMm: 0,
      endMm: enclosure.widthMm,
      label: `Tengah Plat (Y: ${Math.round(plateCenterY)} mm)`,
      color: "#06b6d4", // Cyan
      isPlateCenter: true,
      isComponentCenter: true,
    };
  }

  // B. Cek Sejajar Pusat Y Komponen Lain (Prioritas Utama Deretan Tombol)
  for (const other of otherItems) {
    const otherCenterY = other.yMm + other.heightMm / 2;
    const diffCenterY = Math.abs(candCenterY - otherCenterY);

    if (diffCenterY <= thresholdMm && diffCenterY < bestYDiff) {
      bestYDiff = diffCenterY;
      bestSnappedY = Math.round(otherCenterY - h / 2);
      const minX = Math.min(rawX, other.xMm) - 20;
      const maxX = Math.max(rawX + w, other.xMm + other.widthMm) + 20;

      bestYGuide = {
        id: `guide-cy-${other.id}`,
        type: "HORIZONTAL",
        positionMm: otherCenterY,
        startMm: Math.max(0, minX),
        endMm: Math.min(enclosure.widthMm, maxX),
        label: `Sejajar Pusat Tombol (Y: ${Math.round(otherCenterY)} mm)`,
        color: "#ec4899", // Magenta Smart Guide
        isComponentCenter: true,
      };
    }
  }

  // C. Cek Rata Atas Y (Top Edge) jika belum snap ke center
  if (!bestSnappedY) {
    for (const other of otherItems) {
      const diffTopY = Math.abs(candTopY - other.yMm);
      if (diffTopY <= thresholdMm && diffTopY < bestYDiff) {
        bestYDiff = diffTopY;
        bestSnappedY = other.yMm;
        const minX = Math.min(rawX, other.xMm) - 15;
        const maxX = Math.max(rawX + w, other.xMm + other.widthMm) + 15;
        bestYGuide = {
          id: `guide-top-${other.id}`,
          type: "HORIZONTAL",
          positionMm: other.yMm,
          startMm: Math.max(0, minX),
          endMm: Math.min(enclosure.widthMm, maxX),
          label: `Rata Atas (Y: ${other.yMm} mm)`,
          color: "#a855f7", // Purple
        };
      }
    }
  }

  // D. Cek Rata Bawah Y (Bottom Edge)
  if (!bestSnappedY) {
    for (const other of otherItems) {
      const otherBottom = other.yMm + other.heightMm;
      const diffBottomY = Math.abs(candBottomY - otherBottom);
      if (diffBottomY <= thresholdMm && diffBottomY < bestYDiff) {
        bestYDiff = diffBottomY;
        bestSnappedY = otherBottom - h;
        const minX = Math.min(rawX, other.xMm) - 15;
        const maxX = Math.max(rawX + w, other.xMm + other.widthMm) + 15;
        bestYGuide = {
          id: `guide-bottom-${other.id}`,
          type: "HORIZONTAL",
          positionMm: otherBottom,
          startMm: Math.max(0, minX),
          endMm: Math.min(enclosure.widthMm, maxX),
          label: `Rata Bawah (Y: ${otherBottom} mm)`,
          color: "#a855f7",
        };
      }
    }
  }

  let snappedAxisY = false;
  if (bestSnappedY !== null) {
    nextY = bestSnappedY;
    snappedAxisY = true;
    if (bestYGuide) guides.push(bestYGuide);
  }

  // =========================================================================
  // 2. SNAP SUMBU X (COLUMN ALIGNMENT, CENTER PLAT & CENTER HMI)
  // =========================================================================
  let bestXDiff = Infinity;
  let bestSnappedX: number | null = null;
  let bestXGuide: MagneticGuide | null = null;

  const candCenterX = rawX + w / 2;
  const candLeftX = rawX;
  const candRightX = rawX + w;

  // A. Cek Pusat Layar HMI (Prioritas Khusus: tombol simetris tepat di bawah HMI)
  const hmiItem = otherItems.find((i) => i.category === "HMI");
  if (hmiItem) {
    const hmiCenterX = hmiItem.xMm + hmiItem.widthMm / 2;
    const diffHmiX = Math.abs(candCenterX - hmiCenterX);
    if (diffHmiX <= thresholdMm && diffHmiX < bestXDiff) {
      bestXDiff = diffHmiX;
      bestSnappedX = Math.round(hmiCenterX - w / 2);
      const minY = Math.min(rawY, hmiItem.yMm) - 10;
      const maxY = Math.max(rawY + h, hmiItem.yMm + hmiItem.heightMm) + 15;
      bestXGuide = {
        id: "guide-center-hmi",
        type: "VERTICAL",
        positionMm: hmiCenterX,
        startMm: Math.max(0, minY),
        endMm: Math.min(enclosure.heightMm, maxY),
        label: `Tengah Layar HMI (X: ${Math.round(hmiCenterX)} mm)`,
        color: "#3b82f6", // Electric Blue
        isHmiCenter: true,
        isComponentCenter: true,
      };
    }
  }

  // B. Cek Pusat Plat X
  const plateCenterX = enclosure.widthMm / 2;
  const diffPlateX = Math.abs(candCenterX - plateCenterX);
  if (diffPlateX <= thresholdMm && diffPlateX < bestXDiff) {
    bestXDiff = diffPlateX;
    bestSnappedX = Math.round(plateCenterX - w / 2);
    bestXGuide = {
      id: "guide-plate-cx",
      type: "VERTICAL",
      positionMm: plateCenterX,
      startMm: 0,
      endMm: enclosure.heightMm,
      label: `Tengah Plat (X: ${Math.round(plateCenterX)} mm)`,
      color: "#06b6d4", // Cyan
      isPlateCenter: true,
      isComponentCenter: true,
    };
  }

  // C. Cek Sejajar Pusat X Komponen Lain (Kolom Vertikal)
  for (const other of otherItems) {
    if (other.id === hmiItem?.id) continue;
    const otherCenterX = other.xMm + other.widthMm / 2;
    const diffCenterX = Math.abs(candCenterX - otherCenterX);
    if (diffCenterX <= thresholdMm && diffCenterX < bestXDiff) {
      bestXDiff = diffCenterX;
      bestSnappedX = Math.round(otherCenterX - w / 2);
      const minY = Math.min(rawY, other.yMm) - 15;
      const maxY = Math.max(rawY + h, other.yMm + other.heightMm) + 15;
      bestXGuide = {
        id: `guide-cx-${other.id}`,
        type: "VERTICAL",
        positionMm: otherCenterX,
        startMm: Math.max(0, minY),
        endMm: Math.min(enclosure.heightMm, maxY),
        label: `Sejajar Pusat X (${Math.round(otherCenterX)} mm)`,
        color: "#ec4899", // Magenta
        isComponentCenter: true,
      };
    }
  }

  // D. Cek Jarak Spasi Antar Tombol yang Sama (Equal Spacing Pitch)
  // Menemukan tombol lain yang berada di baris horizontal yang sama
  const effectiveY = bestSnappedY !== null ? bestSnappedY : rawY;
  const sameRowItems = otherItems
    .filter((it) => Math.abs(it.yMm + it.heightMm / 2 - (effectiveY + h / 2)) < 15)
    .sort((a, b) => a.xMm - b.xMm);

  if (sameRowItems.length >= 2) {
    for (let i = 0; i < sameRowItems.length - 1; i++) {
      const a = sameRowItems[i];
      const b = sameRowItems[i + 1];
      const standardGap = b.xMm - (a.xMm + a.widthMm);

      if (standardGap > 5 && standardGap < 150) {
        // Cek jika candidate ditempatkan di sebelah kanan item terakhir
        const lastItem = sameRowItems[sameRowItems.length - 1];
        const targetXRight = lastItem.xMm + lastItem.widthMm + standardGap;
        const diffSpacingRight = Math.abs(rawX - targetXRight);

        if (diffSpacingRight <= thresholdMm && diffSpacingRight < bestXDiff) {
          bestXDiff = diffSpacingRight;
          bestSnappedX = Math.round(targetXRight);
          bestXGuide = {
            id: `guide-spacing-r-${lastItem.id}`,
            type: "VERTICAL",
            positionMm: bestSnappedX,
            startMm: effectiveY - 10,
            endMm: effectiveY + h + 10,
            label: `Spasi Simetris (${Math.round(standardGap)} mm)`,
            color: "#10b981", // Emerald Green
            spacingIndicator: {
              x1: lastItem.xMm + lastItem.widthMm,
              x2: bestSnappedX,
              y: effectiveY + h / 2,
              gapMm: Math.round(standardGap),
            },
          };
          break;
        }

        // Cek jika candidate ditempatkan di sebelah kiri item pertama
        const firstItem = sameRowItems[0];
        const targetXLeft = firstItem.xMm - w - standardGap;
        const diffSpacingLeft = Math.abs(rawX - targetXLeft);

        if (diffSpacingLeft <= thresholdMm && diffSpacingLeft < bestXDiff) {
          bestXDiff = diffSpacingLeft;
          bestSnappedX = Math.round(targetXLeft);
          bestXGuide = {
            id: `guide-spacing-l-${firstItem.id}`,
            type: "VERTICAL",
            positionMm: bestSnappedX + w,
            startMm: effectiveY - 10,
            endMm: effectiveY + h + 10,
            label: `Spasi Simetris (${Math.round(standardGap)} mm)`,
            color: "#10b981",
            spacingIndicator: {
              x1: bestSnappedX + w,
              x2: firstItem.xMm,
              y: effectiveY + h / 2,
              gapMm: Math.round(standardGap),
            },
          };
          break;
        }
      }
    }
  }

  // E. Cek Rata Kiri X jika belum snap
  if (!bestSnappedX) {
    for (const other of otherItems) {
      const diffLeftX = Math.abs(candLeftX - other.xMm);
      if (diffLeftX <= thresholdMm && diffLeftX < bestXDiff) {
        bestXDiff = diffLeftX;
        bestSnappedX = other.xMm;
        const minY = Math.min(rawY, other.yMm) - 15;
        const maxY = Math.max(rawY + h, other.yMm + other.heightMm) + 15;
        bestXGuide = {
          id: `guide-left-${other.id}`,
          type: "VERTICAL",
          positionMm: other.xMm,
          startMm: Math.max(0, minY),
          endMm: Math.min(enclosure.heightMm, maxY),
          label: `Rata Kiri (X: ${other.xMm} mm)`,
          color: "#a855f7",
        };
      }
    }
  }

  // F. Cek Rata Kanan X
  if (!bestSnappedX) {
    for (const other of otherItems) {
      const otherRight = other.xMm + other.widthMm;
      const diffRightX = Math.abs(candRightX - otherRight);
      if (diffRightX <= thresholdMm && diffRightX < bestXDiff) {
        bestXDiff = diffRightX;
        bestSnappedX = otherRight - w;
        const minY = Math.min(rawY, other.yMm) - 15;
        const maxY = Math.max(rawY + h, other.yMm + other.heightMm) + 15;
        bestXGuide = {
          id: `guide-right-${other.id}`,
          type: "VERTICAL",
          positionMm: otherRight,
          startMm: Math.max(0, minY),
          endMm: Math.min(enclosure.heightMm, maxY),
          label: `Rata Kanan (X: ${otherRight} mm)`,
          color: "#a855f7",
        };
      }
    }
  }

  let snappedAxisX = false;
  if (bestSnappedX !== null) {
    nextX = bestSnappedX;
    snappedAxisX = true;
    if (bestXGuide) guides.push(bestXGuide);
  }

  // Batasi agar komponen tidak keluar dari tepi plat panel
  const clampedX = Math.max(5, Math.min(enclosure.widthMm - w - 5, nextX));
  const clampedY = Math.max(5, Math.min(enclosure.heightMm - h - 5, nextY));

  return {
    snappedX: clampedX,
    snappedY: clampedY,
    guides,
    snappedAxisX,
    snappedAxisY,
  };
}

/**
 * 1-Klik memposisikan komponen tepat di tengah plat (Center X atau Center Y atau keduanya).
 */
export function centerItemOnPlate(
  items: PanelLayoutItem[],
  targetItemId: string,
  axis: "X" | "Y" | "BOTH",
  enclosure: PanelEnclosure
): PanelLayoutItem[] {
  return items.map((it) => {
    if (it.id !== targetItemId) return it;
    let x = it.xMm;
    let y = it.yMm;
    if (axis === "X" || axis === "BOTH") {
      x = Math.round((enclosure.widthMm - it.widthMm) / 2);
    }
    if (axis === "Y" || axis === "BOTH") {
      y = Math.round((enclosure.heightMm - it.heightMm) / 2);
    }
    return { ...it, xMm: x, yMm: y };
  });
}

/**
 * 1-Klik menyejajarkan komponen (tombol/saklar) tepat di tengah bawah layar HMI.
 */
export function centerItemUnderHmi(
  items: PanelLayoutItem[],
  targetItemId: string,
  enclosure: PanelEnclosure
): PanelLayoutItem[] {
  const hmi = items.find((i) => i.category === "HMI");
  if (!hmi) return items;
  const hmiCenterX = hmi.xMm + hmi.widthMm / 2;

  return items.map((it) => {
    if (it.id !== targetItemId) return it;
    const targetX = Math.round(hmiCenterX - it.widthMm / 2);
    const clampedX = Math.max(5, Math.min(enclosure.widthMm - it.widthMm - 5, targetX));
    return { ...it, xMm: clampedX };
  });
}

/**
 * 1-Klik membagi rata jarak spasi horizontal (Equal Horizontal Distribution / Symmetrical Align)
 * untuk grup tombol terpilih agar simetris sempurna di baris horizontal.
 *
 * @param customGap Jika diisi angka (misal 23 mm), jarak antar tombol diset persis angka tersebut.
 * @param centerOnEnclosure Jika true, seluruh baris dipusatkan secara simetris di tengah lebar plat panel/door.
 */
export function distributeSelectedItemsHorizontally(
  items: PanelLayoutItem[],
  selectedIds: string[],
  enclosure: PanelEnclosure,
  alignCenterY = true,
  customGap?: number,
  centerOnEnclosure = false
): PanelLayoutItem[] {
  const selectedSet = new Set(selectedIds);
  const targets = items.filter((it) => selectedSet.has(it.id));
  if (targets.length < 2) return items;

  // Urutkan item dari kiri ke kanan berdasarkan xMm
  const sorted = [...targets].sort((a, b) => a.xMm - b.xMm);

  const totalItemWidths = sorted.reduce((sum, it) => sum + it.widthMm, 0);
  const count = sorted.length;

  let gap = 0;
  let startX = sorted[0].xMm;

  if (typeof customGap === "number" && customGap >= 0) {
    gap = customGap;
    if (centerOnEnclosure) {
      const totalSpan = totalItemWidths + (count - 1) * gap;
      startX = Math.max(5, Math.round((enclosure.widthMm - totalSpan) / 2));
    }
  } else if (centerOnEnclosure) {
    const minMargin = 20;
    const availWidth = enclosure.widthMm - 2 * minMargin;
    gap = count > 1 ? Math.max(5, Math.round((availWidth - totalItemWidths) / (count - 1))) : 0;
    const totalSpan = totalItemWidths + (count - 1) * gap;
    startX = Math.max(5, Math.round((enclosure.widthMm - totalSpan) / 2));
  } else {
    // Mode bawaan (preserve batas minX sampai maxRight)
    const minX = sorted[0].xMm;
    const last = sorted[count - 1];
    const maxRight = last.xMm + last.widthMm;
    const totalSpan = maxRight - minX;
    const totalGap = totalSpan - totalItemWidths;
    gap = count > 1 ? totalGap / (count - 1) : 0;
    startX = minX;
  }

  // Hitung target Center Y (atau Hole Center Y)
  // Untuk tombol pintu panel bertipe operator device (tinggi > 40mm) dengan label nameplate di atas:
  // Titik tengah lubang bor & lingkaran tombol berada di yMm + (heightMm - 18).
  // Untuk EMERGENCY STOP atau komponen tanpa nameplate tinggi, berada di yMm + heightMm / 2.
  const isDoorBtnCat = (cat: string) =>
    ["PUSH_BUTTON", "SELECTOR_SWITCH", "PILOT_LAMP", "BUZZER"].includes(cat);

  const getHoleCenterY = (it: PanelLayoutItem) => {
    if (isDoorBtnCat(it.category) && it.heightMm > 40) {
      return it.yMm + (it.heightMm - 18);
    }
    return it.yMm + it.heightMm / 2;
  };

  const avgHoleCenterY =
    sorted.reduce((sum, it) => sum + getHoleCenterY(it), 0) / count;

  const newPositions = new Map<string, { x: number; y: number }>();
  let currentX = startX;

  sorted.forEach((it) => {
    let y = it.yMm;
    if (alignCenterY) {
      if (isDoorBtnCat(it.category) && it.heightMm > 40) {
        y = Math.round(avgHoleCenterY - (it.heightMm - 18));
      } else {
        y = Math.round(avgHoleCenterY - it.heightMm / 2);
      }
    }
    newPositions.set(it.id, {
      x: Math.round(currentX),
      y: Math.max(5, Math.min(enclosure.heightMm - it.heightMm - 5, y)),
    });
    currentX += it.widthMm + gap;
  });

  return items.map((it) => {
    const pos = newPositions.get(it.id);
    if (!pos) return it;
    return {
      ...it,
      xMm: Math.max(5, Math.min(enclosure.widthMm - it.widthMm - 5, pos.x)),
      yMm: pos.y,
    };
  });
}

const isDoorButtonCategory = (cat: string) =>
  ["PUSH_BUTTON", "SELECTOR_SWITCH", "PILOT_LAMP", "BUZZER"].includes(cat);

function getDoorHoleCenterY(it: PanelLayoutItem): number {
  if (isDoorButtonCategory(it.category) && it.heightMm > 40) {
    return it.yMm + (it.heightMm - 18);
  }
  return it.yMm + it.heightMm / 2;
}

function splitRowToFitWidth(
  row: PanelLayoutItem[],
  availWidth: number,
  gapMm: number
): PanelLayoutItem[][] {
  const rowSpan = (arr: PanelLayoutItem[]) =>
    arr.reduce((s, it) => s + it.widthMm, 0) + Math.max(0, arr.length - 1) * gapMm;

  if (row.length <= 1 || rowSpan(row) <= availWidth) {
    return [row];
  }

  // Hitung perkiraan jumlah kolom maksimum yang muat lalu bagi rata (balanced)
  const avgW = row.reduce((s, it) => s + it.widthMm, 0) / row.length;
  const maxCols = Math.max(1, Math.floor((availWidth + gapMm) / (avgW + gapMm)));
  const numRows = Math.max(2, Math.ceil(row.length / maxCols));
  const targetPerRow = Math.ceil(row.length / numRows);

  const chunks: PanelLayoutItem[][] = [];
  let cursor = 0;
  while (cursor < row.length) {
    let slice = row.slice(cursor, cursor + targetPerRow);
    while (slice.length > 1 && rowSpan(slice) > availWidth) {
      slice = slice.slice(0, slice.length - 1);
    }
    chunks.push(slice);
    cursor += slice.length;
  }
  return chunks;
}

/**
 * Merapikan tombol pintu HMI/OP secara simetris (mendukung 1 baris maupun multi-baris).
 * - Jika tombol berada dalam 1 baris dan muat di lebar pintu, diratakan 1 baris simetris di tengah.
 * - Jika tombol terdiri dari beberapa baris atau melebihi lebar pintu, otomatis dikelompokkan/dibagi
 *   menjadi baris-baris seimbang yang masing-masing rata tengah dengan jarak horizontal persis `gapMm`
 *   dan jarak vertikal aman di bawah layar HMI tanpa bertumpukan.
 */
export function distributeDoorButtonsSymmetrically(
  items: PanelLayoutItem[],
  selectedIds: string[],
  enclosure: PanelEnclosure,
  gapMm = 23
): { items: PanelLayoutItem[]; enclosure: PanelEnclosure } {
  const selectedSet = new Set(selectedIds);
  const targets = items.filter((it) => selectedSet.has(it.id));
  if (targets.length < 2) {
    return { items, enclosure };
  }

  const sideMargin = 16;
  const availWidth = Math.max(80, enclosure.widthMm - sideMargin * 2);
  const effectiveGap = Math.max(4, gapMm);

  // Cari batas bawah HMI agar tombol tidak menumpuk layar HMI
  const hmiItems = items.filter(
    (it) => it.category === "HMI" && !selectedSet.has(it.id)
  );
  const hmiBottomY =
    hmiItems.length > 0
      ? Math.max(...hmiItems.map((h) => h.yMm + h.heightMm))
      : 0;

  // Kelompokkan berdasarkan baris Y aktual (toleransi 24mm agar baris berdekatan tidak tergabung paksa)
  const byHoleY = [...targets].sort(
    (a, b) => getDoorHoleCenterY(a) - getDoorHoleCenterY(b)
  );
  const rawRows: PanelLayoutItem[][] = [];
  for (const item of byHoleY) {
    const holeY = getDoorHoleCenterY(item);
    const lastRow = rawRows[rawRows.length - 1];
    if (!lastRow) {
      rawRows.push([item]);
      continue;
    }
    const lastHoleAvg =
      lastRow.reduce((s, r) => s + getDoorHoleCenterY(r), 0) / lastRow.length;
    if (Math.abs(holeY - lastHoleAvg) <= 24) {
      lastRow.push(item);
    } else {
      rawRows.push([item]);
    }
  }

  // Urutkan kiri-ke-kanan per baris & pecah bila lebar baris melebihi lebar pintu panel
  const finalRows: PanelLayoutItem[][] = [];
  for (const row of rawRows) {
    const sortedLeftToRight = [...row].sort((a, b) => a.xMm - b.xMm);
    const fitted = splitRowToFitWidth(sortedLeftToRight, availWidth, effectiveGap);
    finalRows.push(...fitted);
  }

  // Kasus 1 baris muat penuh: pertahankan sumbu Y rata-rata asalkan tidak menabrak HMI
  const singleRowTotalW =
    targets.reduce((s, it) => s + it.widthMm, 0) +
    (targets.length - 1) * effectiveGap;
  if (finalRows.length === 1 && singleRowTotalW <= availWidth) {
    const minAllowedY = hmiBottomY > 0 ? hmiBottomY + 12 : 12;
    const minTargetY = Math.min(...targets.map((t) => t.yMm));
    let adjustedItems = distributeSelectedItemsHorizontally(
      items,
      selectedIds,
      enclosure,
      true,
      effectiveGap,
      true
    );
    if (minTargetY < minAllowedY) {
      const shiftDown = minAllowedY - minTargetY;
      adjustedItems = adjustedItems.map((it) =>
        selectedSet.has(it.id) ? { ...it, yMm: it.yMm + shiftDown } : it
      );
    }
    const maxBottom = Math.max(
      ...adjustedItems
        .filter((it) => selectedSet.has(it.id))
        .map((it) => it.yMm + it.heightMm)
    );
    const nextHeight =
      maxBottom + 12 > enclosure.heightMm
        ? Math.ceil((maxBottom + 14) / 10) * 10
        : enclosure.heightMm;
    return {
      items: adjustedItems,
      enclosure:
        nextHeight !== enclosure.heightMm
          ? { ...enclosure, heightMm: nextHeight }
          : enclosure,
    };
  }

  // Multi-baris simetris: susun baris demi baris di bawah HMI dengan spasi vertikal rapi
  const rowGapY = 12;
  const minStartY = hmiBottomY > 0 ? hmiBottomY + 14 : 24;
  const existingMinY = Math.min(...targets.map((t) => t.yMm));
  let cursorRowTopY = Math.max(minStartY, existingMinY);
  // Jika posisi awal sudah terlalu mepet ke bawah, mulai tepat di bawah HMI agar muat
  const estimatedTotalH =
    finalRows.reduce(
      (sum, r) => sum + Math.max(...r.map((it) => it.heightMm)),
      0
    ) +
    Math.max(0, finalRows.length - 1) * rowGapY;
  if (cursorRowTopY + estimatedTotalH + 12 > enclosure.heightMm && minStartY < cursorRowTopY) {
    cursorRowTopY = minStartY;
  }

  const newPositions = new Map<string, { x: number; y: number }>();
  let maxBottomY = 0;

  for (const row of finalRows) {
    const rowWidth =
      row.reduce((s, it) => s + it.widthMm, 0) +
      Math.max(0, row.length - 1) * effectiveGap;
    let currentX = Math.max(8, Math.round((enclosure.widthMm - rowWidth) / 2));

    // Titik tengah lubang bor dihitung dari rata-rata offset hole di baris ini
    const rowMaxH = Math.max(...row.map((it) => it.heightMm));
    const targetHoleY =
      cursorRowTopY +
      Math.max(
        ...row.map((it) =>
          isDoorButtonCategory(it.category) && it.heightMm > 40
            ? it.heightMm - 18
            : it.heightMm / 2
        )
      );

    for (const it of row) {
      const holeOffset =
        isDoorButtonCategory(it.category) && it.heightMm > 40
          ? it.heightMm - 18
          : it.heightMm / 2;
      const y = Math.max(5, Math.round(targetHoleY - holeOffset));
      const x = Math.max(
        5,
        Math.min(Math.max(5, enclosure.widthMm - it.widthMm - 5), Math.round(currentX))
      );
      newPositions.set(it.id, { x, y });
      maxBottomY = Math.max(maxBottomY, y + it.heightMm);
      currentX += it.widthMm + effectiveGap;
    }

    cursorRowTopY += rowMaxH + rowGapY;
  }

  const neededHeight =
    maxBottomY + 14 > enclosure.heightMm
      ? Math.ceil((maxBottomY + 16) / 10) * 10
      : enclosure.heightMm;

  return {
    items: items.map((it) => {
      const pos = newPositions.get(it.id);
      if (!pos) return it;
      return {
        ...it,
        xMm: pos.x,
        yMm: pos.y,
      };
    }),
    enclosure:
      neededHeight !== enclosure.heightMm
        ? { ...enclosure, heightMm: neededHeight }
        : enclosure,
  };
}
