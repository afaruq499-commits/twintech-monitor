"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Layers,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  WORK_TYPES,
  WORK_TYPE_LABELS,
  type WorkType,
} from "@/lib/constants";

export interface TemplateDTO {
  id: string;
  nama: string;
  jenis: WorkType;
  bolehParalel: boolean;
  deskripsi: string | null;
  subScopes: Array<{
    id: string;
    urutan: number;
    judul: string;
    details: Array<{
      id: string;
      urutan: number;
      teks: string;
    }>;
  }>;
}

export interface ProjectLaneOption {
  laneId: string;
  laneNama: string;
  projectId: string;
  projectNama: string;
  projectClient: string;
}

interface SubScopeDraft {
  judul: string;
  details: string[];
}

export function TemplatesClient({
  initialTemplates,
  laneOptions,
}: {
  initialTemplates: TemplateDTO[];
  laneOptions: ProjectLaneOption[];
}) {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const t of initialTemplates) init[t.id] = true;
    return init;
  });

  // State modal buat template baru
  const [createOpen, setCreateOpen] = useState(false);
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<WorkType>("WIRING");
  const [bolehParalel, setBolehParalel] = useState(false);
  const [deskripsi, setDeskripsi] = useState("");
  const [subScopes, setSubScopes] = useState<SubScopeDraft[]>([
    { judul: "1. Persiapan & Pemeriksaan Awal", details: [""] },
  ]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State modal terapkan template ke lane
  const [applyTarget, setApplyTarget] = useState<TemplateDTO | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState(
    laneOptions[0]?.laneId ?? ""
  );
  const [customJudul, setCustomJudul] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function resetCreateForm() {
    setNama("");
    setJenis("WIRING");
    setBolehParalel(false);
    setDeskripsi("");
    setSubScopes([{ judul: "1. Persiapan & Pemeriksaan Awal", details: [""] }]);
    setErrorMsg(null);
  }

  function addSubScope() {
    setSubScopes((prev) => [
      ...prev,
      { judul: `${prev.length + 1}. `, details: [""] },
    ]);
  }

  function removeSubScope(idx: number) {
    setSubScopes((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSubScopeTitle(idx: number, val: string) {
    setSubScopes((prev) =>
      prev.map((ss, i) => (i === idx ? { ...ss, judul: val } : ss))
    );
  }

  function addDetail(ssIdx: number) {
    setSubScopes((prev) =>
      prev.map((ss, i) =>
        i === ssIdx ? { ...ss, details: [...ss.details, ""] } : ss
      )
    );
  }

  function updateDetail(ssIdx: number, detIdx: number, val: string) {
    setSubScopes((prev) =>
      prev.map((ss, i) =>
        i === ssIdx
          ? {
              ...ss,
              details: ss.details.map((d, j) => (j === detIdx ? val : d)),
            }
          : ss
      )
    );
  }

  function removeDetail(ssIdx: number, detIdx: number) {
    setSubScopes((prev) =>
      prev.map((ss, i) =>
        i === ssIdx
          ? { ...ss, details: ss.details.filter((_, j) => j !== detIdx) }
          : ss
      )
    );
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const cleanedSubScopes = subScopes
      .map((ss) => ({
        judul: ss.judul.trim(),
        details: ss.details.map((d) => d.trim()).filter(Boolean),
      }))
      .filter((ss) => ss.judul && ss.details.length > 0);

    if (cleanedSubScopes.length === 0) {
      setErrorMsg("Isi minimal 1 sub-scope beserta minimal 1 detail tugas.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama,
          jenis,
          bolehParalel,
          deskripsi: deskripsi.trim() || null,
          subScopes: cleanedSubScopes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Gagal menyimpan template.");
        return;
      }
      setCreateOpen(false);
      resetCreateForm();
      router.refresh();
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan saat menyimpan template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate(tpl: TemplateDTO) {
    if (
      !window.confirm(
        `Hapus template "${tpl.nama}"? Pekerjaan proyek yang sudah memakai template ini tidak akan ikut terhapus.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/templates/${tpl.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      alert("Gagal menghapus template.");
    }
  }

  function openApplyModal(tpl: TemplateDTO) {
    setApplyTarget(tpl);
    setCustomJudul(tpl.nama);
    setSelectedLaneId(laneOptions[0]?.laneId ?? "");
    setApplyError(null);
  }

  async function handleApplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!applyTarget || !selectedLaneId) return;
    setApplyError(null);
    setApplying(true);
    try {
      const res = await fetch("/api/templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: applyTarget.id,
          laneId: selectedLaneId,
          judul: customJudul.trim() || applyTarget.nama,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApplyError(data.error ?? "Gagal menerapkan template.");
        return;
      }
      const targetLane = selectedLaneId;
      setApplyTarget(null);
      router.push(`/jadwal/lane/${targetLane}`);
      router.refresh();
    } catch {
      setApplyError("Terjadi kesalahan jaringan saat menerapkan template.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Template Pekerjaan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Standarisasi scope pekerjaan berulang (wiring panel, komunikasi
            PLC/Robot, commissioning, trial run) lengkap dengan sub-scope &
            detail tugas agar siap ditempel ke lane proyek mana pun.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Buat Template Baru
        </button>
      </div>

      {/* Daftar Template */}
      {initialTemplates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Layers className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-800">
            Belum ada template pekerjaan
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Buat template pertama Anda agar struktur sub-scope dan detail tugas
            tidak perlu diketik ulang di proyek berikutnya.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {initialTemplates.map((tpl) => {
            const isExpanded = !!expandedIds[tpl.id];
            const totalDetails = tpl.subScopes.reduce(
              (s, ss) => s + ss.details.length,
              0
            );
            return (
              <div
                key={tpl.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(tpl.id)}
                        className="inline-flex items-center gap-1.5 text-left font-bold text-slate-900 text-base hover:text-blue-600 cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span>{tpl.nama}</span>
                      </button>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {WORK_TYPE_LABELS[tpl.jenis] ?? tpl.jenis}
                      </span>
                      {tpl.bolehParalel && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Boleh Paralel
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        {tpl.subScopes.length} sub-scope • {totalDetails} detail
                        tugas
                      </span>
                    </div>
                    {tpl.deskripsi && (
                      <p className="text-sm text-slate-600 pl-5">
                        {tpl.deskripsi}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-5 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => openApplyModal(tpl)}
                      disabled={laneOptions.length === 0}
                      title={
                        laneOptions.length === 0
                          ? "Buat lane pada salah satu proyek terlebih dahulu"
                          : "Tambahkan pekerjaan dari template ini ke lane proyek"
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <span>Terapkan ke Lane</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Hapus template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 space-y-3">
                    {tpl.subScopes.map((ss) => (
                      <div
                        key={ss.id}
                        className="bg-white rounded-xl border border-slate-200/80 p-3.5"
                      >
                        <div className="text-sm font-semibold text-slate-800">
                          {ss.judul}
                        </div>
                        <ul className="mt-1.5 space-y-1 text-xs text-slate-600 pl-4">
                          {ss.details.map((d, idx) => {
                            const letter = String.fromCharCode(97 + (idx % 26));
                            const hasPrefix = /^[a-z]\.\s/i.test(d.teks);
                            return (
                              <li key={d.id} className="leading-relaxed">
                                {hasPrefix ? d.teks : `${letter}. ${d.teks}`}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Buat Template Baru */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                Buat Template Pekerjaan Baru
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Template Pekerjaan *
                  </label>
                  <input
                    type="text"
                    required
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Contoh: Setting Komunikasi PLC - Robot & Interlock"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Pekerjaan
                  </label>
                  <select
                    value={jenis}
                    onChange={(e) => setJenis(e.target.value as WorkType)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {WORK_TYPES.map((wt) => (
                      <option key={wt} value={wt}>
                        {WORK_TYPE_LABELS[wt]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bolehParalel}
                      onChange={(e) => setBolehParalel(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Boleh paralel (dikecualikan dari batas 1/hari)</span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deskripsi Singkat (Opsional)
                  </label>
                  <input
                    type="text"
                    value={deskripsi}
                    onChange={(e) => setDeskripsi(e.target.value)}
                    placeholder="Catatan penggunaan template ini..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Hierarki Sub-scope & Detail Tugas
                  </label>
                  <button
                    type="button"
                    onClick={addSubScope}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    + Tambah Sub-scope
                  </button>
                </div>

                {subScopes.map((ss, ssIdx) => (
                  <div
                    key={ssIdx}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={ss.judul}
                        onChange={(e) =>
                          updateSubScopeTitle(ssIdx, e.target.value)
                        }
                        placeholder={`${ssIdx + 1}. Nama Sub-scope`}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-medium"
                      />
                      {subScopes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSubScope(ssIdx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Hapus sub-scope"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 pl-3 border-l-2 border-blue-200">
                      {ss.details.map((det, detIdx) => (
                        <div key={detIdx} className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-500 w-4">
                            {String.fromCharCode(97 + (detIdx % 26))}.
                          </span>
                          <input
                            type="text"
                            required
                            value={det}
                            onChange={(e) =>
                              updateDetail(ssIdx, detIdx, e.target.value)
                            }
                            placeholder="Detail langkah tugas..."
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                          {ss.details.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDetail(ssIdx, detIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Hapus detail"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addDetail(ssIdx)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        + Tambah baris detail
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold cursor-pointer"
                >
                  {saving ? "Menyimpan..." : "Simpan Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Terapkan Template ke Lane */}
      {applyTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                Terapkan Template ke Lane Proyek
              </h2>
              <button
                type="button"
                onClick={() => setApplyTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="p-6 space-y-4">
              {applyError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {applyError}
                </div>
              )}

              <div>
                <div className="text-xs text-slate-500">Template dipilih</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {applyTarget.nama}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Lane Tujuan *
                </label>
                <select
                  required
                  value={selectedLaneId}
                  onChange={(e) => setSelectedLaneId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {laneOptions.map((opt) => (
                    <option key={opt.laneId} value={opt.laneId}>
                      {opt.projectClient} — {opt.projectNama} (Lane:{" "}
                      {opt.laneNama})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Pekerjaan di Lane Tujuan
                </label>
                <input
                  type="text"
                  required
                  value={customJudul}
                  onChange={(e) => setCustomJudul(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={applying || !selectedLaneId}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold cursor-pointer"
                >
                  {applying ? "Menerapkan..." : "Tambahkan & Buka Grid"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
