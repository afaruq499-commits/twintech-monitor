"use client";

import { useMemo, useRef } from "react";
import { Download, Printer, X, FileCode2 } from "lucide-react";
import {
  extractPanelFeatures,
  generatePanelLayoutDxf,
  downloadDxfFile,
  type DxfProjectMetadata,
} from "@/lib/export/panel-dxf-generator";
import type { PanelLayoutItem } from "@/lib/panel-layout-template";

interface PanelDrawingSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "HMI" | "MAIN" | "OP_MOUNTING";
  plateWidth: number;
  plateHeight: number;
  items: PanelLayoutItem[];
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
  items,
  project,
}: PanelDrawingSheetModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

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
      pic: project.pic || "DEDI",
      drawnBy: project.pic || "DEDI",
      checkedBy: "IVAN",
      approvedBy: "IVAN",
      partName:
        mode === "HMI"
          ? "DUMMY OP PANEL"
          : mode === "OP_MOUNTING"
            ? "OP MOUNTING PLATE"
            : "PANEL MOUNTING PLATE",
      material: "SPCC t=2.0mm",
      dateStr,
    };
  }, [project, mode]);

  const features = useMemo(
    () => extractPanelFeatures(plateWidth, plateHeight, items, mode),
    [plateWidth, plateHeight, items, mode]
  );

  const dxfContent = useMemo(
    () => generatePanelLayoutDxf(features, metadata, mode),
    [features, metadata, mode]
  );

  if (!isOpen) return null;

  const handleDownloadDxf = () => {
    const cleanKode = (project.kode || "PANEL").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${cleanKode}_${mode === "HMI" ? "OP_PANEL" : "MAIN_PANEL"}_CAD.dxf`;
    downloadDxfFile(filename, dxfContent);
  };

  const handlePrint = () => {
    window.print();
  };

  // Dimensi sheet SVG (A4 / A3 Landscape Aspect 1.414)
  const sheetW = 1188;
  const sheetH = 840;

  // Area gambar mekanik (antara margin kiri dan tabel kop kanan)
  const drawAreaX = 100;
  const drawAreaY = 80;
  const drawAreaW = 680;
  const drawAreaH = 680;

  // Margin plat di dalam area gambar (memberikan ruang untuk garis dimensi atas & kiri)
  const dimMarginLeft = 70;
  const dimMarginTop = 60;
  const usableW = drawAreaW - dimMarginLeft - 20;
  const usableH = drawAreaH - dimMarginTop - 20;

  // Skala visual agar plat fit di dalam area gambar
  const scale = Math.min(usableW / plateWidth, usableH / plateHeight, 1.6);
  const scaledPlateW = plateWidth * scale;
  const scaledPlateH = plateHeight * scale;

  // Posisi pojok kiri-bawah plat di sheet SVG
  const plateOriginX = drawAreaX + dimMarginLeft;
  // Di SVG, Y bertambah ke bawah: titik datum bawah plat berada di:
  const plateBottomY = drawAreaY + dimMarginTop + scaledPlateH;

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
                  {mode === "HMI" ? "OP Panel / HMI Door" : "Mounting Plate"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gambar teknik standar Twintech Precision — ukuran plat {plateWidth}×{plateHeight} mm dengan lubang bor &amp; cutout presisi 1:1.
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

        {/* Lembar Gambar Teknik (Bisa di-print langsung) */}
        <div
          ref={printAreaRef}
          className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-950 flex items-center justify-center print:p-0 print:bg-white"
        >
          <div className="bg-white text-black shadow-2xl rounded-sm p-2 w-full max-w-[1050px] aspect-[1188/840] border border-slate-300 print:shadow-none print:border-none print:p-0 print:w-full print:max-w-none">
            <svg
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

              {/* ================= KOP GAMBAR (TITLE BLOCK) KANAN BAWAH ================= */}
              <g transform={`translate(${sheetW - 470}, ${sheetH - 180})`}>
                <rect x="0" y="0" width="440" height="150" fill="none" stroke="#000" strokeWidth="1.5" />

                {/* Garis Pembagi Horizontal */}
                <line x1="0" y1="30" x2="440" y2="30" stroke="#000" strokeWidth="0.8" />
                <line x1="0" y1="65" x2="440" y2="65" stroke="#000" strokeWidth="0.8" />
                <line x1="0" y1="95" x2="440" y2="95" stroke="#000" strokeWidth="0.8" />

                {/* Baris 1: Part No & Part Name */}
                <line x1="220" y1="0" x2="220" y2="30" stroke="#000" strokeWidth="0.8" />
                <text x="10" y="12" fontSize="6.5" fill="#666">Part No.</text>
                <text x="10" y="24" fontSize="8" fontWeight="bold">-</text>

                <text x="230" y="12" fontSize="6.5" fill="#666">Part Name</text>
                <text x="230" y="24" fontSize="9" fontWeight="bold">
                  {metadata.partName}
                </text>

                {/* Baris 2: Drawn, Checked, Approved, Material, Description */}
                <line x1="60" y1="30" x2="60" y2="65" stroke="#000" strokeWidth="0.8" />
                <line x1="120" y1="30" x2="120" y2="65" stroke="#000" strokeWidth="0.8" />
                <line x1="180" y1="30" x2="180" y2="65" stroke="#000" strokeWidth="0.8" />
                <line x1="280" y1="30" x2="280" y2="65" stroke="#000" strokeWidth="0.8" />
                <line x1="380" y1="30" x2="380" y2="65" stroke="#000" strokeWidth="0.8" />

                <text x="30" y="42" textAnchor="middle" fontSize="6.5" fill="#666">Drawn</text>
                <text x="30" y="58" textAnchor="middle" fontSize="8.5" fontWeight="bold">{metadata.drawnBy}</text>

                <text x="90" y="42" textAnchor="middle" fontSize="6.5" fill="#666">Checked</text>
                <text x="90" y="58" textAnchor="middle" fontSize="8.5" fontWeight="bold">{metadata.checkedBy}</text>

                <text x="150" y="42" textAnchor="middle" fontSize="6.5" fill="#666">Approved</text>
                <text x="150" y="58" textAnchor="middle" fontSize="8.5" fontWeight="bold">{metadata.approvedBy}</text>

                <text x="230" y="42" textAnchor="middle" fontSize="6.5" fill="#666">Material</text>
                <text x="230" y="58" textAnchor="middle" fontSize="7.5" fontWeight="bold">{metadata.material}</text>

                <text x="330" y="42" textAnchor="middle" fontSize="6.5" fill="#666">Date</text>
                <text x="330" y="58" textAnchor="middle" fontSize="7.5" fontWeight="bold">{metadata.dateStr}</text>

                <text x="410" y="42" textAnchor="middle" fontSize="6.5" fill="#666">Scale</text>
                <text x="410" y="58" textAnchor="middle" fontSize="8" fontWeight="bold">NTS (mm)</text>

                {/* Baris 3: Logo & Nama Perusahaan Twintech Precision */}
                <line x1="220" y1="65" x2="220" y2="150" stroke="#000" strokeWidth="0.8" />

                <g transform="translate(10, 75)">
                  <text x="95" y="16" textAnchor="middle" fontSize="13" fontWeight="900" letterSpacing="0.8">
                    Twintech II Precision
                  </text>
                  <text x="95" y="28" textAnchor="middle" fontSize="6.5" fill="#333">
                    pcb dies, precision part, jig and checking fixture
                  </text>
                  <text x="95" y="55" textAnchor="middle" fontSize="7" fill="#666">
                    {metadata.client}
                  </text>
                </g>

                {/* Kolom Kanan: Project Name & Job Order */}
                <g transform="translate(230, 75)">
                  <text x="0" y="10" fontSize="6.5" fill="#666">Project Name :</text>
                  <text x="0" y="24" fontSize="8" fontWeight="bold">
                    {metadata.nama.length > 36 ? metadata.nama.substring(0, 34) + ".." : metadata.nama}
                  </text>

                  <line x1="-10" y1="36" x2="210" y2="36" stroke="#000" strokeWidth="0.6" />

                  <text x="0" y="48" fontSize="6.5" fill="#666">Job Order / Code :</text>
                  <text x="0" y="62" fontSize="9.5" fontWeight="900">
                    {metadata.kode}
                  </text>

                  <text x="130" y="48" fontSize="6.5" fill="#666">Sheet / Qty :</text>
                  <text x="130" y="62" fontSize="9" fontWeight="bold">
                    A4 / 1 PCS
                  </text>
                </g>
              </g>

              {/* ================= AREA GAMBAR MEKANIK TEKNIK ================= */}
              <g id="mechanical-cad-drawing">
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
                      {/* Lingkaran Lubang */}
                      <circle
                        cx={hX}
                        cy={hY}
                        r={r}
                        fill="none"
                        stroke="#000000"
                        strokeWidth="1.4"
                      />
                      {/* Garis Sumbu Crosshair (+) */}
                      <line x1={hX - arm} y1={hY} x2={hX + arm} y2={hY} stroke="#000000" strokeWidth="0.7" />
                      <line x1={hX} y1={hY - arm} x2={hX} y2={hY + arm} stroke="#000000" strokeWidth="0.7" />
                    </g>
                  );
                })}

                {/* 4. LEADER CALLOUT (seperti di PDF: "10X ⌀ 22 THRU") */}
                {features.holes.length > 0 && features.holeLeaderText && (() => {
                  // Lubang target paling kanan
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
                      {/* Panah di titik lubang */}
                      <polygon
                        points={`${tX},${tY} ${tX + 8},${tY - 2} ${tX + 5},${tY - 6}`}
                        fill="#000"
                      />
                      {/* Teks Callout */}
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

                {/* 5. DIN RAILS & DUCTS (UNTUK PANEL UTAMA) */}
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
                  const baselineY = cadToSheetY(plateHeight) - 30;
                  <line
                    x1={cadToSheetX(0)}
                    y1={cadToSheetY(plateHeight) - 25}
                    x2={cadToSheetX(plateWidth)}
                    y2={cadToSheetY(plateHeight) - 25}
                    stroke="#000000"
                    strokeWidth="1.0"
                  />
                  {/* Datum 0 Panah Kiri */}
                  <polygon
                    points={`${cadToSheetX(0)},${cadToSheetY(plateHeight) - 25} ${cadToSheetX(0) + 7},${cadToSheetY(plateHeight) - 28} ${cadToSheetX(0) + 7},${cadToSheetY(plateHeight) - 22}`}
                    fill="#000"
                  />
                  {/* Panah Kanan Lebar Plat */}
                  <polygon
                    points={`${cadToSheetX(plateWidth)},${cadToSheetY(plateHeight) - 25} ${cadToSheetX(plateWidth) - 7},${cadToSheetY(plateHeight) - 28} ${cadToSheetX(plateWidth) - 7},${cadToSheetY(plateHeight) - 22}`}
                    fill="#000"
                  />

                  {features.xDimensions.map((xVal, idx) => {
                    const lineX = cadToSheetX(xVal);
                    const topDimY = cadToSheetY(plateHeight) - 25;
                    return (
                      <g key={`x-dim-${idx}`}>
                        {/* Garis proyeksi ke atas */}
                        <line
                          x1={lineX}
                          y1={cadToSheetY(plateHeight)}
                          x2={lineX}
                          y2={topDimY - 6}
                          stroke="#000000"
                          strokeWidth="0.7"
                        />
                        {/* Angka dimensi miring/vertikal 90° seperti di PDF */}
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
                  const baselineX = cadToSheetX(0) - 30;
                  <line
                    x1={cadToSheetX(0) - 25}
                    y1={cadToSheetY(0)}
                    x2={cadToSheetX(0) - 25}
                    y2={cadToSheetY(plateHeight)}
                    stroke="#000000"
                    strokeWidth="1.0"
                  />
                  {/* Datum 0 Panah Bawah */}
                  <polygon
                    points={`${cadToSheetX(0) - 25},${cadToSheetY(0)} ${cadToSheetX(0) - 28},${cadToSheetY(0) - 7} ${cadToSheetX(0) - 22},${cadToSheetY(0) - 7}`}
                    fill="#000"
                  />
                  {/* Panah Atas Tinggi Plat */}
                  <polygon
                    points={`${cadToSheetX(0) - 25},${cadToSheetY(plateHeight)} ${cadToSheetX(0) - 28},${cadToSheetY(plateHeight) + 7} ${cadToSheetX(0) - 22},${cadToSheetY(plateHeight) + 7}`}
                    fill="#000"
                  />

                  {features.yDimensions.map((yVal, idx) => {
                    const lineY = cadToSheetY(yVal);
                    const leftDimX = cadToSheetX(0) - 25;
                    return (
                      <g key={`y-dim-${idx}`}>
                        {/* Garis proyeksi ke kiri */}
                        <line
                          x1={cadToSheetX(0)}
                          y1={lineY}
                          x2={leftDimX - 6}
                          y2={lineY}
                          stroke="#000000"
                          strokeWidth="0.7"
                        />
                        {/* Angka dimensi horizontal di kiri */}
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
