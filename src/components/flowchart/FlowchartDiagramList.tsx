"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  FileCode2,
  Clock,
  Trash2,
  Copy,
  Edit3,
  RefreshCw,
  AlertTriangle,
  FolderKanban,
} from "lucide-react";

export interface DiagramListItem {
  id: string;
  nama: string;
  deskripsi?: string | null;
  authorName?: string | null;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
  createdAt: string;
}

interface FlowchartDiagramListProps {
  onOpenDiagram: (id: string, initialName: string) => void;
  onCreateNewDiagram: (nama: string, template?: "blank" | "spm" | "decision") => void;
}

export function FlowchartDiagramList({
  onOpenDiagram,
  onCreateNewDiagram,
}: FlowchartDiagramListProps) {
  const [diagrams, setDiagrams] = useState<DiagramListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<"blank" | "spm" | "decision">("spm");

  const [renamingItem, setRenamingItem] = useState<DiagramListItem | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Load Daftar Diagram dari API
  const fetchDiagrams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/flowchart/diagrams", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.isTableMissing) {
          setIsTableMissing(true);
        }
        throw new Error(data.error || "Gagal memuat diagram dari database.");
      }

      setDiagrams(data.diagrams || []);
      setIsTableMissing(false);
    } catch (err: unknown) {
      console.warn("Gagal memuat diagram dari API, memuat fallback lokal:", err);
      setError(err instanceof Error ? err.message : String(err));

      // Fallback ke localStorage
      try {
        const local = localStorage.getItem("twintech_flowchart_local_list");
        if (local) {
          const parsed = JSON.parse(local);
          setDiagrams(parsed);
        }
      } catch {
        // Abaikan jika storage kosong
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagrams();
  }, [fetchDiagrams]);

  // Handle Buat Diagram Baru
  const handleConfirmCreate = () => {
    const title = newTitle.trim() || "Diagram Alur Baru";
    setShowNewModal(false);
    setNewTitle("");
    onCreateNewDiagram(title, selectedTemplate);
  };

  // Handle Hapus Diagram
  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Hapus diagram "${name}" secara permanen?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/flowchart/diagrams/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Gagal menghapus diagram.");
      }
      setDiagrams((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus diagram.");
    }
  };

  // Handle Duplikat Diagram
  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/flowchart/diagrams/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menduplikat diagram.");
      }
      await fetchDiagrams();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menduplikat diagram.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Rename
  const handleConfirmRename = async () => {
    if (!renamingItem) return;
    const title = renameTitle.trim();
    if (!title) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/flowchart/diagrams/${renamingItem.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", nama: title }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengubah nama diagram.");
      }
      setDiagrams((prev) =>
        prev.map((d) => (d.id === renamingItem.id ? { ...d, nama: title } : d))
      );
      setRenamingItem(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengubah nama diagram.");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDiagrams = diagrams.filter((d) =>
    d.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] min-h-[640px] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden transition-colors">
      {/* Header Halaman Daftar Diagram */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">
                Flowchart Studio
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Tahap 5 • Database Cloud
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manajemen alur logika mesin SPM, interlock PLC, dan dokumentasi sistem otomatisasi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari diagram..."
              className="pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 w-44 sm:w-60 transition"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchDiagrams}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition cursor-pointer"
            title="Muat ulang daftar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Tombol Buat Diagram Baru */}
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Diagram Baru</span>
          </button>
        </div>
      </div>

      {/* Database Warning Banner (Jika tabel Supabase belum dimigrasikan) */}
      {isTableMissing ? (
        <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-bold text-amber-900 dark:text-amber-200">
              Tabel Database Belum Dibuat di Supabase
            </div>
            <p className="text-amber-700 dark:text-amber-300/90 mt-0.5 leading-relaxed">
              Tabel <code>flowchart_diagrams</code> belum aktif di Supabase. Anda tetap dapat
              membuat dan mengedit diagram dengan aman (tersimpan sementara di memori & Local
              Storage). Jalankan migrasi SQL yang telah disiapkan setelah Anda membackup database.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-bold text-red-900 dark:text-red-200">
              Gagal Menghubungkan ke Database
            </div>
            <p className="text-red-700 dark:text-red-300/90 mt-0.5 leading-relaxed">
              {error}. Menampilkan daftar diagram lokal cadangan.
            </p>
          </div>
        </div>
      ) : null}

      {/* Konten Utama Grid Diagram */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && diagrams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Menghubungkan ke Supabase...
            </div>
          </div>
        ) : filteredDiagrams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-center max-w-md mx-auto">
            <div className="p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 border border-indigo-100 dark:border-indigo-900/60 mb-4">
              <FileCode2 className="w-10 h-10" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
              {searchQuery ? "Diagram Tidak Ditemukan" : "Belum Ada Diagram Alur"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              {searchQuery
                ? `Tidak ada diagram yang cocok dengan kata kunci "${searchQuery}". Coba kata kunci lain.`
                : "Mulai rancang diagram alur logika mesin otomatisasi, interlock sensor, atau tahapan proyek Anda sekarang."}
            </p>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Diagram Pertama</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDiagrams.map((d) => (
              <div
                key={d.id}
                onClick={() => onOpenDiagram(d.id, d.nama)}
                className="group relative flex flex-col justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 dark:hover:border-indigo-500/50 transition cursor-pointer"
              >
                <div>
                  {/* Header Card */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-1">
                      {d.nama}
                    </h4>
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                      {d.nodeCount} simbol
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                    {d.deskripsi || "Diagram alur sistem otomatisasi Twintech Precision."}
                  </p>
                </div>

                {/* Footer Card */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(d.updatedAt).toLocaleDateString("id-ID")}</span>
                  </div>

                  {/* Actions on Card Hover */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingItem(d);
                        setRenameTitle(d.nama);
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                      title="Ubah Nama"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDuplicate(e, d.id)}
                      disabled={actionLoading}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                      title="Duplikat Diagram"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, d.id, d.nama)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition"
                      title="Hapus Diagram"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Buat Diagram Baru */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1">
              Buat Diagram Alur Baru
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Beri nama diagram alur Anda dan pilih template starter.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Nama Diagram
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Misal: Alur Rotary Table & Clamping"
                  autoFocus
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Template Awal
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate("spm")}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      selectedTemplate === "spm"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div className="text-xs">Starter SPM Alur</div>
                    <div className="text-[10px] opacity-75 font-normal">
                      4 simbol dasar & interlock
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemplate("blank")}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      selectedTemplate === "blank"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div className="text-xs">Kanvas Kosong</div>
                    <div className="text-[10px] opacity-75 font-normal">
                      Mulai dari kanvas bersih
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30 transition cursor-pointer"
              >
                Lanjutkan ke Kanvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ubah Nama (Rename) */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">
              Ubah Nama Diagram
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Masukkan nama baru untuk diagram ini.
            </p>

            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              autoFocus
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingItem(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                disabled={actionLoading || !renameTitle.trim()}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30 disabled:opacity-50 transition cursor-pointer"
              >
                Simpan Nama
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
