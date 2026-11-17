"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";
import {
  WORK_TYPES,
  WORK_TYPE_LABELS,
  type WorkType,
} from "@/lib/constants";
import type { AppSettingsDTO } from "@/lib/data-queries";
import type { SessionUser } from "@/lib/auth";

function toLogoDataUrl(logoBase64: string | null): string | null {
  if (!logoBase64) return null;
  const trimmed = logoBase64.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
}

export function SettingsClient({
  initialSettings,
  currentUser,
}: {
  initialSettings: AppSettingsDTO;
  currentUser?: SessionUser | null;
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

  // ==================== STATE PENGATURAN AKUN SAYA ====================
  const [selfNama, setSelfNama] = useState(currentUser?.nama || "");
  const [selfUsername, setSelfUsername] = useState(currentUser?.username || "");
  const [selfCurrentPassword, setSelfCurrentPassword] = useState("");
  const [selfNewPassword, setSelfNewPassword] = useState("");
  const [selfConfirmNewPassword, setSelfConfirmNewPassword] = useState("");
  const [selfShowPassword, setSelfShowPassword] = useState(false);
  const [selfSaving, setSelfSaving] = useState(false);
  const [selfSuccessMsg, setSelfSuccessMsg] = useState<string | null>(null);
  const [selfErrorMsg, setSelfErrorMsg] = useState<string | null>(null);

  // ==================== STATE KELOLA AKUN TIM (ADMIN) ====================
  const isAdmin = currentUser?.role === "ADMIN";
  const [teamUsers, setTeamUsers] = useState<
    Array<{
      id: string;
      username: string;
      nama: string;
      role: string;
      jabatan: string;
      avatarText: string;
      warna: string;
    }>
  >([]);
  const [selectedTeamUserId, setSelectedTeamUserId] = useState<string>("");
  const [teamNama, setTeamNama] = useState("");
  const [teamUsername, setTeamUsername] = useState("");
  const [teamJabatan, setTeamJabatan] = useState("");
  const [teamNewPassword, setTeamNewPassword] = useState("");
  const [teamShowPassword, setTeamShowPassword] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamSuccessMsg, setTeamSuccessMsg] = useState<string | null>(null);
  const [teamErrorMsg, setTeamErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/auth/users")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.teamUsers) && data.teamUsers.length > 0) {
            setTeamUsers(data.teamUsers);
            const first = data.teamUsers[0];
            setSelectedTeamUserId(first.id);
            setTeamNama(first.nama);
            setTeamUsername(first.username);
            setTeamJabatan(first.jabatan);
          }
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  function handleSelectTeamUser(id: string) {
    setSelectedTeamUserId(id);
    setTeamSuccessMsg(null);
    setTeamErrorMsg(null);
    setTeamNewPassword("");
    const target = teamUsers.find((u) => u.id === id);
    if (target) {
      setTeamNama(target.nama);
      setTeamUsername(target.username);
      setTeamJabatan(target.jabatan);
    }
  }

  async function handleUpdateSelfCredentials(e: React.FormEvent) {
    e.preventDefault();
    setSelfSaving(true);
    setSelfSuccessMsg(null);
    setSelfErrorMsg(null);

    if (selfNewPassword && selfNewPassword !== selfConfirmNewPassword) {
      setSelfErrorMsg("Konfirmasi password baru tidak cocok.");
      setSelfSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_SELF",
          currentPassword: selfCurrentPassword,
          newUsername: selfUsername,
          newNama: selfNama,
          newPassword: selfNewPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSelfErrorMsg(data.error || "Gagal memperbarui akun.");
        return;
      }

      setSelfSuccessMsg(data.message || "Akun Anda berhasil diperbarui.");
      setSelfCurrentPassword("");
      setSelfNewPassword("");
      setSelfConfirmNewPassword("");
      router.refresh();
    } catch {
      setSelfErrorMsg("Gagal menghubungi server.");
    } finally {
      setSelfSaving(false);
    }
  }

  async function handleUpdateTeamUser(e: React.FormEvent) {
    e.preventDefault();
    setTeamSaving(true);
    setTeamSuccessMsg(null);
    setTeamErrorMsg(null);

    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_TEAM_USER",
          targetUserId: selectedTeamUserId,
          newUsername: teamUsername,
          newNama: teamNama,
          newJabatan: teamJabatan,
          newPassword: teamNewPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTeamErrorMsg(data.error || "Gagal memperbarui akun anggota.");
        return;
      }

      setTeamSuccessMsg(data.message || "Akun anggota berhasil diperbarui.");
      setTeamNewPassword("");

      // Update teamUsers state lokal
      setTeamUsers((prev) =>
        prev.map((u) =>
          u.id === selectedTeamUserId
            ? { ...u, nama: teamNama, username: teamUsername, jabatan: teamJabatan }
            : u
        )
      );
      router.refresh();
    } catch {
      setTeamErrorMsg("Gagal menghubungi server.");
    } finally {
      setTeamSaving(false);
    }
  }

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
    <div className="space-y-10 max-w-4xl pb-10">
      <form onSubmit={handleSubmit} className="space-y-6">
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

    {/* ==================== KEAMANAN AKUN & MANAJEMEN PASSWORD ==================== */}
    <div id="keamanan" className="space-y-6 pt-6 border-t border-slate-200 dark:border-white/10">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[#F05232]" />
          Keamanan Akun &amp; Manajemen Password
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Atur username, nama profil, dan password login Anda di sini setelah masuk ke sistem.
        </p>
      </div>

      {/* 1. Pengaturan Kredensial Akun Saya */}
      <section className="bg-white dark:bg-[#161820] rounded-2xl border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <span
              className={`w-10 h-10 rounded-xl text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs ${
                currentUser?.role === "ADMIN"
                  ? "bg-gradient-to-br from-[#F45B38] to-[#D9381E]"
                  : "bg-gradient-to-br from-sky-500 to-blue-600"
              }`}
            >
              {currentUser?.avatarText ?? "TP"}
            </span>
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{selfNama || currentUser?.nama}</span>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    currentUser?.role === "ADMIN"
                      ? "bg-[#F05232] text-white"
                      : "bg-sky-500 text-white"
                  }`}
                >
                  {currentUser?.role === "ADMIN" ? "Admin" : "Member"}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Username aktif: <strong className="text-slate-700 dark:text-slate-300 font-mono">@{selfUsername}</strong>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 italic">
            Perubahan username atau password akan berlaku pada sesi login berikutnya.
          </div>
        </div>

        {selfSuccessMsg && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {selfSuccessMsg}
          </div>
        )}

        {selfErrorMsg && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {selfErrorMsg}
          </div>
        )}

        <form onSubmit={handleUpdateSelfCredentials} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Lengkap / Tampilan
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={selfNama}
                  onChange={(e) => setSelfNama(e.target.value)}
                  placeholder="Nama tampilan Anda..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-sm bg-white dark:bg-[#12141a] text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Username Login
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={selfUsername}
                  onChange={(e) => setSelfUsername(e.target.value)}
                  placeholder="Username login baru..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-sm bg-white dark:bg-[#12141a] text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password Saat Ini <span className="text-slate-400 font-normal">(Wajib diisi untuk konfirmasi keamanan)</span>
              </label>
              <div className="relative max-w-md">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={selfShowPassword ? "text" : "password"}
                  required
                  value={selfCurrentPassword}
                  onChange={(e) => setSelfCurrentPassword(e.target.value)}
                  placeholder="Masukkan password saat ini..."
                  className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-sm bg-white dark:bg-[#12141a] text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setSelfShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  {selfShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password Baru <span className="text-slate-400 font-normal">(Kosongkan jika tidak ingin ganti)</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={selfShowPassword ? "text" : "password"}
                  value={selfNewPassword}
                  onChange={(e) => setSelfNewPassword(e.target.value)}
                  placeholder="Password baru (min. 4 karakter)..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-sm bg-white dark:bg-[#12141a] text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ulangi Password Baru
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={selfShowPassword ? "text" : "password"}
                  value={selfConfirmNewPassword}
                  onChange={(e) => setSelfConfirmNewPassword(e.target.value)}
                  placeholder="Ulangi password baru..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-sm bg-white dark:bg-[#12141a] text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={selfSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-[#111216] text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{selfSaving ? "Menyimpan Kredensial..." : "Simpan Perubahan Kredensial Saya"}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. Kelola Akun Anggota Tim (Khusus Admin) */}
      {isAdmin && (
        <section className="bg-white dark:bg-[#161820] rounded-2xl border border-orange-200 dark:border-orange-500/20 p-5 sm:p-6 shadow-xs space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#F05232]" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Kelola Akun Anggota Tim (Khusus Admin)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#F05232] text-white">
                Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Sebagai Admin, Anda dapat mengatur nama, username login, serta mengatur atau mereset password baru untuk setiap anggota tim.
            </p>
          </div>

          {/* Selector Anggota Tim */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mr-1">
              Pilih Akun yang Ingin Diedit:
            </span>
            {teamUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelectTeamUser(u.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  selectedTeamUserId === u.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-[#111216] shadow-xs ring-2 ring-[#F05232]/50"
                    : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: u.warna }}
                />
                <span>{u.nama} ({u.role === "ADMIN" ? "Admin" : "Member"})</span>
              </button>
            ))}
          </div>

          {teamSuccessMsg && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {teamSuccessMsg}
            </div>
          )}

          {teamErrorMsg && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              {teamErrorMsg}
            </div>
          )}

          <form onSubmit={handleUpdateTeamUser} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap Anggota
                </label>
                <input
                  type="text"
                  required
                  value={teamNama}
                  onChange={(e) => setTeamNama(e.target.value)}
                  placeholder="Nama anggota tim..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-sm bg-white dark:bg-[#12141a] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Username Login
                </label>
                <input
                  type="text"
                  required
                  value={teamUsername}
                  onChange={(e) => setTeamUsername(e.target.value)}
                  placeholder="Username login..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-sm bg-white dark:bg-[#12141a] text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Jabatan / Posisi
                </label>
                <input
                  type="text"
                  value={teamJabatan}
                  onChange={(e) => setTeamJabatan(e.target.value)}
                  placeholder="Contoh: Automation Engineer..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-sm bg-white dark:bg-[#12141a] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reset / Set Password Baru <span className="text-slate-400 font-normal">(Kosongkan jika tidak diubah)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={teamShowPassword ? "text" : "password"}
                    value={teamNewPassword}
                    onChange={(e) => setTeamNewPassword(e.target.value)}
                    placeholder="Masukkan password baru untuk anggota ini..."
                    className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-sm bg-white dark:bg-[#12141a] text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setTeamShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {teamShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={teamSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F45B38] to-[#D9381E] hover:brightness-105 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{teamSaving ? "Menyimpan Akun Anggota..." : "Perbarui Akun Anggota"}</span>
              </button>
            </div>
          </form>

          {/* Daftar Ringkasan Akun */}
          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08]">
            <div className="text-xs font-bold text-slate-500 mb-2">Daftar Akun Tim Aktif:</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {teamUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 flex items-center gap-2.5"
                >
                  <span
                    className="w-8 h-8 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0"
                    style={{ backgroundColor: u.warna }}
                  >
                    {u.avatarText}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {u.nama}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      @{u.username} • {u.role === "ADMIN" ? "Admin" : "Member"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  </div>
  );
}
