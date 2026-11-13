"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Calendar,
  CalendarPlus,
  Edit3,
  FileSpreadsheet,
  GitFork,
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EditableProject | null>(null);

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
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Manajemen Proyek
          </h1>
          <p className="text-sm text-slate-600">
            Kelola seluruh proyek otomasi, progress komponen PR, dan jadwal lane.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/jadwal/buat"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#141518] hover:bg-neutral-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-[#111216] text-xs font-bold shadow-xs transition"
          >
            <CalendarPlus className="w-4 h-4" />
            Buat Schedule Proyek
          </Link>
          <Link
            href="/import-schedule"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full v14-card hover:bg-slate-50 text-slate-800 text-xs font-bold transition"
          >
            <Upload className="w-4 h-4 text-[#F05232]" />
            Import Schedule
          </Link>
          <Link
            href="/import-pr"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full v14-card hover:bg-slate-50 text-slate-800 text-xs font-bold transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Import dari PR
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#F45B38] to-[#D9381E] hover:brightness-105 text-white text-xs font-bold shadow-sm cursor-pointer transition"
          >
            <Plus className="w-4 h-4" />
            Proyek Baru
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="v14-card rounded-[24px] p-3.5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode proyek, nama proyek, atau client..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-blue-900"
        >
          <option value="ALL">Semua Tipe Proyek</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROJECT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium"
        >
          <option value="ALL">Semua Status Proyek</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium"
        >
          <option value="ALL">Semua Prioritas</option>
          {PROJECT_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              Prioritas {PROJECT_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      {/* Daftar Kartu Proyek */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500 text-sm">
          Belum ada proyek yang sesuai filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const prioBadge =
              p.prioritas === "TINGGI"
                ? "bg-rose-100 text-rose-800"
                : p.prioritas === "SEDANG"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700";

            return (
              <div
                key={p.id}
                className="v14-card v14-card-interactive rounded-[24px] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.warna }}
                      />
                      {p.kode && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-xs font-mono font-bold">
                          {p.kode}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                          p.tipeProyek === "IOT"
                            ? "bg-purple-100 text-purple-800"
                            : p.tipeProyek === "AUTOMATION_BESAR"
                              ? "bg-indigo-100 text-indigo-800"
                              : p.tipeProyek === "AFTER_SALES"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-teal-100 text-teal-800"
                        }`}
                      >
                        {PROJECT_TYPE_LABELS[(p.tipeProyek as ProjectType)] ??
                          p.tipeProyek ??
                          "Otomasi"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-bold ${prioBadge}`}
                      >
                        {PROJECT_PRIORITY_LABELS[p.prioritas as ProjectPriority] ??
                          p.prioritas ??
                          "Sedang"}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                        {PROJECT_STATUS_LABELS[p.status as ProjectStatus] ??
                          p.status ??
                          "Planning"}
                      </span>
                      {p.bolehParalel && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-bold">
                          <GitFork className="w-3 h-3" /> Paralel
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(p);
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                        title="Edit Proyek"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        title="Hapus Proyek"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <Link
                    href={`/proyek/${p.id}`}
                    className="block mt-2.5 group"
                  >
                    {p.gambarUrl && (
                      <div className="w-full h-32 rounded-xl overflow-hidden bg-slate-900 mb-2.5 relative border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.gambarUrl}
                          alt={p.nama}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                    )}
                    <h2 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition">
                      {p.nama}
                    </h2>
                    <div className="text-xs font-semibold text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                      <span>
                        Client: {p.client} • PR:{" "}
                        {PR_STATUS_LABELS[p.prStatus as PrStatus] ?? p.prStatus ?? "Draft"}
                      </span>
                      {p.pic && (
                        <span className="inline-flex items-center gap-1 text-slate-700 font-bold">
                          • <User className="w-3.5 h-3.5 text-blue-600" /> PIC:{" "}
                          {p.pic}
                        </span>
                      )}
                    </div>
                  </Link>

                  {p.deskripsi && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                      {p.deskripsi}
                    </p>
                  )}

                  {/* Progress Proyek (8 Berkas Standar) */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700">
                        Progress Proyek
                      </span>
                      <span className="font-bold text-slate-900">
                        {p.checklistCompletedCount}/{p.checklistTotalCount} berkas ({p.progressPct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{
                          width: `${p.progressPct}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3.5 mt-4 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Deadline:{" "}
                      <strong className="text-slate-800">
                        {formatTanggalId(p.deadline, false)}
                      </strong>
                    </span>
                  </div>
                  <Link
                    href={`/proyek/${p.id}`}
                    className="font-bold text-blue-600 hover:text-blue-700"
                  >
                    Detail ({p.lanesCount} Lane) →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
