"use client";

import { AlertTriangle, Ban, CalendarCheck, GitFork, X } from "lucide-react";
import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from "@/lib/constants";
import { formatTanggalId } from "@/lib/date-utils";

export interface ConflictModalState {
  message: string;
  suggestions: {
    tanggal: string;
    label: string;
    selisihHari: number;
  }[];
  onPickSuggestion?: (tanggal: string) => void;
  onForceParallel?: () => void;
}

export interface ComponentWarningModalState {
  message: string;
  scope: "LINKED" | "PROJECT" | "NONE";
  missingComponents: {
    id: string;
    kelompok: string;
    partType: string;
    partName: string;
    qty: number;
    unit: string | null;
    statusPembelian: PurchaseStatus;
    estimasiTiba: string | null;
  }[];
  onConfirmSave: () => void;
}

export function ScheduleFeedbackModals({
  conflict,
  onCloseConflict,
  warning,
  onCloseWarning,
  busy = false,
}: {
  conflict: ConflictModalState | null;
  onCloseConflict: () => void;
  warning: ComponentWarningModalState | null;
  onCloseWarning: () => void;
  busy?: boolean;
}) {
  return (
    <>
      {/* Modal Blokir Konflik Tanggal + 3 Saran Tanggal Kosong Terdekat */}
      {conflict && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border-2 border-rose-500 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-rose-600 text-white">
              <div className="flex items-center gap-2.5 font-bold text-base">
                <Ban className="w-5 h-5 shrink-0" />
                <span>Jadwal Bentrok — Penyimpanan Diblokir</span>
              </div>
              <button
                type="button"
                onClick={onCloseConflict}
                className="p-1 rounded-lg hover:bg-rose-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-semibold text-rose-900 whitespace-pre-line leading-relaxed">
                {conflict.message}
              </div>

              {conflict.suggestions.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    3 Saran Tanggal Kosong Terdekat:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {conflict.suggestions.map((s) => (
                      <button
                        key={s.tanggal}
                        type="button"
                        disabled={busy || !conflict.onPickSuggestion}
                        onClick={() => conflict.onPickSuggestion?.(s.tanggal)}
                        className="flex flex-col items-start p-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-left transition cursor-pointer disabled:opacity-60"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                          <CalendarCheck className="w-3.5 h-3.5" />
                          <span>
                            {s.selisihHari > 0
                              ? `+${s.selisihHari} hari`
                              : `${s.selisihHari} hari`}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-900 mt-1">
                          {s.label}
                        </div>
                      </button>
                    ))}
                  </div>
                  {conflict.onPickSuggestion && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      Klik salah satu tanggal di atas untuk langsung menjadwalkan
                      ke tanggal kosong tersebut.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                {conflict.onForceParallel ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={conflict.onForceParallel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
                  >
                    <GitFork className="w-4 h-4" />
                    Tetap Jadwalkan Paralel di Hari Ini
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={onCloseConflict}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Warning Komponen Belum Lengkap (Tidak Memblokir — Konfirmasi User) */}
      {warning && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white border-2 border-amber-500 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 bg-amber-500 text-slate-950">
              <div className="flex items-center gap-2.5 font-bold text-base">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Peringatan: Komponen Belum Lengkap</span>
              </div>
              <button
                type="button"
                onClick={onCloseWarning}
                className="p-1 rounded-lg hover:bg-amber-600/30 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-sm font-medium text-amber-950">
                {warning.message}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold">
                    <tr>
                      <th className="text-left px-3 py-2">Komponen</th>
                      <th className="text-left px-3 py-2">Kelompok</th>
                      <th className="text-center px-2 py-2">Qty</th>
                      <th className="text-left px-3 py-2">Status Saat Ini</th>
                      <th className="text-left px-3 py-2">Estimasi Tiba</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {warning.missingComponents.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">
                            {c.partName}
                          </div>
                          <div className="text-slate-500">{c.partType}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {c.kelompok}
                        </td>
                        <td className="px-2 py-2 text-center font-medium">
                          {c.qty} {c.unit ?? ""}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                            {PURCHASE_STATUS_LABELS[c.statusPembelian]}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-700">
                          {c.estimasiTiba
                            ? formatTanggalId(c.estimasiTiba, false)
                            : "Belum ada ETA"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={onCloseWarning}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={warning.onConfirmSave}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {busy ? "Menyimpan..." : "Tetap Simpan Jadwal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
