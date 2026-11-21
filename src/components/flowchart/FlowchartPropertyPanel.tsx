"use client";

import {
  SlidersHorizontal,
  Info,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  CornerDownRight,
  Spline,
  Trash2,
  Tag,
  GitFork,
  Check,
} from "lucide-react";
import type {
  FlowchartNode,
  FlowchartEdge,
  EdgeRoutingType,
  EdgeStyle,
  EdgeMarker,
} from "@/lib/flowchart-types";

interface FlowchartPropertyPanelProps {
  selectedNode: FlowchartNode | null;
  selectedEdge: FlowchartEdge | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUpdateEdgeRouting?: (id: string, routing: EdgeRoutingType) => void;
  onUpdateEdgeStyle?: (id: string, style: EdgeStyle) => void;
  onUpdateEdgeMarker?: (id: string, marker: EdgeMarker) => void;
  onUpdateEdgeLabel?: (id: string, label: string) => void;
  onDeleteEdge?: (id: string) => void;
}

export function FlowchartPropertyPanel({
  selectedNode,
  selectedEdge,
  isCollapsed,
  onToggleCollapse,
  onUpdateEdgeRouting,
  onUpdateEdgeStyle,
  onUpdateEdgeMarker,
  onUpdateEdgeLabel,
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
    <aside className="w-72 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 select-none transition-all">
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
        {/* KONDISI 1: GARIS ALUR TERPILIH (EDGES)                    */}
        {/* ======================================================== */}
        {selectedEdge ? (
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

            {/* 2. Bentuk Garis (Solid vs Dashed) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Bentuk Garis
              </label>
              <div className="grid grid-cols-2 gap-1.5">
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
            </div>

            {/* 3. Pilihan Ujung Panah (Marker) */}
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

            {/* 4. Label Garis (e.g. "Ya" / "Tidak") */}
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

            {/* 5. Tombol Hapus Garis */}
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
        ) : selectedNode ? (
          /* ======================================================== */
          /* KONDISI 2: NODE / SIMBOL TERPILIH                        */
          /* ======================================================== */
          <div className="space-y-3 w-full">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-200 dark:border-indigo-800/60">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {selectedNode.label || "Shape Terpilih"}
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                Tipe: {selectedNode.type}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 text-left space-y-1">
              <div>Lebar: <span className="font-mono font-bold">{Math.round(selectedNode.width)}px</span></div>
              <div>Tinggi: <span className="font-mono font-bold">{Math.round(selectedNode.height)}px</span></div>
              <div>Posisi X: <span className="font-mono font-bold">{Math.round(selectedNode.x)}px</span></div>
              <div>Posisi Y: <span className="font-mono font-bold">{Math.round(selectedNode.y)}px</span></div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
              💡 <strong>Tips Menghubungkan:</strong> Arahkan kursor ke titik biru di tepi simbol ini, lalu tarik garis ke simbol lain.
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
              Klik salah satu simbol atau garis alur pada kanvas untuk melihat dan mengatur propertinya.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
