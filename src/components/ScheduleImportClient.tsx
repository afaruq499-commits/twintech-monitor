"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Layers,
  Save,
  Upload,
  User,
} from "lucide-react";
import {
  PROJECT_COLOR_PALETTE,
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABELS,
  SCHEDULE_CELL_LABELS,
  type ProjectPriority,
} from "@/lib/constants";
import { addDaysIso, todayIsoLocal } from "@/lib/date-utils";
import type { ParsedScheduleWorkbookResult } from "@/lib/export/schedule-importer";

interface ProjectOption {
  id: string;
  kode: string | null;
  nama: string;
  client: string;
  lanesCount: number;
}

interface LaneEditableState {
  laneNama: string;
  subjudul: string;
  tanggalMulai: string;
  jumlahHari: number;
  pic: string;
}

export function ScheduleImportClient({
  projects,
}: {
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get("projectId") ?? "";

  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsed, setParsed] = useState<ParsedScheduleWorkbookResult | null>(
    null
  );
  const [laneStates, setLaneStates] = useState<Record<number, LaneEditableState>>(
    {}
  );
  const [expandedLanes, setExpandedLanes] = useState<Record<number, boolean>>(
    {}
  );

  // Target Destination
  const [targetMode, setTargetMode] = useState<
    "NEW_PROJECT" | "EXISTING_PROJECT"
  >(preselectedProjectId ? "EXISTING_PROJECT" : "NEW_PROJECT");
  const [selectedProjectId, setSelectedProjectId] =
    useState(preselectedProjectId);
  const [replaceExistingLanes, setReplaceExistingLanes] = useState(false);

  // Form Proyek Baru
  const [newProjKode, setNewProjKode] = useState("");
  const [newProjNama, setNewProjNama] = useState("");
  const [newProjClient, setNewProjClient] = useState("");
  const [newProjPrioritas, setNewProjPrioritas] =
    useState<ProjectPriority>("SEDANG");
  const [newProjWarna, setNewProjWarna] = useState("#2563eb");
  const [newProjParalel, setNewProjParalel] = useState(false);

  // Success result banner
  const [successInfo, setSuccessInfo] = useState<{
    projectId: string;
    firstLaneId: string | null;
    lanesCount: number;
  } | null>(null);

  async function handleFilesSelected(files: File[]) {
    if (!files || files.length === 0) return;
    setError(null);
    setSuccessInfo(null);
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));

      const res = await fetch("/api/schedule/preview-import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membaca file Excel schedule.");
        return;
      }

      const result: ParsedScheduleWorkbookResult = data.result;
      setParsed(result);

      // Inisialisasi editable state per lane
      const initialStates: Record<number, LaneEditableState> = {};
      const initialExpanded: Record<number, boolean> = {};

      result.lanes.forEach((l, idx) => {
        initialStates[idx] = {
          laneNama: l.laneNama,
          subjudul: l.subjudul,
          tanggalMulai: l.tanggalMulai || todayIsoLocal(),
          jumlahHari: l.jumlahHari,
          pic: l.workItems[0]?.pic || "",
        };
        initialExpanded[idx] = true; // expand semua lane agar jelas terlihat
      });

      setLaneStates(initialStates);
      setExpandedLanes(initialExpanded);

      // Auto-fill nama proyek baru jika belum diisi
      if (result.lanes.length > 0) {
        const first = result.lanes[0];
        const clientClean = first.client && first.client !== "Client" ? first.client : "MGS";
        setNewProjClient((prev) => prev || clientClean);
        setNewProjNama((prev) => {
          if (prev) return prev;
          if (result.lanes.length === 1) {
            return `Proyek ${first.laneNama}`;
          }
          return `Proyek ${clientClean} (${result.lanes.map((x) => x.laneNama).join(" & ")})`;
        });
      }
    } catch {
      setError("Terjadi kesalahan jaringan saat mengunggah file Excel.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) handleFilesSelected(files);
  }

  function updateLaneField<K extends keyof LaneEditableState>(
    idx: number,
    field: K,
    value: LaneEditableState[K]
  ) {
    setLaneStates((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        [field]: value,
      },
    }));
  }

  function toggleExpand(idx: number) {
    setExpandedLanes((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }

  async function handleCommitImport() {
    if (!parsed || parsed.lanes.length === 0) return;
    setError(null);
    setCommitting(true);

    try {
      // Siapkan lanes dengan tanggalMulai dan nama yang mungkin diedit oleh user di form pratinjau
      const lanesPayload = parsed.lanes.map((l, idx) => {
        const st = laneStates[idx] || {
          laneNama: l.laneNama,
          subjudul: l.subjudul,
          tanggalMulai: l.tanggalMulai,
          jumlahHari: l.jumlahHari,
          pic: "",
        };

        const tanggalMulai = st.tanggalMulai || todayIsoLocal();

        return {
          laneNama: st.laneNama,
          subjudul: st.subjudul,
          tanggalMulai,
          jumlahHari: st.jumlahHari,
          pic: st.pic || null,
          workItems: l.workItems.map((wi) => ({
            urutan: wi.urutan,
            judul: wi.judul,
            jenis: wi.jenis,
            pic: wi.pic || st.pic || null,
            deadline: wi.deadline || null,
            subScopes: wi.subScopes.map((ss) => ({
              urutan: ss.urutan,
              judul: ss.judul,
              details: ss.details.map((det) => ({
                urutan: det.urutan,
                teks: det.teks,
              })),
            })),
            scheduleCells: wi.scheduleCells.map((sc) => ({
              tanggal: addDaysIso(tanggalMulai, sc.dayIndex - 1),
              status: sc.status,
              warnaCustom: sc.warnaCustom || null,
              catatan: sc.catatan || null,
            })),
          })),
        };
      });

      const payload = {
        targetMode,
        existingProjectId:
          targetMode === "EXISTING_PROJECT" ? selectedProjectId : undefined,
        newProject:
          targetMode === "NEW_PROJECT"
            ? {
                kode: newProjKode.trim() || null,
                nama: newProjNama.trim(),
                client: newProjClient.trim() || "Client",
                prioritas: newProjPrioritas,
                warna: newProjWarna,
                pic: laneStates[0]?.pic || null,
                bolehParalel: newProjParalel,
                tanggalMulai: laneStates[0]?.tanggalMulai || todayIsoLocal(),
              }
            : undefined,
        lanes: lanesPayload,
        replaceExistingLanes,
      };

      const res = await fetch("/api/schedule/commit-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan jadwal ke database.");
        return;
      }

      setSuccessInfo({
        projectId: data.projectId,
        firstLaneId: data.firstLaneId,
        lanesCount: lanesPayload.length,
      });

      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan saat menyimpan jadwal.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-extrabold mb-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            IMPORT JADWAL EXCEL
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Import Schedule Proyek
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Membaca file jadwal Excel (multi-sheet atau single-sheet) dengan
            format yang sama persis seperti hasil export File 2.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/proyek"
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700"
          >
            Kembali ke Proyek
          </Link>
          <Link
            href="/jadwal"
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
          >
            Lihat Kalender Jadwal
          </Link>
        </div>
      </div>

      {/* Banner Error jika ada */}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Banner Sukses jika berhasil commit */}
      {successInfo && (
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-emerald-950">
                Jadwal Berhasil Diimpor ke Sistem!
              </h2>
              <p className="text-xs text-emerald-800">
                {successInfo.lanesCount} lane jadwal beserta seluruh pekerjaan,
                sub-scope, detail tugas, dan pewarnaan sel berhasil disimpan.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-emerald-200">
            {successInfo.firstLaneId && (
              <Link
                href={`/jadwal/lane/${successInfo.firstLaneId}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs"
              >
                Buka Tampilan Matrix Lane <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link
              href={`/proyek/${successInfo.projectId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-900 text-xs font-bold"
            >
              Buka Detail Proyek
            </Link>
            <button
              type="button"
              onClick={() => {
                setParsed(null);
                setSuccessInfo(null);
              }}
              className="px-3 py-2 text-xs text-slate-600 hover:text-slate-900 font-bold"
            >
              Import File Lain
            </button>
          </div>
        </div>
      )}

      {/* Dropzone Upload File Excel */}
      {!parsed && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition ${
            uploading
              ? "border-teal-400 bg-teal-50/50 opacity-80"
              : "border-slate-300 bg-white hover:border-teal-500 hover:bg-teal-50/20"
          }`}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <Upload className="w-8 h-8" />
          </div>

          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            Tarik & Lepas File Excel Schedule di Sini
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-lg mx-auto">
            Mendukung <strong>1 file Excel multi-sheet</strong> (seperti tab: <em>MGS | Glasstech</em> & <em>MGS | LandGlass</em>) maupun <strong>2 file Excel terpisah sekaligus</strong>. Keduanya otomatis disatukan ke dalam 1 proyek dengan 2 schedule.
          </p>

          <label className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold cursor-pointer shadow-xs">
            <FileSpreadsheet className="w-4 h-4" />
            {uploading ? "Membaca & Mem-parse Excel..." : "Pilih File dari Komputer (Bisa Pilih Sekaligus)"}
            <input
              type="file"
              accept=".xlsx,.xls"
              multiple
              disabled={uploading}
              className="hidden"
              onChange={(e) => {
                const fs = e.target.files ? Array.from(e.target.files) : [];
                if (fs.length > 0) handleFilesSelected(fs);
              }}
            />
          </label>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <span>✓ 1 Proyek Menampung Semua Schedule / Lane</span>
            <span>✓ Mendukung Multi-Sheet & Multi-File Upload</span>
            <span>✓ Membaca status TARGET, ON PROGRES, DONE, DELAY</span>
          </div>
        </div>
      )}

      {/* Pratinjau & Konfigurasi Simpan */}
      {parsed && !successInfo && (
        <div className="space-y-6">
          {/* Card Info File yang Terbaca */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 font-extrabold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    {parsed.filename}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Terdeteksi {parsed.lanes.length} sheet lane jadwal •{" "}
                    {parsed.companyName || "PT. Twintech Precision"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setParsed(null)}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer self-start sm:self-auto"
              >
                Ganti File Lain
              </button>
            </div>

            {/* Banner Penegas 1 Proyek x Banyak Schedule */}
            {parsed.lanes.length > 1 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold">
                    Terbaca {parsed.lanes.length} Schedule / Lane:{" "}
                  </span>
                  <span className="font-semibold">
                    {parsed.lanes.map((l) => l.laneNama).join(", ")}.
                  </span>
                  <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                    Keduanya otomatis disatukan ke dalam 1 proyek di bawah ini (masing-masing menjadi tab schedule tersendiri).
                  </div>
                </div>
              </div>
            )}

            {/* Target Proyek */}
            <div className="space-y-3">
              <label className="text-xs font-extrabold uppercase tracking-wide text-slate-700 block">
                Target Penyimpanan Jadwal:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                    targetMode === "NEW_PROJECT"
                      ? "border-teal-500 bg-teal-50/50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="targetMode"
                    value="NEW_PROJECT"
                    checked={targetMode === "NEW_PROJECT"}
                    onChange={() => setTargetMode("NEW_PROJECT")}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                      Buat Proyek Baru
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Membuat proyek baru dengan lane dari file Excel ini.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                    targetMode === "EXISTING_PROJECT"
                      ? "border-teal-500 bg-teal-50/50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="targetMode"
                    value="EXISTING_PROJECT"
                    checked={targetMode === "EXISTING_PROJECT"}
                    onChange={() => setTargetMode("EXISTING_PROJECT")}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                      Masukkan ke Proyek yang Sudah Ada
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Tambahkan lane ke proyek yang sudah terdaftar.
                    </div>
                  </div>
                </label>
              </div>

              {/* Form Input Proyek Baru */}
              {targetMode === "NEW_PROJECT" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">
                      Nama Proyek <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newProjNama}
                      onChange={(e) => setNewProjNama(e.target.value)}
                      placeholder="Mis. Integrasi Conveyor Servo & Robot Line Kaca"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Client / Customer
                    </label>
                    <input
                      type="text"
                      value={newProjClient}
                      onChange={(e) => setNewProjClient(e.target.value)}
                      placeholder="Mis. MGS / PT. Maju"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Kode Proyek (Opsional)
                    </label>
                    <input
                      type="text"
                      value={newProjKode}
                      onChange={(e) => setNewProjKode(e.target.value)}
                      placeholder="Mis. PRJ-2026-001"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Prioritas Proyek
                    </label>
                    <select
                      value={newProjPrioritas}
                      onChange={(e) =>
                        setNewProjPrioritas(e.target.value as ProjectPriority)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                    >
                      {PROJECT_PRIORITIES.map((pr) => (
                        <option key={pr} value={pr}>
                          {PROJECT_PRIORITY_LABELS[pr]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Warna Proyek
                    </label>
                    <div className="flex items-center gap-1.5 pt-1">
                      {PROJECT_COLOR_PALETTE.slice(0, 6).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewProjWarna(c)}
                          style={{ backgroundColor: c }}
                          className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                            newProjWarna === c
                              ? "border-slate-900 scale-110 shadow-xs"
                              : "border-white opacity-80"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-200">
                    <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newProjParalel}
                        onChange={(e) => setNewProjParalel(e.target.checked)}
                      />
                      <span>
                        Aktifkan Mode Proyek Paralel (dapat dikerjakan bersamaan
                        dengan proyek lain di hari yang sama)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Pilihan Proyek Existing */}
              {targetMode === "EXISTING_PROJECT" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Pilih Proyek:
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                    >
                      <option value="">-- Pilih Proyek Terdaftar --</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama} ({p.client}) — {p.lanesCount} lane ada
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold">
                    <input
                      type="checkbox"
                      checked={replaceExistingLanes}
                      onChange={(e) => setReplaceExistingLanes(e.target.checked)}
                    />
                    <span>
                      Gantikan (hapus) seluruh lane yang ada sebelumnya di proyek
                      ini dengan lane dari file Excel ini
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Daftar Lane yang Terdeteksi */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-600" />
                Daftar Sheet Lane Terdeteksi ({parsed.lanes.length} Sheet)
              </h2>
              <span className="text-xs text-slate-500">
                Anda bisa menyesuaikan tanggal mulai dan nama lane sebelum disimpan.
              </span>
            </div>

            {parsed.lanes.map((lane, idx) => {
              const st = laneStates[idx] || {
                laneNama: lane.laneNama,
                subjudul: lane.subjudul,
                tanggalMulai: lane.tanggalMulai,
                jumlahHari: lane.jumlahHari,
                pic: "",
              };
              const isExpanded = !!expandedLanes[idx];

              return (
                <div
                  key={`${lane.sheetName}-${idx}`}
                  className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-2xs"
                >
                  {/* Header Card Lane */}
                  <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-teal-600 text-white font-extrabold flex items-center justify-center text-xs shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                            Sheet: {lane.sheetName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px]">
                            {st.jumlahHari} Hari
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-0.5">
                          <span>Client: <strong>{lane.client}</strong></span>
                          <span>•</span>
                          <span>{lane.summary.totalWorkItems} Pekerjaan</span>
                          <span>•</span>
                          <span>{lane.summary.totalDetails} Detail Tugas</span>
                          <span>•</span>
                          <span>{lane.summary.totalScheduledCells} Sel Terjadwal</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => toggleExpand(idx)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-xs font-bold text-slate-700 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" /> Sembunyikan Rincian
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" /> Lihat Rincian Tabel
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Pengaturan Tanggal Mulai & Nama Lane */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-slate-100 text-xs bg-white">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Nama Lane di Sistem:
                      </label>
                      <input
                        type="text"
                        value={st.laneNama}
                        onChange={(e) =>
                          updateLaneField(idx, "laneNama", e.target.value)
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-teal-600" />
                        Tanggal Mulai (Day 1):
                      </label>
                      <input
                        type="date"
                        value={st.tanggalMulai}
                        onChange={(e) =>
                          updateLaneField(idx, "tanggalMulai", e.target.value)
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        PIC Default Lane:
                      </label>
                      <input
                        type="text"
                        value={st.pic}
                        onChange={(e) =>
                          updateLaneField(idx, "pic", e.target.value)
                        }
                        placeholder="Mis. Faruq / Tim Wiring"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Summary Status Badges */}
                  <div className="px-4 py-2.5 bg-slate-50/50 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-bold text-slate-500">
                      Distribusi Sel Jadwal:
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      TARGET: {lane.summary.statusCounts.TARGET || 0}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                      ON PROGRES: {lane.summary.statusCounts.ON_PROGRESS || 0}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px]">
                      DONE: {lane.summary.statusCounts.DONE || 0}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[11px]">
                      DELAY: {lane.summary.statusCounts.DELAY || 0}
                    </span>
                    {lane.summary.hasNotesCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[11px]">
                        💬 {lane.summary.hasNotesCount} Catatan Cell
                      </span>
                    )}
                  </div>

                  {/* Accordion Rincian Pekerjaan */}
                  {isExpanded && (
                    <div className="p-4 overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-300">
                            <th className="p-2 w-8 text-center">NO</th>
                            <th className="p-2 w-48">PEKERJAAN (DESCRIPTION)</th>
                            <th className="p-2 w-48">SUB-SCOPE</th>
                            <th className="p-2">SCOPE OF WORK (DETAIL)</th>
                            <th className="p-2 text-center w-36">HARI TERJADWAL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {lane.workItems.map((wi, wiIdx) => (
                            <tr key={wiIdx} className="hover:bg-slate-50/80">
                              <td className="p-2 text-center font-bold text-slate-500 align-top">
                                {wiIdx + 1}
                              </td>
                              <td className="p-2 align-top">
                                <div className="font-extrabold text-slate-900">
                                  {wi.judul}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-1">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                    {wi.jenis}
                                  </span>
                                  {wi.pic && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                                      PIC: {wi.pic}
                                    </span>
                                  )}
                                  {wi.deadline && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">
                                      DL: {wi.deadline}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 align-top">
                                <ul className="space-y-1">
                                  {wi.subScopes.map((ss, ssIdx) => (
                                    <li
                                      key={ssIdx}
                                      className="font-bold text-slate-800"
                                    >
                                      {ss.judul}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                              <td className="p-2 align-top">
                                <div className="space-y-2">
                                  {wi.subScopes.map((ss, ssIdx) => (
                                    <ul
                                      key={ssIdx}
                                      className="space-y-0.5 text-slate-600"
                                    >
                                      {ss.details.map((det, detIdx) => (
                                        <li key={detIdx}>• {det.teks}</li>
                                      ))}
                                    </ul>
                                  ))}
                                </div>
                              </td>
                              <td className="p-2 align-top text-center">
                                {wi.scheduleCells.length === 0 ? (
                                  <span className="text-slate-400 italic">
                                    Belum ada hari
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {wi.scheduleCells.map((sc, scIdx) => {
                                      const label =
                                        SCHEDULE_CELL_LABELS[sc.status] ||
                                        sc.status;
                                      const defaultBg =
                                        sc.status === "DONE"
                                          ? "bg-blue-600 text-white"
                                          : sc.status === "ON_PROGRESS"
                                            ? "bg-amber-400 text-slate-900"
                                            : sc.status === "DELAY"
                                              ? "bg-orange-500 text-white"
                                              : "bg-emerald-600 text-white";

                                      return (
                                        <span
                                          key={scIdx}
                                          style={
                                            sc.warnaCustom
                                              ? {
                                                  backgroundColor:
                                                    sc.warnaCustom,
                                                  color: "#ffffff",
                                                }
                                              : undefined
                                          }
                                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold shadow-2xs ${
                                            sc.warnaCustom ? "" : defaultBg
                                          }`}
                                          title={`Day ${sc.dayIndex}: ${label}${
                                            sc.catatan
                                              ? ` (Catatan: ${sc.catatan})`
                                              : ""
                                          }`}
                                        >
                                          D{sc.dayIndex}
                                          {sc.catatan && " 💬"}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar Simpan */}
          <div className="sticky bottom-4 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400">Siap Mengimpor:</div>
              <div className="font-extrabold text-sm sm:text-base">
                {parsed.lanes.length} Lane Jadwal →{" "}
                {targetMode === "NEW_PROJECT"
                  ? newProjNama || "Proyek Baru"
                  : projects.find((p) => p.id === selectedProjectId)?.nama ||
                    "Proyek Terpilih"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setParsed(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-300"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  committing ||
                  (targetMode === "NEW_PROJECT" && !newProjNama.trim()) ||
                  (targetMode === "EXISTING_PROJECT" && !selectedProjectId)
                }
                onClick={handleCommitImport}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-50 shadow-md transition"
              >
                <Save className="w-4 h-4" />
                {committing ? "Menyimpan ke Database..." : "Simpan & Terapkan Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
