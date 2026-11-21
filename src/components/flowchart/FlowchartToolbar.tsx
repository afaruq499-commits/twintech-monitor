"use client";

import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Trash2,
  Workflow,
  Magnet,
  Trash,
} from "lucide-react";
import type { CanvasViewport } from "@/lib/flowchart-types";

interface FlowchartToolbarProps {
  viewport: CanvasViewport;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitToScreen: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  hasSelectedNode: boolean;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  nodeCount: number;
}

export function FlowchartToolbar({
  viewport,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToScreen,
  showGrid,
  onToggleGrid,
  snapToGrid,
  onToggleSnap,
  hasSelectedNode,
  onDeleteSelected,
  onClearAll,
  nodeCount,
}: FlowchartToolbarProps) {
  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between gap-4 shrink-0 select-none transition-colors">
      {/* Kiri: Judul & Status */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xs">
          <Workflow className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              Flowchart Studio
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Native SVG
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {nodeCount} simbol pada canvas • Dobel-klik teks untuk mengedit
          </div>
        </div>
      </div>

      {/* Tengah / Kanan: Kontrol Zoom, Grid, Snap, Aksi */}
      <div className="flex items-center gap-2">
        {/* Toggle Grid & Magnet Snap */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 text-xs">
          <button
            type="button"
            onClick={onToggleGrid}
            className={`p-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer ${
              showGrid
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
            title="Tampilkan / Sembunyikan Grid"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Grid</span>
          </button>
          <button
            type="button"
            onClick={onToggleSnap}
            className={`p-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer ${
              snapToGrid
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
            title="Snap ke Grid (Kelipatan 10px)"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Snap</span>
          </button>
        </div>

        {/* Kontrol Zoom & Fit */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 text-xs">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Perkecil Zoom (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            className="px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded transition cursor-pointer"
            title="Klik untuk reset zoom ke 100%"
          >
            {Math.round(viewport.zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Perbesar Zoom (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={onFitToScreen}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition cursor-pointer flex items-center gap-1 font-semibold text-[11px]"
            title="Pusatkan dan sesuaikan seluruh diagram ke layar (Fit to screen)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Fit to Screen</span>
          </button>
        </div>

        {/* Hapus Shape Terpilih */}
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={!hasSelectedNode}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
          title="Hapus shape yang sedang dipilih (Tombol Del)"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Reset / Clear All */}
        {nodeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition cursor-pointer"
            title="Bersihkan seluruh kanvas"
          >
            <Trash className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
