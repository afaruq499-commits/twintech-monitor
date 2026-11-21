"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, HelpCircle, X } from "lucide-react";

export interface FlowchartConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export function FlowchartConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  variant = "danger",
  onConfirm,
  onCancel,
}: FlowchartConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter") {
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  const isDanger = variant === "danger";
  const isWarning = variant === "warning";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-all select-none scale-in-95"
      >
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-2xl shrink-0 ${
              isDanger
                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                : isWarning
                ? "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                : "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
            }`}
          >
            {isDanger ? (
              <Trash2 className="w-6 h-6" />
            ) : isWarning ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <HelpCircle className="w-6 h-6" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              id="confirm-modal-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug"
            >
              {title}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition cursor-pointer ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
                : isWarning
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/30"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
