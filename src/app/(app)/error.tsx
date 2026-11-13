"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Database, AlertTriangle, Home } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppRouteError({ error, reset }: ErrorProps) {
  const [countdown, setCountdown] = useState<number>(5);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    console.error("App Route Error:", error);
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
    }, 400);
  };

  const isDbError =
    error.message?.includes("Can't reach database") ||
    error.message?.includes("PrismaClient") ||
    error.message?.includes("connection") ||
    error.message?.includes("SQL") ||
    !error.message;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            {isDbError ? <Database className="w-6 h-6 animate-pulse" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900">
              {isDbError ? "Menghubungkan ke Database..." : "Terjadi Kendala Sementara"}
            </h1>
            <p className="text-xs text-slate-500">
              PT. Twintech Precision — Electrical Monitoring
            </p>
          </div>
        </div>

        <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200 text-xs space-y-1.5 text-amber-900">
          <div className="font-bold flex items-center gap-1.5 text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Koneksi Database Sedang Diinisialisasi</span>
          </div>
          <p className="leading-relaxed text-amber-700">
            Layanan <strong>SQL Server (SQLEXPRESS)</strong> kemungkinan baru saja dimulai atau komputer baru dinyalakan. Silakan muat ulang dalam beberapa detik.
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
            <span>
              {isRetrying
                ? "Menghubungkan Ulang..."
                : countdown > 0
                  ? `Muat Ulang Sekarang (${countdown}s)`
                  : "Muat Ulang Halaman"}
            </span>
          </button>

          <Link
            href="/"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition text-center cursor-pointer border border-slate-200"
          >
            <Home className="w-4 h-4" />
            <span>Ke Dashboard Utama</span>
          </Link>
        </div>

        {error.digest && (
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono text-center">
            Digest: <span className="text-slate-600 font-bold">{error.digest}</span>
          </div>
        )}
      </div>
    </div>
  );
}
