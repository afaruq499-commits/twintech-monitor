"use client";

import { SlidersHorizontal, Info, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import type { FlowchartNode } from "@/lib/flowchart-types";

interface FlowchartPropertyPanelProps {
  selectedNode: FlowchartNode | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function FlowchartPropertyPanel({
  selectedNode,
  isCollapsed,
  onToggleCollapse,
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
    <aside className="w-64 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 select-none transition-all">
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

      {/* Konten Panel Properti (Kosong untuk Tahap 1) */}
      <div className="flex-1 p-5 flex flex-col items-center justify-center text-center">
        {selectedNode ? (
          <div className="space-y-3 w-full">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-200 dark:border-indigo-800/60">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
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
            <p className="text-[11px] text-slate-400 italic">
              Pengaturan warna, ukuran, dan konektor port akan diaktifkan pada tahap berikutnya.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-slate-400">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mx-auto text-slate-400">
              <Info className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Belum Ada Shape Terpilih
            </div>
            <p className="text-[11px] text-slate-400 max-w-[190px] leading-relaxed">
              Klik salah satu simbol pada canvas untuk melihat info elemen.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
