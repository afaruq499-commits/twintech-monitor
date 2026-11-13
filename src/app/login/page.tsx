"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cpu, Lock, LogIn } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Password salah.");
        return;
      }
      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-semibold text-slate-700 mb-1.5"
        >
          Password Akses Engineer
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="password"
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan password aplikasi..."
            className="w-full pl-10 pr-4 py-3 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#12141a] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F05232]/70 focus:border-transparent transition"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-sm font-medium text-rose-700"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F45B38] to-[#D9381E] hover:brightness-105 disabled:opacity-50 text-white font-bold py-3 px-5 transition shadow-md cursor-pointer"
      >
        <LogIn className="w-4 h-4" />
        {loading ? "Memverifikasi..." : "Masuk ke Project Monitor"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] dark:bg-[#0d0e12] p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[540px] h-[540px] rounded-full bg-[#F05232]/10 blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-md v14-card rounded-[28px] p-7 sm:p-9 animate-v14-in">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F45B38] to-[#D9381E] text-white flex items-center justify-center shadow-lg">
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

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          Pantau status pembelian komponen PR, jadwal wiring/PLC/commissioning,
          dan prioritas lintas proyek tanpa bentrok.
        </p>

        <Suspense
          fallback={
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Memuat...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
