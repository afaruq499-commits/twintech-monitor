"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  AlertTriangle,
} from "lucide-react";
import { MlRecommenderPanel } from "@/components/MlRecommenderPanel";
import type { CatalogComponentDTO } from "@/lib/catalog-queries";
import type {
  HistoricalProjectSample,
  RecommendedPrComponent,
} from "@/lib/ml-recommender";

export interface MlProjectOption {
  id: string;
  kode: string | null;
  nama: string;
  client: string;
  komponenInti: string | null;
  totalComponents: number;
}

interface MachineLearningClientProps {
  initialCatalog: CatalogComponentDTO[];
  historicalSamples: HistoricalProjectSample[];
  projects: MlProjectOption[];
  initialProjectId?: string;
}

export function MachineLearningClient({
  initialCatalog,
  historicalSamples,
  projects,
  initialProjectId = "",
}: MachineLearningClientProps) {
  const initialProject = projects.find((p) => p.id === initialProjectId) ?? null;

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProject?.id ?? ""
  );
  const [description, setDescription] = useState<string>(
    initialProject?.komponenInti ?? ""
  );
  const [savingDescription, setSavingDescription] = useState(false);
  const [applyingItems, setApplyingItems] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
    projectId?: string;
  } | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  function handleSelectProject(nextId: string) {
    setSelectedProjectId(nextId);
    setStatusMsg(null);
    if (!nextId) return;
    const found = projects.find((p) => p.id === nextId);
    if (found) {
      setDescription(found.komponenInti ?? "");
    }
  }

  async function handleSaveDescriptionOnly(val: string) {
    if (!selectedProject) return;
    setSavingDescription(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ komponenInti: val.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({
          type: "error",
          text: data.error ?? "Gagal menyimpan deskripsi komponen inti proyek.",
        });
        return;
      }
      setStatusMsg({
        type: "success",
        text: `Deskripsi komponen inti berhasil disimpan ke proyek "${selectedProject.nama}".`,
        projectId: selectedProject.id,
      });
    } catch {
      setStatusMsg({
        type: "error",
        text: "Gagal terhubung ke server saat menyimpan deskripsi proyek.",
      });
    } finally {
      setSavingDescription(false);
    }
  }

  async function handleApplyItems(recommended: RecommendedPrComponent[]) {
    if (applyingItems || recommended.length === 0) return;

    if (!selectedProject) {
      const lines = recommended.map(
        (rec, idx) =>
          `${idx + 1}. ${rec.partType} | ${rec.partName} | Qty: ${rec.qty} ${rec.unit}${
            rec.hargaSatuan !== null
              ? ` | Est. Rp ${Number(rec.hargaSatuan).toLocaleString("id-ID")}`
              : ""
          }`
      );
      try {
        await navigator.clipboard?.writeText(lines.join("\n"));
        setStatusMsg({
          type: "success",
          text: `${recommended.length} komponen hasil sizing ML disalin ke clipboard. Pilih proyek tujuan di atas bila ingin langsung menyimpan ke daftar komponen proyek.`,
        });
      } catch {
        setStatusMsg({
          type: "error",
          text: "Pilih proyek tujuan pada menu dropdown di atas untuk langsung memasukkan komponen hasil ML ke proyek.",
        });
      }
      return;
    }

    setApplyingItems(true);
    setStatusMsg(null);
    let successCount = 0;

    try {
      if (description.trim()) {
        await fetch(`/api/projects/${selectedProject.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ komponenInti: description.trim() }),
        });
      }

      for (const rec of recommended) {
        const res = await fetch("/api/components", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProject.id,
            kelompok: rec.kelompok,
            partType: rec.partType,
            partName: rec.partName,
            supplier: rec.supplier ?? "",
            qty: rec.qty,
            unit: rec.unit,
            hargaSatuan: rec.hargaSatuan,
            catatanPr: rec.catatanPr ?? "",
            statusPembelian: "BELUM_PR",
          }),
        });
        if (res.ok) {
          successCount += 1;
        }
      }

      if (successCount > 0) {
        setStatusMsg({
          type: "success",
          text: `${successCount} komponen hasil identifikasi ML berhasil ditambahkan ke proyek "${selectedProject.nama}".`,
          projectId: selectedProject.id,
        });
      } else {
        setStatusMsg({
          type: "error",
          text: "Tidak ada komponen yang berhasil disimpan ke proyek.",
        });
      }
    } catch {
      setStatusMsg({
        type: "error",
        text: "Terjadi gangguan jaringan saat menyimpan komponen hasil ML ke proyek.",
      });
    } finally {
      setApplyingItems(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header Halaman Machine Learning */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-extrabold uppercase tracking-wider">
              <BrainCircuit className="w-3.5 h-3.5" />
              Menu Khusus Machine Learning
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Machine Learning — Identifikasi & Sizing Panel Otomasi
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Analisis kebutuhan PSU 24VDC, Safety Relay, jumlah Relay & socket,
              kapasitas I/O PLC, dan spek MCB secara terpisah sebelum masuk ke
              pembuatan Purchase Request (PR).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/buat-pr"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-extrabold text-slate-700 transition"
            >
              <ClipboardList className="w-4 h-4 text-emerald-600" />
              Buka Buat PR
            </Link>
            <Link
              href="/proyek"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-extrabold text-white transition"
            >
              <FolderKanban className="w-4 h-4" />
              Daftar Proyek
            </Link>
          </div>
        </div>

        {/* Pilihan Mode / Proyek Tujuan (Opsional) */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="flex-1 max-w-xl">
            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
              Target Proyek (Opsional)
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleSelectProject(e.target.value)}
              disabled={applyingItems || savingDescription}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">
                — Mode Analisis Mandiri (Kalkulator Sizing Tanpa Mengubah Proyek) —
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kode ? `[${p.kode}] ` : ""}
                  {p.nama} — {p.client} ({p.totalComponents} komponen)
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/proyek/${selectedProject.id}?tab=komponen`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-extrabold transition"
              >
                Lihat Komponen Proyek
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href={`/buat-pr?projectId=${selectedProject.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-extrabold transition"
              >
                Buat PR Proyek Ini
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {statusMsg && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs sm:text-sm font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            statusMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          {statusMsg.projectId && (
            <Link
              href={`/proyek/${statusMsg.projectId}?tab=komponen`}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shrink-0"
            >
              Buka Tab Komponen Proyek
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Panel Machine Learning */}
      <MlRecommenderPanel
        description={description}
        onDescriptionChange={setDescription}
        catalog={initialCatalog}
        historicalSamples={historicalSamples}
        onApplyItems={handleApplyItems}
        applyButtonLabel={
          applyingItems
            ? "Menyimpan ke Proyek..."
            : selectedProject
              ? `Simpan ke Komponen Proyek "${selectedProject.kode || selectedProject.nama}"`
              : "Salin Daftar Komponen Terpilih"
        }
        onSaveDescriptionOnly={
          selectedProject ? handleSaveDescriptionOnly : undefined
        }
        savingDescription={savingDescription}
      />
    </div>
  );
}
