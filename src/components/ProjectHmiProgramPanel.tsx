"use client";

import { useState, useRef } from "react";
import {
  Download,
  Trash2,
  Upload,
  CheckCircle2,
  Monitor,
  FileCode2,
  HardDriveDownload,
  Sparkles,
  Layers,
  LayoutGrid,
} from "lucide-react";

interface ProjectHmiProgramPanelProps {
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

// Helper untuk mendeteksi software/brand HMI berdasarkan ekstensi file
export function getHmiBrandBadge(fileName?: string | null): {
  label: string;
  badgeClass: string;
  brand: string;
} {
  if (!fileName) {
    return {
      label: "Berkas Program HMI",
      badgeClass: "bg-slate-200 text-slate-800",
      brand: "HMI",
    };
  }
  const ext = fileName.toLowerCase().split(".").pop() || "";

  switch (ext) {
    // 1. Keyence VT STUDIO (VT5 / VT3 / VT2 Series)
    case "vtp":
    case "vt5":
    case "vt3":
    case "vt2":
    case "vt":
      return {
        label: "Keyence VT STUDIO (.vtp)",
        badgeClass: "bg-red-50 text-red-700 border-red-300 font-black",
        brand: "Keyence",
      };

    // 2. Panasonic GTWIN (GT02 / GT05 / GT12 / GT32 / GT707 Series)
    case "gtn":
    case "gtw":
    case "gtd":
    case "gen":
      return {
        label: "Panasonic GTWIN (.gtn/.gtw)",
        badgeClass: "bg-sky-50 text-sky-800 border-sky-300 font-black",
        brand: "Panasonic",
      };

    // 3. Fatek FV-Designer (FVT Series)
    case "fvd":
    case "fv":
    case "pmt":
      return {
        label: "Fatek FV-Designer (.fvd)",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300 font-black",
        brand: "Fatek",
      };

    // 4. Omron CX-Designer / NB-Designer
    case "ipp":
      return {
        label: "Omron CX-Designer (.ipp)",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
        brand: "Omron",
      };
    case "pkg":
    case "cxd":
    case "nsj":
      return {
        label: "Omron NB-Designer / NS (.pkg)",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
        brand: "Omron",
      };

    // 5. Mitsubishi Electric GT Designer 3 (GOT2000 / GOT1000)
    case "gxe":
    case "gtx":
    case "gpx":
    case "g10":
    case "g20":
    case "god":
      return {
        label: "Mitsubishi GT Designer 3 (.gtx)",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
        brand: "Mitsubishi",
      };

    // 6. Siemens WinCC / TIA Portal HMI (Comfort / Basic Panels)
    case "hmi":
    case "fwc":
      return {
        label: "Siemens WinCC Flexible (.hmi)",
        badgeClass: "bg-teal-100 text-teal-800 border-teal-300",
        brand: "Siemens",
      };
    case "ap15":
    case "ap16":
    case "ap17":
    case "ap18":
    case "ap19":
      return {
        label: `Siemens TIA Portal HMI (.${ext})`,
        badgeClass: "bg-teal-100 text-teal-800 border-teal-300",
        brand: "Siemens",
      };

    // 7. Pro-face GP-Pro EX (Schneider Electric)
    case "prx":
    case "prw":
    case "vdj":
      return {
        label: "Pro-face GP-Pro EX (.prx)",
        badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
        brand: "Pro-face",
      };

    // 8. Weintek EasyBuilder Pro (cMT / MT8000 Series)
    case "emtp":
    case "cmtp":
    case "xob":
    case "exob":
      return {
        label: "Weintek EasyBuilder Pro (.emtp)",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
        brand: "Weintek",
      };

    // 9. Delta Electronics DOPSoft (DOP-100 / DOP-B)
    case "dop":
    case "dpb":
      return {
        label: "Delta DOPSoft (.dop)",
        badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300",
        brand: "Delta",
      };

    // 10. Rockwell / Allen-Bradley FactoryTalk View Studio ME
    case "mer":
    case "apa":
    case "med":
      return {
        label: `Rockwell FactoryTalk ME (.${ext})`,
        badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
        brand: "Rockwell",
      };

    // 11. Fuji Electric / Hakko Monitouch (V-SFT)
    case "v9":
    case "v8":
    case "v7":
    case "v6":
    case "vst":
      return {
        label: `Fuji Monitouch V-SFT (.${ext})`,
        badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300",
        brand: "Fuji Electric",
      };

    // 12. Kinco HMIware
    case "hmw":
      return {
        label: "Kinco HMIware (.hmw)",
        badgeClass: "bg-green-100 text-green-800 border-green-300",
        brand: "Kinco",
      };

    // 13. Arsip Cadangan
    case "zip":
    case "rar":
    case "7z":
      return {
        label: `Arsip Cadangan Proyek HMI (.${ext})`,
        badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
        brand: "Arsip",
      };

    default:
      return {
        label: `Software HMI (${ext ? `.${ext.toUpperCase()}` : "File"})`,
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
        brand: "HMI",
      };
  }
}

export function ProjectHmiProgramPanel({
  projectId,
  initialFileUrl,
  initialFileName,
  initialFileSize,
  onUpdateSuccess,
}: ProjectHmiProgramPanelProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(initialFileUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(initialFileName ?? null);
  const [fileSize, setFileSize] = useState<number | null>(initialFileSize ?? null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const brandInfo = getHmiBrandBadge(fileName);

  async function handleFileUpload(file: File) {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "hmi-programs");

      const resUpload = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!resUpload.ok) {
        const errData = await resUpload.json();
        throw new Error(errData.error || "Gagal mengunggah berkas program HMI");
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
          hmiProgramFileUrl: uploadedUrl,
          hmiProgramFileName: uploadedName,
          hmiProgramFileSize: uploadedSize,
        }),
      });

      if (!resProject.ok) {
        throw new Error("Gagal menyimpan metadata program HMI pada proyek");
      }

      setFileUrl(uploadedUrl);
      setFileName(uploadedName);
      setFileSize(uploadedSize);
      onUpdateSuccess?.(uploadedUrl, uploadedName, uploadedSize);
    } catch (err) {
      console.error("Gagal mengunggah program HMI:", err);
      alert(err instanceof Error ? err.message : "Gagal mengunggah berkas program HMI");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteFile() {
    if (
      !window.confirm(
        "Hapus lampiran berkas program HMI dari proyek ini? Cadangan file di server akan dihapus dari tautan proyek."
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
          hmiProgramFileUrl: null,
          hmiProgramFileName: null,
          hmiProgramFileSize: null,
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal menghapus berkas program HMI pada proyek");
      }

      setFileUrl(null);
      setFileName(null);
      setFileSize(null);
      onUpdateSuccess?.(null, null, null);
    } catch (err) {
      console.error("Gagal menghapus berkas HMI:", err);
      alert(err instanceof Error ? err.message : "Gagal menghapus berkas HMI");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 transition hover:shadow-md">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-800 tracking-tight">
                Program HMI
              </h3>
              {fileUrl && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Tersimpan
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Simpan dan cadangkan file desain layar HMI (Keyence VT, Panasonic GTWIN, Fatek FV, Omron, Mitsubishi GOT, Weintek, Pro-face, dll.)
            </p>
          </div>
        </div>

        {/* Input File Tersembunyi */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
          }}
        />

        {/* Action Button Unggah / Ganti */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading
              ? "Mengunggah..."
              : fileUrl
              ? "Ganti File HMI"
              : "Unggah File HMI"}
          </button>
        </div>
      </div>

      {/* Konten Utama */}
      <div className="mt-4">
        {fileUrl ? (
          <div className="p-4 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/60 via-orange-50/30 to-amber-50/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white border border-amber-300 text-amber-600 flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                <FileCode2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${brandInfo.badgeClass}`}
                  >
                    {brandInfo.label}
                  </span>
                  {fileSize && (
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      • {formatBytes(fileSize)}
                    </span>
                  )}
                </div>
                <h4
                  className="text-sm font-black text-slate-800 truncate"
                  title={fileName || "Program HMI"}
                >
                  {fileName || "File Program HMI"}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Tersedia untuk diunduh langsung ke software desain HMI terkait.
                </p>
              </div>
            </div>

            {/* Tombol Unduh & Hapus */}
            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <a
                href={fileUrl}
                download={fileName || "program-hmi"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                Unduh Berkas HMI
              </a>
              <button
                type="button"
                disabled={uploading}
                onClick={handleDeleteFile}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition active:scale-95 cursor-pointer"
                title="Hapus berkas ini"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Placeholder Kosong / Drop Area */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-6 rounded-xl border-2 border-dashed border-slate-200 hover:border-amber-400 bg-slate-50/50 hover:bg-amber-50/30 transition text-center cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
              <HardDriveDownload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800 group-hover:text-amber-700 transition">
              Belum ada Program HMI
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Klik di sini untuk memilih dan mengunggah berkas proyek HMI (Keyence, Panasonic, Fatek, Omron, Mitsubishi, Pro-face, Weintek, dll.)
            </p>
          </div>
        )}

        {/* Informasi Format Software HMI yang Didukung */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Format Software HMI Didukung (Merek Sesuai PLC):
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold">
              Keyence: VT STUDIO (.vtp, .vt5)
            </span>
            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-semibold">
              Panasonic: GTWIN (.gtn, .gtw)
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              Fatek: FV-Designer (.fvd)
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
              Omron: CX-Designer (.ipp) / NB (.pkg)
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
              Mitsubishi: GT Designer 3 (.gtx, .gxe)
            </span>
            <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-semibold">
              Siemens: WinCC / TIA (.hmi, .ap)
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
              Pro-face: GP-Pro EX (.prx)
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              Weintek: EasyBuilder Pro (.emtp)
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold">
              Delta: DOPSoft (.dop)
            </span>
            <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200 font-semibold">
              Rockwell: FactoryTalk ME (.mer)
            </span>
            <span className="px-2 py-0.5 rounded bg-yellow-50 text-yellow-800 border border-yellow-200 font-semibold">
              Fuji: Monitouch V-SFT (.v9, .v8)
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              Arsip Cadangan (.zip, .rar, .7z)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
