"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  GitFork,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import {
  PROJECT_COLOR_PALETTE,
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABELS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  WORK_TYPES,
  WORK_TYPE_LABELS,
  type ProjectPriority,
  type ProjectType,
  type WorkType,
} from "@/lib/constants";
import {
  AUTOMATION_KECIL_TEMPLATE,
  getTemplateByProjectType,
} from "@/lib/project-templates";
import { SYSTEM_PICS } from "@/lib/users";

interface ExistingProjectOption {
  id: string;
  kode: string | null;
  nama: string;
  client: string;
  deadline: string | null;
  pic: string | null;
  bolehParalel: boolean;
}

interface SubWorkDraft {
  judul: string;
  rincianText: string;
}

interface WorkDraft {
  judul: string;
  jenis: WorkType;
  pic: string;
  deadline: string;
  bolehParalel: boolean;
  jadwalMulai: string;
  jadwalSelesai: string;
  warnaKolom: string;
  komentarAwal: string;
  subPekerjaan: SubWorkDraft[];
}

export function CreateProjectScheduleClient({
  existingProjects,
  defaultTodayIso,
}: {
  existingProjects: ExistingProjectOption[];
  defaultTodayIso: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get("projectId") ?? "";
  const preselectedProj = existingProjects.find(
    (p) => p.id === preselectedProjectId
  );

  const [projectMode, setProjectMode] = useState<"NEW" | "EXISTING">(
    preselectedProj ? "EXISTING" : "NEW"
  );
  const [existingProjectId, setExistingProjectId] = useState(
    preselectedProj?.id ?? existingProjects[0]?.id ?? ""
  );

  // Field Proyek Baru
  const [namaProyek, setNamaProyek] = useState("");
  const [client, setClient] = useState("");
  const [kodeProyek, setKodeProyek] = useState("");
  const [tipeProyek, setTipeProyek] = useState<ProjectType>("AUTOMATION_KECIL");
  const [prioritasProyek, setPrioritasProyek] =
    useState<ProjectPriority>("TINGGI");
  const [warnaProyek, setWarnaProyek] = useState(PROJECT_COLOR_PALETTE[0]);

  // Field Utama Schedule Pengerjaan
  const [judulPengerjaan, setJudulPengerjaan] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState(defaultTodayIso);
  const [deadline, setDeadline] = useState(preselectedProj?.deadline ?? "");
  const [picUtama, setPicUtama] = useState(preselectedProj?.pic ?? "");
  const [proyekParalel, setProyekParalel] = useState(
    preselectedProj?.bolehParalel ?? false
  );

  // Daftar Pekerjaan & Sub-Pekerjaan (Otomatis menggunakan Template Automation Kecil - Function Tester)
  const [pekerjaanList, setPekerjaanList] = useState<WorkDraft[]>(() =>
    AUTOMATION_KECIL_TEMPLATE.map((tpl) => ({
      judul: tpl.judul,
      jenis: tpl.jenis,
      pic: "",
      deadline: "",
      bolehParalel: false,
      jadwalMulai: defaultTodayIso,
      jadwalSelesai: defaultTodayIso,
      warnaKolom: "#00B050",
      komentarAwal: "",
      subPekerjaan: tpl.subPekerjaan.map((sp) => ({
        judul: sp.judul,
        rincianText: sp.rincianText,
      })),
    }))
  );

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function applyTemplateByTipe(type: ProjectType) {
    const tpls = getTemplateByProjectType(type);
    setPekerjaanList(
      tpls.map((tpl) => ({
        judul: tpl.judul,
        jenis: tpl.jenis,
        pic: picUtama.trim(),
        deadline: deadline || "",
        bolehParalel: false,
        jadwalMulai: tanggalMulai || defaultTodayIso,
        jadwalSelesai: tanggalMulai || defaultTodayIso,
        warnaKolom: "#00B050",
        komentarAwal: "",
        subPekerjaan: tpl.subPekerjaan.map((sp) => ({
          judul: sp.judul,
          rincianText: sp.rincianText,
        })),
      }))
    );
  }

  function handleTipeProyekChange(newType: ProjectType) {
    setTipeProyek(newType);
    applyTemplateByTipe(newType);
  }

  function handleSelectExistingProject(id: string) {
    setExistingProjectId(id);
    const found = existingProjects.find((p) => p.id === id);
    if (found) {
      if (found.deadline && !deadline) setDeadline(found.deadline);
      if (found.pic && !picUtama) setPicUtama(found.pic);
      setProyekParalel(found.bolehParalel);
    }
  }

  function addPekerjaan() {
    setPekerjaanList((prev) => [
      ...prev,
      {
        judul: "",
        jenis: "PROGRAMMING",
        pic: "",
        deadline: "",
        bolehParalel: false,
        jadwalMulai: tanggalMulai,
        jadwalSelesai: tanggalMulai,
        warnaKolom: "#00B050",
        komentarAwal: "",
        subPekerjaan: [
          {
            judul: "1. Ruang Lingkup Sub-Pekerjaan",
            rincianText: "",
          },
        ],
      },
    ]);
  }

  function removePekerjaan(idx: number) {
    setPekerjaanList((prev) => prev.filter((_, i) => i !== idx));
  }

  function updatePekerjaan<K extends keyof WorkDraft>(
    idx: number,
    key: K,
    value: WorkDraft[K]
  ) {
    setPekerjaanList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item))
    );
  }

  function addSubPekerjaan(wIdx: number) {
    setPekerjaanList((prev) =>
      prev.map((w, i) =>
        i === wIdx
          ? {
              ...w,
              subPekerjaan: [
                ...w.subPekerjaan,
                {
                  judul: `${w.subPekerjaan.length + 1}. `,
                  rincianText: "",
                },
              ],
            }
          : w
      )
    );
  }

  function removeSubPekerjaan(wIdx: number, sIdx: number) {
    setPekerjaanList((prev) =>
      prev.map((w, i) =>
        i === wIdx
          ? {
              ...w,
              subPekerjaan: w.subPekerjaan.filter((_, j) => j !== sIdx),
            }
          : w
      )
    );
  }

  function updateSubPekerjaan(
    wIdx: number,
    sIdx: number,
    field: keyof SubWorkDraft,
    val: string
  ) {
    setPekerjaanList((prev) =>
      prev.map((w, i) =>
        i === wIdx
          ? {
              ...w,
              subPekerjaan: w.subPekerjaan.map((sp, j) =>
                j === sIdx ? { ...sp, [field]: val } : sp
              ),
            }
          : w
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const formattedWorkList = pekerjaanList.map((w) => ({
      judul: w.judul.trim(),
      jenis: w.jenis,
      pic: w.pic.trim() || picUtama.trim() || null,
      deadline: w.deadline || deadline || null,
      bolehParalel: w.bolehParalel || proyekParalel,
      jadwalMulai: w.jadwalMulai || null,
      jadwalSelesai: w.jadwalSelesai || w.jadwalMulai || null,
      statusJadwal: "TARGET" as const,
      warnaKolom:
        w.warnaKolom.toUpperCase() === "#00B050" ? null : w.warnaKolom,
      komentarAwal: w.komentarAwal.trim() || null,
      subPekerjaan: w.subPekerjaan
        .map((sp) => {
          const lines = sp.rincianText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          return {
            judul: sp.judul.trim(),
            details: lines.length > 0 ? lines : [sp.judul.trim()],
          };
        })
        .filter((sp) => sp.judul),
    }));

    if (formattedWorkList.some((w) => !w.judul || w.subPekerjaan.length === 0)) {
      setErrorMsg(
        "Pastikan setiap Pekerjaan memiliki nama pekerjaan dan minimal 1 Sub-Pekerjaan."
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/schedule/create-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectMode,
          existingProjectId:
            projectMode === "EXISTING" ? existingProjectId : null,
          namaProyek: projectMode === "NEW" ? namaProyek : null,
          client: projectMode === "NEW" ? client : null,
          kodeProyek: projectMode === "NEW" ? kodeProyek : null,
          prioritasProyek,
          tipeProyek,
          warnaProyek,
          proyekParalel,
          judulPengerjaan,
          tanggalMulai,
          deadline: deadline || null,
          picUtama: picUtama.trim() || null,
          pekerjaanList: formattedWorkList,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Gagal menyimpan schedule proyek.");
        return;
      }
      router.push(`/jadwal/lane/${data.laneId}`);
      router.refresh();
    } catch {
      setErrorMsg("Terjadi kesalahan koneksi saat menyimpan schedule proyek.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link
            href="/jadwal"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 mb-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Jadwal & Kalender
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Buat Schedule Proyek
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Susun jadwal proyek lengkap dalam satu halaman: nama proyek, judul
            pengerjaan, daftar pekerjaan & sub-pekerjaan, deadline, siapa yang
            mengerjakan (PIC), serta mode proyek paralel.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold">
          {errorMsg}
        </div>
      )}

      {/* Bagian 1: Identitas Proyek, Judul Pengerjaan, Deadline & PIC */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <h2 className="text-lg font-extrabold text-slate-900">
            1. Data Proyek, Judul Pengerjaan, Deadline & Pelaksana
          </h2>

          {existingProjects.length > 0 && (
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setProjectMode("NEW")}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition cursor-pointer ${
                  projectMode === "NEW"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                + Proyek Baru
              </button>
              <button
                type="button"
                onClick={() => {
                  setProjectMode("EXISTING");
                  if (existingProjects[0] && !existingProjectId) {
                    handleSelectExistingProject(existingProjects[0].id);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition cursor-pointer ${
                  projectMode === "EXISTING"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pilih Proyek yang Sudah Ada
              </button>
            </div>
          )}
        </div>

        {projectMode === "NEW" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-slate-800 mb-1">
                Nama Proyek *
              </label>
              <input
                type="text"
                required
                value={namaProyek}
                onChange={(e) => setNamaProyek(e.target.value)}
                placeholder="Contoh: Jig Welding Bracket 24K / Mesin Conveyor Line 2"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">
                Client / Customer
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Contoh: PT ROKI INDONESIA"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">
                Kode Proyek (Opsional)
              </label>
              <input
                type="text"
                value={kodeProyek}
                onChange={(e) => setKodeProyek(e.target.value)}
                placeholder="Contoh: 26 RKI 1020"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">
                Tipe Proyek Otomasi *
              </label>
              <select
                value={tipeProyek}
                onChange={(e) =>
                  handleTipeProyekChange(e.target.value as ProjectType)
                }
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-blue-400 bg-blue-50/50 text-base font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROJECT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {tipeProyek === "AUTOMATION_KECIL" &&
                  "✨ Otomatis memuat 9 template pekerjaan standar Function Tester (bisa diedit & disesuaikan)."}
                {tipeProyek === "IOT" &&
                  "✨ Otomatis memuat template arsitektur IoT, firmware edge, dan dashboard."}
                {tipeProyek === "AUTOMATION_BESAR" &&
                  "✨ Otomatis memuat template multi-station SPM, robot & PLC motion control."}
                {tipeProyek === "INTEGRASI_ROBOT" &&
                  "✨ Otomatis memuat template analisis jangkauan, teaching point robot, safety zone & handshake PLC."}
                {tipeProyek === "AFTER_SALES" &&
                  "✨ Otomatis memuat template troubleshooting, perbaikan part, update program, dan service report."}
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">
                Prioritas Proyek
              </label>
              <select
                value={prioritasProyek}
                onChange={(e) =>
                  setPrioritasProyek(e.target.value as ProjectPriority)
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-base font-semibold"
              >
                {PROJECT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PROJECT_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1.5">
                Warna Identitas di Kalender
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {PROJECT_COLOR_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setWarnaProyek(hex)}
                    className={`w-7 h-7 rounded-full border-2 cursor-pointer transition ${
                      warnaProyek === hex
                        ? "border-slate-950 scale-110 ring-2 ring-offset-1 ring-slate-400"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">
              Pilih Proyek *
            </label>
            <select
              required
              value={existingProjectId}
              onChange={(e) => handleSelectExistingProject(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-base font-bold"
            >
              {existingProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kode ? `[${p.kode}] ` : ""}
                  {p.nama} — {p.client}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-slate-800 mb-1">
              Judul Pengerjaan (Nama Schedule / Lane) *
            </label>
            <input
              type="text"
              required
              value={judulPengerjaan}
              onChange={(e) => setJudulPengerjaan(e.target.value)}
              placeholder="Contoh: Wiring Panel, Programming PLC & Trial Onsite"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">
              Tanggal Mulai (Day 1) *
            </label>
            <input
              type="date"
              required
              value={tanggalMulai}
              onChange={(e) => setTanggalMulai(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">
              Deadline Selesai
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-slate-800 mb-1">
              Yang Mengerjakan / PIC Utama (Siapa)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={picUtama}
                onChange={(e) => setPicUtama(e.target.value)}
                placeholder="Pilih delegasi PIC atau ketik manual..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] font-bold text-slate-500 mr-1">
                Delegasikan ke:
              </span>
              {SYSTEM_PICS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPicUtama(p.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    picUtama === p.value
                      ? "bg-slate-900 text-white shadow-xs ring-2 ring-slate-400"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 flex items-end">
            <label
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition ${
                proyekParalel
                  ? "bg-indigo-50 border-indigo-500 text-indigo-950"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              <input
                type="checkbox"
                checked={proyekParalel}
                onChange={(e) => setProyekParalel(e.target.checked)}
                className="w-4 h-4"
              />
              <div>
                <div className="text-sm font-extrabold flex items-center gap-1.5">
                  <GitFork className="w-4 h-4 text-indigo-600" />
                  Mode Proyek Paralel
                </div>
                <div className="text-xs text-slate-600">
                  Aktifkan jika proyek ini bisa dikerjakan paralel di hari yang
                  sama dengan proyek lain.
                </div>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* Bagian 2: Daftar Pekerjaan & Sub-Pekerjaan */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              2. Daftar Pekerjaan & Sub-Pekerjaan yang Dikerjakan
            </h2>
            <p className="text-sm text-slate-600">
              Tambahkan setiap pekerjaan beserta sub-pekerjaan, rincian tugas,
              PIC pelaksana, tanggal pengerjaan, dan warna kolomnya.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyTemplateByTipe(tipeProyek)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm font-bold cursor-pointer transition"
              title="Reset dan isi ulang pekerjaan sesuai template tipe proyek"
            >
              ✨ Muat Ulang Template ({PROJECT_TYPE_LABELS[tipeProyek]})
            </button>
            <button
              type="button"
              onClick={addPekerjaan}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tambah Pekerjaan
            </button>
          </div>
        </div>

        {/* TABEL EDITOR GRID PENGISIAN PEKERJAAN & SUB-PEKERJAAN */}
        <div className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-xs w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900 text-white divide-x divide-slate-800">
                  <th className="py-3.5 px-3 w-14 text-center font-black tracking-wider uppercase text-xs shrink-0">
                    NO
                  </th>
                  <th className="py-3.5 px-4 w-72 lg:w-80 text-left font-black tracking-wider uppercase text-xs shrink-0">
                    DESCRIPTION (Pekerjaan, PIC & Deadline)
                  </th>
                  <th className="py-3.5 px-4 text-left font-black tracking-wider uppercase text-xs">
                    SCOPE OF WORK (Sub-Pekerjaan & Rincian Tugas)
                  </th>
                  <th className="py-3.5 px-4 w-56 lg:w-64 text-left font-black tracking-wider uppercase text-xs shrink-0">
                    JADWAL PENGERJAAN
                  </th>
                  <th className="py-3.5 px-3 w-14 text-center font-black tracking-wider uppercase text-xs shrink-0">
                    AKSI
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {pekerjaanList.map((w, wIdx) => (
                  <tr
                    key={wIdx}
                    className="hover:bg-slate-50/70 transition divide-x divide-slate-200"
                  >
                    {/* Kolom NO */}
                    <td className="p-3 text-center align-top bg-slate-50/50 font-black text-slate-800 text-base">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 text-white text-xs font-black">
                        {wIdx + 1}
                      </span>
                    </td>

                    {/* Kolom DESCRIPTION */}
                    <td className="p-3.5 align-top space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                          Nama Pekerjaan *
                        </label>
                        <input
                          type="text"
                          required
                          value={w.judul}
                          onChange={(e) =>
                            updatePekerjaan(wIdx, "judul", e.target.value)
                          }
                          placeholder="Nama pekerjaan..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                            Kategori
                          </label>
                          <select
                            value={w.jenis}
                            onChange={(e) =>
                              updatePekerjaan(
                                wIdx,
                                "jenis",
                                e.target.value as WorkType
                              )
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                          >
                            {WORK_TYPES.map((wt) => (
                              <option key={wt} value={wt}>
                                {WORK_TYPE_LABELS[wt]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                            PIC Pelaksana
                          </label>
                          <input
                            type="text"
                            value={w.pic}
                            onChange={(e) =>
                              updatePekerjaan(wIdx, "pic", e.target.value)
                            }
                            placeholder={picUtama || "Pilih / Ketik PIC"}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                          <div className="flex items-center gap-1 mt-1">
                            {SYSTEM_PICS.map((p) => (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() =>
                                  updatePekerjaan(wIdx, "pic", p.value)
                                }
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                                  w.pic === p.value
                                    ? "bg-slate-900 text-white shadow-2xs"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                }`}
                                title={`Tugaskan ke ${p.label}`}
                              >
                                {p.value}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                          Deadline (Opsional)
                        </label>
                        <input
                          type="date"
                          value={w.deadline}
                          onChange={(e) =>
                            updatePekerjaan(wIdx, "deadline", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                        />
                      </div>

                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={w.bolehParalel || proyekParalel}
                          disabled={proyekParalel}
                          onChange={(e) =>
                            updatePekerjaan(
                              wIdx,
                              "bolehParalel",
                              e.target.checked
                            )
                          }
                        />
                        <span>Pekerjaan boleh paralel</span>
                      </label>
                    </td>

                    {/* Kolom SCOPE OF WORK */}
                    <td className="p-3.5 align-top space-y-2.5">
                      <div className="space-y-2.5">
                        {w.subPekerjaan.map((sp, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 group hover:border-blue-300 transition"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-500 shrink-0">
                                {sIdx + 1}.
                              </span>
                              <input
                                type="text"
                                required
                                value={sp.judul}
                                onChange={(e) =>
                                  updateSubPekerjaan(
                                    wIdx,
                                    sIdx,
                                    "judul",
                                    e.target.value
                                  )
                                }
                                placeholder="Judul Sub-Pekerjaan..."
                                className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                              />
                              {w.subPekerjaan.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeSubPekerjaan(wIdx, sIdx)
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                  title="Hapus sub-pekerjaan ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <textarea
                              rows={Math.max(
                                2,
                                Math.min(6, sp.rincianText.split("\n").length)
                              )}
                              value={sp.rincianText}
                              onChange={(e) =>
                                updateSubPekerjaan(
                                  wIdx,
                                  sIdx,
                                  "rincianText",
                                  e.target.value
                                )
                              }
                              placeholder="Rincian tugas per baris: a. Pengecekan... b. Pemasangan..."
                              className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono leading-relaxed focus:ring-2 focus:ring-blue-600 focus:outline-none resize-y"
                            />
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => addSubPekerjaan(wIdx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-blue-400 bg-blue-50/60 hover:bg-blue-100 text-blue-700 text-xs font-extrabold cursor-pointer transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Sub-Pekerjaan
                      </button>
                    </td>

                    {/* Kolom JADWAL PENGERJAAN */}
                    <td className="p-3.5 align-top space-y-2">
                      <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                          Mulai Dikerjakan
                        </label>
                        <input
                          type="date"
                          value={w.jadwalMulai}
                          onChange={(e) => {
                            const nextStart = e.target.value;
                            updatePekerjaan(wIdx, "jadwalMulai", nextStart);
                            if (
                              !w.jadwalSelesai ||
                              w.jadwalSelesai < nextStart
                            ) {
                              updatePekerjaan(wIdx, "jadwalSelesai", nextStart);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                          Sampai Tanggal
                        </label>
                        <input
                          type="date"
                          value={w.jadwalSelesai}
                          onChange={(e) =>
                            updatePekerjaan(
                              wIdx,
                              "jadwalSelesai",
                              e.target.value
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                          Catatan Awal di Sel
                        </label>
                        <input
                          type="text"
                          value={w.komentarAwal}
                          onChange={(e) =>
                            updatePekerjaan(
                              wIdx,
                              "komentarAwal",
                              e.target.value
                            )
                          }
                          placeholder="Opsional..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                        />
                      </div>
                    </td>

                    {/* Kolom AKSI */}
                    <td className="p-3 text-center align-middle bg-slate-50/30">
                      {pekerjaanList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePekerjaan(wIdx)}
                          className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-xl cursor-pointer transition"
                          title={`Hapus Pekerjaan #${wIdx + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Tombol Submit */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <button
          type="button"
          onClick={addPekerjaan}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-sm font-bold cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Tambah Pekerjaan Lainnya
        </button>

        <div className="flex items-center gap-3">
          <Link
            href="/jadwal"
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-base font-extrabold shadow-sm cursor-pointer"
          >
            {saving ? (
              <span>Menyimpan Schedule...</span>
            ) : (
              <>
                <CalendarPlus className="w-5 h-5" />
                <span>Simpan & Buka Tabel Schedule</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
