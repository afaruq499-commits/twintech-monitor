"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Cpu,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import type { UserRole } from "@/lib/users";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [role, setRole] = useState<UserRole>("ADMIN");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleRoleChange(selectedRole: UserRole) {
    setRole(selectedRole);
    setError(null);
    if (selectedRole === "ADMIN") {
      setUsername("admin");
    } else {
      setUsername("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Username atau password yang Anda masukkan tidak valid.");
        return;
      }

      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch {
      setError("Gagal menghubungi server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Role Selection Tabs: Admin vs Member */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Pilih Tipe Akses
        </label>
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-[#161820] border border-slate-200/80 dark:border-white/10">
          <button
            type="button"
            onClick={() => handleRoleChange("ADMIN")}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              role === "ADMIN"
                ? "bg-white dark:bg-[#222530] text-[#F05232] shadow-sm font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#F05232]" />
            <span>Admin</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleChange("MEMBER")}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              role === "MEMBER"
                ? "bg-white dark:bg-[#222530] text-sky-600 dark:text-sky-400 shadow-sm font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Users className="w-4 h-4 text-sky-500" />
            <span>Member</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4.5">
        {/* Username Field */}
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Username {role === "ADMIN" ? "Admin" : "Member"}
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="username"
              type="text"
              required
              autoFocus={role === "MEMBER"}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                role === "ADMIN"
                  ? "Masukkan username admin..."
                  : "Masukkan username member Anda..."
              }
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#12141a] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F05232]/70 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoFocus={role === "ADMIN"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password..."
              className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#12141a] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F05232]/70 focus:border-transparent transition"
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
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl text-white font-bold py-3 px-5 transition shadow-sm cursor-pointer disabled:opacity-50 ${
            role === "ADMIN"
              ? "bg-gradient-to-r from-[#F45B38] to-[#D9381E] hover:brightness-105"
              : "bg-gradient-to-r from-sky-500 to-blue-600 hover:brightness-105"
          }`}
        >
          <LogIn className="w-4 h-4" />
          {loading ? "Memverifikasi..." : `Masuk sebagai ${role === "ADMIN" ? "Admin" : "Member"}`}
        </button>
      </form>

      <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] text-center">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Untuk pengaturan username dan password akun, silakan akses menu <strong>Pengaturan</strong> setelah berhasil masuk ke sistem.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] dark:bg-[#0d0e12] p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[540px] h-[540px] rounded-full bg-[#F05232]/10 blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-md v14-card rounded-[28px] p-7 sm:p-8 animate-v14-in">
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
            Masuk ke Akun Anda
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Sistem terintegrasi untuk pemantauan jadwal proyek, komponen PR, dan pembagian tugas kerja teknis.
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
