"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileSpreadsheet,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABELS,
  type ProjectPriority,
} from "@/lib/constants";
import { formatRupiah } from "@/lib/date-utils";
import type {
  DuplicateGroup,
  DuplicateResolution,
  ParsedComponent,
  ParsedPr,
} from "@/lib/pr-parser";

interface ProjectOption {
  id: string;
  kode: string | null;
  nama: string;
  client: string;
  totalComponents: number;
}

export function PrImportClient({
  projects,
}: {
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get("projectId") ?? "";

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filename, setFilename] = useState("");
  const [parsedMeta, setParsedMeta] = useState<Omit<ParsedPr, "rows"> | null>(
    null
  );
  const [rows, setRows] = useState<ParsedComponent[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [dupResolutions, setDupResolutions] = useState<
    Record<string, DuplicateResolution>
  >({});

  // Target simpan
  const [targetMode, setTargetMode] = useState<
    "NEW_PROJECT" | "EXISTING_PROJECT"
  >(preselectedProjectId ? "EXISTING_PROJECT" : "NEW_PROJECT");
  const [selectedProjectId, setSelectedProjectId] =
    useState(preselectedProjectId);
  const [importMode, setImportMode] = useState<"MERGE" | "REPLACE" | "APPEND">("APPEND");

  // Data proyek baru (diisi otomatis dari footer PR)
  const [newProjKode, setNewProjKode] = useState("");
  const [newProjNama, setNewProjNama] = useState("");
  const [newProjClient, setNewProjClient] = useState("");
  const [newProjPrioritas, setNewProjPrioritas] =
    useState<ProjectPriority>("TINGGI");
  const [newProjDeadline, setNewProjDeadline] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/pr/preview", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mem-parse file Excel PR.");
        return;
      }

      const pr: ParsedPr = data.parsed;
      const dupes: DuplicateGroup[] = data.duplicates;

      setFilename(data.filename);
      setParsedMeta({
        header: pr.header,
        footer: pr.footer,
        revisionDate: pr.revisionDate,
        groups: pr.groups,
        counts: pr.counts,
      });
      setRows(pr.rows);
      setDuplicates(dupes);

      const defaultRes: Record<string, DuplicateResolution> = {};
      for (const d of dupes) {
        defaultRes[d.key] = "KEEP";
      }
      setDupResolutions(defaultRes);

      // Auto-isi data proyek dari footer PR
      setNewProjNama(pr.footer.partsName ?? "");
      setNewProjClient(pr.footer.customer ?? "");
      setNewProjKode(pr.footer.jobNumber ?? "");
    } catch {
      setError("Gagal mengunggah file Excel PR.");
    } finally {
      setUploading(false);
    }
  }

  function updateRow(tempId: string, patch: Partial<ParsedComponent>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.tempId !== tempId) return r;
        const next = { ...r, ...patch };
        if ("qty" in patch || "hargaSatuan" in patch) {
          const q = next.qty ?? 0;
          const h = next.hargaSatuan;
          next.total = h !== null && q > 0 ? h * q : null;
        }
        return next;
      })
    );
  }

  function renameGroup(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setRows((prev) =>
      prev.map((r) => (r.kelompok === oldName ? { ...r, kelompok: trimmed } : r))
    );
    if (parsedMeta) {
      setParsedMeta({
        ...parsedMeta,
        groups: parsedMeta.groups.map((g) => (g === oldName ? trimmed : g)),
      });
    }
  }

  function removeRow(tempId: string) {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
  }

  const okCount = rows.filter((r) => !r.perluDicek && r.state !== "ERROR").length;
  const checkCount = rows.filter((r) => r.perluDicek && r.state !== "ERROR").length;
  const errorCount = rows.filter((r) => r.state === "ERROR").length;

  async function handleCommitSave() {
    setError(null);
    if (targetMode === "NEW_PROJECT" && (!newProjNama.trim() || !newProjClient.trim())) {
      setError("Nama Proyek dan Client wajib diisi sebelum menyimpan.");
      return;
    }
    if (targetMode === "EXISTING_PROJECT" && !selectedProjectId) {
      setError("Pilih proyek tujuan terlebih dahulu.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/pr/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMode,
          projectId:
            targetMode === "EXISTING_PROJECT" ? selectedProjectId : null,
          newProject:
            targetMode === "NEW_PROJECT"
              ? {
                  kode: newProjKode || null,
                  nama: newProjNama,
                  client: newProjClient,
                  prioritas: newProjPrioritas,
                  deadline: newProjDeadline || null,
                }
              : null,
          importMode,
          namaFile: filename,
          tanggalRevisi: parsedMeta?.revisionDate ?? null,
          header: parsedMeta?.header,
          duplicateResolutions: dupResolutions,
          rows,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan komponen ke proyek.");
        return;
      }
      router.push(`/proyek/${data.projectId}?tab=komponen`);
      router.refresh();
    } catch {
      setError("Gagal menghubungi server saat menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Import Purchase Requisition (PR) Excel
          </h1>
          <p className="text-sm text-slate-600">
            Parser toleran untuk template PR PT. Twintech Precision: baca merged
            cell, ekspresi harga kotor, kelompok komponen, deteksi duplikat, dan
            mode MERGE revisi.
          </p>
        </div>
        <Link
          href={
            preselectedProjectId
              ? `/buat-pr?projectId=${preselectedProjectId}`
              : "/buat-pr"
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shrink-0"
        >
          <ClipboardList className="w-4 h-4" />
          Buat / List Komponen PR di Web
        </Link>
      </div>

      {/* Upload Box */}
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 p-6 text-center transition">
        <label className="cursor-pointer inline-flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-slate-900">
            {uploading
              ? "Sedang membaca struktur sel & merged cell Excel..."
              : filename
                ? `File dimuat: ${filename} (Klik untuk ganti file)`
                : "Klik untuk pilih file Excel Purchase Requisition (.xlsx)"}
          </span>
          <span className="text-xs text-slate-500 mt-1">
            Mendukung import baru maupun import ulang file PR revisi
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <span className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
            <Upload className="w-3.5 h-3.5" /> Pilih File Excel PR
          </span>
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm font-semibold text-rose-800"
        >
          {error}
        </div>
      )}

      {/* Layar Preview Hasil Parse */}
      {parsedMeta && rows.length > 0 && (
        <div className="space-y-5">
          {/* Kartu Ringkasan Parse */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-bold text-slate-500">Total Baris</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {rows.length}
              </div>
            </div>
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
              <div className="text-xs font-bold text-emerald-700">Baris OK</div>
              <div className="text-2xl font-extrabold text-emerald-900 mt-1">
                {okCount}
              </div>
            </div>
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <div className="text-xs font-bold text-amber-800">Perlu Dicek</div>
              <div className="text-2xl font-extrabold text-amber-950 mt-1">
                {checkCount}
              </div>
            </div>
            <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4">
              <div className="text-xs font-bold text-rose-700">Baris Error</div>
              <div className="text-2xl font-extrabold text-rose-900 mt-1">
                {errorCount}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 col-span-2 sm:col-span-1">
              <div className="text-xs font-bold text-slate-500">
                Tanggal Revisi
              </div>
              <div className="text-sm font-extrabold text-slate-900 mt-2">
                {parsedMeta.revisionDate ?? "Tidak terdeteksi"}
              </div>
              <div className="text-[11px] text-slate-500">
                Prep: {parsedMeta.header.prepared ?? "-"}
              </div>
            </div>
          </div>

          {/* Pilihan Proyek Tujuan & Auto-fill Footer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setTargetMode("NEW_PROJECT")}
                className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  targetMode === "NEW_PROJECT"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-slate-300 text-slate-700"
                }`}
              >
                Simpan sebagai Proyek Baru
              </button>
              <button
                type="button"
                onClick={() => setTargetMode("EXISTING_PROJECT")}
                className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  targetMode === "EXISTING_PROJECT"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-slate-300 text-slate-700"
                }`}
              >
                Import / Merge ke Proyek yang Sudah Ada
              </button>
            </div>

            {targetMode === "NEW_PROJECT" ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kode Proyek (JOB NUMBER)
                  </label>
                  <input
                    type="text"
                    value={newProjKode}
                    onChange={(e) => setNewProjKode(e.target.value)}
                    placeholder="Isi manual, mis. 26 RKI 1012"
                    className={`w-full px-3 py-2 rounded-xl border ${
                      !newProjKode.trim()
                        ? "border-amber-400 bg-amber-50/50"
                        : "border-slate-300"
                    }`}
                  />
                  {!parsedMeta.footer.jobNumber && (
                    <span className="text-[11px] text-amber-700 font-semibold">
                      JOB NUMBER kosong di PR — silakan isi manual
                    </span>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Proyek (PARTS NAME) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjNama}
                    onChange={(e) => setNewProjNama(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Client (CUSTOMER) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjClient}
                    onChange={(e) => setNewProjClient(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Prioritas
                  </label>
                  <select
                    value={newProjPrioritas}
                    onChange={(e) =>
                      setNewProjPrioritas(e.target.value as ProjectPriority)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {PROJECT_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PROJECT_PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Target Deadline
                  </label>
                  <input
                    type="date"
                    value={newProjDeadline}
                    onChange={(e) => setNewProjDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Pilih Proyek Tujuan *
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                  >
                    <option value="">-- Pilih Proyek --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.kode ? `[${p.kode}] ` : ""}
                        {p.nama} — {p.client} ({p.totalComponents} komponen)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mode Import Ulang
                  </label>
                  <select
                    value={importMode}
                    onChange={(e) =>
                      setImportMode(e.target.value as "MERGE" | "REPLACE" | "APPEND")
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold cursor-pointer"
                  >
                    <option value="APPEND">
                      Tambah Komponen dari Excel Berbeda (Append, komponen lama tetap utuh)
                    </option>
                    <option value="MERGE">
                      Mode MERGE Revisi (Pertahankan status, tandai BARU &amp; HILANG)
                    </option>
                    <option value="REPLACE">
                      Ganti Semua Komponen (Reset daftar komponen proyek)
                    </option>
                  </select>
                  {importMode === "APPEND" && (
                    <p className="text-xs text-blue-700 mt-1.5 font-medium">
                      ✨ <strong>Mode Append:</strong> Aman untuk menggabungkan file Excel yang berbeda (misal: PR Elektrikal tambahan / Mekanik). Seluruh komponen lama proyek tetap utuh dan <u>TIDAK</u> akan ditandai Hilang.
                    </p>
                  )}
                  {importMode === "MERGE" && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      <strong>Mode Revisi:</strong> Mencocokkan komponen. Komponen lama yang tidak tercantum di file revisi ini akan ditandai <em>&quot;Hilang di Revisi Baru&quot;</em>.
                    </p>
                  )}
                  {importMode === "REPLACE" && (
                    <p className="text-xs text-rose-600 mt-1.5 font-medium">
                      ⚠️ <strong>Ganti Semua:</strong> Seluruh komponen lama pada proyek ini akan dihapus dan digantikan seluruhnya oleh baris Excel ini.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Panel Peringatan Duplikat */}
          {duplicates.length > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-300 p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
                <Copy className="w-4 h-4 text-amber-700" />
                <span>
                  Terdeteksi {duplicates.length} Pasangan Komponen Duplikat
                  (Tipe + Nama Sama)
                </span>
              </div>
              <div className="space-y-2">
                {duplicates.map((d) => (
                  <div
                    key={d.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-xl border border-amber-200 p-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {d.partType} — {d.partName}
                      </div>
                      <div className="text-slate-600">
                        Muncul {d.rowNumbers.length} kali (Baris Excel{" "}
                        {d.rowNumbers.join(" & ")} • {d.kelompoks.join(", ")}) •
                        Total Qty gabungan: <strong>{d.totalQty}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setDupResolutions({
                            ...dupResolutions,
                            [d.key]: "MERGE",
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer ${
                          dupResolutions[d.key] === "MERGE"
                            ? "bg-amber-500 border-amber-600 text-slate-950"
                            : "bg-white border-slate-300 text-slate-700"
                        }`}
                      >
                        Gabungkan Qty ({d.totalQty})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDupResolutions({
                            ...dupResolutions,
                            [d.key]: "KEEP",
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer ${
                          dupResolutions[d.key] === "KEEP"
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-white border-slate-300 text-slate-700"
                        }`}
                      >
                        Biarkan Terpisah
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rename Kelompok Cepat */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-bold text-slate-700 mb-2">
              Nama Kelompok Komponen (Dipisahkan Baris Kosong di PR — Bisa
              Diubah):
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(rows.map((r) => r.kelompok))).map((g) => (
                <input
                  key={g}
                  type="text"
                  defaultValue={g}
                  onBlur={(e) => renameGroup(g, e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50"
                />
              ))}
            </div>
          </div>

          {/* Tabel Preview Inline Edit */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <div className="font-bold text-sm">
                Preview Hasil Parse ({rows.length} baris) — Klik sel untuk Edit
                Inline
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleCommitSave}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Menyimpan..." : "Simpan ke Proyek"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-2 text-left">Baris</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Kelompok</th>
                    <th className="p-2 text-left">No PR</th>
                    <th className="p-2 text-left">Part Type</th>
                    <th className="p-2 text-left">Parts Name</th>
                    <th className="p-2 text-left">Qty / Unit</th>
                    <th className="p-2 text-left">Harga Satuan</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-left">Catatan PR</th>
                    <th className="p-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr
                      key={r.tempId}
                      className={
                        r.perluDicek ? "bg-amber-50/60" : "hover:bg-slate-50"
                      }
                    >
                      <td className="p-2 font-mono text-slate-400">
                        #{r.rowNumber}
                      </td>
                      <td className="p-2">
                        {r.perluDicek ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-bold text-[10px]">
                              <AlertTriangle className="w-3 h-3" /> Perlu dicek
                            </span>
                            {r.hargaRaw && (
                              <div className="text-[10px] text-amber-900 mt-0.5 font-mono">
                                Raw: {r.hargaRaw}
                              </div>
                            )}
                            <div className="text-[10px] text-amber-800 mt-0.5 max-w-[180px]">
                              {r.alasan.join("; ")}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={r.kelompok}
                          onChange={(e) =>
                            updateRow(r.tempId, { kelompok: e.target.value })
                          }
                          className="w-32 px-2 py-1 rounded border border-slate-200 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={r.noPr ?? ""}
                          onChange={(e) =>
                            updateRow(r.tempId, {
                              noPr: e.target.value || null,
                            })
                          }
                          className="w-12 px-2 py-1 rounded border border-slate-200 bg-white font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={r.partType ?? ""}
                          onChange={(e) =>
                            updateRow(r.tempId, { partType: e.target.value })
                          }
                          className="w-52 px-2 py-1 rounded border border-slate-200 bg-white font-semibold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={r.partName ?? ""}
                          onChange={(e) =>
                            updateRow(r.tempId, {
                              partName: e.target.value,
                              perluDicek:
                                e.target.value.trim() !== ""
                                  ? r.alasan.some(
                                      (a) => !a.includes("PARTS NAME")
                                    )
                                  : true,
                            })
                          }
                          placeholder="Wajib isi..."
                          className={`w-32 px-2 py-1 rounded border bg-white ${
                            !r.partName
                              ? "border-amber-500 bg-amber-50"
                              : "border-slate-200"
                          }`}
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <input
                          type="number"
                          step="any"
                          value={r.qty ?? ""}
                          onChange={(e) =>
                            updateRow(r.tempId, {
                              qty: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="w-14 px-2 py-1 rounded border border-slate-200 bg-white text-center font-bold"
                        />{" "}
                        <input
                          type="text"
                          value={r.unit ?? ""}
                          onChange={(e) =>
                            updateRow(r.tempId, { unit: e.target.value })
                          }
                          className="w-12 px-1.5 py-1 rounded border border-slate-200 bg-white text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={r.hargaSatuan ?? ""}
                          onChange={(e) =>
                            updateRow(r.tempId, {
                              hargaSatuan: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          placeholder="Kosong"
                          className="w-28 px-2 py-1 rounded border border-slate-200 bg-white text-right"
                        />
                      </td>
                      <td className="p-2 text-right font-bold whitespace-nowrap">
                        {formatRupiah(r.total)}
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={r.catatanPr ?? ""}
                          onChange={(e) =>
                            updateRow(r.tempId, {
                              catatanPr: e.target.value || null,
                            })
                          }
                          className="w-40 px-2 py-1 rounded border border-slate-200 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => removeRow(r.tempId)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end p-4 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                disabled={saving}
                onClick={handleCommitSave}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Menyimpan..." : "Simpan Komponen ke Proyek"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
