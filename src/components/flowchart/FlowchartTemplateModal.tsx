"use client";

import { X, ArrowRight, LayoutTemplate } from "lucide-react";
import { ALL_FLOWCHART_TEMPLATES, type FlowchartTemplate } from "@/lib/flowchart-templates";

export interface FlowchartTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: FlowchartTemplate) => void;
}

export function FlowchartTemplateModal({
  isOpen,
  onClose,
  onSelectTemplate,
}: FlowchartTemplateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
        className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-all select-none scale-in-95"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <h3 id="template-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                Pilih Template Diagram
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mulai cepat dengan susunan diagram standar industri yang siap pakai
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {ALL_FLOWCHART_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => {
                onSelectTemplate(tmpl);
                onClose();
              }}
              className="text-left flex flex-col justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 hover:shadow-lg transition-all group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {tmpl.badge}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {tmpl.nodes.length} node
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {tmpl.name}
                </h4>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <span>Terapkan</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
