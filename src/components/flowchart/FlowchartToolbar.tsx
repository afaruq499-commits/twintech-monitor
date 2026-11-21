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
  Copy,
  Scissors,
  ClipboardPaste,
  Undo2,
  Redo2,
  CheckSquare,
  BringToFront,
  SendToBack,
  ArrowLeft,
  Save,
} from "lucide-react";
import type { CanvasViewport } from "@/lib/flowchart-types";

interface FlowchartToolbarProps {
  viewport: CanvasViewport;
  diagramTitle?: string;
  onBackToList?: () => void;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  onManualSave?: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitToScreen: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  hasSelection: boolean;
  hasSelectedNode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onDuplicateSelected: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  nodeCount: number;
  edgeCount: number;
}

export function FlowchartToolbar({
  viewport,
  diagramTitle,
  onBackToList,
  saveStatus,
  onManualSave,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToScreen,
  showGrid,
  onToggleGrid,
  snapToGrid,
  onToggleSnap,
  hasSelection,
  hasSelectedNode,
  canUndo,
  canRedo,
  canPaste,
  onUndo,
  onRedo,
  onCopy,
  onCut,
  onPaste,
  onSelectAll,
  onDuplicateSelected,
  onBringToFront,
  onSendToBack,
  onDeleteSelected,
  onClearAll,
  nodeCount,
  edgeCount,
}: FlowchartToolbarProps) {
  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between gap-4 shrink-0 select-none transition-colors">
      {/* Kiri: Tombol Back, Judul & Status Save */}
      <div className="flex items-center gap-3">
        {onBackToList && (
          <button
            type="button"
            onClick={onBackToList}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition cursor-pointer"
            title="Kembali ke Daftar Diagram"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xs">
          <Workflow className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight truncate max-w-[180px] sm:max-w-[280px]">
              {diagramTitle || "Flowchart Studio"}
            </span>

            {/* Indikator Status Auto-Save (Tahap 5) */}
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Menyimpan...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Tersimpan
              </span>
            )}
            {saveStatus === "error" && (
              <button
                type="button"
                onClick={onManualSave}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition cursor-pointer"
                title="Gagal menyimpan ke cloud. Klik untuk coba lagi."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Gagal Simpan (Coba Lagi)
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            {nodeCount} simbol • {edgeCount} garis • Auto-save aktif
          </div>
        </div>
      </div>

      {/* Tengah / Kanan: Kontrol Undo/Redo, Clipboard, Zoom, Grid, Snap, Aksi */}
      <div className="flex items-center gap-2">
        {/* Tombol Simpan Manual (Ctrl+S) */}
        {onManualSave && (
          <button
            type="button"
            onClick={onManualSave}
            disabled={saveStatus === "saving"}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 disabled:opacity-40 transition cursor-pointer"
            title="Simpan Sekarang (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        )}
        {/* 1. Kontrol Undo & Redo (Tahap 4) */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 text-xs">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Urungkan / Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Ulangi / Redo (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. Kontrol Clipboard & Edit (Tahap 4) */}
        <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 text-xs">
          <button
            type="button"
            onClick={onCut}
            disabled={!hasSelection}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Potong / Cut (Ctrl+X)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={!hasSelection}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Salin / Copy (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onPaste}
            disabled={!canPaste}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Tempel / Paste (Ctrl+V)"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onSelectAll}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Pilih Semua / Select All (Ctrl+A)"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3. Kontrol Susunan & Duplikat */}
        <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 text-xs">
          <button
            type="button"
            onClick={onDuplicateSelected}
            disabled={!hasSelectedNode}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Duplikat Simbol Terpilih (Ctrl+D)"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-500" />
          </button>
          <button
            type="button"
            onClick={onBringToFront}
            disabled={!hasSelectedNode}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Bawa ke Paling Depan"
          >
            <BringToFront className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onSendToBack}
            disabled={!hasSelectedNode}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Kirim ke Paling Belakang"
          >
            <SendToBack className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4. Toggle Grid & Magnet Snap */}
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
            <span className="hidden xl:inline text-[11px]">Grid</span>
          </button>
          <button
            type="button"
            onClick={onToggleSnap}
            className={`p-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer ${
              snapToGrid
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
            title="Snap ke Grid & Alignment Guides"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">Snap</span>
          </button>
        </div>

        {/* 5. Kontrol Zoom & Fit */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 text-xs">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Zoom Out (-15%)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            className="px-2 py-1 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
            title="Reset Zoom ke 100%"
          >
            {Math.round(viewport.zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Zoom In (+15%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={onFitToScreen}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Pas ke Layar / Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 6. Tombol Hapus Elemen Terpilih */}
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={!hasSelection}
          className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
            hasSelection
              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 hover:bg-rose-100"
              : "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-800"
          }`}
          title="Hapus Simbol atau Garis Terpilih (Delete / Backspace)"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Hapus</span>
        </button>

        {/* 7. Tombol Clear All Canvas */}
        <button
          type="button"
          onClick={onClearAll}
          disabled={nodeCount === 0 && edgeCount === 0}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Kosongkan Seluruh Kanvas"
        >
          <Trash className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
