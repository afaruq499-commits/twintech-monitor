"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Printer,
  X,
  FileCode2,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import {
  extractPanelFeatures,
  generatePanelLayoutDxf,
  generateOuterPanelDxf,
  downloadDxfFile,
  type DxfProjectMetadata,
} from "@/lib/export/panel-dxf-generator";
import {
  resolveFanCutoutPosition,
  type PanelLayoutItem,
  type OuterPanelLayoutData,
} from "@/lib/panel-layout-template";

interface PanelDrawingSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "HMI" | "MAIN" | "OP_MOUNTING" | "OUTER";
  plateWidth: number;
  plateHeight: number;
  plateDepth?: number;
  items: PanelLayoutItem[];
  outerPanel?: OuterPanelLayoutData;
  project: {
    kode: string;
    nama: string;
    client?: string | null;
    pic?: string | null;
  };
}

export function PanelDrawingSheetModal({
  isOpen,
  onClose,
  mode,
  plateWidth,
  plateHeight,
  plateDepth,
  items,
  outerPanel,
  project,
}: PanelDrawingSheetModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const sheetSvgRef = useRef<SVGSVGElement>(null);
  const dragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [manualOffsets, setManualOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [manualScales, setManualScales] = useState<Record<string, number>>({});
  const [isDraggingDrawing, setIsDraggingDrawing] = useState(false);

  const manualOffset = manualOffsets[mode] ?? { x: 0, y: 0 };
  const manualScale = manualScales[mode] ?? 1;

  const setCurrentOffset = useCallback(
    (next: { x: number; y: number }) => {
      setManualOffsets((prev) => ({ ...prev, [mode]: next }));
    },
    [mode]
  );

  const setCurrentScale = useCallback(
    (next: number) => {
      const clamped = Math.max(0.65, Math.min(1.4, Number(next.toFixed(2))));
      setManualScales((prev) => ({ ...prev, [mode]: clamped }));
    },
    [mode]
  );

  const handleResetPlacement = useCallback(() => {
    setManualOffsets((prev) => ({ ...prev, [mode]: { x: 0, y: 0 } }));
    setManualScales((prev) => ({ ...prev, [mode]: 1 }));
  }, [mode]);

  const metadata: DxfProjectMetadata = useMemo(() => {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, "0");
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const y = today.getFullYear();
    const dateStr = `${d}/${m}/${y}`;

    return {
      kode: project.kode || "26-TBD-0513",
      nama: project.nama || "MODIFIKASI RATCHET X ROAD TAKING,PIN X BASE STAKING",
      client: project.client || "PT. TWINTECH PRECISION",
      pic: project.pic?.trim() || "-",
      drawnBy: project.pic?.trim() || "-",
      checkedBy: "IVAN",
      approvedBy: "IVAN",
      partName:
        mode === "OUTER"
          ? "BOX ENCLOSURE 2D (PANEL LUAR)"
          : mode === "HMI"
            ? "DUMMY OP PANEL"
            : mode === "OP_MOUNTING"
              ? "OP MOUNTING PLATE"
              : "PANEL MOUNTING PLATE",
      material:
        mode === "OUTER"
          ? "SPCC t=1.5mm / Powder Coating RAL 7035"
          : mode === "HMI"
            ? "SPCC t=1.5mm (Enclosure OP Door)"
            : "SPCC t=2.0mm",
      dateStr,
    };
  }, [project, mode]);

  const features = useMemo(
    () =>
      mode === "OUTER"
        ? {
            plateWidth,
            plateHeight,
            depthMm: outerPanel?.enclosure.depthMm || 265,
            cutouts: [],
            holes: [],
            holeLeaderText: "",
            rails: [],
            ducts: [],
            otherComponents: [],
            xDimensions: [],
            yDimensions: [],
          }
        : extractPanelFeatures(
            plateWidth,
            plateHeight,
            items,
            mode as "HMI" | "MAIN" | "OP_MOUNTING",
            plateDepth
          ),
    [plateWidth, plateHeight, plateDepth, items, mode, outerPanel]
  );

  const dxfContent = useMemo(
    () =>
      mode === "OUTER" && outerPanel
        ? generateOuterPanelDxf(outerPanel, metadata)
        : generatePanelLayoutDxf(
            features,
            metadata,
            (mode === "OUTER" ? "MAIN" : mode) as "HMI" | "MAIN" | "OP_MOUNTING"
          ),
    [features, metadata, mode, outerPanel]
  );

  // Dimensi sheet SVG (A4 / A3 Landscape Aspect 1.414)
  const sheetW = 1188;
  const sheetH = 840;

  useEffect(() => {
    if (!isDraggingDrawing) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const drag = dragStateRef.current;
      const svg = sheetSvgRef.current;
      if (!drag || !svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const scaleX = sheetW / rect.width;
      const scaleY = sheetH / rect.height;
      const dx = (e.clientX - drag.startClientX) * scaleX;
      const dy = (e.clientY - drag.startClientY) * scaleY;

      setCurrentOffset({
        x: Math.round(Math.max(-350, Math.min(450, drag.origX + dx))),
        y: Math.round(Math.max(-250, Math.min(300, drag.origY + dy))),
      });
    };

    const handleWindowMouseUp = () => {
      dragStateRef.current = null;
      setIsDraggingDrawing(false);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDraggingDrawing, setCurrentOffset]);

  if (!isOpen) return null;

  const handleDownloadDxf = () => {
    const cleanKode = (project.kode || "PANEL").replace(/[^a-zA-Z0-9_-]/g, "_");
    if (mode === "OUTER" && outerPanel) {
      const filename = `${cleanKode}_BOX_LUAR_CAD.dxf`;
      downloadDxfFile(filename, dxfContent);
      return;
    }
    const filename = `${cleanKode}_${mode === "HMI" ? "OP_PANEL" : "MAIN_PANEL"}_CAD.dxf`;
    downloadDxfFile(filename, dxfContent);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStartDragDrawing = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragStateRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: manualOffset.x,
      origY: manualOffset.y,
    };
    setIsDraggingDrawing(true);
  };

  // Area gambar mekanik aman (antara margin kiri X=85 s.d sebelum tabel toleransi kanan X=965)
  const maxAvailW = 680;
  const maxAvailH = 470;

  // Margin plat di dalam area gambar (memberikan ruang untuk garis dimensi atas & kiri)
  const dimMarginLeft = 65;
  const dimMarginTop = 45;
  const usableW = maxAvailW - dimMarginLeft;
  const usableH = maxAvailH - dimMarginTop;

  // Skala visual agar plat fit di dalam area gambar (dikali skala manual user jika diatur)
  const baseScale = Math.min(usableW / plateWidth, usableH / plateHeight, 1.5);
  const scale = baseScale * manualScale;
  const scaledPlateW = plateWidth * scale;
  const scaledPlateH = plateHeight * scale;

  // Centering posisi plat di sheet SVG (pusat area kerja = 505)
  const centerAreaX = 505;
  const plateOriginX = Math.max(
    90,
    Math.round(centerAreaX - scaledPlateW / 2)
  );

  // Center vertikal (antara baris revisi atas Y=80 s.d kop kanan bawah Y=660)
  const centerAreaY = 365;
  const plateTopY = Math.max(115, Math.round(centerAreaY - scaledPlateH / 2));
  const plateBottomY = plateTopY + scaledPlateH;

  // Helper konversi koordinat CAD (origin bottom-left) ke koordinat SVG Sheet
  const cadToSheetX = (cadX: number) => plateOriginX + cadX * scale;
  const cadToSheetY = (cadY: number) => plateBottomY - cadY * scale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:border-none print:shadow-none print:w-full print:rounded-none">
        {/* Header Modal (Tersembunyi saat Cetak) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/90 border-b border-slate-700 text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  Gambar Kerja &amp; Export CAD 2D (AutoCAD DWG/DXF)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {mode === "OUTER"
                    ? "Panel Luar / Box Enclosure 2D"
                    : mode === "HMI"
                      ? "OP Panel / HMI Door"
                      : "Mounting Plate"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {mode === "OUTER"
                  ? `Gambar teknik standar Twintech Precision — Dimensi Box Luar ${outerPanel?.enclosure.widthMm || plateWidth}×${outerPanel?.enclosure.heightMm || plateHeight}×${outerPanel?.enclosure.depthMm || 265} mm (Tampak Depan & Tampak Samping).`
                  : mode === "HMI"
                    ? `Gambar teknik standar Twintech Precision — Dimensi OP Panel / HMI Door ${plateWidth}×${plateHeight}×${plateDepth || 180} mm (Tampak Depan & Tampak Samping dengan ukuran tebal).`
                    : `Gambar teknik standar Twintech Precision — ukuran plat ${plateWidth}×${plateHeight} mm dengan lubang bor &amp; cutout presisi 1:1.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadDxf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              title="Download file DXF untuk dibuka langsung di AutoCAD atau software CNC Laser Cutting"
            >
              <Download className="w-4 h-4" />
              <span>Download DXF (AutoCAD)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              title="Cetak lembar gambar teknik atau Simpan sebagai PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer ml-1"
              title="Tutup Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bar Kontrol Posisi & Skala Gambar di Kertas (Tersembunyi saat Cetak/PDF) */}
        <div className="px-5 py-2 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 print:hidden">
          <div className="flex items-center gap-2">
            <Move className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              <strong>Tahan &amp; geser gambar</strong> langsung di atas kertas untuk mengatur posisi center secara manual
            </span>
            {(manualOffset.x !== 0 || manualOffset.y !== 0) && (
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-amber-300">
                X: {manualOffset.x >= 0 ? `+${manualOffset.x}` : manualOffset.x} • Y: {manualOffset.y >= 0 ? `+${manualOffset.y}` : manualOffset.y}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-0.5">
              <button
                type="button"
                onClick={() => setCurrentScale(manualScale - 0.05)}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="Perkecil skala gambar di kertas"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] font-bold w-11 text-center text-white">
                {Math.round(manualScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setCurrentScale(manualScale + 0.05)}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="Perbesar skala gambar di kertas"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetPlacement}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer transition"
              title="Kembalikan posisi gambar tepat ke tengah (Auto Center) & skala 100%"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Auto Center</span>
            </button>

            {(manualOffset.x !== 0 || manualOffset.y !== 0 || manualScale !== 1) && (
              <button
                type="button"
                onClick={handleResetPlacement}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition"
                title="Reset posisi & skala"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Lembar Gambar Teknik (Bisa di-print langsung) */}
        <div
          ref={printAreaRef}
          className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-950 flex items-center justify-center print:p-0 print:bg-white"
        >
          <div className="bg-white text-black shadow-2xl rounded-sm p-2 w-full max-w-[1050px] aspect-[1188/840] border border-slate-300 print:shadow-none print:border-none print:p-0 print:w-full print:max-w-none">
            <svg
              ref={sheetSvgRef}
              viewBox={`0 0 ${sheetW} ${sheetH}`}
              className="w-full h-full select-none"
              style={{ fontFamily: "'Courier New', Courier, monospace" }}
            >
              {/* ================= BORDER LUAR & GRID STANDAR CAD ================= */}
              <rect
                x="15"
                y="15"
                width={sheetW - 30}
                height={sheetH - 30}
                fill="none"
                stroke="#000000"
                strokeWidth="1.2"
              />
              <rect
                x="30"
                y="30"
                width={sheetW - 60}
                height={sheetH - 60}
                fill="none"
                stroke="#000000"
                strokeWidth="2.0"
              />

              {/* Grid 1 - 8 (Atas & Bawah) */}
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num, i) => {
                const cellW = (sheetW - 60) / 8;
                const x = 30 + i * cellW + cellW / 2;
                return (
                  <g key={`col-${num}`}>
                    <text x={x} y="25" textAnchor="middle" fontSize="9" fontWeight="bold">
                      {num}
                    </text>
                    <text x={x} y={sheetH - 18} textAnchor="middle" fontSize="9" fontWeight="bold">
                      {num}
                    </text>
                    {i > 0 && (
                      <>
                        <line x1={30 + i * cellW} y1="15" x2={30 + i * cellW} y2="30" stroke="#000" strokeWidth="0.8" />
                        <line x1={30 + i * cellW} y1={sheetH - 30} x2={30 + i * cellW} y2={sheetH - 15} stroke="#000" strokeWidth="0.8" />
                      </>
                    )}
                  </g>
                );
              })}

              {/* Grid A - F (Kiri & Kanan) */}
              {["A", "B", "C", "D", "E", "F"].map((letter, i) => {
                const cellH = (sheetH - 60) / 6;
                const y = 30 + i * cellH + cellH / 2 + 3;
                return (
                  <g key={`row-${letter}`}>
                    <text x="22" y={y} textAnchor="middle" fontSize="9" fontWeight="bold">
                      {letter}
                    </text>
                    <text x={sheetW - 22} y={y} textAnchor="middle" fontSize="9" fontWeight="bold">
                      {letter}
                    </text>
                    {i > 0 && (
                      <>
                        <line x1="15" y1={30 + i * cellH} x2="30" y2={30 + i * cellH} stroke="#000" strokeWidth="0.8" />
                        <line x1={sheetW - 30} y1={30 + i * cellH} x2={sheetW - 15} y2={30 + i * cellH} stroke="#000" strokeWidth="0.8" />
                      </>
                    )}
                  </g>
                );
              })}

              {/* Panah Tengah (Centering Marks) di 4 Tepi */}
              <polygon points={`${sheetW / 2 - 5},15 ${sheetW / 2 + 5},15 ${sheetW / 2},27`} fill="#000" />
              <polygon points={`${sheetW / 2 - 5},${sheetH - 15} ${sheetW / 2 + 5},${sheetH - 15} ${sheetW / 2},${sheetH - 27}`} fill="#000" />
              <polygon points={`15,${sheetH / 2 - 5} 15,${sheetH / 2 + 5} 27,${sheetH / 2}`} fill="#000" />
              <polygon points={`${sheetW - 15},${sheetH / 2 - 5} ${sheetW - 15},${sheetH / 2 + 5} ${sheetW - 27},${sheetH / 2}`} fill="#000" />

              {/* Header Kolom Revisi (Kiri Atas) */}
              <g transform="translate(30, 30)">
                <rect x="0" y="0" width="480" height="40" fill="none" stroke="#000" strokeWidth="1" />
                <line x1="0" y1="20" x2="480" y2="20" stroke="#000" strokeWidth="0.8" />
                <line x1="35" y1="0" x2="35" y2="40" stroke="#000" strokeWidth="0.8" />
                <line x1="330" y1="0" x2="330" y2="40" stroke="#000" strokeWidth="0.8" />
                <line x1="390" y1="0" x2="390" y2="40" stroke="#000" strokeWidth="0.8" />
                <line x1="435" y1="0" x2="435" y2="40" stroke="#000" strokeWidth="0.8" />

                <text x="17" y="14" textAnchor="middle" fontSize="7.5">RevNo</text>
                <text x="180" y="14" textAnchor="middle" fontSize="7.5">Revision note</text>
                <text x="360" y="14" textAnchor="middle" fontSize="7.5">Date</text>
                <text x="412" y="14" textAnchor="middle" fontSize="7.5">Signature</text>
                <text x="457" y="14" textAnchor="middle" fontSize="7.5">Checked</text>
              </g>

              {/* ================= TABEL TOLERANSI UMUM (KANAN ATAS) ================= */}
              <g transform={`translate(${sheetW - 200}, 30)`}>
                <rect x="0" y="0" width="170" height="235" fill="none" stroke="#000" strokeWidth="1.2" />
                <line x1="0" y1="20" x2="170" y2="20" stroke="#000" strokeWidth="0.8" />
                <line x1="0" y1="75" x2="170" y2="75" stroke="#000" strokeWidth="0.8" />
                <line x1="0" y1="95" x2="170" y2="95" stroke="#000" strokeWidth="0.8" />
                <line x1="0" y1="175" x2="170" y2="175" stroke="#000" strokeWidth="0.8" />

                <text x="85" y="14" textAnchor="middle" fontSize="7.5" fontWeight="bold">
                  SURFACE FINISH SYMBOLS
                </text>
                <text x="10" y="34" fontSize="7">~ UNMACHINED</text>
                <text x="10" y="47" fontSize="7">▽ 25µm-100µm</text>
                <text x="10" y="60" fontSize="7">▽▽ 6.3µm-25µm</text>
                <text x="10" y="72" fontSize="7">▽▽▽ 0.8µm-6.3µm</text>

                <text x="85" y="88" textAnchor="middle" fontSize="7.5" fontWeight="bold">
                  GENERAL TOLERANCE
                </text>

                {/* Baris Tabel Toleransi */}
                <line x1="100" y1="95" x2="100" y2="175" stroke="#000" strokeWidth="0.8" />
                {[
                  ["1 - 10", "±0.1"],
                  ["10 - 100", "±0.15"],
                  ["100 - 500", "±0.25"],
                  ["ABOVE 500", "±0.5"],
                  ["ANGLE", "±1°30'"],
                ].map(([range, tol], idx) => (
                  <g key={`tol-${idx}`}>
                    <line x1="0" y1={110 + idx * 13} x2="170" y2={110 + idx * 13} stroke="#000" strokeWidth="0.6" />
                    <text x="10" y={106 + idx * 13} fontSize="6.5">{range}</text>
                    <text x="135" y={106 + idx * 13} textAnchor="middle" fontSize="6.5">{tol}</text>
                  </g>
                ))}

                {/* Toleransi Lubang & Poros (Hole & Shaft Position) */}
                <text x="85" y="187" textAnchor="middle" fontSize="7" fontWeight="bold">
                  HOLE &amp; SHAFT POSITION
                </text>
                <line x1="0" y1="192" x2="170" y2="192" stroke="#000" strokeWidth="0.8" />
                <text x="10" y="204" fontSize="6.5">1 - 100 mm</text>
                <text x="135" y="204" textAnchor="middle" fontSize="6.5">HOLE: +0.2 / 0</text>
                <text x="10" y="217" fontSize="6.5">100 - 500 mm</text>
                <text x="135" y="217" textAnchor="middle" fontSize="6.5">HOLE: +0.3 / 0</text>
                <text x="10" y="229" fontSize="6.5">ABOVE 500 mm</text>
                <text x="135" y="229" textAnchor="middle" fontSize="6.5">HOLE: +0.5 / 0</text>
              </g>

              {/* ================= KOP GAMBAR (TITLE BLOCK) KANAN BAWAH - STANDAR TWINTECH ================= */}
              {(() => {
                const tbW = 520;
                const tbH = 156;
                const tbX = sheetW - 30 - tbW;
                const tbY = sheetH - 30 - tbH;

                const shortMaterial =
                  mode === "OUTER" || mode === "HMI" ? "SPCC t=1.5" : "SPCC t=2.0";
                const hardTreatment =
                  mode === "OUTER" || mode === "HMI" ? "RAL 7035" : "GALVANIZED";
                const topPartName =
                  mode === "OUTER"
                    ? "MAIN PANEL + BOX LUAR"
                    : mode === "HMI"
                      ? "OPERATION PANEL (OP)"
                      : mode === "OP_MOUNTING"
                        ? "MOUNTING OP PANEL"
                        : "MAIN MOUNTING PLATE";
                const bottomPartNo =
                  mode === "OUTER"
                    ? "PANEL LUAR 2D"
                    : mode === "HMI"
                      ? "MAIN OP PANEL"
                      : mode === "OP_MOUNTING"
                        ? "MOUNTING OP"
                        : "MOUNTING PLATE";

                // Bagi judul proyek menjadi maksimal 2 baris rapi agar tidak pernah memotong border
                const rawProj = (metadata.nama || "PROJECT AUTOMATION").trim().toUpperCase();
                let projLine1 = rawProj;
                let projLine2 = "";
                if (rawProj.length > 26) {
                  const words = rawProj.split(/\s+/);
                  let l1 = "";
                  let idx = 0;
                  while (idx < words.length && (l1 + " " + words[idx]).trim().length <= 26) {
                    l1 = (l1 + " " + words[idx]).trim();
                    idx += 1;
                  }
                  if (!l1) {
                    l1 = rawProj.slice(0, 26);
                    projLine2 = rawProj.slice(26, 52);
                  } else {
                    projLine2 = words.slice(idx).join(" ");
                    if (projLine2.length > 28) projLine2 = projLine2.slice(0, 26) + "..";
                  }
                  projLine1 = l1;
                }

                return (
                  <g
                    transform={`translate(${tbX}, ${tbY})`}
                    style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
                  >
                    {/* Kotak Luar Title Block */}
                    <rect x="0" y="0" width={tbW} height={tbH} fill="#ffffff" stroke="#000000" strokeWidth="1.2" />

                    {/* ================= BARIS ATAS: ITEM NO / PART NAME / MATERIAL / DESC / QTY / HARD TREATMENT ================= */}
                    <line x1="0" y1="16" x2={tbW} y2="16" stroke="#000000" strokeWidth="0.7" />
                    <line x1="0" y1="32" x2={tbW} y2="32" stroke="#000000" strokeWidth="0.9" />
                    <line x1="48" y1="0" x2="48" y2="32" stroke="#000000" strokeWidth="0.7" />
                    <line x1="208" y1="0" x2="208" y2="32" stroke="#000000" strokeWidth="0.7" />
                    <line x1="288" y1="0" x2="288" y2="32" stroke="#000000" strokeWidth="0.7" />
                    <line x1="390" y1="0" x2="390" y2="32" stroke="#000000" strokeWidth="0.7" />
                    <line x1="428" y1="0" x2="428" y2="32" stroke="#000000" strokeWidth="0.7" />

                    {/* Nilai Baris 1 (Atas) */}
                    <text x="24" y="11.5" textAnchor="middle" fontSize="8" fill="#000">M-PN</text>
                    <text x="128" y="11.5" textAnchor="middle" fontSize="8" fill="#000">{topPartName}</text>
                    <text x="248" y="11.5" textAnchor="middle" fontSize="8" fill="#000">{shortMaterial}</text>
                    <text x="339" y="11.5" textAnchor="middle" fontSize="8" fill="#000">-</text>
                    <text x="409" y="11.5" textAnchor="middle" fontSize="8" fill="#000">01</text>
                    <text x="474" y="11.5" textAnchor="middle" fontSize="7.5" fill="#000">{hardTreatment}</text>

                    {/* Label Baris 2 (Bawah Nilai) */}
                    <text x="24" y="27" textAnchor="middle" fontSize="7.5" fill="#111">Item No.</text>
                    <text x="128" y="27" textAnchor="middle" fontSize="7.5" fill="#111">Part Name</text>
                    <text x="248" y="27" textAnchor="middle" fontSize="7.5" fill="#111">Material</text>
                    <text x="339" y="27" textAnchor="middle" fontSize="7.5" fill="#111">Description</text>
                    <text x="409" y="27" textAnchor="middle" fontSize="7.5" fill="#111">Qty.</text>
                    <text x="474" y="27" textAnchor="middle" fontSize="7.5" fill="#111">Hard Treatment</text>

                    {/* Pemisah Vertikal Utama Kiri (Sign-off & Logo) vs Kanan (Date, Project, Job Order) */}
                    <line x1="222" y1="32" x2="222" y2={tbH} stroke="#000000" strokeWidth="0.9" />

                    {/* ================= BLOK KIRI: DRAWN / CHECKED / APPROVED + LOGO TWINTECH ================= */}
                    <line x1="0" y1="46" x2="222" y2="46" stroke="#000000" strokeWidth="0.7" />
                    <line x1="0" y1="80" x2="222" y2="80" stroke="#000000" strokeWidth="0.7" />
                    <line x1="0" y1="96" x2="222" y2="96" stroke="#000000" strokeWidth="0.9" />
                    <line x1="74" y1="32" x2="74" y2="96" stroke="#000000" strokeWidth="0.7" />
                    <line x1="148" y1="32" x2="148" y2="96" stroke="#000000" strokeWidth="0.7" />

                    <text x="37" y="42" textAnchor="middle" fontSize="7.5" fill="#111">Drawn</text>
                    <text x="111" y="42" textAnchor="middle" fontSize="7.5" fill="#111">Checked</text>
                    <text x="185" y="42" textAnchor="middle" fontSize="7.5" fill="#111">Approved</text>

                    <text x="37" y="91" textAnchor="middle" fontSize="8" fill="#000">{metadata.drawnBy}</text>
                    <text x="111" y="91" textAnchor="middle" fontSize="8" fill="#000">{metadata.checkedBy}</text>
                    <text x="185" y="91" textAnchor="middle" fontSize="8" fill="#000">{metadata.approvedBy}</text>

                    {/* Logo Twintech || Precision (Gaya Outline AutoCAD + Tagline) */}
                    <g transform="translate(0, 96)">
                      <text
                        x="94"
                        y="31"
                        textAnchor="end"
                        fontSize="16.5"
                        fontWeight="900"
                        fill="none"
                        stroke="#000000"
                        strokeWidth="0.85"
                        letterSpacing="0.3"
                      >
                        Twintech
                      </text>
                      {/* Simbol Dua Pilar || */}
                      <rect x="99" y="16.5" width="4.5" height="17" fill="none" stroke="#000000" strokeWidth="0.85" />
                      <rect x="106.5" y="12.5" width="4.5" height="18" fill="none" stroke="#000000" strokeWidth="0.85" />
                      <text
                        x="116"
                        y="31"
                        textAnchor="start"
                        fontSize="16.5"
                        fontWeight="900"
                        fill="none"
                        stroke="#000000"
                        strokeWidth="0.85"
                        letterSpacing="0.3"
                      >
                        Precision
                      </text>
                      <text x="111" y="47" textAnchor="middle" fontSize="8.2" fill="#111">
                        pcb dies, precision part, jig and checking fixture
                      </text>
                    </g>

                    {/* ================= BLOK KANAN ATAS: DATE / ORDER NO / A4 mm / SCALE NtS / PROJECTION ================= */}
                    <line x1="222" y1="64" x2={tbW} y2="64" stroke="#000000" strokeWidth="0.9" />
                    <line x1="222" y1="47" x2="382" y2="47" stroke="#000000" strokeWidth="0.7" />
                    <line x1="324" y1="32" x2="324" y2="64" stroke="#000000" strokeWidth="0.7" />
                    <line x1="382" y1="32" x2="382" y2="64" stroke="#000000" strokeWidth="0.7" />
                    <line x1="418" y1="32" x2="418" y2="64" stroke="#000000" strokeWidth="0.7" />
                    <line x1="456" y1="32" x2="456" y2="64" stroke="#000000" strokeWidth="0.7" />

                    <text x="273" y="42.5" textAnchor="middle" fontSize="7.5" fill="#111">Date</text>
                    <text x="273" y="58.5" textAnchor="middle" fontSize="8.2" fill="#000">{metadata.dateStr}</text>

                    <text x="353" y="42.5" textAnchor="middle" fontSize="7.5" fill="#111">Order No.</text>
                    <text x="353" y="58.5" textAnchor="middle" fontSize="8" fill="#000">-</text>

                    <text x="400" y="44" textAnchor="middle" fontSize="8" fill="#111">A4</text>
                    <text x="400" y="58" textAnchor="middle" fontSize="8" fill="#111">mm</text>

                    <text x="437" y="44" textAnchor="middle" fontSize="7.5" fill="#111">Scale</text>
                    <text x="437" y="58" textAnchor="middle" fontSize="8" fill="#111">NtS</text>

                    {/* Simbol Proyeksi Orthogonal (ISO Third-Angle) */}
                    <g transform="translate(456, 32)">
                      {/* Lingkaran konsentris + garis sumbu */}
                      <circle cx="19" cy="16" r="7.5" fill="none" stroke="#000000" strokeWidth="0.9" />
                      <circle cx="19" cy="16" r="3.8" fill="none" stroke="#000000" strokeWidth="0.9" />
                      <line x1="9" y1="16" x2="29" y2="16" stroke="#000000" strokeWidth="0.6" />
                      <line x1="19" y1="6" x2="19" y2="26" stroke="#000000" strokeWidth="0.6" />
                      {/* Trapesium proyeksi + garis sumbu */}
                      <polygon
                        points="36,12 52,8.5 52,23.5 36,20"
                        fill="none"
                        stroke="#000000"
                        strokeWidth="0.9"
                      />
                      <line x1="33" y1="16" x2="55" y2="16" stroke="#000000" strokeWidth="0.6" />
                    </g>

                    {/* ================= BLOK KANAN TENGAH: PROJECT NAME & QTY. PO ================= */}
                    <line x1="222" y1="125" x2={tbW} y2="125" stroke="#000000" strokeWidth="0.9" />
                    <line x1="456" y1="64" x2="456" y2="125" stroke="#000000" strokeWidth="0.7" />

                    <text x="227" y="75" fontSize="7.5" fill="#111">Project Name :</text>
                    {projLine2 ? (
                      <>
                        <text x="339" y="95" textAnchor="middle" fontSize="11" fontWeight="600" fill="#000">
                          {projLine1}
                        </text>
                        <text x="339" y="111" textAnchor="middle" fontSize="11" fontWeight="600" fill="#000">
                          {projLine2}
                        </text>
                      </>
                    ) : (
                      <text x="339" y="102" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#000">
                        {projLine1}
                      </text>
                    )}

                    <text x="488" y="75" textAnchor="middle" fontSize="7.5" fill="#111">Qty. PO</text>
                    <text x="488" y="104" textAnchor="middle" fontSize="9.5" fill="#000">1</text>

                    {/* ================= BLOK KANAN BAWAH: JOB ORDER / MODEL / PART NO ================= */}
                    <line x1="352" y1="125" x2="352" y2={tbH} stroke="#000000" strokeWidth="0.7" />
                    <line x1="394" y1="125" x2="394" y2={tbH} stroke="#000000" strokeWidth="0.7" />

                    <text x="227" y="136" fontSize="7.5" fill="#111">Job Order</text>
                    <text x="287" y="150" textAnchor="middle" fontSize="9" fill="#000">
                      {metadata.kode}
                    </text>

                    <text x="357" y="136" fontSize="7.5" fill="#111">Model</text>
                    <text x="373" y="150" textAnchor="middle" fontSize="9" fill="#000">-</text>

                    <text x="399" y="136" fontSize="7.5" fill="#111">Part No.</text>
                    <text x="457" y="150" textAnchor="middle" fontSize="8.5" fill="#000">
                      {bottomPartNo}
                    </text>
                  </g>
                );
              })()}

              {/* Garis Bantu Center Saat Menggeser Gambar Manual (Tidak ikut tercetak) */}
              {isDraggingDrawing && (
                <g className="print:hidden" pointerEvents="none">
                  <line
                    x1={505}
                    y1={75}
                    x2={505}
                    y2={650}
                    stroke="#0ea5e9"
                    strokeWidth="0.9"
                    strokeDasharray="6,4"
                  />
                  <line
                    x1={35}
                    y1={360}
                    x2={980}
                    y2={360}
                    stroke="#0ea5e9"
                    strokeWidth="0.9"
                    strokeDasharray="6,4"
                  />
                </g>
              )}

              {/* ================= AREA GAMBAR MEKANIK TEKNIK (Bisa Digeser Manual) ================= */}
              <g
                id="mechanical-cad-drawing"
                transform={`translate(${manualOffset.x}, ${manualOffset.y})`}
                onMouseDown={handleStartDragDrawing}
                className={isDraggingDrawing ? "cursor-grabbing" : "cursor-grab"}
              >
                {/* Hit area transparan agar klik di ruang kosong gambar juga bisa drag */}
                <rect
                  x={40}
                  y={80}
                  width={930}
                  height={575}
                  fill="transparent"
                />
                {mode === "OUTER" ? (
                  // ================= GAMBAR 2D PANEL LUAR (FRONT & SIDE VIEW) =================
                  (() => {
                    const outerW = outerPanel?.enclosure.widthMm || plateWidth || 700;
                    const outerH = outerPanel?.enclosure.heightMm || plateHeight || 600;
                    const outerD = outerPanel?.enclosure.depthMm || 265;
                    const feat = outerPanel?.features || {
                      hasLockDoor: true,
                      lockDoorX: 55,
                      lockDoorY: Math.round(outerH * 0.55),
                      hasLoto: false,
                      hasFan: false,
                      fanSizeMm: 120,
                      fanY: 90,
                    };

                    const outerGap = 70;
                    const totalCadW = outerW + outerGap + outerD;

                    // Batas ruang gambar aman agar center antara margin kiri (X=90) dan tabel toleransi kanan (X=965)
                    const maxDrawW = 660;
                    const maxDrawH = 430;
                    const s = Math.min(maxDrawW / totalCadW, maxDrawH / outerH, 0.85) * manualScale;
                    const sw = outerW * s;
                    const sh = outerH * s;
                    const sd = outerD * s;
                    const sgap = outerGap * s;
                    const totalDrawingW = sw + sgap + sd;

                    // Posisi Center Horizontal seimbang (pusat area aman = 505)
                    const outerCenterX = 505;
                    const fx = Math.max(90, Math.round(outerCenterX - totalDrawingW / 2));
                    const sx = fx + sw + sgap;

                    // Posisi Center Vertikal (antara baris revisi atas Y=80 s.d kop kanan bawah Y=660)
                    const outerCenterY = 355;
                    const boxTopY = Math.round(outerCenterY - sh / 2);
                    const fy = boxTopY + sh;
                    const sy = fy;

                    const effectiveLockDoorY = feat.hasLoto
                      ? (feat.lockDoorY ?? Math.round(outerH * 0.58))
                      : Math.round(outerH * 0.5);
                    const lcx = fx + (feat.lockDoorX ?? 55) * s;
                    const lcy = fy - sh + effectiveLockDoorY * s;

                    const lotox = fx + (feat.lotoX ?? 110) * s;
                    const lotoy = fy - sh + (feat.lotoY ?? 110) * s;

                    const fanSizeMm = feat.fanSizeMm || 120;
                    const fanPos = resolveFanCutoutPosition(
                      outerD,
                      outerH,
                      fanSizeMm,
                      feat.fanY
                    );
                    const fanCx = sx + fanPos.cxFromEdgeMm * s;
                    const fanCy = sy - sh + fanPos.cyFromTopMm * s;
                    const fanRMain = (fanPos.spec.cutoutDiaMm / 2) * s;
                    const fanRScrew = (fanPos.spec.screwHoleDiaMm / 2) * s;
                    const fanHalfPitch = fanPos.spec.halfPitchMm * s;

                    return (
                      <g id="outer-panel-sheet-drawing">
                        {/* ================= TAMPAK DEPAN (FRONT VIEW) ================= */}
                        {/* 1. Box Enclosure Utama */}
                        <rect
                          x={fx}
                          y={fy - sh}
                          width={sw}
                          height={sh}
                          fill="#f8fafc"
                          stroke="#000000"
                          strokeWidth="2.0"
                        />

                        {/* 2. Door Bevel Seam Line */}
                        <rect
                          x={fx + 16 * s}
                          y={fy - sh + 16 * s}
                          width={sw - 32 * s}
                          height={sh - 32 * s}
                          fill="none"
                          stroke="#000000"
                          strokeWidth="1.2"
                          strokeDasharray="5,2"
                        />

                        {/* 3. Lock Door (Handle Kunci) */}
                        {feat.hasLockDoor && (
                          <g id="sheet-lock-door">
                            <rect
                              x={lcx - 7 * s}
                              y={lcy - 30 * s}
                              width={14 * s}
                              height={60 * s}
                              rx={3 * s}
                              fill="#ffffff"
                              stroke="#000000"
                              strokeWidth="1.4"
                            />
                            <rect
                              x={lcx - 4 * s}
                              y={lcy - 16 * s}
                              width={8 * s}
                              height={32 * s}
                              rx={2 * s}
                              fill="#e2e8f0"
                              stroke="#000000"
                              strokeWidth="1.0"
                            />
                            <circle
                              cx={lcx}
                              cy={lcy + 18 * s}
                              r={3 * s}
                              fill="#000000"
                            />
                            <line
                              x1={lcx + 7 * s}
                              y1={lcy}
                              x2={lcx + 35}
                              y2={lcy - 35}
                              stroke="#000000"
                              strokeWidth="1.0"
                            />
                            <line
                              x1={lcx + 35}
                              y1={lcy - 35}
                              x2={lcx + 145}
                              y2={lcy - 35}
                              stroke="#000000"
                              strokeWidth="1.0"
                            />
                            <polygon
                              points={`${lcx + 7 * s},${lcy} ${lcx + 7 * s + 6},${lcy - 2} ${lcx + 7 * s + 4},${lcy - 5}`}
                              fill="#000000"
                            />
                            <text
                              x={lcx + 38}
                              y={lcy - 38}
                              fontSize="9.5"
                              fontWeight="bold"
                              fill="#000000"
                            >
                              LOCK DOOR (HANDLE KUNCI)
                            </text>
                          </g>
                        )}

                        {/* 4. LOTO Switch Rotary */}
                        {feat.hasLoto && (
                          <g id="sheet-loto-switch">
                            <rect
                              x={lotox - 22 * s}
                              y={lotoy - 22 * s}
                              width={44 * s}
                              height={44 * s}
                              rx={2 * s}
                              fill="#fef08a"
                              stroke="#000000"
                              strokeWidth="1.4"
                            />
                            <circle
                              cx={lotox}
                              cy={lotoy}
                              r={16 * s}
                              fill="#ffffff"
                              stroke="#000000"
                              strokeWidth="1.2"
                            />
                            <rect
                              x={lotox - 5 * s}
                              y={lotoy - 14 * s}
                              width={10 * s}
                              height={28 * s}
                              rx={2 * s}
                              fill="#ef4444"
                              stroke="#000000"
                              strokeWidth="1.0"
                            />
                            <circle
                              cx={lotox - 10 * s}
                              cy={lotoy + 10 * s}
                              r={3 * s}
                              fill="none"
                              stroke="#000000"
                              strokeWidth="1.0"
                            />
                            <line
                              x1={lotox + 22 * s}
                              y1={lotoy}
                              x2={lotox + 45}
                              y2={lotoy - 30}
                              stroke="#000000"
                              strokeWidth="1.0"
                            />
                            <line
                              x1={lotox + 45}
                              y1={lotoy - 30}
                              x2={lotox + 165}
                              y2={lotoy - 30}
                              stroke="#000000"
                              strokeWidth="1.0"
                            />
                            <polygon
                              points={`${lotox + 22 * s},${lotoy} ${lotox + 22 * s + 6},${lotoy - 2} ${lotox + 22 * s + 4},${lotoy - 5}`}
                              fill="#000000"
                            />
                            <text
                              x={lotox + 48}
                              y={lotoy - 33}
                              fontSize="9.5"
                              fontWeight="bold"
                              fill="#000000"
                            >
                              LOTO MAIN SWITCH (SCHNEIDER EZAROTE)
                            </text>
                          </g>
                        )}

                        {/* Dimensi Lebar (Bawah Tampak Depan) */}
                        <line
                          x1={fx}
                          y1={fy + 25}
                          x2={fx + sw}
                          y2={fy + 25}
                          stroke="#000000"
                          strokeWidth="1.0"
                        />
                        <polygon
                          points={`${fx},${fy + 25} ${fx + 7},${fy + 22} ${fx + 7},${fy + 28}`}
                          fill="#000"
                        />
                        <polygon
                          points={`${fx + sw},${fy + 25} ${fx + sw - 7},${fy + 22} ${fx + sw - 7},${fy + 28}`}
                          fill="#000"
                        />
                        <line x1={fx} y1={fy} x2={fx} y2={fy + 32} stroke="#000" strokeWidth="0.6" />
                        <line x1={fx + sw} y1={fy} x2={fx + sw} y2={fy + 32} stroke="#000" strokeWidth="0.6" />
                        <text
                          x={fx + sw / 2}
                          y={fy + 20}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          {outerW}
                        </text>

                        {/* Dimensi Tinggi (Kiri Tampak Depan) */}
                        <line
                          x1={fx - 25}
                          y1={fy}
                          x2={fx - 25}
                          y2={fy - sh}
                          stroke="#000000"
                          strokeWidth="1.0"
                        />
                        <polygon
                          points={`${fx - 25},${fy} ${fx - 28},${fy - 7} ${fx - 22},${fy - 7}`}
                          fill="#000"
                        />
                        <polygon
                          points={`${fx - 25},${fy - sh} ${fx - 28},${fy - sh + 7} ${fx - 22},${fy - sh + 7}`}
                          fill="#000"
                        />
                        <line x1={fx} y1={fy} x2={fx - 32} y2={fy} stroke="#000" strokeWidth="0.6" />
                        <line x1={fx} y1={fy - sh} x2={fx - 32} y2={fy - sh} stroke="#000" strokeWidth="0.6" />
                        <text
                          x={fx - 32}
                          y={fy - sh / 2 + 4}
                          textAnchor="end"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          {outerH}
                        </text>

                        {/* Label Judul Tampak Depan */}
                        <text
                          x={fx + sw / 2}
                          y={fy + 48}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="bold"
                          fill="#000000"
                        >
                          TAMPAK DEPAN (FRONT VIEW)
                        </text>

                        {/* ================= TAMPAK SAMPING (SIDE VIEW) ================= */}
                        {/* 1. Box Samping */}
                        <rect
                          x={sx}
                          y={sy - sh}
                          width={sd}
                          height={sh}
                          fill="#f8fafc"
                          stroke="#000000"
                          strokeWidth="2.0"
                        />

                        {/* 2. Door Edge */}
                        <rect
                          x={sx - 6 * s}
                          y={sy - sh + 8 * s}
                          width={6 * s}
                          height={sh - 16 * s}
                          fill="#e2e8f0"
                          stroke="#000000"
                          strokeWidth="1.0"
                        />

                        {/* 3. Protrusi Lock Door di Samping */}
                        {feat.hasLockDoor && (
                          <rect
                            x={sx - 12 * s}
                            y={lcy - 20 * s}
                            width={6 * s}
                            height={40 * s}
                            rx={1 * s}
                            fill="#cbd5e1"
                            stroke="#000000"
                            strokeWidth="1.0"
                          />
                        )}

                        {/* 4. Protrusi LOTO Switch di Samping */}
                        {feat.hasLoto && (
                          <rect
                            x={sx - 14 * s}
                            y={lotoy - 12 * s}
                            width={8 * s}
                            height={24 * s}
                            rx={1 * s}
                            fill="#ef4444"
                            stroke="#000000"
                            strokeWidth="1.0"
                          />
                        )}

                        {/* 5. Lubang Fan Bulat (Ø115 + 4× Ø5 pitch 105×105 mm) */}
                        {feat.hasFan && (
                          <g id="sheet-fan-louver">
                            {/* Garis sumbu tengah */}
                            <line
                              x1={fanCx - fanRMain - 14}
                              y1={fanCy}
                              x2={fanCx + fanRMain + 14}
                              y2={fanCy}
                              stroke="#64748b"
                              strokeWidth="0.6"
                              strokeDasharray="4 2 1 2"
                            />
                            <line
                              x1={fanCx}
                              y1={fanCy - fanRMain - 14}
                              x2={fanCx}
                              y2={fanCy + fanRMain + 14}
                              stroke="#64748b"
                              strokeWidth="0.6"
                              strokeDasharray="4 2 1 2"
                            />

                            {/* Lubang Potong Utama Ø115 */}
                            <circle
                              cx={fanCx}
                              cy={fanCy}
                              r={fanRMain}
                              fill="#ffffff"
                              stroke="#000000"
                              strokeWidth="1.3"
                            />

                            {/* 4 Lubang Baut Ø5 pada jarak 105×105 mm */}
                            {[
                              [-fanHalfPitch, -fanHalfPitch],
                              [fanHalfPitch, -fanHalfPitch],
                              [-fanHalfPitch, fanHalfPitch],
                              [fanHalfPitch, fanHalfPitch],
                            ].map(([dx, dy], idx) => (
                              <circle
                                key={`sheet-fan-bolt-${idx}`}
                                cx={fanCx + dx}
                                cy={fanCy + dy}
                                r={fanRScrew}
                                fill="#ffffff"
                                stroke="#000000"
                                strokeWidth="1.0"
                              />
                            ))}

                            {/* Dimensi Pitch Vertikal 105 (kiri) */}
                            <line
                              x1={fanCx - fanHalfPitch - 14}
                              y1={fanCy - fanHalfPitch}
                              x2={fanCx - fanHalfPitch - 14}
                              y2={fanCy + fanHalfPitch}
                              stroke="#000000"
                              strokeWidth="0.7"
                            />
                            <line
                              x1={fanCx - fanHalfPitch - 17}
                              y1={fanCy - fanHalfPitch}
                              x2={fanCx - fanHalfPitch}
                              y2={fanCy - fanHalfPitch}
                              stroke="#000000"
                              strokeWidth="0.5"
                            />
                            <line
                              x1={fanCx - fanHalfPitch - 17}
                              y1={fanCy + fanHalfPitch}
                              x2={fanCx - fanHalfPitch}
                              y2={fanCy + fanHalfPitch}
                              stroke="#000000"
                              strokeWidth="0.5"
                            />
                            <text
                              x={fanCx - fanHalfPitch - 17}
                              y={fanCy}
                              textAnchor="middle"
                              fontSize="8"
                              fill="#000000"
                              transform={`rotate(-90 ${fanCx - fanHalfPitch - 17} ${fanCy})`}
                            >
                              {fanPos.spec.holePitchMm}
                            </text>

                            {/* Dimensi Pitch Horizontal 105 (bawah) */}
                            <line
                              x1={fanCx - fanHalfPitch}
                              y1={fanCy + fanHalfPitch + 14}
                              x2={fanCx + fanHalfPitch}
                              y2={fanCy + fanHalfPitch + 14}
                              stroke="#000000"
                              strokeWidth="0.7"
                            />
                            <line
                              x1={fanCx - fanHalfPitch}
                              y1={fanCy + fanHalfPitch}
                              x2={fanCx - fanHalfPitch}
                              y2={fanCy + fanHalfPitch + 17}
                              stroke="#000000"
                              strokeWidth="0.5"
                            />
                            <line
                              x1={fanCx + fanHalfPitch}
                              y1={fanCy + fanHalfPitch}
                              x2={fanCx + fanHalfPitch}
                              y2={fanCy + fanHalfPitch + 17}
                              stroke="#000000"
                              strokeWidth="0.5"
                            />
                            <text
                              x={fanCx}
                              y={fanCy + fanHalfPitch + 25}
                              textAnchor="middle"
                              fontSize="8"
                              fill="#000000"
                            >
                              {fanPos.spec.holePitchMm}
                            </text>

                            {/* Dimensi Dari Tepi Atas ke Lubang Baut & Center (kanan) */}
                            <line
                              x1={sx + sd + 12}
                              y1={sy - sh}
                              x2={sx + sd + 12}
                              y2={fanCy - fanHalfPitch}
                              stroke="#000000"
                              strokeWidth="0.6"
                            />
                            <text
                              x={sx + sd + 16}
                              y={(sy - sh + (fanCy - fanHalfPitch)) / 2}
                              fontSize="7.5"
                              fill="#000000"
                              transform={`rotate(-90 ${sx + sd + 16} ${(sy - sh + (fanCy - fanHalfPitch)) / 2})`}
                            >
                              {String(fanPos.topToUpperHoleMm).replace(".", ",")}
                            </text>
                            <line
                              x1={sx + sd + 26}
                              y1={sy - sh}
                              x2={sx + sd + 26}
                              y2={fanCy}
                              stroke="#000000"
                              strokeWidth="0.6"
                            />
                            <text
                              x={sx + sd + 30}
                              y={(sy - sh + fanCy) / 2}
                              fontSize="7.5"
                              fill="#000000"
                              transform={`rotate(-90 ${sx + sd + 30} ${(sy - sh + fanCy) / 2})`}
                            >
                              {String(fanPos.cyFromTopMm).replace(".", ",")}
                            </text>

                            {/* Leader Ø115 */}
                            <line
                              x1={fanCx - fanRMain * 0.45}
                              y1={fanCy - fanRMain * 0.9}
                              x2={fanCx - fanRMain - 14}
                              y2={fanCy - fanRMain - 24}
                              stroke="#000000"
                              strokeWidth="0.8"
                            />
                            <line
                              x1={fanCx - fanRMain - 14}
                              y1={fanCy - fanRMain - 24}
                              x2={fanCx - fanRMain - 54}
                              y2={fanCy - fanRMain - 24}
                              stroke="#000000"
                              strokeWidth="0.8"
                            />
                            <text
                              x={fanCx - fanRMain - 52}
                              y={fanCy - fanRMain - 27}
                              fontSize="8.5"
                              fontWeight="bold"
                              fill="#000000"
                            >
                              Ø{fanPos.spec.cutoutDiaMm}
                            </text>

                            {/* Leader Ø5 */}
                            <line
                              x1={fanCx + fanHalfPitch + fanRScrew * 0.7}
                              y1={fanCy + fanHalfPitch + fanRScrew * 0.7}
                              x2={fanCx + fanHalfPitch + 12}
                              y2={fanCy + fanHalfPitch + 14}
                              stroke="#000000"
                              strokeWidth="0.8"
                            />
                            <line
                              x1={fanCx + fanHalfPitch + 12}
                              y1={fanCy + fanHalfPitch + 14}
                              x2={fanCx + fanHalfPitch + 38}
                              y2={fanCy + fanHalfPitch + 14}
                              stroke="#000000"
                              strokeWidth="0.8"
                            />
                            <text
                              x={fanCx + fanHalfPitch + 15}
                              y={fanCy + fanHalfPitch + 11}
                              fontSize="8"
                              fontWeight="bold"
                              fill="#000000"
                            >
                              Ø{fanPos.spec.screwHoleDiaMm}
                            </text>
                          </g>
                        )}

                        {/* Dimensi Kedalaman / Tebal (Bawah Tampak Samping) */}
                        <line
                          x1={sx}
                          y1={sy + 25}
                          x2={sx + sd}
                          y2={sy + 25}
                          stroke="#000000"
                          strokeWidth="1.0"
                        />
                        <polygon
                          points={`${sx},${sy + 25} ${sx + 7},${sy + 22} ${sx + 7},${sy + 28}`}
                          fill="#000"
                        />
                        <polygon
                          points={`${sx + sd},${sy + 25} ${sx + sd - 7},${sy + 22} ${sx + sd - 7},${sy + 28}`}
                          fill="#000"
                        />
                        <line x1={sx} y1={sy} x2={sx} y2={sy + 32} stroke="#000" strokeWidth="0.6" />
                        <line x1={sx + sd} y1={sy} x2={sx + sd} y2={sy + 32} stroke="#000" strokeWidth="0.6" />
                        <text
                          x={sx + sd / 2}
                          y={sy + 20}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          {outerD}
                        </text>

                        {/* Label Judul Tampak Samping */}
                        <text
                          x={sx + sd / 2}
                          y={sy + 48}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="bold"
                          fill="#000000"
                        >
                          TAMPAK SAMPING (SIDE VIEW)
                        </text>
                      </g>
                    );
                  })()
                ) : mode === "HMI" ? (
                  // ================= GAMBAR 2D PANEL HMI (TAMPAK DEPAN & TAMPAK SAMPING DENGAN UKURAN TEBAL) =================
                  (() => {
                    const hmiW = plateWidth || 430;
                    const hmiH = plateHeight || 440;
                    const hmiD = plateDepth || 180;
                    const gap = 110;
                    const totalCadW = hmiW + gap + hmiD;

                    // Batas ruang gambar aman agar center dan tidak menabrak kop gambar di kanan bawah (Y=660)
                    const maxDrawW = 650;
                    const maxDrawH = 415;
                    const s = Math.min(maxDrawW / totalCadW, maxDrawH / hmiH, 1.1) * manualScale;
                    const sw = hmiW * s;
                    const sh = hmiH * s;
                    const sd = hmiD * s;
                    const sgap = gap * s;
                    const totalDrawingW = sw + sgap + sd;

                    // Posisi Center Horizontal seimbang (pusat area aman = 505)
                    const hmiCenterX = 505;
                    const fx = Math.max(90, Math.round(hmiCenterX - totalDrawingW / 2));
                    const sx = fx + sw + sgap;

                    // Posisi Center Vertikal (antara baris revisi atas Y=80 s.d kop kanan bawah Y=660)
                    const hmiCenterY = 355;
                    const boxTopY = Math.round(hmiCenterY - sh / 2);
                    const fy = boxTopY + sh;
                    const sy = fy;

                    const frontCadToX = (cadX: number) => fx + cadX * s;
                    const frontCadToY = (cadY: number) => fy - cadY * s;

                    return (
                      <g id="hmi-sheet-dual-view">
                        {/* ================= TAMPAK DEPAN (FRONT VIEW) ================= */}
                        {/* 1. Kontur Box/Door Luar */}
                        <rect
                          x={fx}
                          y={fy - sh}
                          width={sw}
                          height={sh}
                          fill="#f8fafc"
                          stroke="#000000"
                          strokeWidth="2.0"
                        />

                        {/* 2. Bevel Door Seam */}
                        <rect
                          x={fx + 14 * s}
                          y={fy - sh + 14 * s}
                          width={sw - 28 * s}
                          height={sh - 28 * s}
                          fill="none"
                          stroke="#64748b"
                          strokeWidth="0.8"
                          strokeDasharray="4,2"
                        />

                        {/* 3. Cutout HMI */}
                        {features.cutouts.map((c, idx) => {
                          const cutX = frontCadToX(c.minX);
                          const cutY = frontCadToY(c.maxY);
                          const cutW = c.widthMm * s;
                          const cutH = c.heightMm * s;
                          return (
                            <g key={`hmi-cut-${idx}`}>
                              <rect
                                x={cutX}
                                y={cutY}
                                width={cutW}
                                height={cutH}
                                fill="#ffffff"
                                stroke="#000000"
                                strokeWidth="1.6"
                              />
                              <text
                                x={cutX + cutW / 2}
                                y={cutY + cutH / 2 + 3}
                                textAnchor="middle"
                                fontSize="9"
                                fill="#334155"
                                fontWeight="bold"
                              >
                                {c.label} ({c.widthMm}×{c.heightMm})
                              </text>
                            </g>
                          );
                        })}

                        {/* 4. Lubang Bor Tombol (Ø22 / Ø30 mm) & Garis Sumbu */}
                        {features.holes.map((h, idx) => {
                          const hX = frontCadToX(h.cx);
                          const hY = frontCadToY(h.cy);
                          const r = (h.diameter / 2) * s;
                          const arm = r + 5;
                          return (
                            <g key={`hmi-hole-${idx}`}>
                              <circle
                                cx={hX}
                                cy={hY}
                                r={r}
                                fill="none"
                                stroke="#000000"
                                strokeWidth="1.4"
                              />
                              <line x1={hX - arm} y1={hY} x2={hX + arm} y2={hY} stroke="#000000" strokeWidth="0.7" />
                              <line x1={hX} y1={hY - arm} x2={hX} y2={hY + arm} stroke="#000000" strokeWidth="0.7" />
                            </g>
                          );
                        })}

                        {/* 5. Leader Callout Lubang */}
                        {features.holes.length > 0 && features.holeLeaderText && (() => {
                          const target = features.holes.reduce((p, c) => (c.cx > p.cx ? c : p));
                          const tX = frontCadToX(target.cx) + (target.diameter / 2) * s * 0.7;
                          const tY = frontCadToY(target.cy) + (target.diameter / 2) * s * 0.7;
                          const elbX = tX + 16;
                          const elbY = tY + 18;
                          const endX = elbX + 70;
                          return (
                            <g id="hmi-hole-leader">
                              <line x1={tX} y1={tY} x2={elbX} y2={elbY} stroke="#000000" strokeWidth="1.2" />
                              <line x1={elbX} y1={elbY} x2={endX} y2={elbY} stroke="#000000" strokeWidth="1.2" />
                              <polygon points={`${tX},${tY} ${tX + 6},${tY + 1} ${tX + 1},${tY + 6}`} fill="#000" />
                              <text x={elbX + 3} y={elbY - 3} fontSize="9" fontWeight="bold" fill="#000">
                                {features.holeLeaderText.replace("%%c", "⌀")}
                              </text>
                            </g>
                          );
                        })()}

                        {/* 6. Dimensi Lebar Tampak Depan (Bawah) */}
                        <line x1={fx} y1={fy + 25} x2={fx + sw} y2={fy + 25} stroke="#000000" strokeWidth="1.0" />
                        <polygon points={`${fx},${fy + 25} ${fx + 7},${fy + 22} ${fx + 7},${fy + 28}`} fill="#000" />
                        <polygon points={`${fx + sw},${fy + 25} ${fx + sw - 7},${fy + 22} ${fx + sw - 7},${fy + 28}`} fill="#000" />
                        <line x1={fx} y1={fy} x2={fx} y2={fy + 32} stroke="#000" strokeWidth="0.6" />
                        <line x1={fx + sw} y1={fy} x2={fx + sw} y2={fy + 32} stroke="#000" strokeWidth="0.6" />
                        <text x={fx + sw / 2} y={fy + 20} textAnchor="middle" fontSize="11" fontWeight="bold">
                          {hmiW}
                        </text>

                        {/* 7. Dimensi Tinggi Tampak Depan (Kiri) */}
                        <line x1={fx - 25} y1={fy} x2={fx - 25} y2={fy - sh} stroke="#000000" strokeWidth="1.0" />
                        <polygon points={`${fx - 25},${fy} ${fx - 28},${fy - 7} ${fx - 22},${fy - 7}`} fill="#000" />
                        <polygon points={`${fx - 25},${fy - sh} ${fx - 28},${fy - sh + 7} ${fx - 22},${fy - sh + 7}`} fill="#000" />
                        <line x1={fx} y1={fy} x2={fx - 32} y2={fy} stroke="#000" strokeWidth="0.6" />
                        <line x1={fx} y1={fy - sh} x2={fx - 32} y2={fy - sh} stroke="#000" strokeWidth="0.6" />
                        <text x={fx - 32} y={fy - sh / 2 + 4} textAnchor="end" fontSize="11" fontWeight="bold">
                          {hmiH}
                        </text>

                        {/* Label Judul Tampak Depan */}
                        <text x={fx + sw / 2} y={fy + 48} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000">
                          TAMPAK DEPAN (FRONT VIEW)
                        </text>

                        {/* ================= TAMPAK SAMPING (SIDE VIEW) ================= */}
                        {/* 1. Box Samping Enclosure OP Panel */}
                        <rect
                          x={sx}
                          y={sy - sh}
                          width={sd}
                          height={sh}
                          fill="#f8fafc"
                          stroke="#000000"
                          strokeWidth="2.0"
                        />

                        {/* 2. Profil Daun Pintu Depan */}
                        <line x1={sx - 6 * s} y1={sy - sh} x2={sx - 6 * s} y2={sy} stroke="#000000" strokeWidth="1.4" />
                        <line x1={sx - 6 * s} y1={sy - sh} x2={sx} y2={sy - sh} stroke="#000000" strokeWidth="1.0" />
                        <line x1={sx - 6 * s} y1={sy} x2={sx} y2={sy} stroke="#000000" strokeWidth="1.0" />

                        {/* 3. Tonjolan Bezel HMI di Tampak Samping */}
                        {features.cutouts.length > 0 && (() => {
                          const c = features.cutouts[0];
                          const topY = frontCadToY(c.maxY);
                          const cH = c.heightMm * s;
                          const midY = topY + cH / 2;
                          return (
                            <g id="hmi-side-bezel">
                              <rect
                                x={sx - 10 * s}
                                y={topY}
                                width={6 * s}
                                height={cH}
                                rx={1}
                                fill="#0284c7"
                                stroke="#000000"
                                strokeWidth="1.0"
                              />
                              <line x1={sx - 10 * s} y1={midY} x2={sx - 32 * s} y2={midY} stroke="#0284c7" strokeWidth="0.8" />
                              <polygon points={`${sx - 10 * s},${midY} ${sx - 14 * s},${midY - 2} ${sx - 14 * s},${midY + 2}`} fill="#0284c7" />
                              <text x={sx - 36 * s} y={midY + 3} textAnchor="end" fontSize="8" fontWeight="bold" fill="#0284c7">
                                HMI BEZEL
                              </text>
                            </g>
                          );
                        })()}

                        {/* 4. Tonjolan Push Button & Emergency Stop di Tampak Samping */}
                        {features.holes.length > 0 && (() => {
                          const minHoleY = Math.min(...features.holes.map((h) => h.cy));
                          const maxHoleY = Math.max(...features.holes.map((h) => h.cy));
                          const topY = frontCadToY(maxHoleY + 11);
                          const pbH = (maxHoleY - minHoleY + 22) * s;
                          const midY = topY + pbH / 2;
                          return (
                            <g id="hmi-side-push-buttons">
                              <rect
                                x={sx - 14 * s}
                                y={topY}
                                width={10 * s}
                                height={pbH}
                                rx={2}
                                fill="#ef4444"
                                stroke="#000000"
                                strokeWidth="1.0"
                              />
                              <line x1={sx - 14 * s} y1={midY} x2={sx - 32 * s} y2={midY} stroke="#ef4444" strokeWidth="0.8" />
                              <polygon points={`${sx - 14 * s},${midY} ${sx - 18 * s},${midY - 2} ${sx - 18 * s},${midY + 2}`} fill="#ef4444" />
                              <text x={sx - 36 * s} y={midY + 3} textAnchor="end" fontSize="7.5" fontWeight="bold" fill="#ef4444">
                                OPERATOR PB
                              </text>
                            </g>
                          );
                        })()}

                        {/* 5. Dimensi Kedalaman / Tebal (Bawah Tampak Samping) */}
                        <line x1={sx} y1={sy + 25} x2={sx + sd} y2={sy + 25} stroke="#000000" strokeWidth="1.0" />
                        <polygon points={`${sx},${sy + 25} ${sx + 7},${sy + 22} ${sx + 7},${sy + 28}`} fill="#000" />
                        <polygon points={`${sx + sd},${sy + 25} ${sx + sd - 7},${sy + 22} ${sx + sd - 7},${sy + 28}`} fill="#000" />
                        <line x1={sx} y1={sy} x2={sx} y2={sy + 32} stroke="#000" strokeWidth="0.6" />
                        <line x1={sx + sd} y1={sy} x2={sx + sd} y2={sy + 32} stroke="#000" strokeWidth="0.6" />
                        <text x={sx + sd / 2} y={sy + 20} textAnchor="middle" fontSize="11" fontWeight="bold">
                          {hmiD}
                        </text>

                        {/* Label Judul Tampak Samping */}
                        <text x={sx + sd / 2} y={sy + 48} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000">
                          TAMPAK SAMPING (SIDE VIEW)
                        </text>
                      </g>
                    );
                  })()
                ) : (
                  <>
                    {/* 1. KONTUR PLAT LUAR (Garis putus-putus tebal seperti di PDF) */}
                    <rect
                      x={cadToSheetX(0)}
                      y={cadToSheetY(plateHeight)}
                      width={scaledPlateW}
                      height={scaledPlateH}
                      fill="none"
                      stroke="#000000"
                      strokeWidth="1.8"
                      strokeDasharray="5,2"
                    />

                    {/* 2. LUBANG CUTOUT HMI */}
                    {features.cutouts.map((c, idx) => {
                      const cutX = cadToSheetX(c.minX);
                      const cutY = cadToSheetY(c.maxY);
                      const cutW = c.widthMm * scale;
                      const cutH = c.heightMm * scale;
                      return (
                        <g key={`cut-${idx}`}>
                          <rect
                            x={cutX}
                            y={cutY}
                            width={cutW}
                            height={cutH}
                            fill="none"
                            stroke="#000000"
                            strokeWidth="1.6"
                          />
                          <text
                            x={cutX + cutW / 2}
                            y={cutY + cutH / 2 + 3}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#555555"
                            fontWeight="bold"
                          >
                            {c.label} ({c.widthMm}×{c.heightMm})
                          </text>
                        </g>
                      );
                    })}

                    {/* 3. LUBANG BOR TOMBOL (DRILL HOLES Ø22mm) & GARIS SUMBU */}
                    {features.holes.map((h, idx) => {
                      const hX = cadToSheetX(h.cx);
                      const hY = cadToSheetY(h.cy);
                      const r = (h.diameter / 2) * scale;
                      const arm = r + 6;

                      return (
                        <g key={`hole-${idx}`}>
                          <circle
                            cx={hX}
                            cy={hY}
                            r={r}
                            fill="none"
                            stroke="#000000"
                            strokeWidth="1.4"
                          />
                          <line x1={hX - arm} y1={hY} x2={hX + arm} y2={hY} stroke="#000000" strokeWidth="0.7" />
                          <line x1={hX} y1={hY - arm} x2={hX} y2={hY + arm} stroke="#000000" strokeWidth="0.7" />
                        </g>
                      );
                    })}

                    {/* 4. LEADER CALLOUT */}
                    {features.holes.length > 0 && features.holeLeaderText && (() => {
                      const target = features.holes.reduce((p, c) => (c.cx > p.cx ? c : p));
                      const tX = cadToSheetX(target.cx) + (target.diameter / 2) * scale * 0.7;
                      const tY = cadToSheetY(target.cy) - (target.diameter / 2) * scale * 0.7;
                      const elbX = tX + 45;
                      const elbY = tY - 35;
                      const endX = elbX + 85;

                      return (
                        <g id="hole-leader-annotation">
                          <line x1={tX} y1={tY} x2={elbX} y2={elbY} stroke="#000000" strokeWidth="1.2" />
                          <line x1={elbX} y1={elbY} x2={endX} y2={elbY} stroke="#000000" strokeWidth="1.2" />
                          <polygon
                            points={`${tX},${tY} ${tX + 8},${tY - 2} ${tX + 5},${tY - 6}`}
                            fill="#000"
                          />
                          <text
                            x={elbX + 4}
                            y={elbY - 4}
                            fontSize="11"
                            fontWeight="bold"
                            fill="#000"
                          >
                            {features.holeLeaderText.replace("%%c", "⌀")}
                          </text>
                        </g>
                      );
                    })()}

                    {/* 5. DIN RAILS & DUCTS */}
                    {features.rails.map((r, idx) => {
                      const rx = cadToSheetX(r.minX);
                      const ry = cadToSheetY(r.maxY);
                      const rw = r.widthMm * scale;
                      const rh = r.heightMm * scale;
                      return (
                        <g key={`rail-${idx}`}>
                          <rect x={rx} y={ry} width={rw} height={rh} fill="none" stroke="#2563eb" strokeWidth="1.2" />
                          <line x1={rx} y1={ry + rh / 2} x2={rx + rw} y2={ry + rh / 2} stroke="#ef4444" strokeWidth="0.8" strokeDasharray="6,3" />
                          <text x={rx + rw / 2} y={ry + rh / 2 + 3} textAnchor="middle" fontSize="8" fill="#2563eb" fontWeight="bold">
                            {r.label}
                          </text>
                        </g>
                      );
                    })}

                    {features.ducts.map((d, idx) => {
                      const dx = cadToSheetX(d.minX);
                      const dy = cadToSheetY(d.maxY);
                      const dw = d.widthMm * scale;
                      const dh = d.heightMm * scale;
                      return (
                        <g key={`duct-${idx}`}>
                          <rect x={dx} y={dy} width={dw} height={dh} fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="3,3" />
                          <text x={dx + dw / 2} y={dy + dh / 2 + 3} textAnchor="middle" fontSize="7.5" fill="#64748b">
                            {d.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* 6. DIMENSI ORDINAT / BASELINE SUMBU X (ATAS) */}
                    <g id="dimension-x-top">
                      <line
                        x1={cadToSheetX(0)}
                        y1={cadToSheetY(plateHeight) - 25}
                        x2={cadToSheetX(plateWidth)}
                        y2={cadToSheetY(plateHeight) - 25}
                        stroke="#000000"
                        strokeWidth="1.0"
                      />
                      <polygon
                        points={`${cadToSheetX(0)},${cadToSheetY(plateHeight) - 25} ${cadToSheetX(0) + 7},${cadToSheetY(plateHeight) - 28} ${cadToSheetX(0) + 7},${cadToSheetY(plateHeight) - 22}`}
                        fill="#000"
                      />
                      <polygon
                        points={`${cadToSheetX(plateWidth)},${cadToSheetY(plateHeight) - 25} ${cadToSheetX(plateWidth) - 7},${cadToSheetY(plateHeight) - 28} ${cadToSheetX(plateWidth) - 7},${cadToSheetY(plateHeight) - 22}`}
                        fill="#000"
                      />

                      {features.xDimensions.map((xVal, idx) => {
                        const lineX = cadToSheetX(xVal);
                        const topDimY = cadToSheetY(plateHeight) - 25;
                        return (
                          <g key={`x-dim-${idx}`}>
                            <line
                              x1={lineX}
                              y1={cadToSheetY(plateHeight)}
                              x2={lineX}
                              y2={topDimY - 6}
                              stroke="#000000"
                              strokeWidth="0.7"
                            />
                            <text
                              x={lineX - 3}
                              y={topDimY - 12}
                              fontSize="9.5"
                              fontWeight="bold"
                              transform={`rotate(-90, ${lineX - 3}, ${topDimY - 12})`}
                              fill="#000000"
                            >
                              {Number.isInteger(xVal) ? xVal : xVal.toFixed(1).replace(".", ",")}
                            </text>
                          </g>
                        );
                      })}
                    </g>

                    {/* 7. DIMENSI ORDINAT / BASELINE SUMBU Y (KIRI) */}
                    <g id="dimension-y-left">
                      <line
                        x1={cadToSheetX(0) - 25}
                        y1={cadToSheetY(0)}
                        x2={cadToSheetX(0) - 25}
                        y2={cadToSheetY(plateHeight)}
                        stroke="#000000"
                        strokeWidth="1.0"
                      />
                      <polygon
                        points={`${cadToSheetX(0) - 25},${cadToSheetY(0)} ${cadToSheetX(0) - 28},${cadToSheetY(0) - 7} ${cadToSheetX(0) - 22},${cadToSheetY(0) - 7}`}
                        fill="#000"
                      />
                      <polygon
                        points={`${cadToSheetX(0) - 25},${cadToSheetY(plateHeight)} ${cadToSheetX(0) - 28},${cadToSheetY(plateHeight) + 7} ${cadToSheetX(0) - 22},${cadToSheetY(plateHeight) + 7}`}
                        fill="#000"
                      />

                      {features.yDimensions.map((yVal, idx) => {
                        const lineY = cadToSheetY(yVal);
                        const leftDimX = cadToSheetX(0) - 25;
                        return (
                          <g key={`y-dim-${idx}`}>
                            <line
                              x1={cadToSheetX(0)}
                              y1={lineY}
                              x2={leftDimX - 6}
                              y2={lineY}
                              stroke="#000000"
                              strokeWidth="0.7"
                            />
                            <text
                              x={leftDimX - 10}
                              y={lineY + 3.5}
                              textAnchor="end"
                              fontSize="9.5"
                              fontWeight="bold"
                              fill="#000000"
                            >
                              {Number.isInteger(yVal) ? yVal : yVal.toFixed(1).replace(".", ",")}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  </>
                )}
              </g>

              {/* Teks Lokasi File CAD di Kiri Bawah (Standard Drawing Header) */}
              <text x="35" y={sheetH - 35} fontSize="6.5" fill="#555">
                {`D:\\PROJECT\\000-PO\\${new Date().getFullYear()}\\${metadata.kode}\\${metadata.partName}.DWG`}
              </text>
            </svg>
          </div>
        </div>

        {/* Footer info modal */}
        <div className="px-5 py-3 bg-slate-800/80 border-t border-slate-700/80 flex flex-wrap items-center justify-between text-xs text-slate-400 print:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Format DXF kompatibel 100% dengan AutoCAD Electrical, SolidWorks Sheet Metal, dan Software Mesin Laser Cutting (CypCut / Trumpf).
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span>Ukuran Plat: {plateWidth} × {plateHeight} mm</span>
            <span>•</span>
            <span>Lubang: {features.holes.length} item</span>
            <span>•</span>
            <span>Cutout: {features.cutouts.length} item</span>
          </div>
        </div>
      </div>
    </div>
  );
}
