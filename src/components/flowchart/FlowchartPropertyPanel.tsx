"use client";

import {
  SlidersHorizontal,
  Info,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  CornerDownRight,
  Spline,
  Trash2,
  Tag,
  GitFork,
  Check,
  Copy,
  BringToFront,
  SendToBack,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Paintbrush,
  Type,
  Maximize,
} from "lucide-react";
import type {
  FlowchartNode,
  FlowchartEdge,
  EdgeRoutingType,
  EdgeStyle,
  EdgeMarker,
  TextAlign,
} from "@/lib/flowchart-types";

interface FlowchartPropertyPanelProps {
  selectedNode: FlowchartNode | null;
  selectedEdge: FlowchartEdge | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  // Handler untuk Node (Tahap 3)
  onUpdateNodeFillColor?: (id: string, color: string) => void;
  onUpdateNodeStrokeColor?: (id: string, color: string) => void;
  onUpdateNodeStrokeWidth?: (id: string, width: number) => void;
  onUpdateNodeFontSize?: (id: string, size: number) => void;
  onUpdateNodeTextColor?: (id: string, color: string) => void;
  onUpdateNodeTextAlign?: (id: string, align: TextAlign) => void;
  onDuplicateNode?: (id: string) => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
  onDeleteNode?: (id: string) => void;
  // Handler untuk Garis / Edge (Tahap 2 & 3)
  onUpdateEdgeRouting?: (id: string, routing: EdgeRoutingType) => void;
  onUpdateEdgeStyle?: (id: string, style: EdgeStyle) => void;
  onUpdateEdgeMarker?: (id: string, marker: EdgeMarker) => void;
  onUpdateEdgeLabel?: (id: string, label: string) => void;
  onUpdateEdgeColor?: (id: string, color: string) => void;
  onUpdateEdgeStrokeWidth?: (id: string, width: number) => void;
  onDeleteEdge?: (id: string) => void;
}

// Palet warna standar Twintech
const COLOR_PRESETS = [
  { name: "Blue", hex: "#2563eb" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Emerald", hex: "#059669" },
  { name: "Amber", hex: "#d97706" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Sky", hex: "#0284c7" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Dark Slate", hex: "#1e293b" },
  { name: "White", hex: "#ffffff" },
  { name: "Rose", hex: "#e11d48" },
];

const TEXT_COLOR_PRESETS = [
  { name: "White", hex: "#ffffff" },
  { name: "Slate Dark", hex: "#0f172a" },
  { name: "Slate Muted", hex: "#64748b" },
  { name: "Yellow", hex: "#f59e0b" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Red", hex: "#ef4444" },
];

export function FlowchartPropertyPanel({
  selectedNode,
  selectedEdge,
  isCollapsed,
  onToggleCollapse,
  onUpdateNodeFillColor,
  onUpdateNodeStrokeColor,
  onUpdateNodeStrokeWidth,
  onUpdateNodeFontSize,
  onUpdateNodeTextColor,
  onUpdateNodeTextAlign,
  onDuplicateNode,
  onBringToFront,
  onSendToBack,
  onDeleteNode,
  onUpdateEdgeRouting,
  onUpdateEdgeStyle,
  onUpdateEdgeMarker,
  onUpdateEdgeLabel,
  onUpdateEdgeColor,
  onUpdateEdgeStrokeWidth,
  onDeleteEdge,
}: FlowchartPropertyPanelProps) {
  if (isCollapsed) {
    return (
      <div className="border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 flex flex-col items-center shrink-0 select-none">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          title="Buka Panel Properti"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 select-none transition-all">
      {/* Header Panel */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-wide uppercase">
            Panel Properti
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          title="Sembunyikan Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Konten Properti */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* ======================================================== */}
        {/* KONDISI 1: NODE / SIMBOL TERPILIH (TAHAP 3)              */}
        {/* ======================================================== */}
        {selectedNode ? (
          <div className="space-y-4">
            {/* Header Status Node */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {selectedNode.label || "Simbol Flowchart"}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Tipe: {selectedNode.type}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDuplicateNode?.(selectedNode.id)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title="Duplikat Simbol (Ctrl+D)"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onBringToFront?.(selectedNode.id)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title="Bawa ke Paling Depan"
                >
                  <BringToFront className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onSendToBack?.(selectedNode.id)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title="Kirim ke Paling Belakang"
                >
                  <SendToBack className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 1. Warna Isi (Fill Color) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Paintbrush className="w-3.5 h-3.5 text-indigo-500" />
                Warna Isi (Fill)
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => onUpdateNodeFillColor?.(selectedNode.id, preset.hex)}
                    style={{ backgroundColor: preset.hex }}
                    className={`w-5 h-5 rounded-md border transition cursor-pointer hover:scale-110 shadow-2xs ${
                      selectedNode.fillColor === preset.hex
                        ? "ring-2 ring-indigo-500 border-white"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                    title={preset.name}
                  />
                ))}
                {/* Custom Color Input */}
                <label
                  className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:scale-110 overflow-hidden bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500"
                  title="Warna Khusus"
                >
                  <input
                    type="color"
                    value={selectedNode.fillColor || "#4f46e5"}
                    onChange={(e) => onUpdateNodeFillColor?.(selectedNode.id, e.target.value)}
                    className="opacity-0 w-0 h-0"
                  />
                </label>
              </div>
            </div>

            {/* 2. Warna Garis & Ketebalan Garis (Stroke) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Garis Border
              </label>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => onUpdateNodeStrokeColor?.(selectedNode.id, preset.hex)}
                    style={{ backgroundColor: preset.hex }}
                    className={`w-5 h-5 rounded-md border transition cursor-pointer hover:scale-110 shadow-2xs ${
                      selectedNode.strokeColor === preset.hex
                        ? "ring-2 ring-indigo-500 border-white"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                    title={preset.name}
                  />
                ))}
                <label
                  className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:scale-110 overflow-hidden bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500"
                  title="Warna Khusus Border"
                >
                  <input
                    type="color"
                    value={selectedNode.strokeColor || "#3730a3"}
                    onChange={(e) => onUpdateNodeStrokeColor?.(selectedNode.id, e.target.value)}
                    className="opacity-0 w-0 h-0"
                  />
                </label>
              </div>

              {/* Ketebalan Border (1px, 2px, 3px, 4px) */}
              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
                {[1, 2, 3, 4].map((width) => (
                  <button
                    key={width}
                    type="button"
                    onClick={() => onUpdateNodeStrokeWidth?.(selectedNode.id, width)}
                    className={`py-1 text-center rounded-lg text-xs font-semibold transition cursor-pointer ${
                      (selectedNode.strokeWidth || (width === 2 ? 2 : 1.5)) === width
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {width}px
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Pengaturan Teks / Font */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-500" />
                Format Teks
              </label>

              {/* Ukuran Font & Perataan */}
              <div className="flex items-center gap-2">
                {/* Perataan Teks (Align Left, Center, Right) */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => onUpdateNodeTextAlign?.(selectedNode.id, "left")}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      selectedNode.textAlign === "left"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                    }`}
                    title="Rata Kiri"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateNodeTextAlign?.(selectedNode.id, "center")}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      (!selectedNode.textAlign || selectedNode.textAlign === "center")
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                    }`}
                    title="Rata Tengah"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateNodeTextAlign?.(selectedNode.id, "right")}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      selectedNode.textAlign === "right"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                    }`}
                    title="Rata Kanan"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Pilihan Ukuran Font */}
                <select
                  value={selectedNode.fontSize || 11}
                  onChange={(e) => onUpdateNodeFontSize?.(selectedNode.id, Number(e.target.value))}
                  className="flex-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value={10}>10px (Kecil)</option>
                  <option value={11}>11px (Standar)</option>
                  <option value={12}>12px (Sedang)</option>
                  <option value={14}>14px (Besar)</option>
                  <option value={16}>16px (Ekstra)</option>
                  <option value={18}>18px (Judul)</option>
                </select>
              </div>

              {/* Warna Font */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Warna Teks</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {TEXT_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => onUpdateNodeTextColor?.(selectedNode.id, preset.hex)}
                      style={{ backgroundColor: preset.hex }}
                      className={`w-5 h-5 rounded-md border transition cursor-pointer hover:scale-110 shadow-2xs ${
                        selectedNode.textColor === preset.hex
                          ? "ring-2 ring-indigo-500 border-white"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                      title={preset.name}
                    />
                  ))}
                  <label
                    className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:scale-110 overflow-hidden bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500"
                    title="Warna Khusus Teks"
                  >
                    <input
                      type="color"
                      value={selectedNode.textColor || "#ffffff"}
                      onChange={(e) => onUpdateNodeTextColor?.(selectedNode.id, e.target.value)}
                      className="opacity-0 w-0 h-0"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* 4. Dimensi & Posisi Info (Resize via Handle) */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 mb-1">
                <Maximize className="w-3.5 h-3.5 text-indigo-500" />
                Dimensi & Posisi (Resize via Handle)
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
                <div>W: <span className="font-bold">{Math.round(selectedNode.width)}px</span></div>
                <div>H: <span className="font-bold">{Math.round(selectedNode.height)}px</span></div>
                <div>X: <span className="font-bold">{Math.round(selectedNode.x)}px</span></div>
                <div>Y: <span className="font-bold">{Math.round(selectedNode.y)}px</span></div>
              </div>
            </div>

            {/* 5. Aksi Hapus Node */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onDeleteNode?.(selectedNode.id)}
                className="w-full py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Simbol Ini (Delete)
              </button>
            </div>
          </div>
        ) : selectedEdge ? (
          /* ======================================================== */
          /* KONDISI 2: GARIS ALUR TERPILIH (TAHAP 2 & 3)             */
          /* ======================================================== */
          <div className="space-y-4">
            {/* Header Status Garis */}
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                <GitFork className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Garis Alur Terpilih
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  {selectedEdge.sourcePort} → {selectedEdge.targetPort}
                </div>
              </div>
            </div>

            {/* 1. Tipe Jalur Garis (Routing) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Tipe Garis
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => onUpdateEdgeRouting?.(selectedEdge.id, "orthogonal")}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                    selectedEdge.routing === "orthogonal"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                  title="Garis Siku (Orthogonal)"
                >
                  <CornerDownRight className="w-3.5 h-3.5 mb-1" />
                  Siku
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateEdgeRouting?.(selectedEdge.id, "straight")}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                    selectedEdge.routing === "straight"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                  title="Garis Lurus (Straight)"
                >
                  <ArrowRight className="w-3.5 h-3.5 mb-1" />
                  Lurus
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateEdgeRouting?.(selectedEdge.id, "curved")}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                    selectedEdge.routing === "curved"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                  title="Garis Melengkung (Bézier)"
                >
                  <Spline className="w-3.5 h-3.5 mb-1" />
                  Lengkung
                </button>
              </div>
            </div>

            {/* 2. Bentuk Garis & Ketebalan Garis (Tahap 3) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Bentuk & Ketebalan Garis
              </label>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => onUpdateEdgeStyle?.(selectedEdge.id, "solid")}
                  className={`flex items-center justify-center gap-2 py-1.5 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    selectedEdge.style === "solid"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <span className="w-5 h-0.5 bg-current rounded-full" />
                  Solid
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateEdgeStyle?.(selectedEdge.id, "dashed")}
                  className={`flex items-center justify-center gap-2 py-1.5 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    selectedEdge.style === "dashed"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <span className="w-5 border-t-2 border-dashed border-current" />
                  Putus-Putus
                </button>
              </div>

              {/* Selector Ketebalan Garis (Tahap 3) */}
              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
                {[1, 2, 3, 4].map((width) => (
                  <button
                    key={width}
                    type="button"
                    onClick={() => onUpdateEdgeStrokeWidth?.(selectedEdge.id, width)}
                    className={`py-1 text-center rounded-lg text-xs font-semibold transition cursor-pointer ${
                      (selectedEdge.strokeWidth || 2) === width
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {width}px
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Warna Garis (Tahap 3) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Warna Garis
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => onUpdateEdgeColor?.(selectedEdge.id, preset.hex)}
                    style={{ backgroundColor: preset.hex }}
                    className={`w-5 h-5 rounded-md border transition cursor-pointer hover:scale-110 shadow-2xs ${
                      selectedEdge.color === preset.hex
                        ? "ring-2 ring-indigo-500 border-white"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                    title={preset.name}
                  />
                ))}
                <label
                  className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:scale-110 overflow-hidden bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500"
                  title="Warna Khusus Garis"
                >
                  <input
                    type="color"
                    value={selectedEdge.color || "#64748b"}
                    onChange={(e) => onUpdateEdgeColor?.(selectedEdge.id, e.target.value)}
                    className="opacity-0 w-0 h-0"
                  />
                </label>
              </div>
            </div>

            {/* 4. Pilihan Ujung Panah (Marker) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Ujung Panah
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateEdgeMarker?.(selectedEdge.id, "arrow")}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition cursor-pointer text-center ${
                    selectedEdge.marker === "arrow"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  Panah Akhir (→)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateEdgeMarker?.(selectedEdge.id, "none")}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition cursor-pointer text-center ${
                    selectedEdge.marker === "none"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  Tanpa Panah (—)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateEdgeMarker?.(selectedEdge.id, "arrow-start")}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition cursor-pointer text-center ${
                    selectedEdge.marker === "arrow-start"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  Panah Awal (←)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateEdgeMarker?.(selectedEdge.id, "arrow-both")}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition cursor-pointer text-center ${
                    selectedEdge.marker === "arrow-both"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  Kedua Ujung (↔)
                </button>
              </div>
            </div>

            {/* 5. Label Garis (e.g. "Ya" / "Tidak") */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  Label Garis
                </label>
                {selectedEdge.label && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Ada Label
                  </span>
                )}
              </div>
              <input
                type="text"
                value={selectedEdge.label || ""}
                onChange={(e) => onUpdateEdgeLabel?.(selectedEdge.id, e.target.value)}
                placeholder="Misal: Ya, Tidak, OK, Error..."
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500"
              />

              {/* Tombol Preset Cepat */}
              <div className="flex flex-wrap gap-1">
                {["Ya", "Tidak", "True", "False", "OK", "Batal"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onUpdateEdgeLabel?.(selectedEdge.id, preset)}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
                {selectedEdge.label && (
                  <button
                    type="button"
                    onClick={() => onUpdateEdgeLabel?.(selectedEdge.id, "")}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 transition cursor-pointer"
                  >
                    Hapus Teks
                  </button>
                )}
              </div>
            </div>

            {/* 6. Tombol Hapus Garis */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onDeleteEdge?.(selectedEdge.id)}
                className="w-full py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Garis Ini (Delete)
              </button>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* KONDISI 3: TIDAK ADA ELEMEN TERPILIH                     */
          /* ======================================================== */
          <div className="py-8 space-y-2 text-center text-slate-400">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mx-auto text-slate-400">
              <Info className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Belum Ada Elemen Terpilih
            </div>
            <p className="text-[11px] text-slate-400 max-w-[210px] mx-auto leading-relaxed">
              Klik salah satu simbol atau garis alur pada kanvas untuk mengubah warna, ukuran, gaya, atau susunannya.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
