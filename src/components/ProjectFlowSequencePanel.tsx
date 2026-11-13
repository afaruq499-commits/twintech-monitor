"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  MoveDown,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";

export type FlowStepType =
  | "HOME"
  | "LOADING"
  | "PROCESS"
  | "INSPECTION"
  | "UNLOADING"
  | "EMERGENCY";

export interface FlowSequenceStep {
  id: string;
  step: number;
  judul: string;
  deskripsi?: string;
  kondisiInput?: string; // Sensor input pemicu (DI)
  aksiOutput?: string; // Aktuator / aktuasi output (DO / Servo)
  konfirmasiSelesai?: string; // Sensor konfirmasi step selesai
  tipe: FlowStepType;
  durasiEstimasiDetik?: number;
}

const STEP_TYPE_CONFIG: Record<
  FlowStepType,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  HOME: {
    label: "Home & Safety",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-300",
    icon: "🏠",
  },
  LOADING: {
    label: "Loading Part",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-300",
    icon: "📥",
  },
  PROCESS: {
    label: "Proses Mesin",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-300",
    icon: "⚙️",
  },
  INSPECTION: {
    label: "Inspeksi & Test",
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-300",
    icon: "🔬",
  },
  UNLOADING: {
    label: "Unloading & Eject",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-300",
    icon: "📤",
  },
  EMERGENCY: {
    label: "Safety / E-Stop",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-300",
    icon: "🛑",
  },
};

const DEFAULT_SPM_SEQUENCE_TEMPLATE: FlowSequenceStep[] = [
  {
    id: "step-1",
    step: 1,
    judul: "Standby, Home Origin & Safety Interlock Check",
    deskripsi:
      "Memastikan tombol Emergency Stop release, safety cover tertutup rapat, dan semua silinder pneumatik berada di home sensor.",
    kondisiInput:
      "Tombol E-Stop RELEASE (NC) + Safety Door Closed (DI) + Tombol Start ditekan",
    aksiOutput:
      "Servo Drive Homing ON, Solenoid Silinder Origin Valve ON, Lampu Indicator Hijau READY",
    konfirmasiSelesai:
      "Origin Sensor Servo ON & Reed Switch Silinder Retract Aktif",
    tipe: "HOME",
    durasiEstimasiDetik: 2,
  },
  {
    id: "step-2",
    step: 2,
    judul: "Loading Part & Deteksi Keberadaan Benda Kerja",
    deskripsi:
      "Operator meletakkan benda kerja pada fixture jig test atau part masuk dari conveyor.",
    kondisiInput: "Optical / Proximity Sensor Part Detect Aktif (DI)",
    aksiOutput:
      "Conveyor Stopper Turun, Vacuum Suction Valve ON, Lampu Standby Biru ON",
    konfirmasiSelesai: "Sensor Tekanan Vacuum Switch mencapai batas aman (-70 kPa)",
    tipe: "LOADING",
    durasiEstimasiDetik: 3,
  },
  {
    id: "step-3",
    step: 3,
    judul: "Clamping Benda Kerja & Penekanan Silinder Test Probe",
    deskripsi:
      "Silinder pneumatik menjepit part dengan stabil dan silinder probe uji menekan kontak konektor benda kerja.",
    kondisiInput:
      "Konfirmasi Part Ready + Tombol Dua Tangan (Two-Hand Safety) ditekan",
    aksiOutput:
      "Solenoid Valve Silinder Clamp Maju ON, Solenoid Probe Penekan Turun ON",
    konfirmasiSelesai:
      "Reed Switch Silinder Clamp ADVANCE ON & Reed Switch Probe DOWN ON",
    tipe: "PROCESS",
    durasiEstimasiDetik: 4,
  },
  {
    id: "step-4",
    step: 4,
    judul: "Pengujian Parameter Elektrikal & Komunikasi (Inspeksi)",
    deskripsi:
      "Menjalankan pengukuran tegangan, arus uji, resistansi isolasi, atau transmisi data komunikasi serial/CAN ke modul produk.",
    kondisiInput: "Probe Down Confirmed & Modul Instrumentasi Siap",
    aksiOutput:
      "Relay Power Uji ON (MY2N DO), Trigger Alat Ukur Digital ON, Kirim Frame Test",
    konfirmasiSelesai:
      "Hasil Ukur Diterima: Status Kriteria OK (Lampu Hijau) atau NG (Buzzer & Alarm)",
    tipe: "INSPECTION",
    durasiEstimasiDetik: 6,
  },
  {
    id: "step-5",
    step: 5,
    judul: "Unclamping, Eject Benda Kerja & Reset Counter",
    deskripsi:
      "Silinder probe uji naik kembali, clamp terbuka, dan part didorong ke keranjang OK atau jalur evaluasi NG.",
    kondisiInput: "Siklus Test Selesai (Sinyal PLC Sequence Finished)",
    aksiOutput:
      "Solenoid Probe NAIK ON, Solenoid Clamp MUNDUR ON, Silinder Ejector Maju ON, Tambah Counter Produksi",
    konfirmasiSelesai:
      "Semua Reed Switch Home ON & Part Cleared dari Sensor Fixture",
    tipe: "UNLOADING",
    durasiEstimasiDetik: 3,
  },
];

export function ProjectFlowSequencePanel({
  projectId,
  initialFlowJson,
  onSaveSuccess,
}: {
  projectId: string;
  initialFlowJson: string | null | undefined;
  onSaveSuccess?: (newJson: string) => void;
}) {
  const [steps, setSteps] = useState<FlowSequenceStep[]>(() => {
    if (!initialFlowJson) return [];
    try {
      const parsed = JSON.parse(initialFlowJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [saving, setSaving] = useState(false);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form State untuk tambah / edit step
  const [formJudul, setFormJudul] = useState("");
  const [formDeskripsi, setFormDeskripsi] = useState("");
  const [formKondisiInput, setFormKondisiInput] = useState("");
  const [formAksiOutput, setFormAksiOutput] = useState("");
  const [formKonfirmasi, setFormKonfirmasi] = useState("");
  const [formTipe, setFormTipe] = useState<FlowStepType>("PROCESS");
  const [formDurasi, setFormDurasi] = useState<number>(3);

  async function saveToServer(updatedSteps: FlowSequenceStep[]) {
    setSaving(true);
    const jsonStr = JSON.stringify(updatedSteps);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowSequenceJson: jsonStr }),
      });
      if (res.ok) {
        setSteps(updatedSteps);
        onSaveSuccess?.(jsonStr);
      }
    } catch (err) {
      console.error("Gagal menyimpan alur sekuens:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleUseTemplate() {
    if (
      steps.length > 0 &&
      !window.confirm(
        "Ganti alur sekuens saat ini dengan Template Sekuens Mesin SPM Standar?"
      )
    ) {
      return;
    }
    void saveToServer(DEFAULT_SPM_SEQUENCE_TEMPLATE);
  }

  function openAddModal() {
    setEditingIndex(null);
    const nextStepNum = steps.length + 1;
    setFormJudul(`${nextStepNum}. `);
    setFormDeskripsi("");
    setFormKondisiInput("");
    setFormAksiOutput("");
    setFormKonfirmasi("");
    setFormTipe("PROCESS");
    setFormDurasi(3);
    setIsEditingModalOpen(true);
  }

  function openEditModal(index: number) {
    const s = steps[index];
    setEditingIndex(index);
    setFormJudul(s.judul);
    setFormDeskripsi(s.deskripsi ?? "");
    setFormKondisiInput(s.kondisiInput ?? "");
    setFormAksiOutput(s.aksiOutput ?? "");
    setFormKonfirmasi(s.konfirmasiSelesai ?? "");
    setFormTipe(s.tipe);
    setFormDurasi(s.durasiEstimasiDetik ?? 3);
    setIsEditingModalOpen(true);
  }

  function handleSaveForm() {
    if (!formJudul.trim()) {
      alert("Nama langkah sekuens wajib diisi.");
      return;
    }

    let updated: FlowSequenceStep[];
    if (editingIndex !== null) {
      // Edit
      updated = steps.map((item, idx) =>
        idx === editingIndex
          ? {
              ...item,
              judul: formJudul.trim(),
              deskripsi: formDeskripsi.trim() || undefined,
              kondisiInput: formKondisiInput.trim() || undefined,
              aksiOutput: formAksiOutput.trim() || undefined,
              konfirmasiSelesai: formKonfirmasi.trim() || undefined,
              tipe: formTipe,
              durasiEstimasiDetik: Number(formDurasi) || 3,
            }
          : item
      );
    } else {
      // Tambah Baru
      const newStep: FlowSequenceStep = {
        id: `step-${Date.now()}`,
        step: steps.length + 1,
        judul: formJudul.trim(),
        deskripsi: formDeskripsi.trim() || undefined,
        kondisiInput: formKondisiInput.trim() || undefined,
        aksiOutput: formAksiOutput.trim() || undefined,
        konfirmasiSelesai: formKonfirmasi.trim() || undefined,
        tipe: formTipe,
        durasiEstimasiDetik: Number(formDurasi) || 3,
      };
      updated = [...steps, newStep];
    }

    // Normalisasi nomor step 1..N
    updated = updated.map((s, idx) => ({ ...s, step: idx + 1 }));

    setIsEditingModalOpen(false);
    void saveToServer(updated);
  }

  function handleDeleteStep(index: number) {
    if (!window.confirm("Hapus langkah sekuens ini?")) return;
    const updated = steps
      .filter((_, idx) => idx !== index)
      .map((s, idx) => ({ ...s, step: idx + 1 }));
    void saveToServer(updated);
  }

  function handleMoveStep(index: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const cloned = [...steps];
    const temp = cloned[index];
    cloned[index] = cloned[targetIdx];
    cloned[targetIdx] = temp;
    const updated = cloned.map((s, idx) => ({ ...s, step: idx + 1 }));
    void saveToServer(updated);
  }

  const totalCycleTime = steps.reduce(
    (sum, s) => sum + (s.durasiEstimasiDetik || 0),
    0
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/70">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <Workflow className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-slate-900 text-base">
              Flow Sequence & Flowchart Sekuens Mesin Otomasi
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Urutan operasional kerja mesin: Input Sensor Trigger (DI) ➔ Aksi
            Aktuator / Output (DO / Servo) ➔ Konfirmasi Sensor Selesai.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {steps.length > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span>{steps.length} Langkah Sekuens</span>
              {totalCycleTime > 0 && (
                <span className="text-indigo-600 font-medium">
                  • Est. Cycle: ~{totalCycleTime}s
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleUseTemplate}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
            title="Muat 5 langkah sekuens standar mesin SPM Function Tester"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Template Sekuens SPM</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Langkah</span>
          </button>
        </div>
      </div>

      {/* Konten Flowchart & Timeline Alur */}
      <div className="p-5">
        {steps.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <Workflow className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-slate-800 text-sm">
              Belum Ada Flow Sequence Operasional Mesin
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Susun alur kerja mesin otomasi SPM ini dari tahap Home, Loading Part,
              Penjepitan, Inspeksi Elektrikal, hingga Unloading part.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={handleUseTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                Gunakan Template Sekuens SPM Function Tester
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Buat Langkah Manual
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Diagram Flowchart Sekuens */}
            <div className="relative pl-6 sm:pl-8 border-l-2 border-indigo-200 space-y-6 my-2">
              {steps.map((st, idx) => {
                const conf = STEP_TYPE_CONFIG[st.tipe] || STEP_TYPE_CONFIG.PROCESS;
                const isLast = idx === steps.length - 1;

                return (
                  <div key={st.id || idx} className="relative group">
                    {/* Node Dot di garis alur */}
                    <div className="absolute -left-[33px] sm:-left-[41px] top-4 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-extrabold shadow-md border-2 border-white ring-2 ring-indigo-200">
                      {st.step}
                    </div>

                    {/* Card Langkah Sekuens */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-indigo-400 hover:shadow-md transition">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span className="text-xl" role="img" aria-label="type">
                            {conf.icon}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${conf.bg} ${conf.text} ${conf.border}`}
                              >
                                {conf.label}
                              </span>
                              {st.durasiEstimasiDetik && (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  ⏱ {st.durasiEstimasiDetik} detik
                                </span>
                              )}
                            </div>
                            <h4 className="font-extrabold text-slate-900 text-base mt-1">
                              {st.judul}
                            </h4>
                            {st.deskripsi && (
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {st.deskripsi}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Kontrol Aksi: Naik/Turun, Edit, Hapus */}
                        <div className="flex items-center gap-1 self-end sm:self-start shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, "up")}
                            disabled={idx === 0 || saving}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            title="Geser ke atas"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, "down")}
                            disabled={isLast || saving}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            title="Geser ke bawah"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(idx)}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                            title="Edit langkah sekuens"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStep(idx)}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Hapus langkah sekuens"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Detail I/O Alur Otomasi */}
                      {(st.kondisiInput || st.aksiOutput || st.konfirmasiSelesai) && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3.5 pt-3.5 border-t border-slate-100 text-xs">
                          {/* 1. Kondisi Input Sensor */}
                          <div className="bg-amber-50/60 rounded-xl p-2.5 border border-amber-200/60">
                            <div className="flex items-center gap-1.5 font-bold text-amber-800 mb-1">
                              <Zap className="w-3.5 h-3.5 text-amber-600" />
                              <span>1. Kondisi Trigger (Input Sensor)</span>
                            </div>
                            <div className="font-medium text-slate-700 text-[11px] leading-snug">
                              {st.kondisiInput || "-"}
                            </div>
                          </div>

                          {/* 2. Aksi Output Aktuator */}
                          <div className="bg-indigo-50/60 rounded-xl p-2.5 border border-indigo-200/60">
                            <div className="flex items-center gap-1.5 font-bold text-indigo-800 mb-1">
                              <PlayCircle className="w-3.5 h-3.5 text-indigo-600" />
                              <span>2. Aksi Aktuasi (Output / DO)</span>
                            </div>
                            <div className="font-medium text-slate-700 text-[11px] leading-snug">
                              {st.aksiOutput || "-"}
                            </div>
                          </div>

                          {/* 3. Konfirmasi Selesai */}
                          <div className="bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-200/60">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>3. Konfirmasi Selesai</span>
                            </div>
                            <div className="font-medium text-slate-700 text-[11px] leading-snug">
                              {st.konfirmasiSelesai || "-"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Garis Panah Penghubung ke Langkah Berikutnya */}
                    {!isLast && (
                      <div className="flex items-center justify-center my-1 text-indigo-400">
                        <MoveDown className="w-4 h-4 animate-bounce" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Step */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  {editingIndex !== null
                    ? `Edit Langkah #${editingIndex + 1}`
                    : "Tambah Langkah Sekuens Mesin"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Langkah Sekuens *
                  </label>
                  <input
                    type="text"
                    value={formJudul}
                    onChange={(e) => setFormJudul(e.target.value)}
                    placeholder="Contoh: Clamping Benda Kerja & Penekanan Silinder"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori / Tipe
                  </label>
                  <select
                    value={formTipe}
                    onChange={(e) => setFormTipe(e.target.value as FlowStepType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="HOME">Home & Safety</option>
                    <option value="LOADING">Loading Part</option>
                    <option value="PROCESS">Proses Mesin</option>
                    <option value="INSPECTION">Inspeksi & Test</option>
                    <option value="UNLOADING">Unloading & Eject</option>
                    <option value="EMERGENCY">Safety / E-Stop</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deskripsi Alur Operasional
                </label>
                <textarea
                  rows={2}
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  placeholder="Rincian cara kerja mesin pada tahap langkah ini..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-800 mb-1">
                  1. Kondisi Input Sensor Trigger (DI)
                </label>
                <input
                  type="text"
                  value={formKondisiInput}
                  onChange={(e) => setFormKondisiInput(e.target.value)}
                  placeholder="Contoh: Safety Door Tertutup (DI) + Tombol Start ON + Sensor Part Detect OK"
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/30 text-sm focus:outline-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-indigo-800 mb-1">
                  2. Aksi Output Aktuator / Pergerakan (DO / Servo)
                </label>
                <input
                  type="text"
                  value={formAksiOutput}
                  onChange={(e) => setFormAksiOutput(e.target.value)}
                  placeholder="Contoh: Solenoid Silinder Clamp Maju ON + Motor Servo Bergerak ke Posisi Uji"
                  className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-indigo-50/30 text-sm focus:outline-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-emerald-800 mb-1">
                    3. Sensor Konfirmasi Selesai
                  </label>
                  <input
                    type="text"
                    value={formKonfirmasi}
                    onChange={(e) => setFormKonfirmasi(e.target.value)}
                    placeholder="Contoh: Reed Switch Clamp ADVANCE ON & Tekanan Stabil"
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50/30 text-sm focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Est. Durasi (detik)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formDurasi}
                    onChange={(e) => setFormDurasi(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {saving ? "Menyimpan..." : "Simpan Langkah"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
