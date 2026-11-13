"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Image as ImageIcon,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  WORK_TYPES,
  WORK_TYPE_LABELS,
  type WorkType,
} from "@/lib/constants";
import type { AppSettingsDTO } from "@/lib/data-queries";

function toLogoDataUrl(logoBase64: string | null): string | null {
  if (!logoBase64) return null;
  const trimmed = logoBase64.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
}

export function SettingsClient({
  initialSettings,
}: {
  initialSettings: AppSettingsDTO;
}) {
  const router = useRouter();
  const [kapasitasPerHari, setKapasitasPerHari] = useState(
    initialSettings.kapasitasPerHari
  );
  const [jenisDikecualikan, setJenisDikecualikan] = useState<WorkType[]>(
    initialSettings.jenisDikecualikan
  );
  const [namaPerusahaan, setNamaPerusahaan] = useState(
    initialSettings.namaPerusahaan
  );
  const [alamatPerusahaan, setAlamatPerusahaan] = useState(
    initialSettings.alamatPerusahaan
  );
  const [telpPerusahaan, setTelpPerusahaan] = useState(
    initialSettings.telpPerusahaan
  );
  const [faxPerusahaan, setFaxPerusahaan] = useState(
    initialSettings.faxPerusahaan
  );
  const [logoBase64, setLogoBase64] = useState<string | null>(
    initialSettings.logoBase64
  );

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function toggleExemptType(wt: WorkType) {
    setJenisDikecualikan((prev) =>
      prev.includes(wt) ? prev.filter((item) => item !== wt) : [...prev, wt]
    );
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setErrorMsg("Ukuran file logo maksimal 1,5 MB (format PNG atau JPEG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoBase64(reader.result);
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kapasitasPerHari,
          jenisDikecualikan,
          namaPerusahaan,
          alamatPerusahaan,
          telpPerusahaan,
          faxPerusahaan,
          logoBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Gagal menyimpan pengaturan.");
        return;
      }
      setSavedNotice(true);
      router.refresh();
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan saat menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  }

  const logoPreviewUrl = toLogoDataUrl(logoBase64);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Sistem</h1>
        <p className="text-sm text-slate-600 mt-1">
          Atur batas kapasitas pekerjaan harian lintas proyek serta identitas
          perusahaan untuk kop export jadwal Excel client.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {errorMsg}
        </div>
      )}

      {savedNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Pengaturan berhasil disimpan.</span>
        </div>
      )}

      {/* Bagian 1: Aturan Kapasitas & Konflik Jadwal */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Aturan Konflik & Kapasitas Harian
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mencegah jadwal bentrok saat menangani banyak proyek sekaligus di
              workshop maupun site client.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kapasitas Pekerjaan Utama / Hari
            </label>
            <input
              type="number"
              min={1}
              max={20}
              required
              value={kapasitasPerHari}
              onChange={(e) =>
                setKapasitasPerHari(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-32 px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
            />
            <p className="text-xs text-slate-500 mt-1">
              Default: <strong>1</strong> pekerjaan utama per tanggal lintas
              seluruh proyek & lane.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Jenis Pekerjaan yang Dikecualikan dari Kuota Harian
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WORK_TYPES.map((wt) => {
                const checked = jenisDikecualikan.includes(wt);
                return (
                  <label
                    key={wt}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition ${
                      checked
                        ? "bg-blue-50 border-blue-300 text-blue-800"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExemptType(wt)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>{WORK_TYPE_LABELS[wt]}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Selain jenis di atas, setiap pekerjaan yang ditandai{" "}
              <em>&ldquo;Boleh paralel&rdquo;</em> pada editor jadwal juga tidak
              memicu blokir konflik tanggal.
            </p>
          </div>
        </div>
      </section>

      {/* Bagian 2: Identitas Perusahaan untuk Export Jadwal Excel */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Identitas Perusahaan (Kop Export Excel)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dicetak otomatis pada sudut kiri atas setiap sheet saat menekan{" "}
              <strong>Export Lane Ini</strong> atau{" "}
              <strong>Export Semua Lane</strong>.
            </p>
          </div>
        </div>

        {/* Pratinjau Kop Excel */}
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {logoPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreviewUrl}
                alt={namaPerusahaan}
                className="h-10 w-auto object-contain bg-white px-2 py-1 rounded border border-slate-200"
              />
            ) : (
              <div className="text-sm font-bold text-slate-800">
                {namaPerusahaan || "Nama Perusahaan"}
              </div>
            )}
            <div className="text-[11px] text-slate-700 leading-snug">
              <div>{alamatPerusahaan || "Alamat perusahaan..."}</div>
              <div>
                {[
                  telpPerusahaan ? `Tel: ${telpPerusahaan}` : "",
                  faxPerusahaan ? `Fax: ${faxPerusahaan}` : "",
                ]
                  .filter(Boolean)
                  .join(" , ")}
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-lg font-bold text-slate-900">
              Schedule Lane &lt;Nama Lane&gt;
            </div>
            <div className="text-xs font-semibold text-slate-600">
              (Timeline Onsite &amp; Commissioning)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Perusahaan *
            </label>
            <input
              type="text"
              required
              value={namaPerusahaan}
              onChange={(e) => setNamaPerusahaan(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alamat Perusahaan (Baris B5 di Excel)
            </label>
            <input
              type="text"
              value={alamatPerusahaan}
              onChange={(e) => setAlamatPerusahaan(e.target.value)}
              placeholder="Contoh: Multiguna 1, Jl. Mahoni 1 No. 9 Lippo Cikarang 17550, Indonesia"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nomor Telepon
            </label>
            <input
              type="text"
              value={telpPerusahaan}
              onChange={(e) => setTelpPerusahaan(e.target.value)}
              placeholder="+62 (21) 89902228"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nomor Fax
            </label>
            <input
              type="text"
              value={faxPerusahaan}
              onChange={(e) => setFaxPerusahaan(e.target.value)}
              placeholder="+62 (21) 89902229"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="sm:col-span-2 pt-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Logo Perusahaan (PNG / JPEG untuk Kop Excel B2:D4)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
                <ImageIcon className="w-4 h-4 text-slate-500" />
                <span>Pilih Gambar Logo...</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              {logoBase64 && (
                <button
                  type="button"
                  onClick={() => setLogoBase64(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Logo (Gunakan Teks Nama Perusahaan)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Menyimpan..." : "Simpan Pengaturan"}</span>
        </button>
      </div>
    </form>
  );
}
