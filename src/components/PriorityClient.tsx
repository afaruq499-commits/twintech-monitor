"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  type ProjectPriority,
  type ProjectStatus,
} from "@/lib/constants";
import { formatTanggalId } from "@/lib/date-utils";
import type { RankedProjectPriority } from "@/lib/priority/score";

export function PriorityClient({
  initialRanked,
}: {
  initialRanked: RankedProjectPriority[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialRanked);
  const [busy, setBusy] = useState(false);

  const hasManualOverride = items.some((i) => i.isManualOverride);

  async function moveItem(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const copy = [...items];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);

    const renumbered = copy.map((it, idx) => ({
      ...it,
      rank: idx + 1,
      isManualOverride: true,
    }));
    setItems(renumbered);

    setBusy(true);
    try {
      await fetch("/api/priority/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedIds: renumbered.map((r) => r.project.id),
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleResetAuto() {
    setBusy(true);
    try {
      const res = await fetch("/api/priority/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Prioritas Pengerjaan Minggu Ini
          </h1>
          <p className="text-sm text-slate-600">
            Diurutkan otomatis berdasarkan kedekatan deadline, level prioritas,
            dan kesiapan komponen (komponen lengkap naik). Gunakan panah untuk
            override manual.
          </p>
        </div>

        {hasManualOverride && (
          <button
            type="button"
            disabled={busy}
            onClick={handleResetAuto}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset ke Urutan Otomatis
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="v14-card rounded-[24px] p-10 text-center text-sm text-slate-500">
          Tidak ada proyek aktif untuk diurutkan.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.project.id}
              className={`v14-card v14-card-interactive rounded-[24px] p-4 sm:p-5 ${
                item.isDeadlineRisk ? "ring-1 ring-rose-400/50" : ""
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div
                      className="w-10 h-10 rounded-xl text-white font-extrabold text-base flex items-center justify-center shadow-xs"
                      style={{
                        backgroundColor: item.project.warna ?? "#0f172a",
                      }}
                    >
                      #{idx + 1}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0 || busy}
                        onClick={() => moveItem(idx, -1)}
                        className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        title="Naikkan urutan"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1 || busy}
                        onClick={() => moveItem(idx, 1)}
                        className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        title="Turunkan urutan"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.project.kode && (
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-xs font-mono font-bold">
                          {item.project.kode}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold">
                        {
                          PROJECT_STATUS_LABELS[
                            item.project.status as ProjectStatus
                          ]
                        }
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-xs font-bold">
                        Prioritas{" "}
                        {
                          PROJECT_PRIORITY_LABELS[
                            item.project.prioritas as ProjectPriority
                          ]
                        }
                      </span>
                      {item.isManualOverride ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                          Urutan Manual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                          <Sparkles className="w-3 h-3" /> Skor Otomatis:{" "}
                          {item.autoScore}
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/proyek/${item.project.id}`}
                      className="block mt-1.5 text-base sm:text-lg font-extrabold text-slate-900 hover:text-blue-600"
                    >
                      {item.project.nama}
                    </Link>

                    <div className="text-xs font-semibold text-slate-600 mt-0.5">
                      Client: {item.project.client} • Deadline:{" "}
                      <strong className="text-slate-900">
                        {formatTanggalId(item.project.deadline, false)}
                      </strong>
                    </div>

                    {/* Alasan Urutan */}
                    <div className="mt-2.5 inline-block px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold">
                      Alasan urutan: {item.reasonSummary}
                    </div>

                    {/* Peringatan Risiko Deadline < 7 Hari */}
                    {item.isDeadlineRisk && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-rose-700">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          Berisiko Terlambat (&lt; 7 hari):{" "}
                          {item.riskReasons.join("; ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Komponen Ringkas */}
                <div className="sm:w-48 shrink-0">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-600">Kesiapan Komponen</span>
                    <span className="text-slate-900">
                      {item.componentReadinessPct}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${item.componentReadinessPct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 text-right">
                    {item.totalComponents > 0
                      ? `${item.arrivedComponents}/${item.totalComponents} datang`
                      : "Tanpa daftar PR"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
