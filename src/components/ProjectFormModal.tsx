"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  PR_STATUSES,
  PR_STATUS_LABELS,
  PROJECT_COLOR_PALETTE,
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type PrStatus,
  type ProjectPriority,
  type ProjectStatus,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  type ProjectType,
} from "@/lib/constants";
import { SYSTEM_PICS } from "@/lib/users";

export interface EditableProject {
  id?: string;
  kode: string | null;
  nama: string;
  client: string;
  komponenInti?: string | null;
  deskripsi: string | null;
  tanggalMulai: string | null;
  deadline: string | null;
  prioritas: ProjectPriority;
  tipeProyek?: ProjectType | string | null;
  status: ProjectStatus;
  prStatus: PrStatus;
  catatan: string | null;
  warna: string;
  pic?: string | null;
  bolehParalel?: boolean;
}

export function ProjectFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: EditableProject | null;
  onClose: () => void;
  onSaved: (projectId: string) => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [kode, setKode] = useState(initial?.kode ?? "");
  const [nama, setNama] = useState(initial?.nama ?? "");
  const [client, setClient] = useState(initial?.client ?? "");
  const [komponenInti, setKomponenInti] = useState(
    initial?.komponenInti ?? ""
  );
  const [deskripsi, setDeskripsi] = useState(initial?.deskripsi ?? "");
  const [tanggalMulai, setTanggalMulai] = useState(initial?.tanggalMulai ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [prioritas, setPrioritas] = useState<ProjectPriority>(
    initial?.prioritas ?? "SEDANG"
  );
  const [tipeProyek, setTipeProyek] = useState<ProjectType>(
    (initial?.tipeProyek as ProjectType) || "AUTOMATION_KECIL"
  );
  const [status, setStatus] = useState<ProjectStatus>(
    initial?.status ?? "PLANNING"
  );
  const [prStatus, setPrStatus] = useState<PrStatus>(
    initial?.prStatus ?? "DRAFT"
  );
  const [catatan, setCatatan] = useState(initial?.catatan ?? "");
  const [pic, setPic] = useState(initial?.pic ?? "");
  const [bolehParalel, setBolehParalel] = useState(
    initial?.bolehParalel ?? false
  );
  const [warna, setWarna] = useState(
    initial?.warna ?? PROJECT_COLOR_PALETTE[0]
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const url = isEdit ? `/api/projects/${initial!.id}` : "/api/projects";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode: kode || null,
          nama,
          client,
          komponenInti: komponenInti.trim() || null,
          deskripsi: deskripsi || null,
          tanggalMulai: tanggalMulai || null,
          deadline: deadline || null,
          prioritas,
          tipeProyek,
          status,
          prStatus,
          catatan: catatan || null,
          pic: pic.trim() || null,
          bolehParalel,
          warna,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan proyek.");
        return;
      }
      onSaved(data.project.id);
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <h2 className="font-bold text-base">
            {isEdit ? "Edit Data Proyek" : "Tambah Proyek Baru"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto text-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kode Proyek
              </label>
              <input
                type="text"
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                placeholder="Contoh: 26 RKI 1012"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Proyek *
              </label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Jig Insert Collar 23MJ2"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Client / Customer *
              </label>
              <input
                type="text"
                required
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Contoh: PT ROKI INDONESIA"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Deadline / Delivery
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tipe Proyek *
              </label>
              <select
                value={tipeProyek}
                onChange={(e) => setTipeProyek(e.target.value as ProjectType)}
                className="w-full px-3 py-2 rounded-xl border border-blue-400 bg-blue-50/40 font-semibold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROJECT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Prioritas
              </label>
              <select
                value={prioritas}
                onChange={(e) => setPrioritas(e.target.value as ProjectPriority)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {PROJECT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PROJECT_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status Pengerjaan
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status PR
              </label>
              <select
                value={prStatus}
                onChange={(e) => setPrStatus(e.target.value as PrStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {PR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PR_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Yang Mengerjakan / PIC Proyek
              </label>
              <input
                type="text"
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                placeholder="Pilih atau ketik nama PIC..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                {SYSTEM_PICS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPic(p.value)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ${
                      pic === p.value
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.value}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-950 cursor-pointer">
              <input
                type="checkbox"
                checked={bolehParalel}
                onChange={(e) => setBolehParalel(e.target.checked)}
              />
              <span>
                Proyek Paralel (Boleh jalan di hari yang sama dengan proyek lain)
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Warna Identitas di Kalender
            </label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLOR_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setWarna(hex)}
                  className={`w-7 h-7 rounded-full border-2 cursor-pointer transition ${
                    warna === hex
                      ? "border-slate-900 scale-110 ring-2 ring-offset-1 ring-slate-400"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-indigo-50/70 border border-indigo-200 p-3">
            <label className="block text-xs font-extrabold text-indigo-950 mb-1">
              Deskripsi Singkat Komponen Inti Proyek (Input Machine Learning)
            </label>
            <textarea
              rows={2}
              value={komponenInti}
              onChange={(e) => setKomponenInti(e.target.value)}
              placeholder='Contoh: 3 valve, 1 robot Yasakawa tipe a, dan 2 motor servo seri b'
              className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <p className="text-[11px] text-indigo-800 mt-1 font-medium">
              Dipakai otomatis oleh Machine Learning untuk merekomendasikan seri
              PSU, Safety Relay, jumlah Relay, tipe PLC, & spek MCB.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Deskripsi Proyek
            </label>
            <textarea
              rows={2}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Ruang lingkup wiring, PLC/HMI, robot, atau instalasi..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Teknis / Lapangan
            </label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan penting untuk pengadaan atau commissioning..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Buat Proyek"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
