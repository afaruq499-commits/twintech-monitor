"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  Calculator,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Monitor,
  Network,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import type { CatalogComponentDTO } from "@/lib/catalog-queries";
import { formatRupiah } from "@/lib/date-utils";
import {
  recommendComponentsWithMl,
  type HistoricalProjectSample,
  type MlRecommendationResult,
  type RecommendedPrComponent,
} from "@/lib/ml-recommender";

const QUICK_EXAMPLES = [
  "3 valve, 1 robot Yasakawa tipe a, dan 2 motor servo seri b",
  "4 valve pneumatik, 6 sensor proximity, 1 light curtain",
  "2 robot Fanuc, 4 motor servo, 8 solenoid valve, 1 motor vacuum 3 phase",
  "2 motor conveyor inverter, 3 heater sealing, 4 photoelectric sensor",
];

export interface MlRecommenderPanelProps {
  description: string;
  onDescriptionChange: (val: string) => void;
  catalog: CatalogComponentDTO[];
  historicalSamples?: HistoricalProjectSample[];
  onApplyItems?: (items: RecommendedPrComponent[]) => void;
  applyButtonLabel?: string;
  onSaveDescriptionOnly?: (val: string) => Promise<void> | void;
  savingDescription?: boolean;
}

export function MlRecommenderPanel({
  description,
  onDescriptionChange,
  catalog,
  historicalSamples = [],
  onApplyItems,
  applyButtonLabel = "Masukkan Rekomendasi Terpilih ke Daftar PR",
  onSaveDescriptionOnly,
  savingDescription = false,
}: MlRecommenderPanelProps) {
  const [serverResult, setServerResult] =
    useState<MlRecommendationResult | null>(null);
  const [analyzingServer, setAnalyzingServer] = useState(false);
  const [uncheckedKeys, setUncheckedKeys] = useState<Record<string, boolean>>(
    {}
  );
  const [appliedToast, setAppliedToast] = useState<string | null>(null);
  const [showPlcDetails, setShowPlcDetails] = useState(false);
  const [showHmiDetails, setShowHmiDetails] = useState(false);

  // Kalkulasi ML lokal instan setiap kali deskripsi atau katalog berubah
  const liveResult = useMemo(() => {
    if (!description.trim()) return null;
    return recommendComponentsWithMl(description, catalog, historicalSamples);
  }, [description, catalog, historicalSamples]);

  const activeResult =
    serverResult && serverResult.inputDescription === description.trim()
      ? serverResult
      : liveResult;

  // Sinkronkan defaultChecked untuk item pendukung yang awalnya defaultChecked = false
  useEffect(() => {
    if (!activeResult) return;
    const defaults: Record<string, boolean> = {};
    for (const item of activeResult.allRecommendedItems) {
      if (!item.defaultChecked) {
        defaults[item.key] = true;
      }
    }
    setUncheckedKeys(defaults);
  }, [activeResult]);

  async function handleRunServerMl() {
    const clean = description.trim();
    if (!clean) return;
    setAnalyzingServer(true);
    setAppliedToast(null);
    try {
      const res = await fetch("/api/ml/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: clean }),
      });
      const data = await res.json();
      if (res.ok && data?.result) {
        setServerResult(data.result);
      }
    } catch {
      // Fallback tetap memakai liveResult lokal
    } finally {
      setAnalyzingServer(false);
    }
  }

  const selectedItems = useMemo(() => {
    if (!activeResult) return [];
    return activeResult.allRecommendedItems.filter(
      (item) => !uncheckedKeys[item.key]
    );
  }, [activeResult, uncheckedKeys]);

  const selectedEstimatedTotal = useMemo(() => {
    return selectedItems.reduce(
      (sum, it) => sum + (it.hargaSatuan ?? 0) * it.qty,
      0
    );
  }, [selectedItems]);

  function toggleItemCheck(key: string) {
    setUncheckedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function selectAllItems(selectSupportingToo: boolean) {
    if (!activeResult) return;
    if (selectSupportingToo) {
      setUncheckedKeys({});
    } else {
      const next: Record<string, boolean> = {};
      for (const item of activeResult.allRecommendedItems) {
        if (item.pillar === "PENDUKUNG") {
          next[item.key] = true;
        }
      }
      setUncheckedKeys(next);
    }
  }

  function handleApplySelected() {
    if (!onApplyItems || selectedItems.length === 0) return;
    onApplyItems(selectedItems);
    setAppliedToast(
      `${selectedItems.length} komponen hasil rekomendasi Machine Learning berhasil dimasukkan!`
    );
  }

  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 p-5 shadow-xs space-y-5">
      {/* Header Panel ML */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-extrabold mb-2">
            <BrainCircuit className="w-4 h-4" />
            MACHINE LEARNING — IDENTIFIKASI & SIZING KOMPONEN OTOMASI
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
            Deskripsi Singkat Komponen Inti Proyek
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Ketik perangkat utama yang dipakai (jumlah valve, merek/tipe robot,
            jumlah motor servo, sensor, inverter, heater, dll.) — Machine
            Learning akan merekomendasikan <strong>seri PSU</strong>,{" "}
            <strong>seri Safety Relay</strong>, <strong>jumlah Relay</strong>,{" "}
            <strong>tipe PLC</strong>, dan <strong>spek MCB</strong> yang cocok.
          </p>
        </div>

        {onSaveDescriptionOnly && (
          <button
            type="button"
            disabled={savingDescription}
            onClick={() => onSaveDescriptionOnly(description)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-300 bg-white hover:bg-indigo-50 text-indigo-800 text-xs sm:text-sm font-extrabold cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {savingDescription
              ? "Menyimpan..."
              : "Simpan Deskripsi Inti ke Proyek"}
          </button>
        )}
      </div>

      {/* Input Deskripsi Komponen Inti */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <textarea
            rows={2}
            value={description}
            onChange={(e) => {
              setAppliedToast(null);
              onDescriptionChange(e.target.value);
            }}
            placeholder='Contoh: "3 valve, 1 robot Yasakawa tipe a, dan 2 motor servo seri b"'
            className="flex-1 px-3.5 py-2.5 rounded-xl border-2 border-indigo-300 bg-white text-sm sm:text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
          <button
            type="button"
            disabled={!description.trim() || analyzingServer}
            onClick={handleRunServerMl}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold cursor-pointer shrink-0 disabled:opacity-50 shadow-xs"
          >
            {analyzingServer ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Analisis ML
          </button>
        </div>

        {/* Contoh Cepat 1-Klik */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-slate-500 mr-1">
            Contoh cepat (klik):
          </span>
          {QUICK_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setAppliedToast(null);
                onDescriptionChange(ex);
              }}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 font-semibold cursor-pointer transition text-left"
            >
              &ldquo;{ex}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* Hasil Analisis Machine Learning */}
      {activeResult && activeResult.entities.length === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs sm:text-sm text-amber-900 font-semibold">
          Belum terdeteksi kata kunci perangkat keras otomasi pada teks di atas.
          Sebutkan komponen inti seperti{" "}
          <em>
            valve / solenoid, robot (Yaskawa/Fanuc/ABB), motor servo, sensor
            proximity, inverter/conveyor, light curtain, atau heater
          </em>
          .
        </div>
      )}

      {activeResult && activeResult.entities.length > 0 && (
        <div className="space-y-4">
          {/* Bar Status Model ML, Entitas Terdeteksi, & Kemiripan k-NN */}
          <div className="rounded-xl bg-slate-900 text-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold">
                  Skor Kecocokan ML: {activeResult.mlMeta.confidencePct}%
                </span>
                <span className="text-xs text-slate-300 font-semibold">
                  {activeResult.mlMeta.algorithm} (
                  {activeResult.mlMeta.trainingSamplesCount} profil pelatihan
                  {activeResult.mlMeta.historicalSamplesCount > 0
                    ? `, termasuk ${activeResult.mlMeta.historicalSamplesCount} riwayat proyek Anda`
                    : ""}
                  )
                </span>
              </div>
            </div>

            {/* Chip Entitas Komponen Inti yang Dikenali NLP */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 mr-1">
                Perangkat Inti Terdeteksi:
              </span>
              {activeResult.entities.map((ent, idx) => (
                <span
                  key={`${ent.kind}-${idx}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/25 border border-indigo-400/40 text-white text-xs font-extrabold"
                >
                  <span className="text-amber-300">{ent.qty}x</span> {ent.label}
                </span>
              ))}
            </div>

            {/* Nearest Neighbors Explanation */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800 text-[11px] text-slate-300">
              <span className="font-bold text-slate-400">
                Referensi Terdekat (k-NN):
              </span>
              {activeResult.mlMeta.nearestProfiles.map((np, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-200"
                >
                  {np.title}{" "}
                  <strong className="text-amber-300">
                    ({np.similarityPct}%)
                  </strong>
                  {np.source === "RIWAYAT_PROYEK" ? " ★ Riwayat Anda" : ""}
                </span>
              ))}
            </div>
          </div>

          {/* ==================== 5 KARTU REKOMENDASI INTI ==================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. REKOMENDASI PSU */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                  <Zap className="w-3.5 h-3.5" /> 1. Rekomendasi Seri PSU (24VDC)
                </span>
                <span className="text-xs font-bold text-slate-600">
                  Beban ~{activeResult.summaryFivePillars.psu.activeLoadWatts}W
                  ({activeResult.summaryFivePillars.psu.activeCurrentAmps}A) →
                  Min{" "}
                  {activeResult.summaryFivePillars.psu.recommendedMinWatts}W
                </span>
              </div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900">
                {activeResult.summaryFivePillars.psu.headline}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {activeResult.summaryFivePillars.psu.reasoning}
              </p>
              <div className="text-[11px] text-indigo-700 bg-indigo-50/70 rounded-lg px-2.5 py-1.5 font-semibold">
                {activeResult.summaryFivePillars.psu.alternativeNote}
              </div>
            </div>

            {/* 2. REKOMENDASI SAFETY RELAY */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5" /> 2. Rekomendasi Safety
                  Relay
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {activeResult.summaryFivePillars.safetyRelay.safetyCategory}
                </span>
              </div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900">
                {activeResult.summaryFivePillars.safetyRelay.headline}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {activeResult.summaryFivePillars.safetyRelay.reasoning}
              </p>
              <div className="text-[11px] text-indigo-700 bg-indigo-50/70 rounded-lg px-2.5 py-1.5 font-semibold">
                {activeResult.summaryFivePillars.safetyRelay.alternativeNote}
              </div>
            </div>

            {/* 3. REKOMENDASI JUMLAH RELAY */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  <Layers className="w-3.5 h-3.5" /> 3. Jumlah Relay & Tipe
                  Socket
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-extrabold">
                  Total: {activeResult.summaryFivePillars.relay.totalRelayQty}{" "}
                  Relay
                </span>
              </div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900">
                {activeResult.summaryFivePillars.relay.headline}
              </div>
              <ul className="text-xs text-slate-700 space-y-1 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                {activeResult.summaryFivePillars.relay.breakdown.map(
                  (b, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <span>• {b.label}</span>
                      <strong className="font-mono text-slate-900">
                        {b.qty} pcs
                      </strong>
                    </li>
                  )
                )}
              </ul>
              <p className="text-[11px] text-slate-500">
                {activeResult.summaryFivePillars.relay.reasoning}
              </p>
            </div>

            {/* 4. PERHITUNGAN & REKOMENDASI PLC */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                  <Cpu className="w-3.5 h-3.5" /> 4. Perhitungan & Rekomendasi PLC
                </span>
                <span className="text-xs font-bold text-slate-600">
                  {activeResult.summaryFivePillars.plc.estimatedDi} DI /{" "}
                  {activeResult.summaryFivePillars.plc.estimatedDo} DO
                  {activeResult.summaryFivePillars.plc.highSpeedAxes > 0
                    ? ` • ${activeResult.summaryFivePillars.plc.highSpeedAxes} Axis Pulse`
                    : ""}
                </span>
              </div>

              <div className="text-sm sm:text-base font-extrabold text-slate-900">
                {activeResult.summaryFivePillars.plc.headline}
              </div>

              {/* Status Efisiensi Biaya (Tidak Beli Modul 64-Pin bila Cukup FX5U) */}
              {activeResult.summaryFivePillars.plc.calculation && (
                <div
                  className={`rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-2 ${
                    activeResult.summaryFivePillars.plc.calculation.selection
                      .family === "FX5U"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                      : "bg-blue-50 border border-blue-200 text-blue-900"
                  }`}
                >
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>
                    {activeResult.summaryFivePillars.plc.calculation.selection
                      .family === "FX5U"
                      ? "I/O cukup dengan seri FX5U — Hemat biaya & TIDAK membeli modul I/O 64-pin yang mahal!"
                      : "Arsitektur Modular MELSEC iQ-R — untuk multi-robot / ekspansi bus skala besar."}
                  </span>
                </div>
              )}

              {/* Ringkasan Matriks Perhitungan I/O */}
              {activeResult.summaryFivePillars.plc.calculation && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold">
                      RAW I/O RIIL
                    </div>
                    <div className="text-xs font-extrabold text-slate-800">
                      {
                        activeResult.summaryFivePillars.plc.calculation.io
                          .rawDi
                      }{" "}
                      DI /{" "}
                      {
                        activeResult.summaryFivePillars.plc.calculation.io
                          .rawDo
                      }{" "}
                      DO
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold">
                      SPARE (+20%)
                    </div>
                    <div className="text-xs font-extrabold text-slate-800">
                      +
                      {
                        activeResult.summaryFivePillars.plc.calculation.io
                          .spareDi
                      }{" "}
                      DI / +
                      {
                        activeResult.summaryFivePillars.plc.calculation.io
                          .spareDo
                      }{" "}
                      DO
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200">
                    <div className="text-[10px] text-indigo-700 font-bold">
                      TOTAL DIBUTUHKAN
                    </div>
                    <div className="text-xs font-extrabold text-indigo-900">
                      {
                        activeResult.summaryFivePillars.plc.calculation.io
                          .requiredDi
                      }{" "}
                      DI /{" "}
                      {
                        activeResult.summaryFivePillars.plc.calculation.io
                          .requiredDo
                      }{" "}
                      DO
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] text-emerald-700 font-bold">
                      KAPASITAS HARDWARE
                    </div>
                    <div className="text-xs font-extrabold text-emerald-900">
                      {
                        activeResult.summaryFivePillars.plc.calculation
                          .selection.chosen.capacityDi
                      }{" "}
                      DI /{" "}
                      {
                        activeResult.summaryFivePillars.plc.calculation
                          .selection.chosen.capacityDo
                      }{" "}
                      DO
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                {activeResult.summaryFivePillars.plc.reasoning}
              </p>

              {/* Tombol Collapsible Rincian Alokasi I/O */}
              {activeResult.summaryFivePillars.plc.calculation && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPlcDetails((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>
                      {showPlcDetails
                        ? "Sembunyikan Rincian Titik I/O"
                        : "Lihat Rincian Alokasi Titik I/O (DI & DO)"}
                    </span>
                    {showPlcDetails ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {showPlcDetails && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Digital Input Items */}
                        <div className="space-y-1.5">
                          <div className="font-extrabold text-slate-800 pb-1 border-b border-slate-200 flex items-center justify-between">
                            <span>Alokasi Digital Input (DI)</span>
                            <span className="font-mono text-indigo-700">
                              {
                                activeResult.summaryFivePillars.plc.calculation
                                  .io.rawDi
                              }{" "}
                              Titik
                            </span>
                          </div>
                          <ul className="space-y-1 text-slate-600">
                            {activeResult.summaryFivePillars.plc.calculation.io.diItems.map(
                              (item, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start justify-between gap-2"
                                >
                                  <span>• {item.label}</span>
                                  <strong className="font-mono text-slate-900 shrink-0">
                                    {item.qty} DI
                                  </strong>
                                </li>
                              )
                            )}
                          </ul>
                        </div>

                        {/* Digital Output Items */}
                        <div className="space-y-1.5">
                          <div className="font-extrabold text-slate-800 pb-1 border-b border-slate-200 flex items-center justify-between">
                            <span>Alokasi Digital Output (DO)</span>
                            <span className="font-mono text-indigo-700">
                              {
                                activeResult.summaryFivePillars.plc.calculation
                                  .io.rawDo
                              }{" "}
                              Titik
                            </span>
                          </div>
                          <ul className="space-y-1 text-slate-600">
                            {activeResult.summaryFivePillars.plc.calculation.io.doItems.map(
                              (item, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start justify-between gap-2"
                                >
                                  <span>• {item.label}</span>
                                  <strong className="font-mono text-slate-900 shrink-0">
                                    {item.qty} DO
                                  </strong>
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Modul Hardware yang Dipilih */}
                      <div className="pt-2 border-t border-slate-200">
                        <span className="font-extrabold text-slate-800">
                          Konfigurasi Hardware Terpilih:
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {activeResult.summaryFivePillars.plc.calculation.selection.chosen.lines.map(
                            (line, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-bold"
                              >
                                {line.qty}x {line.hwKey} ({line.role})
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="text-[11px] text-indigo-700 bg-indigo-50/70 rounded-lg px-2.5 py-1.5 font-semibold">
                {activeResult.summaryFivePillars.plc.alternativeNote}
              </div>
            </div>

            {/* 5. PERHITUNGAN & REKOMENDASI HMI (PILAR BARU) */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-lg">
                  <Monitor className="w-3.5 h-3.5" /> 5. Perhitungan & Rekomendasi HMI
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-700 text-white text-xs font-extrabold">
                  {activeResult.summaryFivePillars.hmi.calculation.sizeLabel}
                </span>
              </div>

              <div className="text-sm sm:text-base font-extrabold text-slate-900">
                {activeResult.summaryFivePillars.hmi.headline}
              </div>

              {/* Ringkasan Matriks Perhitungan HMI */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold">
                    ESTIMASI LAYAR
                  </div>
                  <div className="text-xs font-extrabold text-slate-800">
                    {
                      activeResult.summaryFivePillars.hmi.calculation
                        .totalScreens
                    }{" "}
                    Layar
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold">
                    TAG PLC - HMI
                  </div>
                  <div className="text-xs font-extrabold text-slate-800">
                    ~
                    {
                      activeResult.summaryFivePillars.hmi.calculation
                        .estimatedTags
                    }{" "}
                    Tag
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold">
                    ALARM AKTIF
                  </div>
                  <div className="text-xs font-extrabold text-slate-800">
                    {
                      activeResult.summaryFivePillars.hmi.calculation
                        .estimatedAlarms
                    }{" "}
                    Titik
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-cyan-50 border border-cyan-200">
                  <div className="text-[10px] text-cyan-700 font-bold">
                    TOPOLOGI ETHERNET
                  </div>
                  <div className="text-[11px] font-extrabold text-cyan-900">
                    {activeResult.summaryFivePillars.hmi.calculation
                      .needsEthernetSwitch
                      ? "Switch Wajib"
                      : "Direct 1:1"}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {activeResult.summaryFivePillars.hmi.reasoning}
              </p>

              {/* Tombol Collapsible Rincian Layar HMI */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowHmiDetails((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-700 hover:text-cyan-900 cursor-pointer"
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>
                    {showHmiDetails
                      ? "Sembunyikan Rincian Layar HMI"
                      : "Lihat Rincian Estimasi Layar HMI"}
                  </span>
                  {showHmiDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showHmiDetails && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <span className="font-extrabold text-slate-800">
                      Rincian Desain Layar HMI yang Diperlukan:
                    </span>
                    <ul className="space-y-1 text-slate-600">
                      {activeResult.summaryFivePillars.hmi.calculation.screenItems.map(
                        (screen, idx) => (
                          <li
                            key={idx}
                            className="flex items-center justify-between gap-2"
                          >
                            <span>• {screen.label}</span>
                            <strong className="font-mono text-slate-900 shrink-0">
                              {screen.qty} Layar
                            </strong>
                          </li>
                        )
                      )}
                    </ul>
                    <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                      Komunikasi Ethernet terhubung ke{" "}
                      {
                        activeResult.summaryFivePillars.hmi.calculation
                          .ethernetDevices
                      }{" "}
                      perangkat jaringan panel.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 6. REKOMENDASI SPEK MCB / MCCB (Full Width) */}
            <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-4 shadow-2xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
                  <Activity className="w-3.5 h-3.5" /> 6. Rekomendasi
                  Spesifikasi MCB & Pembagian Jalur Proteksi
                </span>
                <span className="text-xs font-extrabold text-slate-700">
                  Suplai: {activeResult.summaryFivePillars.mcb.supplyPhase} •
                  Estimasi Arus Puncak ~
                  {activeResult.summaryFivePillars.mcb.estimatedMainAmps}A
                </span>
              </div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900">
                {activeResult.summaryFivePillars.mcb.headline}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {activeResult.summaryFivePillars.mcb.specsBreakdown.map(
                  (sp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800">
                          {sp.jalur}
                        </div>
                        <div className="text-purple-800 font-extrabold">
                          {sp.spekMcb}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold shrink-0">
                        {sp.qty} pcs
                      </span>
                    </div>
                  )
                )}
              </div>
              <p className="text-xs text-slate-600">
                {activeResult.summaryFivePillars.mcb.reasoning}
              </p>
            </div>
          </div>

          {/* ==================== CHECKLIST MASUKKAN KE DAFTAR PR ==================== */}
          {onApplyItems && (
            <div className="rounded-xl bg-white border border-indigo-200 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                    Daftar Komponen Hasil Identifikasi ML Siap Masuk PR (
                    {selectedItems.length} dipilih)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Centang komponen yang ingin langsung dimasukkan ke tabel PR
                    beserta jumlah & estimasi harganya.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => selectAllItems(false)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 font-bold text-slate-700 cursor-pointer"
                  >
                    Hanya Komponen Pilar Inti (PSU, Safety, Relay, PLC, HMI, MCB)
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAllItems(true)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 font-bold text-slate-700 cursor-pointer"
                  >
                    Pilih Semua (+ Pendukung)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {activeResult.allRecommendedItems.map((item) => {
                  const isChecked = !uncheckedKeys[item.key];
                  return (
                    <label
                      key={item.key}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        isChecked
                          ? "bg-indigo-50/50 border-indigo-300"
                          : "bg-slate-50/60 border-slate-200 opacity-70"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItemCheck(item.key)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-slate-900 truncate">
                            {item.partType}
                          </span>
                          <span className="shrink-0 font-mono font-extrabold text-indigo-700">
                            {item.qty} {item.unit}
                          </span>
                        </div>
                        <div className="text-slate-600 font-semibold flex items-center justify-between gap-2 mt-0.5">
                          <span className="truncate">{item.partName}</span>
                          <span className="shrink-0 text-emerald-700 font-bold">
                            {formatRupiah(
                              item.hargaSatuan !== null
                                ? item.hargaSatuan * item.qty
                                : null
                            )}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          [{item.pillar}] {item.alasanSingkat}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="text-xs sm:text-sm font-bold text-slate-700">
                  Estimasi Subtotal Rekomendasi Terpilih:{" "}
                  <span className="text-indigo-700 font-extrabold">
                    {formatRupiah(selectedEstimatedTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={selectedItems.length === 0}
                  onClick={handleApplySelected}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  {applyButtonLabel} ({selectedItems.length} Item)
                </button>
              </div>

              {appliedToast && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-extrabold text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{appliedToast}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
