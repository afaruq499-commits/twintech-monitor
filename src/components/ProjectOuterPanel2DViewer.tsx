"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  FileCode2,
  Printer,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Fan,
  Lock,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  resolveFanCutoutPosition,
  type OuterPanelLayoutData,
  type PanelComponentInput,
} from "@/lib/panel-layout-template";
import {
  generateOuterPanelDxf,
  downloadDxfFile,
  type DxfProjectMetadata,
} from "@/lib/export/panel-dxf-generator";

export interface ProjectOuterPanel2DViewerProps {
  outerPanel: OuterPanelLayoutData;
  onChange: (next: OuterPanelLayoutData) => void;
  components: PanelComponentInput[];
  mainWidthMm?: number;
  mainHeightMm?: number;
  projectKode?: string | null;
  projectNama?: string | null;
  projectClient?: string | null;
  projectPic?: string | null;
  onRequestPdf?: () => void;
}

export function ProjectOuterPanel2DViewer({
  outerPanel,
  onChange,
  components,
  mainWidthMm = 600,
  mainHeightMm = 800,
  projectKode,
  projectNama,
  projectClient,
  projectPic,
  onRequestPdf,
}: ProjectOuterPanel2DViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom and Pan
  const [zoom, setZoom] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Deteksi otomatis fitur PR untuk informasi pengguna
  const prFeatures = useMemo(() => {
    const active = (components || []).filter((c) => c.statusImport !== "HILANG_DI_REVISI");
    const lotoRegex =
      /loto|lockout|lock\s*out|main\s*switch|rotary\s*switch|saklar\s*utama|disconnect\s*switch/i;
    const lotoComp = active.find(
      (c) => lotoRegex.test(c.partType) || lotoRegex.test(c.partName)
    );

    const fanRegex = /fan|kipas|blower|exhaust|xf1232/i;
    const fanComp = active.find(
      (c) =>
        c.kelompok?.toUpperCase() === "FAN" ||
        fanRegex.test(c.partType) ||
        fanRegex.test(c.partName)
    );

    let fanSizeMm = 120;
    if (fanComp) {
      const text = `${fanComp.partType} ${fanComp.partName}`.toUpperCase();
      const mmMatch = text.match(/(\d{2,3})\s*[x×]\s*(\d{2,3})/);
      const cmMatch = text.match(/(\d{1,2})\s*CM/);
      if (mmMatch) fanSizeMm = parseInt(mmMatch[1], 10);
      else if (cmMatch) fanSizeMm = parseInt(cmMatch[1], 10) * 10;
      else if (text.includes("XF1232") || text.includes("12CM")) fanSizeMm = 120;
      else if (text.includes("15CM") || text.includes("150")) fanSizeMm = 150;
      else if (text.includes("20CM") || text.includes("200")) fanSizeMm = 200;
    }

    return {
      hasPrLoto: Boolean(lotoComp),
      lotoCompName: lotoComp ? `${lotoComp.partType || lotoComp.partName}` : null,
      hasPrFan: Boolean(fanComp),
      fanCompName: fanComp ? `${fanComp.partType || fanComp.partName}` : null,
      fanSizeMm,
    };
  }, [components]);

  const enclosure = outerPanel.enclosure;
  const features = outerPanel.features;

  const widthMm = enclosure.widthMm || 700;
  const heightMm = enclosure.heightMm || 600;
  const depthMm = enclosure.depthMm || 265;

  // Ukuran kanvas SVG virtual
  // Tampak Depan (W x H) + Spasi + Tampak Samping (D x H) + Margin dimensi & judul
  const gap = 160;
  const marginX = 140;
  const marginY = 130;
  const totalSvgWidth = marginX + widthMm + gap + depthMm + marginX;
  const totalSvgHeight = marginY + heightMm + marginY + 40;

  // Koordinat Tampak Depan (Origin Top-Left Box)
  const frontX = marginX;
  const frontY = marginY;

  // Koordinat Tampak Samping (Origin Top-Left Box)
  const sideX = frontX + widthMm + gap;
  const sideY = marginY;

  // Posisi Lock Door (Handle Kunci)
  // Geser otomatis: Saat LOTO Switch OFF, Lock Door center vertikal ke tengah (heightMm / 2).
  // Saat LOTO Switch ON, Lock Door bergeser ke bawah (heightMm * 0.58) agar ergonomis & memberi ruang LOTO di kiri atas.
  const lockDoorX = frontX + (features.lockDoorX ?? 55);
  const effectiveLockDoorY = features.hasLoto
    ? (features.lockDoorY ?? Math.round(heightMm * 0.58))
    : Math.round(heightMm * 0.5);
  const lockDoorY = frontY + effectiveLockDoorY;

  // Posisi LOTO Switch
  const lotoX = frontX + (features.lotoX ?? 110);
  const lotoY = frontY + (features.lotoY ?? 110);

  // Posisi Lubang Fan Samping (Ø115 + 4× Ø5 pitch 105×105 mm)
  const fanSizeMm = features.fanSizeMm || prFeatures.fanSizeMm || 120;
  const fanPos = resolveFanCutoutPosition(
    depthMm,
    heightMm,
    fanSizeMm,
    features.fanY
  );
  const fanCx = sideX + fanPos.cxFromEdgeMm;
  const fanCy = sideY + fanPos.cyFromTopMm;

  // Penyesuaian Dimensi
  const updateEnclosure = (patch: Partial<typeof enclosure>) => {
    onChange({
      ...outerPanel,
      enclosure: {
        ...enclosure,
        ...patch,
      },
    });
  };

  const updateFeatures = (patch: Partial<typeof features>) => {
    onChange({
      ...outerPanel,
      features: {
        ...features,
        ...patch,
      },
    });
  };

  // Preset Ukuran Cepat
  const applyPreset = (w: number, h: number, d: number) => {
    onChange({
      ...outerPanel,
      enclosure: {
        ...enclosure,
        widthMm: w,
        heightMm: h,
        depthMm: d,
        name: `Box Enclosure (${w} × ${h} × ${d} mm)`,
      },
      features: {
        ...features,
        lockDoorY: Math.round(h * 0.55),
      },
    });
  };

  const syncFromPlate = () => {
    const w = Math.max(700, mainWidthMm + 100);
    const h = Math.max(600, mainHeightMm + 100);
    const d = 265;
    applyPreset(w, h, d);
  };

  // Pas Layar
  const handleFitToScreen = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth - 40;
    const ch = containerRef.current.clientHeight - 40;
    if (cw <= 0 || ch <= 0) return;
    const scale = Math.min(cw / totalSvgWidth, ch / totalSvgHeight, 1.2);
    setZoom(Math.max(0.3, Math.min(scale, 1.5)));
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    handleFitToScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthMm, heightMm, depthMm]);

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((z) => Math.max(0.2, Math.min(2.5, z + delta)));
  };

  // Unduh DXF AutoCAD
  const handleExportDxf = () => {
    try {
      const cleanKode = (projectKode || "PANEL").replace(/[^a-zA-Z0-9_-]/g, "_");
      const metadata: DxfProjectMetadata = {
        kode: projectKode || "TWINTECH-PANEL",
        nama: projectNama || "PANEL ENCLOSURE 2D",
        client: projectClient,
        pic: projectPic?.trim() || "-",
        drawnBy: projectPic?.trim() || "-",
        checkedBy: "IVAN",
        approvedBy: "IVAN",
        partName: "BOX ENCLOSURE 2D",
        material: "SPCC t=1.5mm / Powder Coating RAL 7035",
        dateStr: new Date().toLocaleDateString("id-ID"),
      };
      const dxfContent = generateOuterPanelDxf(outerPanel, metadata);
      const filename = `${cleanKode}_BOX_LUAR_CAD.dxf`;
      downloadDxfFile(filename, dxfContent);
    } catch (err) {
      console.error("Gagal export DXF:", err);
      alert("Gagal mengunduh file DXF.");
    }
  };

  // Unduh PNG
  const handleExportPng = () => {
    if (!svgRef.current) return;
    try {
      const svgEl = svgRef.current;
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgEl);

      if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 2; // High Resolution
        canvas.width = totalSvgWidth * scale;
        canvas.height = totalSvgHeight * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `Layout_Panel_Luar_Box_${widthMm}x${heightMm}x${depthMm}mm.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
    } catch (err) {
      console.error("Gagal export PNG:", err);
      alert("Gagal mengunduh gambar layout panel luar.");
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full bg-slate-50 rounded-2xl p-3 border border-slate-200">
      {/* TOOLBAR ATAS: UKURAN ENCLOSURE & PRESET */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        {/* Input Dimensi W x H x D */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Ukuran Box Luar:</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-semibold">Lebar (W):</span>
            <input
              type="number"
              min={300}
              max={2400}
              step={10}
              value={widthMm}
              onChange={(e) => updateEnclosure({ widthMm: parseInt(e.target.value, 10) || 700 })}
              className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-slate-800 focus:outline-blue-500"
            />
            <span className="text-slate-400">×</span>
            <span className="text-slate-500 font-semibold">Tinggi (H):</span>
            <input
              type="number"
              min={300}
              max={2400}
              step={10}
              value={heightMm}
              onChange={(e) => updateEnclosure({ heightMm: parseInt(e.target.value, 10) || 600 })}
              className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-slate-800 focus:outline-blue-500"
            />
            <span className="text-slate-400">×</span>
            <span className="text-slate-500 font-semibold">Tebal (D):</span>
            <input
              type="number"
              min={100}
              max={800}
              step={5}
              value={depthMm}
              onChange={(e) => updateEnclosure({ depthMm: parseInt(e.target.value, 10) || 265 })}
              className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-slate-800 focus:outline-blue-500"
            />
            <span className="text-slate-500 font-medium">mm</span>
          </div>

          {/* Preset Ukuran Standar */}
          <div className="hidden sm:flex items-center gap-1 text-[11px]">
            <span className="text-slate-400 font-medium mr-1">Preset:</span>
            {[
              { label: "700×600×265 (Standar)", w: 700, h: 600, d: 265 },
              { label: "600×800×250", w: 600, h: 800, d: 250 },
              { label: "700×900×265", w: 700, h: 900, d: 265 },
              { label: "800×1000×300", w: 800, h: 1000, d: 300 },
              { label: "500×600×200", w: 500, h: 600, d: 200 },
            ].map((p) => {
              const isActive = widthMm === p.w && heightMm === p.h && depthMm === p.d;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.w, p.h, p.d)}
                  className={`px-2 py-1 rounded-md font-bold transition cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={syncFromPlate}
              className="ml-1 inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md font-bold text-slate-600 transition cursor-pointer"
              title="Sinkronkan ukuran enclosure luar dari ukuran plat dasar dalam (+100mm margin)"
            >
              <RefreshCw className="w-3 h-3 text-blue-500" />
              <span>Sync Plat Dalam</span>
            </button>
          </div>
        </div>

        {/* Action Buttons: DXF, PNG, Zoom */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportDxf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            title="Download gambar kerja 2D AutoCAD (.DXF) skala 1:1"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Export DXF</span>
          </button>
          {onRequestPdf && (
            <button
              type="button"
              onClick={onRequestPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              title="Buka lembar gambar kerja teknik resmi Twintech Precision (Kop gambar, toleransi & dimensi) untuk dicetak / PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Gambar Kerja (PDF)</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportPng}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold shadow-xs transition cursor-pointer"
            title="Unduh gambar PNG 2D Tampak Depan & Samping"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Unduh PNG</span>
          </button>
          <div className="h-4 w-px bg-slate-300 mx-1" />
          <button
            type="button"
            onClick={handleFitToScreen}
            className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
            title="Pas Layar"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
            className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-bold text-slate-600 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
            className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
            title="Reset Zoom 100%"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* STATUS & KONTROL FITUR PR: LOCK DOOR, LOTO, & FAN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200">
        {/* 1. LOCK DOOR (Selalu Aktif) */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-100 text-blue-700">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>Lock Door (Handle Kunci)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-blue-100 text-blue-700 font-extrabold">
                  STANDAR
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Pintu kiri panel • Handle cam lock & keyhole
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Aktif
          </span>
        </div>

        {/* 2. LOTO SWITCH (Deteksi Otomatis dari PR + Toggle Manual) */}
        <div
          className={`flex items-center justify-between p-2 rounded-lg border transition ${
            features.hasLoto
              ? "bg-amber-50/70 border-amber-300"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-md ${
                features.hasLoto
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>LOTO Switch (Kiri Atas)</span>
                {prFeatures.hasPrLoto ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-extrabold">
                    Ada di PR
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-200 text-slate-600 font-medium">
                    Tidak di PR
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 truncate max-w-[170px]">
                {features.hasLoto
                  ? features.lotoLabel || prFeatures.lotoCompName || "Rotary Main Switch"
                  : "Saklar putar pengaman LOTO"}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={features.hasLoto}
              onChange={(e) => {
                const nextHasLoto = e.target.checked;
                updateFeatures({
                  hasLoto: nextHasLoto,
                  lockDoorY: nextHasLoto
                    ? Math.round(heightMm * 0.58)
                    : Math.round(heightMm * 0.5),
                });
              }}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-amber-500" />
          </label>
        </div>

        {/* 3. COOLING FAN LOUVRE (Deteksi Otomatis dari PR + Ukuran + Toggle) */}
        <div
          className={`flex items-center justify-between p-2 rounded-lg border transition ${
            features.hasFan
              ? "bg-cyan-50/70 border-cyan-300"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-md ${
                features.hasFan
                  ? "bg-cyan-600 text-white shadow-xs"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              <Fan className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>Cooling Fan (Samping)</span>
                {prFeatures.hasPrFan ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-extrabold">
                    Ada di PR ({prFeatures.fanSizeMm}mm)
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-200 text-slate-600 font-medium">
                    Tidak di PR
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-slate-500">Ukuran:</span>
                <select
                  value={fanSizeMm}
                  disabled={!features.hasFan}
                  onChange={(e) =>
                    updateFeatures({
                      fanSizeMm: parseInt(e.target.value, 10),
                      fanLabel: `FAN FILTER ${e.target.value}×${e.target.value} mm`,
                    })
                  }
                  className="text-[10px] bg-white border border-slate-300 rounded px-1 py-0.5 font-bold text-slate-700 disabled:opacity-50"
                >
                  <option value={120}>120 × 120 mm</option>
                  <option value={150}>150 × 150 mm</option>
                  <option value={200}>200 × 200 mm</option>
                  <option value={250}>250 × 250 mm</option>
                </select>
              </div>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={features.hasFan}
              onChange={(e) => updateFeatures({ hasFan: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-cyan-600" />
          </label>
        </div>
      </div>

      {/* KANVAS GAMBAR 2D (INTERAKTIF SVG) */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="relative w-full h-[620px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-inner select-none cursor-grab active:cursor-grabbing"
      >
        {/* Grid Background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Floating Info Overlay */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-white text-xs">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span>
            2D CAD Box Enclosure:{" "}
            <strong className="text-blue-300">
              {widthMm} × {heightMm} × {depthMm} mm
            </strong>
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Scroll untuk Zoom • Drag untuk Geser</span>
        </div>

        {/* SVG Drawing Canvas */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-75 ease-out origin-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <svg
            id="outer-panel-2d-canvas"
            ref={svgRef}
            width={totalSvgWidth}
            height={totalSvgHeight}
            viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`}
            className="overflow-visible"
          >
            <defs>
              {/* Metallic Gradients untuk Panel Sheet Metal (Industrial Enclosure) */}
              <linearGradient id="panelBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>

              <linearGradient id="doorBevelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="50%" stopColor="#475569" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>

              <linearGradient id="handleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="50%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>

              <linearGradient id="lotoRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#16a34a" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>

              {/* Marker Arrow untuk Leader Line Dimensi CAD */}
              <marker
                id="arrowPointer"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
              </marker>

              <marker
                id="dimArrow"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#fbbf24" />
              </marker>
            </defs>

            {/* ============================================================== */}
            {/* GAMBAR 1: TAMPAK DEPAN (FRONT VIEW)                            */}
            {/* ============================================================== */}
            <g id="front-view">
              {/* Outer Enclosure Shadow & Body */}
              <rect
                x={frontX}
                y={frontY}
                width={widthMm}
                height={heightMm}
                rx={6}
                fill="url(#panelBodyGrad)"
                stroke="#94a3b8"
                strokeWidth={2.5}
                className="drop-shadow-lg"
              />

              {/* Inner Door Seam / Lipatan Pintu Panel */}
              <rect
                x={frontX + 16}
                y={frontY + 16}
                width={widthMm - 32}
                height={heightMm - 32}
                rx={4}
                fill="none"
                stroke="#1e293b"
                strokeWidth={2}
                strokeDasharray="4 2"
              />

              {/* Engsel Pintu di Sisi Kanan Panel */}
              <rect
                x={frontX + widthMm - 6}
                y={frontY + 60}
                width={6}
                height={26}
                rx={2}
                fill="#334155"
                stroke="#64748b"
                strokeWidth={1}
              />
              <rect
                x={frontX + widthMm - 6}
                y={frontY + heightMm - 86}
                width={6}
                height={26}
                rx={2}
                fill="#334155"
                stroke="#64748b"
                strokeWidth={1}
              />

              {/* --- ELEMEN: LOCK DOOR (HANDLE KUNCI PINTU PANEL) --- */}
              {/* Posisi di sisi kiri pintu panel sesuai gambar referensi: Otomatis center saat LOTO off */}
              <g
                id="lock-door"
                transform={`translate(${lockDoorX}, ${lockDoorY})`}
                style={{
                  transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {/* Housing Handle Recessed */}
                <rect
                  x={-14}
                  y={-50}
                  width={28}
                  height={100}
                  rx={6}
                  fill="#0f172a"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                />
                {/* Gagang Tuas Putar Logam (Lever Handle) */}
                <rect
                  x={-7}
                  y={-36}
                  width={14}
                  height={62}
                  rx={4}
                  fill="url(#handleGrad)"
                  stroke="#475569"
                  strokeWidth={1.5}
                />
                {/* Silinder Kunci & Lubang Anak Kunci (Keyhole) */}
                <circle cx={0} cy={34} r={5} fill="#e2e8f0" stroke="#334155" strokeWidth={1} />
                <rect x={-1} y={32} width={2} height={5} fill="#0f172a" />

                {/* Indikator Titik Kunci */}
                <circle cx={0} cy={-28} r={2} fill="#38bdf8" />
              </g>

              {/* Leader Line Pointer ke Lock Door */}
              <path
                d={`M ${lockDoorX + 16} ${lockDoorY} L ${lockDoorX + 80} ${lockDoorY - 40} L ${lockDoorX + 160} ${lockDoorY - 40}`}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.8}
                markerStart="url(#arrowPointer)"
                style={{
                  transition: "d 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
              <text
                x={lockDoorX + 85}
                y={lockDoorY - 46}
                fill="#38bdf8"
                fontSize={12}
                fontWeight="bold"
                fontFamily="monospace"
                style={{
                  transition: "y 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                LOCK DOOR
              </text>
              <text
                x={lockDoorX + 85}
                y={lockDoorY - 28}
                fill="#94a3b8"
                fontSize={10}
                fontFamily="sans-serif"
                style={{
                  transition: "y 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                Kunci Pintu Panel
              </text>

              {/* --- ELEMEN: LOTO SWITCH (KIRI ATAS) --- */}
              {/* Tampil HANYA jika hasLoto === true */}
              {features.hasLoto && (
                <g id="loto-switch" transform={`translate(${lotoX}, ${lotoY})`}>
                  {/* Escutcheon Plate Persegi Hitam */}
                  <rect
                    x={-34}
                    y={-34}
                    width={68}
                    height={68}
                    rx={6}
                    fill="#0f172a"
                    stroke="#facc15"
                    strokeWidth={2.5}
                  />

                  {/* Dial Putar Hijau (Sesuai Gambar Referensi CAD User) */}
                  <circle
                    cx={0}
                    cy={0}
                    r={26}
                    fill="url(#lotoRingGrad)"
                    stroke="#22c55e"
                    strokeWidth={2}
                  />

                  {/* Rotary Handle Knob */}
                  <rect
                    x={-7}
                    y={-18}
                    width={14}
                    height={36}
                    rx={3}
                    fill="#0f172a"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={0}
                    y1={-16}
                    x2={0}
                    y2={16}
                    stroke="#ef4444"
                    strokeWidth={2}
                  />

                  {/* Lubang Gembok Padlock Lockout */}
                  <circle cx={-18} cy={-18} r={3.5} fill="#facc15" stroke="#78350f" strokeWidth={1} />
                  <circle cx={18} cy={-18} r={3.5} fill="#facc15" stroke="#78350f" strokeWidth={1} />

                  <text
                    x={0}
                    y={23}
                    textAnchor="middle"
                    fill="#facc15"
                    fontSize={7}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    LOTO
                  </text>
                </g>
              )}

              {/* Leader Line Pointer ke LOTO Switch */}
              {features.hasLoto && (
                <>
                  <path
                    d={`M ${lotoX + 28} ${lotoY - 20} L ${lotoX + 75} ${lotoY - 60} L ${lotoX + 175} ${lotoY - 60}`}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={1.8}
                    markerStart="url(#arrowPointer)"
                  />
                  <text
                    x={lotoX + 80}
                    y={lotoY - 66}
                    fill="#38bdf8"
                    fontSize={12}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    LOTO SWITCH
                  </text>
                  <text
                    x={lotoX + 80}
                    y={lotoY - 48}
                    fill="#94a3b8"
                    fontSize={9.5}
                    fontFamily="sans-serif"
                  >
                    {features.lotoLabel || prFeatures.lotoCompName || "Main Disconnect Switch"}
                  </text>
                </>
              )}

              {/* --- GARIS UKUR DIMENSI TAMPAK DEPAN --- */}
              {/* 1. Garis Ukur Tinggi (Left Dimension: H mm) */}
              <g id="dim-front-height">
                <line
                  x1={frontX}
                  y1={frontY}
                  x2={frontX - 45}
                  y2={frontY}
                  stroke="#64748b"
                  strokeWidth={1}
                />
                <line
                  x1={frontX}
                  y1={frontY + heightMm}
                  x2={frontX - 45}
                  y2={frontY + heightMm}
                  stroke="#64748b"
                  strokeWidth={1}
                />
                <line
                  x1={frontX - 35}
                  y1={frontY}
                  x2={frontX - 35}
                  y2={frontY + heightMm}
                  stroke="#fbbf24"
                  strokeWidth={1.8}
                  markerStart="url(#dimArrow)"
                  markerEnd="url(#dimArrow)"
                />
                {/* Badge Angka Dimensi */}
                <g transform={`translate(${frontX - 35}, ${frontY + heightMm / 2})`}>
                  <rect
                    x={-24}
                    y={-14}
                    width={48}
                    height={28}
                    rx={6}
                    fill="#0f172a"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                  />
                  <text
                    x={0}
                    y={5}
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize={14}
                    fontWeight="extrabold"
                    fontFamily="monospace"
                  >
                    {heightMm}
                  </text>
                </g>
              </g>

              {/* 2. Garis Ukur Lebar (Bottom Dimension: W mm) */}
              <g id="dim-front-width">
                <line
                  x1={frontX}
                  y1={frontY + heightMm}
                  x2={frontX}
                  y2={frontY + heightMm + 45}
                  stroke="#64748b"
                  strokeWidth={1}
                />
                <line
                  x1={frontX + widthMm}
                  y1={frontY + heightMm}
                  x2={frontX + widthMm}
                  y2={frontY + heightMm + 45}
                  stroke="#64748b"
                  strokeWidth={1}
                />
                <line
                  x1={frontX}
                  y1={frontY + heightMm + 35}
                  x2={frontX + widthMm}
                  y2={frontY + heightMm + 35}
                  stroke="#fbbf24"
                  strokeWidth={1.8}
                  markerStart="url(#dimArrow)"
                  markerEnd="url(#dimArrow)"
                />
                {/* Badge Angka Dimensi */}
                <g transform={`translate(${frontX + widthMm / 2}, ${frontY + heightMm + 35})`}>
                  <rect
                    x={-28}
                    y={-14}
                    width={56}
                    height={28}
                    rx={6}
                    fill="#0f172a"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                  />
                  <text
                    x={0}
                    y={5}
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize={14}
                    fontWeight="extrabold"
                    fontFamily="monospace"
                  >
                    {widthMm}
                  </text>
                </g>
              </g>

              {/* Judul Gambar Tampak Depan */}
              <text
                x={frontX + widthMm / 2}
                y={frontY + heightMm + 85}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize={15}
                fontWeight="extrabold"
                letterSpacing={1.5}
                fontFamily="sans-serif"
              >
                TAMPAK DEPAN (FRONT VIEW)
              </text>
            </g>

            {/* ============================================================== */}
            {/* GAMBAR 2: TAMPAK SAMPING (SIDE VIEW)                           */}
            {/* ============================================================== */}
            <g id="side-view">
              {/* Outer Enclosure Samping Body (Width = D, Height = H) */}
              <rect
                x={sideX}
                y={sideY}
                width={depthMm}
                height={heightMm}
                rx={6}
                fill="url(#panelBodyGrad)"
                stroke="#94a3b8"
                strokeWidth={2.5}
                className="drop-shadow-lg"
              />

              {/* Garis Ketebalan Pintu Depan di Sisi Kiri Tampak Samping */}
              <rect
                x={sideX - 10}
                y={sideY + 8}
                width={10}
                height={heightMm - 16}
                rx={2}
                fill="#334155"
                stroke="#64748b"
                strokeWidth={1.5}
              />

              {/* Tonjolan Siluet Lock Door di Sisi Depan Pintu (Otomatis center bila LOTO off) */}
              <rect
                x={sideX - 18}
                y={lockDoorY - 40}
                width={8}
                height={80}
                rx={3}
                fill="#1e293b"
                stroke="#cbd5e1"
                strokeWidth={1.5}
                style={{
                  transition: "y 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />

              {/* Tonjolan Siluet Rotary LOTO Switch (Jika Aktif) */}
              {features.hasLoto && (
                <rect
                  x={sideX - 22}
                  y={lotoY - 22}
                  width={12}
                  height={44}
                  rx={3}
                  fill="#facc15"
                  stroke="#78350f"
                  strokeWidth={1.5}
                />
              )}

              {/* --- ELEMEN: LUBANG CUTOUT FAN BULAT (Ø115 + 4× Ø5 PITCH 105×105) --- */}
              {/* Tampil HANYA jika hasFan === true */}
              {features.hasFan && (() => {
                const { spec } = fanPos;
                const rMain = spec.cutoutDiaMm / 2;
                const rScrew = spec.screwHoleDiaMm / 2;
                const hp = spec.halfPitchMm;
                const armExt = rMain + 16;

                return (
                  <g id="cooling-fan-louvre">
                    {/* Garis Sumbu Tengah (Centerlines) */}
                    <line
                      x1={fanCx - armExt}
                      y1={fanCy}
                      x2={fanCx + armExt}
                      y2={fanCy}
                      stroke="#64748b"
                      strokeWidth={1}
                      strokeDasharray="6 3 2 3"
                    />
                    <line
                      x1={fanCx}
                      y1={fanCy - armExt}
                      x2={fanCx}
                      y2={fanCy + armExt}
                      stroke="#64748b"
                      strokeWidth={1}
                      strokeDasharray="6 3 2 3"
                    />

                    {/* Lubang Potong Utama Bulat Ø115 */}
                    <circle
                      cx={fanCx}
                      cy={fanCy}
                      r={rMain}
                      fill="#0f172a"
                      stroke="#38bdf8"
                      strokeWidth={2}
                    />

                    {/* 4 Lubang Baut Ø5 pada jarak 105×105 mm */}
                    {[
                      [-hp, -hp],
                      [hp, -hp],
                      [-hp, hp],
                      [hp, hp],
                    ].map(([dx, dy], i) => (
                      <circle
                        key={`fan-bolt-${i}`}
                        cx={fanCx + dx}
                        cy={fanCy + dy}
                        r={rScrew}
                        fill="#0f172a"
                        stroke="#38bdf8"
                        strokeWidth={1.6}
                      />
                    ))}

                    {/* Dimensi Pitch Vertikal 105 (kiri) */}
                    <line
                      x1={fanCx - hp - 18}
                      y1={fanCy - hp}
                      x2={fanCx - hp - 18}
                      y2={fanCy + hp}
                      stroke="#94a3b8"
                      strokeWidth={0.9}
                    />
                    <line
                      x1={fanCx - hp - 22}
                      y1={fanCy - hp}
                      x2={fanCx - hp}
                      y2={fanCy - hp}
                      stroke="#94a3b8"
                      strokeWidth={0.7}
                    />
                    <line
                      x1={fanCx - hp - 22}
                      y1={fanCy + hp}
                      x2={fanCx - hp}
                      y2={fanCy + hp}
                      stroke="#94a3b8"
                      strokeWidth={0.7}
                    />
                    <text
                      x={fanCx - hp - 22}
                      y={fanCy}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize={9}
                      fontFamily="monospace"
                      transform={`rotate(-90 ${fanCx - hp - 22} ${fanCy})`}
                    >
                      {spec.holePitchMm}
                    </text>

                    {/* Dimensi Pitch Horizontal 105 (bawah) */}
                    <line
                      x1={fanCx - hp}
                      y1={fanCy + hp + 18}
                      x2={fanCx + hp}
                      y2={fanCy + hp + 18}
                      stroke="#94a3b8"
                      strokeWidth={0.9}
                    />
                    <line
                      x1={fanCx - hp}
                      y1={fanCy + hp}
                      x2={fanCx - hp}
                      y2={fanCy + hp + 22}
                      stroke="#94a3b8"
                      strokeWidth={0.7}
                    />
                    <line
                      x1={fanCx + hp}
                      y1={fanCy + hp}
                      x2={fanCx + hp}
                      y2={fanCy + hp + 22}
                      stroke="#94a3b8"
                      strokeWidth={0.7}
                    />
                    <text
                      x={fanCx}
                      y={fanCy + hp + 30}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {spec.holePitchMm}
                    </text>

                    {/* Leader Pointer Ø115 */}
                    <path
                      d={`M ${fanCx + rMain * 0.7} ${fanCy - rMain * 0.7} L ${fanCx + rMain + 28} ${fanCy - rMain - 24} L ${fanCx + rMain + 120} ${fanCy - rMain - 24}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={1.6}
                      markerStart="url(#arrowPointer)"
                    />
                    <text
                      x={fanCx + rMain + 32}
                      y={fanCy - rMain - 30}
                      fill="#38bdf8"
                      fontSize={11}
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      Ø{spec.cutoutDiaMm} (4× Ø{spec.screwHoleDiaMm})
                    </text>
                    <text
                      x={fanCx + rMain + 32}
                      y={fanCy - rMain - 12}
                      fill="#94a3b8"
                      fontSize={9}
                      fontFamily="sans-serif"
                    >
                      {features.fanLabel || prFeatures.fanCompName || `Fan Cutout ${spec.holePitchMm}×${spec.holePitchMm}`}
                    </text>
                  </g>
                );
              })()}

              {/* --- GARIS UKUR DIMENSI TAMPAK SAMPING --- */}
              {/* Garis Ukur Tebal/Kedalaman (Bottom Dimension: D mm) */}
              <g id="dim-side-depth">
                <line
                  x1={sideX}
                  y1={sideY + heightMm}
                  x2={sideX}
                  y2={sideY + heightMm + 45}
                  stroke="#64748b"
                  strokeWidth={1}
                />
                <line
                  x1={sideX + depthMm}
                  y1={sideY + heightMm}
                  x2={sideX + depthMm}
                  y2={sideY + heightMm + 45}
                  stroke="#64748b"
                  strokeWidth={1}
                />
                <line
                  x1={sideX}
                  y1={sideY + heightMm + 35}
                  x2={sideX + depthMm}
                  y2={sideY + heightMm + 35}
                  stroke="#fbbf24"
                  strokeWidth={1.8}
                  markerStart="url(#dimArrow)"
                  markerEnd="url(#dimArrow)"
                />
                {/* Badge Angka Dimensi Tebal */}
                <g transform={`translate(${sideX + depthMm / 2}, ${sideY + heightMm + 35})`}>
                  <rect
                    x={-28}
                    y={-14}
                    width={56}
                    height={28}
                    rx={6}
                    fill="#0f172a"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                  />
                  <text
                    x={0}
                    y={5}
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize={14}
                    fontWeight="extrabold"
                    fontFamily="monospace"
                  >
                    {depthMm}
                  </text>
                </g>
              </g>

              {/* Judul Gambar Tampak Samping */}
              <text
                x={sideX + depthMm / 2}
                y={sideY + heightMm + 85}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize={15}
                fontWeight="extrabold"
                letterSpacing={1.5}
                fontFamily="sans-serif"
              >
                TAMPAK SAMPING (SIDE VIEW)
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
