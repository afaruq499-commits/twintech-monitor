"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Workflow,
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  ExternalLink,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Layers,
  FileCode,
  ListOrdered,
  Eye,
  Check,
  Search,
} from "lucide-react";
import {
  normalizeFlowchartPayload,
  StoredFlowchartPayload,
} from "@/lib/flowchart-storage";
import { FlowStepItem, generateDrawioXml } from "@/lib/flowchart-converter";
import { TwintechNativeFlowchart } from "./TwintechNativeFlowchart";

export interface ProjectOptionItem {
  id: string;
  kode?: string | null;
  nama: string;
  client: string;
  status: string;
  flowSequenceJson?: string | null;
  deadline?: string | null;
}

interface FlowchartStudioClientProps {
  projects: ProjectOptionItem[];
  initialProjectId?: string;
}

// Koleksi Template Bawaan Industri Otomasi Twintech Precision
const PRESET_TEMPLATES: Record<string, { label: string; desc: string; steps: FlowStepItem[] }> = {
  SPM_STANDARD: {
    label: "Mesin SPM Otomasi Standar (7-8 Step)",
    desc: "Alur standar perakitan & pengetesan part: Start, Homing, Clamping, Probe Test, Decision OK/NG, dan Cycle Reset.",
    steps: [
      { id: "step-start", nomor: "0", judul: "START / STANDBY", deskripsi: "E-Stop Release & Safety Door Tutup (Interlock OK)", tipe: "START" },
      { id: "step-1", nomor: "1", judul: "HOME POSITION CHECK", deskripsi: "Servo Origin OK & Silinder Retract (Reed SW DI)", tipe: "STEP" },
      { id: "step-2", nomor: "2", judul: "LOADING PART & DETEKSI", deskripsi: "Sensor Part Detect (DI) ON & Tombol Start ditekan", tipe: "STEP" },
      { id: "step-3", nomor: "3", judul: "CLAMPING & PROBE TEST", deskripsi: "Silinder Clamp Maju & Silinder Probe Turun", tipe: "STEP" },
      { id: "step-dec", nomor: "4", judul: "HASIL PENGUJIAN?", deskripsi: "Tegangan, Arus, dan Sinyal Komunikasi Sesuai Toleransi?", tipe: "DECISION" },
      { id: "step-ok", nomor: "OK", judul: "PART OK (GOOD)", deskripsi: "Marking Stamp & Eject ke Pallet / Box Part OK", tipe: "OK" },
      { id: "step-ng", nomor: "NG", judul: "PART NG (REJECT)", deskripsi: "Alarm Buzzer ON & Eject ke Chute Box NG", tipe: "NG" },
      { id: "step-finish", nomor: "5", judul: "UNCLAMP & RESET CYCLE", deskripsi: "Silinder Kembali Home, Siap Siklus Part Berikutnya", tipe: "FINISH" },
    ],
  },
  DUAL_COLUMN: {
    label: "Twintech Dual-Column (Safety Relay + Machine Running)",
    desc: "Alur 2-kolom standar Twintech: Kolom kiri Safety Relay & Power-Up, Kolom kanan Siklus Mesin & Inspeksi.",
    steps: [
      { id: "pw-on", nomor: "1", judul: "POWER ON", deskripsi: "Lamp kuning ON", tipe: "START" },
      { id: "emg-rel", nomor: "2", judul: "EMG PUSHBUTTON RELEASE", deskripsi: "Tombol E-Stop dibuka", tipe: "STEP" },
      { id: "s-relay", nomor: "3", judul: "SAFETY RELAY ON", deskripsi: "Relay safety aktif", tipe: "STEP" },
      { id: "s-check", nomor: "4", judul: "SAFETY CHECK OK?", deskripsi: "Pengecekan area safety", tipe: "DECISION" },
      { id: "plc-sig", nomor: "5", judul: "KIRIM SINYAL KE PLC", deskripsi: "Input X0 aktif", tipe: "STEP" },
      { id: "sup-24v", nomor: "6", judul: "SUPPLY 24VDC", deskripsi: "Sensor dan aktuator aktif", tipe: "STEP" },
      { id: "light-c", nomor: "7", judul: "LIGHT CURTAIN TERHALANG?", deskripsi: "Sensor optik safety", tipe: "DECISION" },
      { id: "conn-a", nomor: "8", judul: "LANJUT KE MACHINE RUNNING [A]", deskripsi: "Pindah ke alur operasional mesin", tipe: "STEP" },
      { id: "m-ready", nomor: "9", judul: "MESIN READY", deskripsi: "Lamp hijau ON", tipe: "STEP" },
      { id: "m-2pb", nomor: "10", judul: "2 PB DITEKAN BERSAMA 2 S?", deskripsi: "Two-hand safety button", tipe: "DECISION" },
      { id: "m-inspect", nomor: "11", judul: "INSPECT ON", deskripsi: "1. Servo ON • 2. Inspect count 8x", tipe: "STEP" },
      { id: "m-result", nomor: "12", judul: "HASIL INSPECT?", deskripsi: "Pengujian benda kerja", tipe: "DECISION" },
      { id: "m-ok", nomor: "OK", judul: "STAMP LABEL & HOMING (OK)", deskripsi: "Stamping part lolos uji", tipe: "OK" },
      { id: "m-ng", nomor: "NG", judul: "ALARM NG & HOMING (REJECT)", deskripsi: "Buzzer alarm berbunyi", tipe: "NG" },
      { id: "m-reset", nomor: "13", judul: "KEMBALI KE SAFETY CHECK [B]", deskripsi: "Reset siklus mesin", tipe: "FINISH" },
    ],
  },
  VISION_CONVEYOR: {
    label: "Lini Konveyor & Kamera Keyence Vision",
    desc: "Alur inspeksi visual: Infeed, Stopper Positioning, Trigger Kamera IV4, Evaluasi Dimensi, dan Sortir OK/NG.",
    steps: [
      { id: "v-start", nomor: "0", judul: "CONVEYOR INFEED ON", deskripsi: "Motor konveyor running membawa part shaft", tipe: "START" },
      { id: "v-stop", nomor: "1", judul: "STOPPER & POSITIONING", deskripsi: "Silinder stopper naik, proximity detect part", tipe: "STEP" },
      { id: "v-cam", nomor: "2", judul: "TRIGGER CAMERA IV4", deskripsi: "Kamera Keyence IV4 trigger capture gambar", tipe: "STEP" },
      { id: "v-dec", nomor: "3", judul: "HASIL INSPEKSI VISION?", deskripsi: "Evaluasi diameter, runout, dan cacat visual", tipe: "DECISION" },
      { id: "v-ok", nomor: "OK", judul: "GATE PASS TERBUKA", deskripsi: "Part lolos diteruskan ke jalur perakitan", tipe: "OK" },
      { id: "v-ng", nomor: "NG", judul: "PUSHER REJECT KE BIN NG", deskripsi: "Pneumatic pusher dorong part cacat ke bin NG", tipe: "NG" },
      { id: "v-finish", nomor: "4", judul: "CYCLE COMPLETE", deskripsi: "Stopper turun, siap siklus part berikutnya", tipe: "FINISH" },
    ],
  },
  BLANK: {
    label: "Kanvas Baru / Kosong (Mulai dari Nol)",
    desc: "Diagram minimalis siap diketik langsung dari awal.",
    steps: [
      { id: "b-start", nomor: "0", judul: "START / POWER ON", deskripsi: "Awal proses sekuens mesin", tipe: "START" },
      { id: "b-1", nomor: "1", judul: "LANGKAH 1", deskripsi: "Ketik proses atau sinyal I/O PLC di sini", tipe: "STEP" },
      { id: "b-end", nomor: "2", judul: "SELESAI / RESET", deskripsi: "Akhir siklus mesin", tipe: "FINISH" },
    ],
  },
};

export function FlowchartStudioClient({
  projects: initialProjects,
  initialProjectId = "",
}: FlowchartStudioClientProps) {
  const router = useRouter();

  // Daftar proyek lokal
  const [projectList, setProjectList] = useState<ProjectOptionItem[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [projectSearch, setProjectSearch] = useState<string>("");

  const selectedProject = useMemo(
    () => projectList.find((p) => p.id === selectedProjectId),
    [projectList, selectedProjectId]
  );

  // State langkah flowchart aktif
  const [currentSteps, setCurrentSteps] = useState<FlowStepItem[]>(
    PRESET_TEMPLATES.SPM_STANDARD.steps
  );

  // Tab mode: "canvas" (Diagram Visual SVG) atau "outline" (Tabel Langkah Alur)
  const [activeTab, setActiveTab] = useState<"canvas" | "outline">("canvas");

  // State proses penyimpanan
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Muat data dari proyek jika proyek dipilih
  useEffect(() => {
    if (!selectedProject) return;

    if (selectedProject.flowSequenceJson) {
      const normalized = normalizeFlowchartPayload(
        selectedProject.flowSequenceJson,
        selectedProject.id
      );
      if (
        normalized &&
        normalized.steps &&
        Array.isArray(normalized.steps) &&
        normalized.steps.length > 0
      ) {
        setCurrentSteps(normalized.steps as FlowStepItem[]);
        showToast(`Memuat flowchart tersimpan dari ${selectedProject.nama}`);
        return;
      }
    }

    // Jika belum ada flowchart tersimpan pada proyek, berikan template standar
    setCurrentSteps(PRESET_TEMPLATES.SPM_STANDARD.steps);
  }, [selectedProjectId, selectedProject]);

  // Muat ulang dari database proyek terpilih
  const handleReloadFromProject = () => {
    if (!selectedProject) return;
    if (selectedProject.flowSequenceJson) {
      const normalized = normalizeFlowchartPayload(
        selectedProject.flowSequenceJson,
        selectedProject.id
      );
      if (normalized?.steps && normalized.steps.length > 0) {
        setCurrentSteps(normalized.steps as FlowStepItem[]);
        showToast(`Flowchart dimuat ulang dari ${selectedProject.nama}`);
        return;
      }
    }
    setCurrentSteps(PRESET_TEMPLATES.SPM_STANDARD.steps);
    showToast("Template default dimuat");
  };

  // Muat Template Pilihan
  const handleApplyTemplate = (templateKey: string) => {
    const template = PRESET_TEMPLATES[templateKey];
    if (!template) return;
    setCurrentSteps(template.steps);
    showToast(`Template "${template.label}" diterapkan!`);
  };

  // Simpan & Terapkan ke Proyek
  const handleSaveToProject = useCallback(
    async (
      stepsToSave: FlowStepItem[],
      xmlString?: string,
      svgDataUrlString?: string
    ) => {
      if (!selectedProjectId) {
        showToast("Pilih proyek terlebih dahulu untuk menyimpan ke database proyek!");
        return;
      }

      setSaving(true);
      try {
        const xml =
          xmlString ||
          generateDrawioXml(stepsToSave, {
            diagramName: `Flowchart ${selectedProject?.nama || "Twintech"}`,
          });

        const payload: StoredFlowchartPayload = {
          schemaVersion: 2,
          projectId: selectedProjectId,
          primaryImageUrl: null,
          imageUrls: [],
          svgDataUrl: svgDataUrlString || null,
          xml,
          steps: stepsToSave,
          updatedAt: new Date().toISOString(),
        };

        const res = await fetch(`/api/projects/${selectedProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flowSequenceJson: JSON.stringify(payload),
          }),
        });

        if (!res.ok) {
          throw new Error("Gagal menyimpan ke server proyek.");
        }

        // Perbarui state proyek lokal agar statusnya langsung terupdate
        setProjectList((prev) =>
          prev.map((p) =>
            p.id === selectedProjectId
              ? { ...p, flowSequenceJson: JSON.stringify(payload) }
              : p
          )
        );

        showToast(
          `Flowchart berhasil disimpan & diaplikasikan ke Proyek ${
            selectedProject?.nama || ""
          }!`
        );
        router.refresh();
      } catch (err) {
        console.error("Gagal menyimpan ke proyek:", err);
        showToast("Terjadi kesalahan saat menyimpan ke database proyek.");
      } finally {
        setSaving(false);
      }
    },
    [selectedProjectId, selectedProject?.nama, router]
  );

  // Filter daftar proyek berdasarkan pencarian
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projectList;
    const q = projectSearch.toLowerCase();
    return projectList.filter(
      (p) =>
        p.nama.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q) ||
        (p.kode && p.kode.toLowerCase().includes(q))
    );
  }, [projectList, projectSearch]);

  // Handler editing di Outline Mode
  const handleOutlineFieldChange = (
    id: string,
    field: keyof FlowStepItem,
    value: string
  ) => {
    setCurrentSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleOutlineMove = (id: string, dir: "up" | "down") => {
    const idx = currentSteps.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentSteps.length) return;
    const copy = [...currentSteps];
    const [item] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, item);
    setCurrentSteps(copy);
  };

  const handleOutlineDuplicate = (id: string) => {
    const idx = currentSteps.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const item = currentSteps[idx];
    const newId = `step-${Date.now().toString(36)}`;
    const copy = [...currentSteps];
    copy.splice(idx + 1, 0, {
      ...item,
      id: newId,
      nomor: `${item.nomor}B`,
      judul: `${item.judul} (Salinan)`,
    });
    setCurrentSteps(copy);
    showToast("Langkah disalin");
  };

  const handleOutlineDelete = (id: string) => {
    setCurrentSteps((prev) => prev.filter((s) => s.id !== id));
    showToast("Langkah dihapus");
  };

  const handleOutlineAdd = () => {
    const newId = `step-${Date.now().toString(36)}`;
    setCurrentSteps((prev) => [
      ...prev,
      {
        id: newId,
        nomor: String(prev.length + 1),
        judul: "LANGKAH BARU",
        deskripsi: "Deskripsi proses atau sinyal I/O PLC",
        tipe: "STEP",
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifikasi */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200 border border-emerald-400/40">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Utama Studio Flowchart */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-indigo-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Workflow className="w-3.5 h-3.5 text-indigo-300" />
              <span>Studio Flowchart Native Twintech • 100% Internal &amp; Mandiri</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Studio &amp; Editor Flowchart Mesin
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Rancang alur sekuens mesin otomasi secara visual langsung di dalam web, sinkronkan ke proyek
              engineering Twintech, dan unduh sebagai gambar PNG beresolusi tinggi dengan title block resmi.
            </p>
          </div>

          {/* Area Target Proyek */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 min-w-[320px] max-w-md">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-indigo-200 mb-2">
              <div className="flex items-center gap-1.5">
                <FolderKanban className="w-4 h-4 text-indigo-300" />
                <span>Pilih Proyek Target:</span>
              </div>
              {selectedProject && (
                <Link
                  href={`/proyek/${selectedProject.id}`}
                  className="text-indigo-300 hover:text-white underline text-[11px] font-bold flex items-center gap-1"
                >
                  <span>Buka Proyek</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            {/* Selector Dropdown Proyek */}
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-indigo-400/40 text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-400 cursor-pointer"
            >
              <option value="">— Mode Bebas (Desain Tanpa Proyek) —</option>
              {filteredProjects.map((p) => {
                const hasFlow = Boolean(p.flowSequenceJson);
                return (
                  <option key={p.id} value={p.id}>
                    {hasFlow ? "✓ [LENGKAP] " : "○ [BELUM ADA] "}
                    {p.kode ? `[${p.kode}] ` : ""}
                    {p.nama} — {p.client}
                  </option>
                );
              })}
            </select>

            {/* Status Keterangan Proyek Terpilih */}
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
              {selectedProject ? (
                <>
                  <span className="truncate max-w-[200px]">
                    Klien: <strong>{selectedProject.client}</strong>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedProject.flowSequenceJson
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {selectedProject.flowSequenceJson ? "Flowchart Tersimpan" : "Belum Ada Flowchart"}
                  </span>
                </>
              ) : (
                <span className="text-slate-400 italic">
                  Mode bebas: flowchart dapat diunduh tanpa disimpan ke proyek
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab & Template Quick Select Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-6 border-t border-white/10">
          {/* Pilihan Template Cepat */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold mr-1">Template Cepat:</span>
            {Object.entries(PRESET_TEMPLATES).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleApplyTemplate(key)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold transition cursor-pointer text-[11px]"
                title={item.desc}
              >
                {item.label.split("(")[0].trim()}
              </button>
            ))}
          </div>

          {/* Tab Mode Tampilan: Kanvas vs Outline */}
          <div className="flex items-center bg-slate-900/80 border border-slate-700/60 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("canvas")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition cursor-pointer ${
                activeTab === "canvas"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Kanvas Diagram</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("outline")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition cursor-pointer ${
                activeTab === "outline"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Tabel Langkah Alur ({currentSteps.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Konten Utama Studio */}
      {activeTab === "canvas" ? (
        /* 1. Mode Kanvas Diagram Interaktif (100% Native) */
        <TwintechNativeFlowchart
          initialSteps={currentSteps}
          projectName={selectedProject?.nama || "Twintech"}
          projectClient={selectedProject?.client || "PT Twintech Precision"}
          isSaving={saving}
          onStepsChange={(newSteps) => setCurrentSteps(newSteps)}
          onSave={async (stepsToSave, xml, svgDataUrl) => {
            setCurrentSteps(stepsToSave);
            if (selectedProjectId) {
              await handleSaveToProject(stepsToSave, xml, svgDataUrl);
            }
          }}
        />
      ) : (
        /* 2. Mode Tabel Langkah Alur (Editor Cepat Berbentuk List) */
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-indigo-600" />
                <span>Daftar Rangkaian Langkah Alur Mesin</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Edit seluruh langkah alur, nomor langkah, judul, dan sinyal I/O PLC dalam satu tabel terstruktur.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOutlineAdd}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Langkah Baru</span>
              </button>
              {selectedProjectId && (
                <button
                  type="button"
                  onClick={() => handleSaveToProject(currentSteps)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan ke Proyek"}</span>
                </button>
              )}
            </div>
          </div>

          {/* List Card Langkah */}
          <div className="space-y-3">
            {currentSteps.map((step, idx) => (
              <div
                key={step.id}
                className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center gap-3 justify-between"
              >
                {/* Kolom 1: Nomor & Tipe */}
                <div className="flex items-center gap-2 md:w-56 shrink-0">
                  <div className="w-12">
                    <label className="text-[10px] text-slate-400 font-bold block mb-0.5">No.</label>
                    <input
                      type="text"
                      value={step.nomor}
                      onChange={(e) => handleOutlineFieldChange(step.id, "nomor", e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-center"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Tipe Node</label>
                    <select
                      value={step.tipe}
                      onChange={(e) =>
                        handleOutlineFieldChange(
                          step.id,
                          "tipe",
                          e.target.value as FlowStepItem["tipe"]
                        )
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold cursor-pointer"
                    >
                      <option value="START">START / STANDBY</option>
                      <option value="STEP">STEP (Proses)</option>
                      <option value="DECISION">DECISION (Kondisi)</option>
                      <option value="OK">OK (Pass)</option>
                      <option value="NG">NG (Reject)</option>
                      <option value="FINISH">FINISH / RESET</option>
                    </select>
                  </div>
                </div>

                {/* Kolom 2: Judul & Deskripsi */}
                <div className="flex-1 space-y-1.5">
                  <input
                    type="text"
                    value={step.judul}
                    onChange={(e) => handleOutlineFieldChange(step.id, "judul", e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 placeholder-slate-400"
                    placeholder="Judul langkah (misal: CLAMPING PART)"
                  />
                  <input
                    type="text"
                    value={step.deskripsi}
                    onChange={(e) => handleOutlineFieldChange(step.id, "deskripsi", e.target.value)}
                    className="w-full px-3 py-1 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 placeholder-slate-400"
                    placeholder="Keterangan sinyal I/O PLC atau proses silinder"
                  />
                </div>

                {/* Kolom 3: Aksi Reorder, Duplicate, Delete */}
                <div className="flex items-center gap-1 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleOutlineMove(step.id, "up")}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-600 cursor-pointer"
                    title="Geser ke Atas"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOutlineMove(step.id, "down")}
                    disabled={idx === currentSteps.length - 1}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-600 cursor-pointer"
                    title="Geser ke Bawah"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOutlineDuplicate(step.id)}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-blue-600 cursor-pointer"
                    title="Duplikat Langkah Ini"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOutlineDelete(step.id)}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 text-rose-600 cursor-pointer"
                    title="Hapus Langkah Ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tombol Bawah */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleOutlineAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Baris Langkah</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("canvas")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Lihat Hasil di Kanvas Diagram</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
