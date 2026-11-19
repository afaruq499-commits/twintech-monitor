"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Edit3,
  FileSpreadsheet,
  GitFork,
  LayoutGrid,
  List,
  Plus,
  Search,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import {
  PR_STATUS_LABELS,
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  type PrStatus,
  type ProjectPriority,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/constants";
import { formatTanggalId } from "@/lib/date-utils";
import { ProjectFormModal, type EditableProject } from "./ProjectFormModal";

interface ProjectOverviewItem extends EditableProject {
  id: string;
  totalComponents: number;
  arrivedComponents: number;
  checkCount: number;
  progressPct: number;
  checklistCompletedCount: number;
  checklistTotalCount: number;
  lanesCount: number;
  scheduledCellsCount: number;
  gambarUrl?: string | null;
  flowSequenceJson?: string | null;
  wiringDiagramPdfUrl?: string | null;
  wiringDiagramPdfName?: string | null;
}

export function ProjectsClient({
  projects,
}: {
  projects: ProjectOverviewItem[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"GRID" | "LIST">("GRID");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EditableProject | null>(null);

  // Deteksi trigger pembuatan proyek dari Primary Action sidebar (?action=baru / ?action=new)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "baru" || params.get("action") === "new") {
        setEditing(null);
        setModalOpen(true);
      }
      const savedView = window.localStorage.getItem("pm_projects_view");
      if (savedView === "LIST" || savedView === "GRID") {
        setViewMode(savedView);
      }
    }
  }, []);

  function handleViewModeChange(mode: "GRID" | "LIST") {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("pm_projects_view", mode);
    }
  }

  const filtered = projects.filter((p) => {
    if (typeFilter !== "ALL" && (p.tipeProyek ?? "AUTOMATION_KECIL") !== typeFilter)
      return false;
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && p.prioritas !== priorityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        (p.kode ?? "").toLowerCase().includes(q) ||
        (p.nama ?? "").toLowerCase().includes(q) ||
        (p.client ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  async function handleDelete(p: ProjectOverviewItem) {
    if (
      !window.confirm(
        `Hapus proyek "${p.nama}" beserta seluruh komponen dan jadwalnya?`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Manajemen Proyek
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar seluruh mesin otomasi, kemajuan 8 berkas proyek, PR, dan timeline pengerjaan.
          </p>
        </div>

        {/* Action Buttons & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => handleViewModeChange("GRID")}
              title="Tampilan Grid Kartu"
              className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                viewMode === "GRID"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("LIST")}
              title="Tampilan Spreadsheet / Tabel"
              className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                viewMode === "LIST"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <Link
            href="/jadwal/buat"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#161822] border border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-200 text-xs font-bold shadow-xs transition"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
            <span>Schedule</span>
          </Link>

          <Link
            href="/import-schedule"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#161822] border border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-200 text-xs font-bold shadow-xs transition"
          >
            <Upload className="w-3.5 h-3.5 text-[#F05232]" />
            <span>Import</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-neutral-800 dark:hover:bg-slate-100 text-xs font-bold shadow-xs transition duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Proyek Baru</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar Airy & Refined */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-slate-200/70 dark:border-white/[0.08] p-3 flex flex-col md:flex-row items-stretch gap-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode proyek, nama proyek, atau nama client..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.08] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F05232]/30 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Tipe</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROJECT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.08] text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.08] text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Prioritas</option>
            {PROJECT_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                Prioritas {PROJECT_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>

          {(search || typeFilter !== "ALL" || statusFilter !== "ALL" || priorityFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("ALL");
                setStatusFilter("ALL");
                setPriorityFilter("ALL");
              }}
              className="text-xs font-semibold text-[#F05232] hover:underline px-2 py-1 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main View Area: GRID or LIST */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#161822] rounded-2xl border border-slate-200/70 dark:border-white/[0.08] p-12 text-center text-slate-500 text-xs">
          Belum ada proyek yang sesuai dengan kriteria pencarian atau filter.
        </div>
      ) : viewMode === "GRID" ? (
        /* ==================== 1. GRID CARDS VIEW ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5 transition-all duration-200">
          {filtered.map((p) => {
            const prioBadge =
              p.prioritas === "TINGGI"
                ? "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                : p.prioritas === "SEDANG"
                ? "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                : "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-white/[0.05] dark:text-slate-300 dark:border-white/10";

            const statusBadge =
              p.status === "SELESAI"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                : p.status === "WIRING" || p.status === "PROGRAMMING" || p.status === "COMMISSIONING"
                ? "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                : "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-white/[0.05] dark:text-slate-300 dark:border-white/10";

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-[#161822] rounded-2xl border border-slate-200/70 dark:border-white/[0.08] p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.02)] hover:border-slate-300 dark:hover:border-white/20 hover:shadow-md hover:-translate-y-0.5 transition-all duration-180 ease-out group"
              >
                <div>
                  {/* Card Top Meta & Pill Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.warna || "#F05232" }}
                        title={`Warna Identitas: ${p.warna}`}
                      />
                      {p.kode && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px] font-mono font-bold">
                          {p.kode}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${prioBadge}`}
                      >
                        {PROJECT_PRIORITY_LABELS[p.prioritas as ProjectPriority] ?? "Sedang"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}
                      >
                        {PROJECT_STATUS_LABELS[p.status as ProjectStatus] ?? p.status}
                      </span>
                      {p.bolehParalel && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200/60 text-[10px] font-bold">
                          <GitFork className="w-2.5 h-2.5" /> Paralel
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(p);
                          setModalOpen(true);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
                        title="Edit Proyek"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer"
                        title="Hapus Proyek"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Project Image Preview (jika ada) */}
                  {p.gambarUrl && (
                    <div className="w-full h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mt-3 relative border border-slate-100 dark:border-white/[0.06]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.gambarUrl}
                        alt={p.nama}
                        className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                      />
                    </div>
                  )}

                  {/* Project Title & Client */}
                  <Link href={`/proyek/${p.id}`} className="block mt-3">
                    <h2 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-[#F05232] transition line-clamp-1">
                      {p.nama}
                    </h2>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-1.5 truncate">
                      <span>{p.client}</span>
                      <span>•</span>
                      <span>PR: {PR_STATUS_LABELS[p.prStatus as PrStatus] ?? "Draft"}</span>
                    </div>
                  </Link>

                  {p.deskripsi && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 font-normal leading-relaxed">
                      {p.deskripsi}
                    </p>
                  )}

                  {/* Slim Progress Bars Section */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-2.5">
                    {/* Progress Berkas 8 Dokumen */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          Berkas & Dokumen
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {p.checklistCompletedCount}/{p.checklistTotalCount} ({p.progressPct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${p.progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Progress Kesiapan Komponen PR */}
                    {p.totalComponents > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-600 dark:text-slate-400">
                            Komponen Tiba
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {p.arrivedComponents}/{p.totalComponents} part
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((p.arrivedComponents / p.totalComponents) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: PIC Avatars & Deadline */}
                <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-100 dark:border-white/[0.06] text-xs">
                  {/* PIC Avatar Stack */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 ring-2 ring-white dark:ring-[#161822]">
                      {(p.pic || "Far").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate max-w-[100px]">
                      {p.pic || "Team"}
                    </span>
                  </div>

                  <Link
                    href={`/proyek/${p.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#F05232] hover:text-[#da381b] group-hover:translate-x-0.5 transition-all"
                  >
                    <span>Detail ({p.lanesCount} Lane)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== 2. COMPACT SPREADSHEET / TABLE VIEW ==================== */
        <div className="bg-white dark:bg-[#161822] rounded-2xl border border-slate-200/70 dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden transition-all duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/70 dark:border-white/[0.06] select-none">
                <tr>
                  <th className="py-3 px-4">Proyek & Kode</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Tipe & Prioritas</th>
                  <th className="py-3 px-3">Status PR</th>
                  <th className="py-3 px-3">Progress Berkas</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3">PIC</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors duration-150 group"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      <Link
                        href={`/proyek/${p.id}`}
                        className="flex items-center gap-2 hover:text-[#F05232] transition"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.warna || "#F05232" }}
                        />
                        {p.kode && (
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-white/[0.08] px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-200">
                            {p.kode}
                          </span>
                        )}
                        <span className="truncate max-w-[220px]">{p.nama}</span>
                      </Link>
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                      {p.client}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200">
                          {PROJECT_TYPE_LABELS[(p.tipeProyek as ProjectType)] ?? "Otomasi"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.prioritas === "TINGGI"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                              : p.prioritas === "SEDANG"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                              : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400"
                          }`}
                        >
                          {PROJECT_PRIORITY_LABELS[p.prioritas as ProjectPriority] ?? "Sedang"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                      {PR_STATUS_LABELS[p.prStatus as PrStatus] ?? "Draft"}
                    </td>

                    <td className="py-3 px-3">
                      <div className="w-28 space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                          <span>{p.checklistCompletedCount}/{p.checklistTotalCount}</span>
                          <span>{p.progressPct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${p.progressPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                      {formatTanggalId(p.deadline, false)}
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        <User className="w-3 h-3 text-slate-400" />
                        {p.pic || "Team"}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/proyek/${p.id}`}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#F05232] hover:bg-[#F05232]/10 transition"
                        >
                          Detail
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(p);
                            setModalOpen(true);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form Proyek */}
      {modalOpen && (
        <ProjectFormModal
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSaved={(projectId) => {
            setModalOpen(false);
            if (!editing) {
              router.push(`/proyek/${projectId}`);
            } else {
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}
