"use client";

import { useState, useRef } from "react";
import {
  Download,
  Trash2,
  Upload,
  CheckCircle2,
  Cpu,
  FileCode2,
  HardDriveDownload,
  Server,
  Layers,
  Sparkles,
  Archive,
} from "lucide-react";

interface ProjectPlcProgramPanelProps {
  projectId: string;
  initialFileUrl?: string | null;
  initialFileName?: string | null;
  initialFileSize?: number | null;
  onUpdateSuccess?: (
    url: string | null,
    name: string | null,
    size: number | null
  ) => void;
}

// Helper untuk format ukuran byte menjadi KB / MB
function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Helper untuk mendeteksi software/brand PLC berdasarkan ekstensi file
function getPlcBrandBadge(fileName?: string | null): {
  label: string;
  badgeClass: string;
} {
  if (!fileName) return { label: "Berkas Program PLC", badgeClass: "bg-slate-200 text-slate-800" };
  const ext = fileName.toLowerCase().split(".").pop() || "";

  switch (ext) {
    // 1. Keyence KV Series (KV-8000 / KV-7000 / KV-Nano / KV STUDIO)
    case "kvp":
    case "kvs":
    case "kvr":
    case "kvd":
    case "kbp":
    case "kv":
      return {
        label: "Keyence KV STUDIO (KV-8000)",
        badgeClass: "bg-red-50 text-red-700 border-red-300 font-black",
      };

    // 2. Panasonic Control FPWIN Pro 7 / FP Series
    case "p7":
    case "p6":
    case "fp":
    case "fpw":
    case "fpe":
      return {
        label: "Panasonic FPWIN Pro 7 (.p7)",
        badgeClass: "bg-sky-50 text-sky-800 border-sky-300 font-black",
      };

    // 3. Fatek UpperLogic / WinProladder (FBs Series)
    case "fkg":
    case "pms":
    case "ldf":
    case "fatek":
    case "fbs":
      return {
        label: "Fatek UpperLogic (.fkg/.pms)",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300 font-black",
      };

    // 4. Omron CX-Programmer / Sysmac Studio
    case "cxp":
      return {
        label: "Omron CX-Programmer (.cxp)",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
      };

    // 5. Mitsubishi Electric GX Works 3 / 2
    case "gx3":
      return {
        label: "Mitsubishi GX Works 3 (.gx3)",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
      };
    case "gx2":
    case "gxw":
      return {
        label: "Mitsubishi GX Works 2 / Developer (.gx2)",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
      };

    // 6. Siemens SIMATIC / TIA Portal / MicroWIN
    case "smw":
    case "mwp":
      return {
        label: "Siemens S7-200 MicroWIN (.smw)",
        badgeClass: "bg-teal-100 text-teal-800 border-teal-300",
      };
    case "ap15":
    case "ap16":
    case "ap17":
    case "ap18":
    case "ap19":
    case "s7p":
      return {
        label: `Siemens TIA Portal (.${ext})`,
        badgeClass: "bg-teal-100 text-teal-800 border-teal-300",
      };

    // 7. Rockwell / Studio 5000 / RSLogix
    case "acd":
    case "mer":
    case "apa":
      return {
        label: `Rockwell / Studio 5000 (.${ext})`,
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
      };

    // 8. Schneider / CoDeSys
    case "pro":
    case "project":
      // Cek apakah kemungkinan Panasonic FPWIN Pro atau Schneider
      if (fileName?.toLowerCase().includes("panasonic") || fileName?.toLowerCase().includes("fpwin")) {
        return {
          label: "Panasonic FPWIN Pro 7 (.pro)",
          badgeClass: "bg-sky-50 text-sky-800 border-sky-300 font-black",
        };
      }
      return {
        label: "Schneider / CoDeSys Project (.pro)",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      };

    // 9. Delta Electronics WPLSoft
    case "dvp":
    case "ipp":
      return {
        label: "Delta Electronics WPLSoft (.dvp)",
        badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300",
      };

    // 10. Arsip Proyek
    case "zip":
    case "rar":
    case "7z":
      return {
        label: `Arsip Cadangan Proyek PLC (.${ext})`,
        badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
      };

    default:
      return {
        label: `Software PLC (${ext ? `.${ext.toUpperCase()}` : "File"})`,
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
      };
  }
}

export function ProjectPlcProgramPanel({
  projectId,
  initialFileUrl,
  initialFileName,
  initialFileSize,
  onUpdateSuccess,
}: ProjectPlcProgramPanelProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(initialFileUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(initialFileName ?? null);
  const [fileSize, setFileSize] = useState<number | null>(initialFileSize ?? null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const brandInfo = getPlcBrandBadge(fileName);

  async function handleFileUpload(file: File) {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "plc-programs");

      const resUpload = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!resUpload.ok) {
        const errData = await resUpload.json();
        throw new Error(errData.error || "Gagal mengunggah berkas program PLC");
      }

      const uploadResult = await resUpload.json();
      const uploadedUrl = uploadResult.url;
      const uploadedName = uploadResult.fileName;
      const uploadedSize = uploadResult.fileSize || file.size;

      // Update proyek di database
      const resProject = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plcProgramFileUrl: uploadedUrl,
          plcProgramFileName: uploadedName,
          plcProgramFileSize: uploadedSize,
        }),
      });

      if (!resProject.ok) {
        throw new Error("Gagal menyimpan metadata program PLC pada proyek");
      }

      setFileUrl(uploadedUrl);
      setFileName(uploadedName);
      setFileSize(uploadedSize);
      onUpdateSuccess?.(uploadedUrl, uploadedName, uploadedSize);
    } catch (err) {
      console.error("Gagal mengunggah program PLC:", err);
      alert(err instanceof Error ? err.message : "Gagal mengunggah berkas program PLC");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteFile() {
    if (
      !window.confirm(
        "Hapus lampiran berkas program PLC dari proyek ini? Cadangan file di server akan dihapus dari tautan proyek."
      )
    ) {
      return;
    }

    setUploading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plcProgramFileUrl: null,
          plcProgramFileName: null,
          plcProgramFileSize: null,
        }),
      });
      if (res.ok) {
        setFileUrl(null);
        setFileName(null);
        setFileSize(null);
        onUpdateSuccess?.(null, null, null);
      }
    } catch (err) {
      console.error("Gagal menghapus berkas program PLC:", err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/70">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
              <Cpu className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-slate-900 text-base">
              Program PLC
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Simpan cadangan berkas logika ladder / instruksi program PLC proyek mesin ini.
            Mendukung semua format berkas PLC (<strong>Keyence KV-8000 .kvp/.kvs</strong>, <strong>Panasonic FPWIN Pro 7 .p7/.pro</strong>, <strong>Fatek UpperLogic .fkg/.pms</strong>, Omron, Mitsubishi, Siemens, maupun arsip <strong>ZIP/RAR</strong>).
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFileUpload(f);
          }}
        />

        <div className="flex items-center gap-2">
          {fileUrl && (
            <a
              href={fileUrl}
              download={fileName || "Program_PLC"}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Program PLC</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>
              {uploading
                ? "Mengunggah..."
                : fileUrl
                ? "Ganti Berkas Program"
                : "Upload Program PLC"}
            </span>
          </button>
        </div>
      </div>

      {/* Konten Area */}
      <div className="p-5">
        {!fileUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-10 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl bg-indigo-50/20 hover:bg-indigo-50/40 text-center transition cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition shadow-xs">
              <Cpu className="w-7 h-7" />
            </div>
            <h4 className="font-extrabold text-slate-800 text-sm">
              Belum Ada Program PLC
            </h4>
            <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1 mb-4 leading-relaxed">
              Klik di sini untuk mengunggah berkas program PLC hasil pemrograman mesin. Mendukung semua format software PLC:
              <strong>Keyence KV STUDIO KV-8000</strong> (<code>.kvp</code>, <code>.kvs</code>), <strong>Panasonic FPWIN Pro 7</strong> (<code>.p7</code>, <code>.pro</code>), <strong>Fatek UpperLogic</strong> (<code>.fkg</code>, <code>.pms</code>), Omron (<code>.cxp</code>), Mitsubishi GX Works (<code>.gx3</code>), Siemens, maupun arsip ZIP/RAR.
            </p>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 group-hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs">
              <Upload className="w-4 h-4" />
              Pilih Program PLC
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Card Berkas Program PLC Tersimpan */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700 shadow-sm">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0 shadow-inner">
                  <FileCode2 className="w-7 h-7 text-indigo-400" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border uppercase tracking-wide ${brandInfo.badgeClass}`}
                    >
                      {brandInfo.label}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan &amp; Siap Diunduh
                    </span>
                    {fileSize && (
                      <span className="text-xs text-slate-400 font-mono">
                        ({formatBytes(fileSize)})
                      </span>
                    )}
                  </div>
                  <h4 className="font-extrabold text-white text-base mt-1 break-all">
                    {fileName || "Program_PLC_Mesin"}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                    Berkas cadangan program PLC ini tersimpan aman di sistem. Teknisi atau engineer commissioning dapat mengunduhnya kapan pun untuk pengujian mesin, transfer ke PLC, atau perbaikan program di lapangan.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end md:self-center">
                <a
                  href={fileUrl}
                  download={fileName || "Program_PLC"}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition shadow-md"
                >
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>Unduh Program PLC</span>
                </a>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Ganti File</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteFile}
                  disabled={uploading}
                  className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition cursor-pointer"
                  title="Hapus berkas program PLC ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Info Bantuan Format */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                <HardDriveDownload className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-800">
                  Cadangan Program PLC Proyek (Offline &amp; Cloud Ready):
                </p>
                <p className="leading-relaxed">
                  Semua berkas program yang diunggah akan otomatis melengkapi ceklis <strong>Pemprograman (Program PLC)</strong> pada berkas proyek.
                  File cadangan dapat diunduh langsung tanpa perlu konversi, siap dibuka oleh software pemrograman PLC masing-masing vendor.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
