"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Database, AlertTriangle, Home } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  const [countdown, setCountdown] = useState<number>(5);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    console.error("Application Global Error:", error);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [error]);

  const handleRetry = () => {
    setIsRetrying(true);
    reset();
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const isDbError =
    error.message?.includes("Can't reach database") ||
    error.message?.includes("PrismaClient") ||
    error.message?.includes("connection") ||
    error.message?.includes("SQL") ||
    !error.message;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            {isDbError ? <Database className="w-6 h-6 animate-pulse" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">
              {isDbError ? "Menghubungkan ke Database..." : "Terjadi Kesalahan Sementara"}
            </h1>
            <p className="text-xs text-slate-400">
              PT. Twintech Precision — Electrical Monitoring
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-700/60 text-xs space-y-2 text-slate-300">
          <div className="font-semibold text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Penyebab yang Paling Sering Terjadi:</span>
          </div>
          <p className="leading-relaxed text-slate-400">
            Layanan <strong>SQL Server (SQLEXPRESS)</strong> sedang melakukan pemulihan atau *cold-start* setelah komputer baru dinyalakan/direstart (biasanya membutuhkan waktu 10-40 detik untuk siap).
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
            <span>
              {isRetrying
                ? "Mencoba Menghubungkan Kembali..."
                : countdown > 0
                  ? `Muat Ulang Sekarang (Auto-retry ${countdown}s)`
                  : "Muat Ulang Halaman (Coba Lagi)"}
            </span>
          </button>

          <Link
            href="/"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition text-center cursor-pointer border border-slate-600"
          >
            <Home className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>

        {error.digest && (
          <div className="pt-2 border-t border-slate-700/50 text-[10px] text-slate-500 font-mono text-center">
            Kode Error Digest: <span className="text-slate-400 font-bold">{error.digest}</span>
          </div>
        )}
      </div>
    </div>
  );
}
