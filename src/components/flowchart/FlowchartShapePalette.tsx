"use client";

import { useState } from "react";
import {
  CirclePlay,
  Square,
  Diamond,
  FileInput,
  Boxes,
  Database,
  FileText,
  CircleDot,
  StickyNote,
  Search,
  Shapes,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { FlowchartShapeType, PaletteShapeDefinition } from "@/lib/flowchart-types";

export const SHAPE_DEFINITIONS: PaletteShapeDefinition[] = [
  {
    type: "start_end",
    name: "Start / End",
    description: "Titik awal atau akhir dari sebuah alur proses (Terminator)",
    defaultWidth: 140,
    defaultHeight: 52,
    defaultLabel: "Start / End",
  },
  {
    type: "process",
    name: "Process",
    description: "Operasi, perhitungan, atau langkah proses mesin standar",
    defaultWidth: 150,
    defaultHeight: 64,
    defaultLabel: "Process Step",
  },
  {
    type: "decision",
    name: "Decision",
    description: "Percabangan kondisi logika sensor / hasil pengujian (Ya / Tidak)",
    defaultWidth: 130,
    defaultHeight: 80,
    defaultLabel: "Decision?",
  },
  {
    type: "input_output",
    name: "Input / Output",
    description: "Operasi baca sinyal input sensor atau pengaktifan output aktuator",
    defaultWidth: 145,
    defaultHeight: 56,
    defaultLabel: "Data / I-O",
  },
  {
    type: "subprocess",
    name: "Subprocess",
    description: "Rangkaian proses sekuens yang telah didefinisikan di tempat lain",
    defaultWidth: 155,
    defaultHeight: 64,
    defaultLabel: "Subroutine",
  },
  {
    type: "database",
    name: "Database",
    description: "Penyimpanan data, memori register PLC, atau resep produksi",
    defaultWidth: 120,
    defaultHeight: 70,
    defaultLabel: "Database",
  },
  {
    type: "document",
    name: "Document",
    description: "Pencetakan laporan, berkas inspeksi, atau pencatatan dokumen",
    defaultWidth: 135,
    defaultHeight: 65,
    defaultLabel: "Document",
  },
  {
    type: "connector",
    name: "Connector",
    description: "Konektor lompatan alur dalam halaman yang sama",
    defaultWidth: 46,
    defaultHeight: 46,
    defaultLabel: "A",
  },
  {
    type: "note",
    name: "Note / Catatan",
    description: "Catatan penjelas, instruksi teknis, atau pengingat sinyal I/O",
    defaultWidth: 140,
    defaultHeight: 60,
    defaultLabel: "Catatan Teknis",
  },
];

interface FlowchartShapePaletteProps {
  onAddShape: (def: PaletteShapeDefinition) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function FlowchartShapePalette({
  onAddShape,
  isCollapsed = false,
  onToggleCollapse,
}: FlowchartShapePaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredShapes = SHAPE_DEFINITIONS.filter((shape) =>
    shape.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shape.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getShapeIcon = (type: FlowchartShapeType) => {
    switch (type) {
      case "start_end":
        return <CirclePlay className="w-5 h-5 text-blue-500" />;
      case "process":
        return <Square className="w-5 h-5 text-slate-500 dark:text-slate-300" />;
      case "decision":
        return <Diamond className="w-5 h-5 text-indigo-500" />;
      case "input_output":
        return <FileInput className="w-5 h-5 text-emerald-500" />;
      case "subprocess":
        return <Boxes className="w-5 h-5 text-amber-500" />;
      case "database":
        return <Database className="w-5 h-5 text-teal-500" />;
      case "document":
        return <FileText className="w-5 h-5 text-sky-500" />;
      case "connector":
        return <CircleDot className="w-5 h-5 text-purple-500" />;
      case "note":
        return <StickyNote className="w-5 h-5 text-yellow-500" />;
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, def: PaletteShapeDefinition) => {
    const payload = JSON.stringify({
      type: def.type,
      defaultWidth: def.defaultWidth,
      defaultHeight: def.defaultHeight,
      defaultLabel: def.defaultLabel,
    });
    e.dataTransfer.setData("application/json", payload);
    e.dataTransfer.effectAllowed = "copy";
  };

  if (isCollapsed) {
    return (
      <aside className="w-14 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center shrink-0 select-none py-3 gap-2 transition-all">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Buka Palet Simbol"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        <div className="w-6 h-px bg-slate-200 dark:bg-slate-800 my-1" />
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center gap-1.5 w-full px-2">
          {SHAPE_DEFINITIONS.map((def) => (
            <div
              key={def.type}
              draggable
              onDragStart={(e) => handleDragStart(e, def)}
              onClick={() => onAddShape(def)}
              className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs transition cursor-grab active:cursor-grabbing shrink-0"
              title={`${def.name}: ${def.description}`}
            >
              {getShapeIcon(def.type)}
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 select-none transition-all">
      {/* Header Panel */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shapes className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-wide uppercase">
            Palet Bentuk
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {SHAPE_DEFINITIONS.length}
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Kecilkan Palet"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Input Pencarian */}
      <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari simbol..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Petunjuk Drag & Drop */}
      <div className="px-3 pt-2 text-[10px] text-slate-400 italic">
        Tarik ke canvas atau klik untuk menambahkan
      </div>

      {/* Daftar Shape */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {filteredShapes.map((def) => (
          <div
            key={def.type}
            draggable
            onDragStart={(e) => handleDragStart(e, def)}
            onClick={() => onAddShape(def)}
            className="group flex items-center gap-3 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs transition cursor-grab active:cursor-grabbing"
            title={`${def.name}: ${def.description}`}
          >
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              {getShapeIcon(def.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {def.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {def.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
