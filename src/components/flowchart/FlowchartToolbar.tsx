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
  Download,
  Upload,
  ArrowDownWideNarrow,
  ArrowRightLeft,
  LayoutTemplate,
} from "lucide-react";
import type { CanvasViewport } from "@/lib/flowchart-types";

interface FlowchartToolbarProps {
  viewport: CanvasViewport;
  diagramTitle?: string;
  onBackToList?: () => void;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  onManualSave?: () => void;
  onOpenExportModal?: () => void;
  onImportJsonFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAutoLayout?: (direction: "TB" | "LR") => void;
  onOpenTemplateModal?: () => void;
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
  onOpenExportModal,
  onImportJsonFile,
  onAutoLayout,
  onOpenTemplateModal,
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
    <header className="h-14 border-b border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#161822] px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 shrink-0 select-none transition-colors">
      {/* 1. Zona Kiri: Tombol Back, Judul & Status Auto-Save (Pinned) */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {onBackToList && (
          <button
            type="button"
            onClick={onBackToList}
            className="p-1.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition cursor-pointer"
            title="Kembali ke Daftar Diagram"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xs shrink-0">
          <Workflow className="w-4 h-4" />
        </div>
        <div className="min-w-0 max-w-[150px] sm:max-w-[200px] md:max-w-[260px]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight truncate">
              {diagramTitle || "Flowchart Studio"}
            </span>

            {/* Indikator Status Auto-Save */}
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="hidden sm:inline">Menyimpan...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="hidden sm:inline">Tersimpan</span>
              </span>
            )}
            {saveStatus === "error" && (
              <button
                type="button"
                onClick={onManualSave}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition cursor-pointer shrink-0"
                title="Gagal menyimpan ke cloud. Klik untuk coba lagi."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="hidden sm:inline">Gagal Simpan</span>
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {nodeCount} simbol • {edgeCount} garis
          </div>
        </div>
      </div>

      {/* 2. Zona Tengah: Alat Manipulasi Kanvas (Bisa Scroll Horizontal jika Layar Terbatas) */}
      <div className="flex-1 min-w-0 flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none px-1.5 py-1">
        {/* Undo & Redo (Tahap 4) */}
        <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5 sm:p-1 text-xs shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Urungkan / Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Ulangi / Redo (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Clipboard & Multi-Select (Tahap 4) */}
        <div className="hidden md:flex items-center bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5 sm:p-1 text-xs shrink-0">
          <button
            type="button"
            onClick={onCut}
            disabled={!hasSelection}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Potong / Cut (Ctrl+X)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={!hasSelection}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Salin / Copy (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onPaste}
            disabled={!canPaste}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Tempel / Paste (Ctrl+V)"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onSelectAll}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Pilih Semua / Select All (Ctrl+A)"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Susunan & Duplikat */}
        <div className="hidden lg:flex items-center bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5 sm:p-1 text-xs shrink-0">
          <button
            type="button"
            onClick={onDuplicateSelected}
            disabled={!hasSelectedNode}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Duplikat Simbol Terpilih (Ctrl+D)"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-500" />
          </button>
          <button
            type="button"
            onClick={onBringToFront}
            disabled={!hasSelectedNode}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Bawa ke Paling Depan"
          >
            <BringToFront className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onSendToBack}
            disabled={!hasSelectedNode}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Kirim ke Paling Belakang"
          >
            <SendToBack className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Auto-Layout Hierarkis Dagre (Tahap 7 - Undoable) */}
        {onAutoLayout && (
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5 sm:p-1 text-xs shrink-0">
            <button
              type="button"
              onClick={() => onAutoLayout("TB")}
              disabled={nodeCount === 0}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
              title="Tata Otomatis Vertikal / Auto-Layout TB (Bisa di-undo)"
            >
              <ArrowDownWideNarrow className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden xl:inline text-[11px] font-semibold">Vertikal</span>
            </button>
            <button
              type="button"
              onClick={() => onAutoLayout("LR")}
              disabled={nodeCount === 0}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
              title="Tata Otomatis Horizontal / Auto-Layout LR (Bisa di-undo)"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden xl:inline text-[11px] font-semibold">Horizontal</span>
            </button>
          </div>
        )}

        {/* Template Diagram Cepat (Tahap 7) */}
        {onOpenTemplateModal && (
          <button
            type="button"
            onClick={onOpenTemplateModal}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
            title="Pilih Template Diagram Siap Pakai"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden md:inline">Template</span>
          </button>
        )}

        {/* Toggle Grid & Magnet Snap */}
        <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5 sm:p-1 text-xs shrink-0">
          <button
            type="button"
            onClick={onToggleGrid}
            className={`p-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer ${
              showGrid
                ? "bg-white dark:bg-[#161822] text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
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
                ? "bg-white dark:bg-[#161822] text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
            title="Snap ke Grid & Alignment Guides"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">Snap</span>
          </button>
        </div>

        {/* Kontrol Zoom & Fit */}
        <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 rounded-xl p-0.5 sm:p-1 text-xs shrink-0">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Zoom Out (-15%)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            className="px-1.5 sm:px-2 py-1 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
            title="Reset Zoom ke 100%"
          >
            {Math.round(viewport.zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Zoom In (+15%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-slate-200 dark:border-white/10 mx-0.5" />
          <button
            type="button"
            onClick={onFitToScreen}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Pas ke Layar / Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tombol Hapus Elemen Terpilih */}
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={!hasSelection}
          className={`p-1.5 sm:p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer shrink-0 ${
            hasSelection
              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 hover:bg-rose-100"
              : "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-white/[0.04] text-slate-400 border-slate-200/80 dark:border-white/10"
          }`}
          title="Hapus Simbol atau Garis Terpilih (Delete / Backspace)"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Hapus</span>
        </button>

        {/* Tombol Clear All Canvas */}
        <button
          type="button"
          onClick={onClearAll}
          disabled={nodeCount === 0 && edgeCount === 0}
          className="p-1.5 sm:p-2 rounded-xl border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          title="Kosongkan Seluruh Kanvas"
        >
          <Trash className="w-4 h-4" />
        </button>
      </div>

      {/* 3. Zona Kanan: Aksi Utama (Simpan, Impor, Ekspor) - Selalu Pinned & Terlihat Penuh */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pl-2 sm:pl-3 border-l border-slate-200/80 dark:border-white/10">
        {/* Tombol Simpan Manual (Ctrl+S) */}
        {onManualSave && (
          <button
            type="button"
            onClick={onManualSave}
            disabled={saveStatus === "saving"}
            className="p-1.5 sm:p-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-40 transition cursor-pointer shrink-0"
            title="Simpan Sekarang (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Tombol Impor JSON */}
        {onImportJsonFile && (
          <label
            className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
            title="Impor Berkas JSON (.flowchart.json)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Impor</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={onImportJsonFile}
              className="hidden"
            />
          </label>
        )}

        {/* Tombol Ekspor Diagram */}
        {onOpenExportModal && (
          <button
            type="button"
            onClick={onOpenExportModal}
            disabled={nodeCount === 0}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            title="Ekspor Diagram (PNG, SVG, PDF, JSON, XML mxGraph)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="inline font-bold">Ekspor</span>
          </button>
        )}
      </div>
    </header>
  );
}
