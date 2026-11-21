"use client";

import { useState } from "react";
import {
  X,
  Download,
  FileImage,
  FileCode2,
  FileText,
  FileJson,
  Layers,
  Printer,
  Check,
} from "lucide-react";
import type {
  FlowchartNode,
  FlowchartEdge,
  CanvasViewport,
} from "@/lib/flowchart-types";
import {
  exportDiagramToPng,
  exportDiagramToSvg,
  exportDiagramToPdf,
  exportDiagramToJson,
  exportDiagramToMxGraphXml,
  triggerFileDownload,
  type ExportBackgroundOption,
} from "@/lib/flowchart-export";

interface FlowchartExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  viewport: CanvasViewport;
  defaultTitle?: string;
}

type ExportFormat = "png" | "svg" | "pdf" | "json" | "drawio";

export function FlowchartExportModal({
  isOpen,
  onClose,
  nodes,
  edges,
  viewport,
  defaultTitle = "Flowchart-Twintech",
}: FlowchartExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [background, setBackground] = useState<ExportBackgroundOption>("white");
  const [scale, setScale] = useState<number>(2); // 2x High-DPI
  const [filename, setFilename] = useState<string>(
    defaultTitle.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_")
  );
  const [isExporting, setIsExporting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecuteExport = async () => {
    setIsExporting(true);
    const cleanFilename = filename.trim() || "Flowchart";

    try {
      if (format === "png") {
        await exportDiagramToPng(nodes, edges, cleanFilename, {
          background,
          scale,
        });
        setSuccessToast("Berkas PNG High-DPI berhasil diunduh!");
      } else if (format === "svg") {
        exportDiagramToSvg(nodes, edges, cleanFilename, {
          background,
        });
        setSuccessToast("Berkas SVG Vektor berhasil diunduh!");
      } else if (format === "pdf") {
        await exportDiagramToPdf(nodes, edges, cleanFilename, {
          background,
        });
        setSuccessToast("Jendela cetak / simpan PDF dibuka!");
      } else if (format === "json") {
        exportDiagramToJson(nodes, edges, viewport, cleanFilename);
        setSuccessToast("Berkas JSON diagram berhasil diunduh!");
      } else if (format === "drawio") {
        const xml = exportDiagramToMxGraphXml(nodes, edges, cleanFilename);
        const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
        triggerFileDownload(blob, `${cleanFilename}.drawio`);
        setSuccessToast("Berkas XML drawio berhasil diunduh!");
      }

      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      alert("Gagal melakukan ekspor: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Ekspor Diagram Flowchart
              </h3>
              <p className="text-[11px] text-slate-400">
                Pilih format gambar, dokumen, atau data pertukaran diagram
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {/* 1. Format Ekspor */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
              Format Berkas
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setFormat("png")}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                  format === "png"
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <FileImage className="w-5 h-5 text-indigo-500" />
                <span className="text-xs">PNG</span>
                <span className="text-[9px] opacity-75">High-DPI</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("svg")}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                  format === "svg"
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <FileCode2 className="w-5 h-5 text-emerald-500" />
                <span className="text-xs">SVG</span>
                <span className="text-[9px] opacity-75">Vektor</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                  format === "pdf"
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <FileText className="w-5 h-5 text-red-500" />
                <span className="text-xs">PDF</span>
                <span className="text-[9px] opacity-75">Cetak</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("json")}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                  format === "json"
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <FileJson className="w-5 h-5 text-amber-500" />
                <span className="text-xs">JSON</span>
                <span className="text-[9px] opacity-75">Cadangan</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("drawio")}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                  format === "drawio"
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Layers className="w-5 h-5 text-purple-500" />
                <span className="text-xs">XML</span>
                <span className="text-[9px] opacity-75">mxGraph</span>
              </button>
            </div>
          </div>

          {/* 2. Opsi Background (Hanya relevan untuk PNG, SVG, PDF) */}
          {(format === "png" || format === "svg" || format === "pdf") && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                Latar Belakang (Background)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setBackground("white")}
                  className={`px-3 py-2.5 rounded-xl border text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                    background === "white"
                      ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 bg-white" />
                  <span>Putih</span>
                </button>

                {format !== "pdf" && (
                  <button
                    type="button"
                    onClick={() => setBackground("transparent")}
                    className={`px-3 py-2.5 rounded-xl border text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                      background === "transparent"
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-dashed border-indigo-400 bg-transparent" />
                    <span>Transparan</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setBackground("dark")}
                  className={`px-3 py-2.5 rounded-xl border text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                    background === "dark"
                      ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-700 bg-slate-900" />
                  <span>Tema Gelap</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Opsi Resolusi / Skala (Khusus PNG) */}
          {format === "png" && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                Resolusi Render (High-DPI)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScale(2)}
                  className={`px-3 py-2 rounded-xl border text-xs transition cursor-pointer ${
                    scale === 2
                      ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  2x Retina HD (Standar)
                </button>
                <button
                  type="button"
                  onClick={() => setScale(3)}
                  className={`px-3 py-2 rounded-xl border text-xs transition cursor-pointer ${
                    scale === 3
                      ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  3x Ultra HD (Cetak 300 DPI)
                </button>
              </div>
            </div>
          )}

          {/* 4. Nama Berkas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Nama Berkas
            </label>
            <div className="flex items-center">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Flowchart_Twintech"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <span className="ml-2 text-xs font-bold text-slate-400 shrink-0">
                .{format === "drawio" ? "drawio" : format === "json" ? "flowchart.json" : format}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            {nodes.length} simbol • {edges.length} garis alur
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecuteExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 disabled:opacity-50 transition cursor-pointer"
            >
              {successToast ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>{successToast}</span>
                </>
              ) : format === "pdf" ? (
                <>
                  <Printer className="w-4 h-4" />
                  <span>{isExporting ? "Memproses..." : "Cetak / Simpan PDF"}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{isExporting ? "Mengekspor..." : "Unduh Berkas"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
