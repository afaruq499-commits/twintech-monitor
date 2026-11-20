"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  Edit3,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Save,
  Sparkles,
  Layers,
  FileCode,
  X,
  Move,
  Copy,
  LayoutGrid,
  Columns,
  Square,
  Eye,
} from "lucide-react";
import { FlowStepItem, generateDrawioXml } from "@/lib/flowchart-converter";

export interface TwintechNativeFlowchartProps {
  initialSteps: FlowStepItem[];
  projectName?: string;
  projectClient?: string;
  onSave?: (steps: FlowStepItem[], xml: string, svgDataUrl: string) => Promise<void> | void;
  isSaving?: boolean;
  onStepsChange?: (steps: FlowStepItem[]) => void;
  forceLayoutMode?: "auto" | "single" | "dual";
}

export function TwintechNativeFlowchart({
  initialSteps,
  projectName = "Twintech",
  projectClient = "PT Twintech Precision",
  onSave,
  isSaving = false,
  onStepsChange,
  forceLayoutMode = "auto",
}: TwintechNativeFlowchartProps) {
  const [steps, setSteps] = useState<FlowStepItem[]>(() =>
    initialSteps && initialSteps.length > 0 ? initialSteps : []
  );

  // Sync prop changes
  useEffect(() => {
    if (initialSteps && initialSteps.length > 0) {
      setSteps(initialSteps);
    }
  }, [initialSteps]);

  // Notify parent on steps change
  const updateSteps = useCallback(
    (newSteps: FlowStepItem[]) => {
      setSteps(newSteps);
      if (onStepsChange) {
        onStepsChange(newSteps);
      }
    },
    [onStepsChange]
  );

  // Selected node for editing
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showEditDrawer, setShowEditDrawer] = useState(false);

  // Canvas Pan & Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [canvasTheme, setCanvasTheme] = useState<"dark" | "light">("dark");
  const [userLayoutChoice, setUserLayoutChoice] = useState<"auto" | "single" | "dual">(forceLayoutMode);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.15, 0.4));
  const handleZoomReset = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".flowchart-node-interactive")) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Periksa apakah ini alur 2-kolom (Safety Relay di kiri & Machine Running di kanan)
  const isTwintechDualColumn = useMemo(() => {
    if (userLayoutChoice === "single") return false;
    if (userLayoutChoice === "dual") return true;
    if (steps.length < 6) return false;
    const hasSafety = steps.some((s) => /safety|emg|power on/i.test(s.judul + s.deskripsi));
    const hasMachine = steps.some((s) => /inspect|homing|mesin ready|2 pb/i.test(s.judul + s.deskripsi));
    return hasSafety && hasMachine;
  }, [steps, userLayoutChoice]);

  // Pisahkan langkah untuk mode 2 kolom
  const { columnLeftSteps, columnRightSteps } = useMemo(() => {
    if (!isTwintechDualColumn) {
      return { columnLeftSteps: steps, columnRightSteps: [] };
    }
    const splitIndex = steps.findIndex((s) => /mesin ready|inspect on/i.test(s.judul));
    if (splitIndex > 0) {
      return {
        columnLeftSteps: steps.slice(0, splitIndex),
        columnRightSteps: steps.slice(splitIndex),
      };
    }
    const half = Math.ceil(steps.length / 2);
    return {
      columnLeftSteps: steps.slice(0, half),
      columnRightSteps: steps.slice(half),
    };
  }, [steps, isTwintechDualColumn]);

  // Perbarui data langkah terpilih
  const selectedStep = useMemo(() => {
    return steps.find((s) => s.id === selectedNodeId) || null;
  }, [steps, selectedNodeId]);

  const updateSelectedStep = (field: keyof FlowStepItem, value: string) => {
    if (!selectedNodeId) return;
    const next = steps.map((s) => (s.id === selectedNodeId ? { ...s, [field]: value } : s));
    updateSteps(next);
  };

  // Pindahkan urutan langkah
  const handleMoveStep = (id: string, direction: "up" | "down") => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const copy = [...steps];
    const [item] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, item);
    updateSteps(copy);
  };

  // Hapus langkah
  const handleDeleteStep = (id: string) => {
    const next = steps.filter((s) => s.id !== id);
    updateSteps(next);
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      setShowEditDrawer(false);
    }
    showToast("Langkah berhasil dihapus");
  };

  // Duplikasi langkah
  const handleDuplicateStep = (id: string) => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const item = steps[idx];
    const newId = `step-${Date.now().toString(36)}`;
    const duplicate: FlowStepItem = {
      ...item,
      id: newId,
      nomor: `${item.nomor}B`,
      judul: `${item.judul} (Salinan)`,
    };
    const copy = [...steps];
    copy.splice(idx + 1, 0, duplicate);
    updateSteps(copy);
    setSelectedNodeId(newId);
    showToast("Langkah berhasil disalin");
  };

  // Tambah langkah baru
  const handleAddStep = (afterId?: string) => {
    const newId = `step-${Date.now().toString(36)}`;
    const newStep: FlowStepItem = {
      id: newId,
      nomor: String(steps.length + 1),
      judul: "LANGKAH BARU",
      deskripsi: "Deskripsi proses atau sinyal I/O PLC",
      tipe: "STEP",
    };

    if (afterId) {
      const idx = steps.findIndex((s) => s.id === afterId);
      if (idx >= 0) {
        const copy = [...steps];
        copy.splice(idx + 1, 0, newStep);
        updateSteps(copy);
        setSelectedNodeId(newId);
        setShowEditDrawer(true);
        return;
      }
    }

    updateSteps([...steps, newStep]);
    setSelectedNodeId(newId);
    setShowEditDrawer(true);
  };

  // Helper untuk membuat SVG Data URL
  const generateSvgDataUrl = (): string => {
    if (!svgRef.current) return "";
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
  };

  // Simpan perubahan ke database proyek
  const handleTriggerSave = async () => {
    const xml = generateDrawioXml(steps, { diagramName: `Flowchart ${projectName}` });
    const svgDataUrl = generateSvgDataUrl();
    if (onSave) {
      await onSave(steps, xml, svgDataUrl);
    }
    showToast("Flowchart berhasil disimpan & diaplikasikan ke proyek!");
  };

  // Unduh Berkas SVG
  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Flowchart-${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Berkas SVG berhasil diunduh!");
  };

  // Unduh Berkas PNG (Resolusi Tinggi 2x Retina + Title Block Twintech)
  const handleDownloadPng = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const svgWidth = canvasWidth;
    const svgHeight = canvasHeight;
    clonedSvg.setAttribute("width", String(svgWidth));
    clonedSvg.setAttribute("height", String(svgHeight));

    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const URLObject = window.URL || window.webkitURL || window;
    const blobURL = URLObject.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2; // Skala 2x Retina HD
      const headerHeight = 90 * scale;
      canvas.width = svgWidth * scale;
      canvas.height = svgHeight * scale + headerHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Latar Belakang Kanvas
        ctx.fillStyle = canvasTheme === "dark" ? "#0b0f19" : "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Header Title Block Resmi Twintech Precision
        ctx.fillStyle = canvasTheme === "dark" ? "#1e293b" : "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, headerHeight);

        ctx.strokeStyle = canvasTheme === "dark" ? "#334155" : "#cbd5e1";
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(10 * scale, 10 * scale, canvas.width - 20 * scale, canvas.height - 20 * scale);
        ctx.beginPath();
        ctx.moveTo(10 * scale, headerHeight);
        ctx.lineTo(canvas.width - 10 * scale, headerHeight);
        ctx.stroke();

        // Teks Judul
        ctx.fillStyle = canvasTheme === "dark" ? "#ffffff" : "#0f172a";
        ctx.font = `bold ${14 * scale}px sans-serif`;
        ctx.fillText("PT. TWINTECH PRECISION — ENGINEERING FLOWCHART DOKUMENTASI MESIN", 24 * scale, 36 * scale);

        // Teks Informasi Tambahan
        ctx.fillStyle = canvasTheme === "dark" ? "#94a3b8" : "#475569";
        ctx.font = `${10 * scale}px sans-serif`;
        const dateStr = new Date().toLocaleDateString("id-ID", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        ctx.fillText(
          `PROYEK: ${projectName.toUpperCase()}  |  CLIENT: ${projectClient.toUpperCase()}  |  TANGGAL: ${dateStr}  |  TOTAL LANGKAH: ${steps.length} STEP`,
          24 * scale,
          62 * scale
        );

        // Gambar Vektor Flowchart
        ctx.drawImage(image, 0, headerHeight, svgWidth * scale, svgHeight * scale);

        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `Flowchart-${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
        a.click();
        showToast("Gambar PNG resolusi tinggi berhasil diunduh!");
      }
      URLObject.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

  // Unduh Berkas .drawio
  const handleDownloadDrawio = () => {
    const xml = generateDrawioXml(steps, { diagramName: `Flowchart ${projectName}` });
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Flowchart-${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}.drawio`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Berkas .drawio berhasil diunduh!");
  };

  // Hitung dimensi kanvas SVG
  const canvasWidth = isTwintechDualColumn ? 1680 : 960;
  const maxStepCount = Math.max(columnLeftSteps.length, columnRightSteps.length, steps.length, 6);
  const canvasHeight = Math.max(maxStepCount * 125 + 160, 850);

  return (
    <div
      className={`bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col relative ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : "min-h-[780px]"
      }`}
    >
      {/* Toast Notifikasi */}
      {toastMessage && (
        <div className="absolute top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Toolbar Atas Studio Flowchart Native */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-900/30">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <div className="text-sm font-bold flex items-center gap-2">
              <span>Studio Flowchart Native Twintech</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                100% Offline &amp; Instan
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {steps.length} langkah alur • Klik kotak alur untuk mengedit langsung
            </div>
          </div>
        </div>

        {/* Action Controls & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Layout Mode Switcher */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setUserLayoutChoice("single")}
              className={`p-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition ${
                !isTwintechDualColumn ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
              title="Tata Letak Kolom Tunggal (Linear)"
            >
              <Square className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">1 Kolom</span>
            </button>
            <button
              type="button"
              onClick={() => setUserLayoutChoice("dual")}
              className={`p-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition ${
                isTwintechDualColumn ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
              title="Tata Letak Kolom Ganda (Safety + Machine Running)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">2 Kolom</span>
            </button>
          </div>

          {/* Canvas Theme Toggle */}
          <button
            type="button"
            onClick={() => setCanvasTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer text-xs flex items-center gap-1"
            title={`Ubah tema kanvas ke ${canvasTheme === "dark" ? "Terang (White)" : "Gelap (Dark)"}`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{canvasTheme === "dark" ? "Dark" : "Light"}</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              title="Perkecil (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono font-bold text-[11px] text-slate-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomReset}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              title="Reset ke 100%"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              title="Perbesar (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tombol Tambah Langkah */}
          <button
            type="button"
            onClick={() => handleAddStep()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
            title="Tambah langkah alur baru"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tambah Langkah</span>
          </button>

          {/* Unduh Gambar PNG */}
          <button
            type="button"
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-blue-900/30"
            title="Unduh diagram beresolusi tinggi (PNG)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh PNG</span>
          </button>

          {/* Unduh Vektor SVG */}
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer shadow-xs"
            title="Unduh vektor SVG tajam"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>SVG</span>
          </button>

          {/* Unduh .drawio (Opsional) */}
          <button
            type="button"
            onClick={handleDownloadDrawio}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer shadow-xs"
            title="Unduh berkas format Draw.io (.drawio)"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>.drawio</span>
          </button>

          {/* Simpan ke Proyek */}
          {onSave && (
            <button
              type="button"
              onClick={handleTriggerSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-md cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Flowchart</span>
                </>
              )}
            </button>
          )}

          {/* Toggle Layar Penuh */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Area Kanvas Diagram & Sidebar Editor */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Kanvas Pembungkus SVG (Mendukung Zoom & Drag Pan) */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex-1 overflow-hidden relative flex items-center justify-center select-none ${
            canvasTheme === "dark" ? "bg-[#0b0f19]" : "bg-slate-100"
          } ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            backgroundImage:
              canvasTheme === "dark"
                ? "radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px)"
                : "radial-gradient(circle, rgba(0, 0, 0, 0.08) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          {/* Instruksi Geser & Zoom */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none bg-slate-900/80 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-1.5 backdrop-blur-xs">
            <Move className="w-3 h-3 text-indigo-400" />
            <span>Klik &amp; tarik kanvas untuk geser • Scroll untuk zoom • Klik kotak alur untuk edit</span>
          </div>

          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 0.1s ease-out",
            }}
            className="flex items-center justify-center p-8"
          >
            {/* SVG Native Flowchart Canvas */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              width={canvasWidth}
              height={canvasHeight}
              className="drop-shadow-2xl transition-all"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Marker Panah Biru Standar */}
                <marker
                  id="native-arrow-blue"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#60a5fa" />
                </marker>

                {/* Marker Panah Hijau OK */}
                <marker
                  id="native-arrow-green"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
                </marker>

                {/* Marker Panah Merah NG */}
                <marker
                  id="native-arrow-red"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
                </marker>

                {/* Filter Glow saat Node Dipilih */}
                <filter id="glow-selected" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#6366f1" floodOpacity="0.8" />
                </filter>
              </defs>

              {/* Latar Belakang Kotak Pembatas / Panel */}
              <rect
                x="10"
                y="10"
                width={canvasWidth - 20}
                height={canvasHeight - 20}
                rx="24"
                fill={canvasTheme === "dark" ? "#0f172a" : "#ffffff"}
                stroke={canvasTheme === "dark" ? "#1e293b" : "#cbd5e1"}
                strokeWidth="2"
              />

              {/* Render Diagram Kolom Ganda (Twintech Dual Flow) atau Kolom Tunggal */}
              {isTwintechDualColumn ? (
                <>
                  {/* Kolom Kiri Header: Safety Relay */}
                  <rect
                    x="40"
                    y="30"
                    width="760"
                    height="40"
                    rx="10"
                    fill={canvasTheme === "dark" ? "#1e293b" : "#f1f5f9"}
                  />
                  <text
                    x="420"
                    y="55"
                    fill={canvasTheme === "dark" ? "#93c5fd" : "#1e40af"}
                    fontSize="13"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    BAGIAN 1: SAFETY RELAY &amp; POWER-UP SEQUENCE
                  </text>

                  {/* Kolom Kanan Header: Machine Running */}
                  <rect
                    x="880"
                    y="30"
                    width="760"
                    height="40"
                    rx="10"
                    fill={canvasTheme === "dark" ? "#1e293b" : "#f1f5f9"}
                  />
                  <text
                    x="1260"
                    y="55"
                    fill={canvasTheme === "dark" ? "#a7f3d0" : "#065f46"}
                    fontSize="13"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    BAGIAN 2: MACHINE RUNNING &amp; INSPECTION SEQUENCE
                  </text>

                  {/* Render Node Kolom Kiri */}
                  {renderStepList(
                    columnLeftSteps,
                    420,
                    100,
                    selectedNodeId,
                    (id) => {
                      setSelectedNodeId(id);
                      setShowEditDrawer(true);
                    },
                    canvasTheme
                  )}

                  {/* Render Node Kolom Kanan */}
                  {renderStepList(
                    columnRightSteps,
                    1260,
                    100,
                    selectedNodeId,
                    (id) => {
                      setSelectedNodeId(id);
                      setShowEditDrawer(true);
                    },
                    canvasTheme
                  )}

                  {/* Panah Interkoneksi Kolom Kiri ke Kolom Kanan [A] */}
                  <path
                    d={`M 660 ${columnLeftSteps.length * 115} H 780 V 130 H 1040`}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    markerEnd="url(#native-arrow-blue)"
                  />
                  <rect x="740" y="115" width="130" height="26" rx="6" fill="#1e3a8a" stroke="#3b82f6" />
                  <text x="805" y="132" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">
                    Lanjut ke Part [A] ➔
                  </text>

                  {/* Panah Loopback dari Kolom Kanan kembali ke Safety Check [B] */}
                  <path
                    d={`M 1260 ${columnRightSteps.length * 115 + 130} V ${canvasHeight - 60} H 420 V ${
                      columnLeftSteps.length * 115 + 85
                    }`}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    markerEnd="url(#native-arrow-red)"
                  />
                  <rect
                    x="760"
                    y={canvasHeight - 75}
                    width="180"
                    height="28"
                    rx="6"
                    fill="#7f1d1d"
                    stroke="#ef4444"
                  />
                  <text
                    x="850"
                    y={canvasHeight - 57}
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    Loopback Safety Reset [B] ↺
                  </text>
                </>
              ) : (
                /* Render Kolom Tunggal Linear */
                renderStepList(
                  steps,
                  canvasWidth / 2,
                  70,
                  selectedNodeId,
                  (id) => {
                    setSelectedNodeId(id);
                    setShowEditDrawer(true);
                  },
                  canvasTheme
                )
              )}
            </svg>
          </div>
        </div>

        {/* Sidebar Inspector Edit Langkah Terpilih */}
        {showEditDrawer && selectedStep && (
          <div className="w-80 border-l border-slate-800 bg-slate-950 p-5 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right-5 duration-200 text-white z-20">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-bold">Edit Langkah Alur</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditDrawer(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Input Edit */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tipe Kotak Alur:</label>
                  <select
                    value={selectedStep.tipe}
                    onChange={(e) =>
                      updateSelectedStep("tipe", e.target.value as FlowStepItem["tipe"])
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="START">START / STANDBY (Pill Bulat)</option>
                    <option value="STEP">STEP (Proses Normal)</option>
                    <option value="DECISION">DECISION (Belah Ketupat / Kondisi)</option>
                    <option value="OK">OK / PASS (Kotak Hijau Lolos)</option>
                    <option value="NG">NG / ALARM (Kotak Merah Peringatan)</option>
                    <option value="FINISH">FINISH / RESET (Selesai Alur)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Nomor / Label Urut:</label>
                  <input
                    type="text"
                    value={selectedStep.nomor}
                    onChange={(e) => updateSelectedStep("nomor", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    placeholder="misal: 1 atau OK atau DEC"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Judul Langkah:</label>
                  <input
                    type="text"
                    value={selectedStep.judul}
                    onChange={(e) => updateSelectedStep("judul", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    placeholder="Judul alur atau aksi mesin"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Deskripsi / Keterangan I/O PLC:
                  </label>
                  <textarea
                    rows={3}
                    value={selectedStep.deskripsi}
                    onChange={(e) => updateSelectedStep("deskripsi", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    placeholder="misal: Input X0 aktif • Silinder clamp maju"
                  />
                </div>

                {/* Tombol Pindah Urutan & Duplikat */}
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMoveStep(selectedStep.id, "up")}
                    className="flex-1 py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>Ke Atas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveStep(selectedStep.id, "down")}
                    className="flex-1 py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>Ke Bawah</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateStep(selectedStep.id)}
                    className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1 cursor-pointer"
                    title="Duplikat Langkah Ini"
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddStep(selectedStep.id)}
                  className="w-full py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 font-bold flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Sisipkan Langkah Setelah Ini</span>
                </button>
              </div>
            </div>

            {/* Tombol Hapus Langkah */}
            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleDeleteStep(selectedStep.id)}
                className="w-full py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Langkah Ini</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Render visual daftar langkah alur menjadi komponen elemen SVG
 */
function renderStepList(
  stepItems: FlowStepItem[],
  centerX: number,
  startY: number,
  selectedId: string | null,
  onSelectNode: (id: string) => void,
  theme: "dark" | "light" = "dark"
) {
  return stepItems.map((step, idx) => {
    const yPos = startY + idx * 115;
    const isSelected = selectedId === step.id;

    // 1. Tipe START / STANDBY (Pill Rounded Capsule)
    if (step.tipe === "START") {
      const width = 260;
      const height = 56;
      const x = centerX - width / 2;
      return (
        <g
          key={step.id}
          className="flowchart-node-interactive cursor-pointer group"
          onClick={() => onSelectNode(step.id)}
        >
          <rect
            x={x}
            y={yPos}
            width={width}
            height={height}
            rx="28"
            fill={theme === "dark" ? "#1e3a8a" : "#2563eb"}
            stroke={isSelected ? "#818cf8" : theme === "dark" ? "#3b82f6" : "#1d4ed8"}
            strokeWidth={isSelected ? "3" : "2"}
            filter={isSelected ? "url(#glow-selected)" : undefined}
          />
          <text x={centerX} y={yPos + 24} fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">
            {step.judul}
          </text>
          <text x={centerX} y={yPos + 42} fill="#bfdbfe" fontSize="10" textAnchor="middle">
            {step.deskripsi}
          </text>
          {idx < stepItems.length - 1 && (
            <line
              x1={centerX}
              y1={yPos + height}
              x2={centerX}
              y2={yPos + 115}
              stroke="#60a5fa"
              strokeWidth="2"
              markerEnd="url(#native-arrow-blue)"
            />
          )}
        </g>
      );
    }

    // 2. Tipe DECISION (Diamond / Rhombus)
    if (step.tipe === "DECISION") {
      const dWidth = 260;
      const dHeight = 76;
      const pTop = `${centerX},${yPos}`;
      const pRight = `${centerX + dWidth / 2},${yPos + dHeight / 2}`;
      const pBottom = `${centerX},${yPos + dHeight}`;
      const pLeft = `${centerX - dWidth / 2},${yPos + dHeight / 2}`;

      return (
        <g
          key={step.id}
          className="flowchart-node-interactive cursor-pointer group"
          onClick={() => onSelectNode(step.id)}
        >
          <polygon
            points={`${pTop} ${pRight} ${pBottom} ${pLeft}`}
            fill={theme === "dark" ? "#312e81" : "#4f46e5"}
            stroke={isSelected ? "#c7d2fe" : theme === "dark" ? "#818cf8" : "#4338ca"}
            strokeWidth={isSelected ? "3" : "2"}
            filter={isSelected ? "url(#glow-selected)" : undefined}
          />
          <text
            x={centerX}
            y={yPos + dHeight / 2 - 4}
            fill="#ffffff"
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
          >
            {step.judul}
          </text>
          <text
            x={centerX}
            y={yPos + dHeight / 2 + 13}
            fill="#e0e7ff"
            fontSize="10"
            textAnchor="middle"
          >
            {step.deskripsi}
          </text>
          {idx < stepItems.length - 1 && (
            <line
              x1={centerX}
              y1={yPos + dHeight}
              x2={centerX}
              y2={yPos + 115}
              stroke="#60a5fa"
              strokeWidth="2"
              markerEnd="url(#native-arrow-blue)"
            />
          )}
        </g>
      );
    }

    // 3. Tipe OK / GOOD (Kotak Hijau Lolos)
    if (step.tipe === "OK") {
      const width = 240;
      const height = 54;
      const x = centerX - width / 2;
      return (
        <g
          key={step.id}
          className="flowchart-node-interactive cursor-pointer group"
          onClick={() => onSelectNode(step.id)}
        >
          <rect
            x={x}
            y={yPos}
            width={width}
            height={height}
            rx="12"
            fill={theme === "dark" ? "#064e3b" : "#059669"}
            stroke={isSelected ? "#6ee7b7" : theme === "dark" ? "#10b981" : "#047857"}
            strokeWidth={isSelected ? "3" : "2"}
            filter={isSelected ? "url(#glow-selected)" : undefined}
          />
          <text x={centerX} y={yPos + 23} fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">
            {step.judul}
          </text>
          <text x={centerX} y={yPos + 40} fill="#a7f3d0" fontSize="10" textAnchor="middle">
            {step.deskripsi}
          </text>
          {idx < stepItems.length - 1 && (
            <line
              x1={centerX}
              y1={yPos + height}
              x2={centerX}
              y2={yPos + 115}
              stroke="#10b981"
              strokeWidth="2"
              markerEnd="url(#native-arrow-green)"
            />
          )}
        </g>
      );
    }

    // 4. Tipe NG / ALARM (Kotak Merah Peringatan)
    if (step.tipe === "NG") {
      const width = 240;
      const height = 54;
      const x = centerX - width / 2;
      return (
        <g
          key={step.id}
          className="flowchart-node-interactive cursor-pointer group"
          onClick={() => onSelectNode(step.id)}
        >
          <rect
            x={x}
            y={yPos}
            width={width}
            height={height}
            rx="12"
            fill={theme === "dark" ? "#7f1d1d" : "#dc2626"}
            stroke={isSelected ? "#fca5a5" : theme === "dark" ? "#ef4444" : "#b91c1c"}
            strokeWidth={isSelected ? "3" : "2"}
            filter={isSelected ? "url(#glow-selected)" : undefined}
          />
          <text x={centerX} y={yPos + 23} fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">
            {step.judul}
          </text>
          <text x={centerX} y={yPos + 40} fill="#fecaca" fontSize="10" textAnchor="middle">
            {step.deskripsi}
          </text>
          {idx < stepItems.length - 1 && (
            <line
              x1={centerX}
              y1={yPos + height}
              x2={centerX}
              y2={yPos + 115}
              stroke="#ef4444"
              strokeWidth="2"
              markerEnd="url(#native-arrow-red)"
            />
          )}
        </g>
      );
    }

    // 5. Tipe STEP Standar & FINISH (Rounded Rect)
    const isFinish = step.tipe === "FINISH";
    const width = 260;
    const height = 56;
    const x = centerX - width / 2;
    const rx = isFinish ? "28" : "12";
    const fill = isFinish
      ? theme === "dark"
        ? "#1e3a8a"
        : "#1d4ed8"
      : theme === "dark"
      ? "#1e293b"
      : "#f8fafc";
    const stroke = isSelected
      ? "#818cf8"
      : isFinish
      ? "#3b82f6"
      : theme === "dark"
      ? "#475569"
      : "#cbd5e1";

    return (
      <g
        key={step.id}
        className="flowchart-node-interactive cursor-pointer group"
        onClick={() => onSelectNode(step.id)}
      >
        <rect
          x={x}
          y={yPos}
          width={width}
          height={height}
          rx={rx}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? "3" : "1.5"}
          filter={isSelected ? "url(#glow-selected)" : undefined}
        />
        {/* Badge Nomor Langkah */}
        <rect
          x={x + 10}
          y={yPos + 12}
          width={28}
          height={20}
          rx="5"
          fill={theme === "dark" ? "#334155" : "#e2e8f0"}
        />
        <text
          x={x + 24}
          y={yPos + 26}
          fill={theme === "dark" ? "#94a3b8" : "#475569"}
          fontSize="10"
          fontWeight="bold"
          textAnchor="middle"
        >
          {step.nomor}
        </text>

        <text
          x={x + 46}
          y={yPos + 26}
          fill={theme === "dark" ? "#ffffff" : "#0f172a"}
          fontSize="12"
          fontWeight="bold"
        >
          {step.judul.length > 24 ? step.judul.slice(0, 24) + "..." : step.judul}
        </text>
        <text
          x={x + 12}
          y={yPos + 44}
          fill={theme === "dark" ? "#94a3b8" : "#64748b"}
          fontSize="10"
        >
          {step.deskripsi.length > 35 ? step.deskripsi.slice(0, 35) + "..." : step.deskripsi}
        </text>
        {idx < stepItems.length - 1 && (
          <line
            x1={centerX}
            y1={yPos + height}
            x2={centerX}
            y2={yPos + 115}
            stroke="#60a5fa"
            strokeWidth="2"
            markerEnd="url(#native-arrow-blue)"
          />
        )}
      </g>
    );
  });
}
