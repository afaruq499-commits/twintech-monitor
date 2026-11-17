"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

type RoleMode = "ADMIN" | "MEMBER";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [roleMode, setRoleMode] = useState<RoleMode>("ADMIN");
  const [selectedMember, setSelectedMember] = useState<"apip" | "rajip">("apip");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualUsername, setManualUsername] = useState("");

  const activeUsername = isManualInput
    ? manualUsername
    : roleMode === "ADMIN"
    ? "faruq"
    : selectedMember;

  const activeName =
    activeUsername === "faruq"
      ? "Faruq"
      : activeUsername === "apip"
      ? "Apip"
      : activeUsername === "rajip"
      ? "Rajip"
      : activeUsername;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: activeUsername,
          password,
          role: roleMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Password salah. Periksa kembali akun Anda.");
        return;
      }

      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch {
      setError("Gagal menghubungi server. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  }

  function applyQuickCredential(username: "faruq" | "apip" | "rajip", pass: string) {
    if (username === "faruq") {
      setRoleMode("ADMIN");
    } else {
      setRoleMode("MEMBER");
      setSelectedMember(username);
    }
    setIsManualInput(false);
    setPassword(pass);
    setError(null);
  }

  return (
    <div className="space-y-6">
      {/* Selector Mode Tab: Admin vs Member */}
      <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-[#161820] border border-slate-200/80 dark:border-white/10">
        <button
          type="button"
          onClick={() => {
            setRoleMode("ADMIN");
            setIsManualInput(false);
            setError(null);
          }}
          className={`relative flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            roleMode === "ADMIN" && !isManualInput
              ? "bg-white dark:bg-[#20232c] text-[#F05232] shadow-sm font-extrabold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-[#F05232]" />
          <span>Admin (Faruq)</span>
          {roleMode === "ADMIN" && !isManualInput && (
            <span className="w-2 h-2 rounded-full bg-[#F05232]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setRoleMode("MEMBER");
            setIsManualInput(false);
            setError(null);
          }}
          className={`relative flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            roleMode === "MEMBER" && !isManualInput
              ? "bg-white dark:bg-[#20232c] text-sky-600 dark:text-sky-400 shadow-sm font-extrabold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Users className="w-4 h-4 text-sky-500" />
          <span>Member (Apip / Rajip)</span>
          {roleMode === "MEMBER" && !isManualInput && (
            <span className="w-2 h-2 rounded-full bg-sky-500" />
          )}
        </button>
      </div>

      {/* Role Card Banner */}
      {!isManualInput ? (
        roleMode === "ADMIN" ? (
          <div className="rounded-2xl border border-orange-200/80 dark:border-orange-500/20 bg-orange-50/60 dark:bg-orange-500/5 p-4 flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#F45B38] to-[#D9381E] text-white font-black text-sm flex items-center justify-center shadow-md shrink-0">
              FQ
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Faruq
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F05232] text-white">
                  Admin
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Menentukan pekerjaan, menjadwalkan tanggal, &amp; menentukan PIC pelaksana tim (Admin juga bisa bekerja).
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Pilih Akun Member:
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedMember("apip");
                  setError(null);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  selectedMember === "apip"
                    ? "border-sky-500 bg-sky-50/80 dark:bg-sky-500/10 shadow-xs ring-2 ring-sky-500/30"
                    : "border-slate-200 dark:border-white/10 bg-white dark:bg-[#161820] hover:border-slate-300"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0">
                  AP
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Apip
                    {selectedMember === "apip" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Member
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMember("rajip");
                  setError(null);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  selectedMember === "rajip"
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-500/10 shadow-xs ring-2 ring-emerald-500/30"
                    : "border-slate-200 dark:border-white/10 bg-white dark:bg-[#161820] hover:border-slate-300"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0">
                  RJ
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Rajip
                    {selectedMember === "rajip" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Member
                  </div>
                </div>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              Member menerima notifikasi pekerjaan harian dari Admin dan memantau tugas yang diberikan.
            </p>
          </div>
        )
      ) : (
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Username Akun
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="username"
              type="text"
              required
              value={manualUsername}
              onChange={(e) => setManualUsername(e.target.value)}
              placeholder="faruq / apip / rajip"
              className="w-full pl-10 pr-4 py-3 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#12141a] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F05232]/70 focus:border-transparent transition"
            />
          </div>
        </div>
      )}

      {/* Form Input Password */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Password untuk <strong className="text-slate-900 dark:text-white">{activeName}</strong>
            </label>
            <button
              type="button"
              onClick={() => setIsManualInput((v) => !v)}
              className="text-[11px] text-[#F05232] hover:underline font-semibold cursor-pointer"
            >
              {isManualInput ? "Pilih Profil Cepat" : "Ketik Username Manual"}
            </button>
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                roleMode === "ADMIN"
                  ? "Masukkan password Faruq (default: faruq123)..."
                  : selectedMember === "apip"
                  ? "Masukkan password Apip (default: apip123)..."
                  : "Masukkan password Rajip (default: rajip123)..."
              }
              className="w-full pl-10 pr-11 py-3 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#12141a] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F05232]/70 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              title={showPassword ? "Sembunyikan password" : "Lihat password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-400"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-full text-white font-bold py-3 px-5 transition shadow-md cursor-pointer disabled:opacity-50 ${
            roleMode === "ADMIN"
              ? "bg-gradient-to-r from-[#F45B38] to-[#D9381E] hover:brightness-105"
              : selectedMember === "apip"
              ? "bg-gradient-to-r from-sky-500 to-blue-600 hover:brightness-105"
              : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-105"
          }`}
        >
          <LogIn className="w-4 h-4" />
          {loading
            ? "Memverifikasi Sesi..."
            : `Masuk sebagai ${activeName} (${roleMode === "ADMIN" ? "Admin" : "Member"})`}
        </button>
      </form>

      {/* Quick Autofill Helper Chips */}
      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.08]">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-2">
          <KeyRound className="w-3.5 h-3.5" />
          <span>Klik akun untuk isi otomatis password:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyQuickCredential("faruq", "faruq123")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 hover:bg-orange-100 transition cursor-pointer flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#F05232]" />
            Faruq (Admin): faruq123
          </button>
          <button
            type="button"
            onClick={() => applyQuickCredential("apip", "apip123")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 hover:bg-sky-100 transition cursor-pointer flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Apip (Member): apip123
          </button>
          <button
            type="button"
            onClick={() => applyQuickCredential("rajip", "rajip123")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Rajip (Member): rajip123
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] dark:bg-[#0d0e12] p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[540px] h-[540px] rounded-full bg-[#F05232]/10 blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-lg v14-card rounded-[28px] p-7 sm:p-9 animate-v14-in">
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F45B38] to-[#D9381E] text-white flex items-center justify-center shadow-lg shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Project Monitor
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              PT. Twintech Precision • Industrial Automation
            </p>
          </div>
        </div>

        <div className="mb-6 pb-4 border-b border-slate-100 dark:border-white/[0.08]">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Portal Akses &amp; Manajemen Pengerjaan
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Admin Faruq dapat menjadwalkan pekerjaan &amp; menentukan PIC pelaksana. Member (Apip &amp; Rajip) mendapatkan notifikasi tugas harian secara teratur.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
              Memuat form login...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
