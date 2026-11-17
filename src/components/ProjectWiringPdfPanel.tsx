"use client";

import { useState, useRef } from "react";
import {
  Download,
  Eye,
  FileText,
  Maximize2,
  Trash2,
  Upload,
  CheckCircle2,
  FileCheck,
  Compass,
  FileCode2,
  Layers,
} from "lucide-react";

export function ProjectWiringPdfPanel({
  projectId,
  initialPdfUrl,
  initialPdfName,
  onUpdateSuccess,
}: {
  projectId: string;
  initialPdfUrl: string | null | undefined;
  initialPdfName: string | null | undefined;
  onUpdateSuccess?: (url: string | null, name: string | null) => void;
}) {
  const [fileUrl, setFileUrl] = useState<string | null>(initialPdfUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(initialPdfName ?? null);
  const [uploading, setUploading] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deteksi tipe berkas
  const lowerName = (fileName || fileUrl || "").toLowerCase();
  const isDwg = lowerName.endsWith(".dwg");
  const isDxf = lowerName.endsWith(".dxf");
  const isPdf = lowerName.endsWith(".pdf");
  const isImage = /\.(png|jpe?g|svg|webp)$/i.test(lowerName);

  async function handleFileUpload(file: File) {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "wiring-diagrams");

      const resUpload = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!resUpload.ok) {
        const errData = await resUpload.json();
        throw new Error(errData.error || "Gagal mengunggah berkas diagram wiring");
      }

      const uploadResult = await resUpload.json();
      const uploadedUrl = uploadResult.url;
      const uploadedName = uploadResult.fileName;

      // Update proyek di database
      const resProject = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wiringDiagramPdfUrl: uploadedUrl,
          wiringDiagramPdfName: uploadedName,
        }),
      });

      if (!resProject.ok) {
        throw new Error("Gagal menyimpan tautan diagram wiring pada proyek");
      }

      setFileUrl(uploadedUrl);
      setFileName(uploadedName);
      onUpdateSuccess?.(uploadedUrl, uploadedName);
    } catch (err) {
      console.error("Gagal mengunggah diagram wiring:", err);
      alert(err instanceof Error ? err.message : "Gagal mengunggah berkas diagram wiring");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteFile() {
    const formatLabel = isDwg ? "DWG AutoCAD" : isDxf ? "DXF" : isPdf ? "PDF" : "diagram wiring";
    if (!window.confirm(`Hapus lampiran berkas ${formatLabel} dari proyek ini?`)) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wiringDiagramPdfUrl: null,
          wiringDiagramPdfName: null,
        }),
      });
      if (res.ok) {
        setFileUrl(null);
        setFileName(null);
        onUpdateSuccess?.(null, null);
      }
    } catch (err) {
      console.error("Gagal menghapus berkas:", err);
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
            <span className="p-1.5 rounded-lg bg-rose-600 text-white shadow-xs">
              <FileText className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-slate-900 text-base">
              Diagram Wiring
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Simpan berkas gambar skematik elektrikal, power distribution, PLC I/O wiring, dan servo driver.
            Mendukung berkas <strong>AutoCAD DWG (.dwg)</strong>, DXF, maupun dokumen <strong>PDF (.pdf)</strong>.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg,.svg,.zip,.rar,application/pdf,application/acad,image/vnd.dwg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFileUpload(f);
          }}
        />

        <div className="flex items-center gap-2">
          {fileUrl && isPdf && (
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>Buka Layar Penuh</span>
            </button>
          )}

          {fileUrl && (
            <a
              href={fileUrl}
              download={fileName || (isDwg ? "Diagram_Wiring.dwg" : "Diagram_Wiring.pdf")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Berkas</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>
              {uploading
                ? "Mengunggah..."
                : fileUrl
                ? "Ganti Berkas (DWG / PDF)"
                : "Upload Diagram Wiring (DWG / PDF)"}
            </span>
          </button>
        </div>
      </div>

      {/* Konten Area */}
      <div className="p-5">
        {!fileUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-10 border-2 border-dashed border-rose-200 hover:border-rose-400 rounded-2xl bg-rose-50/20 hover:bg-rose-50/40 text-center transition cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition shadow-xs">
              <Compass className="w-7 h-7" />
            </div>
            <h4 className="font-extrabold text-slate-800 text-sm">
              Belum Ada Berkas Diagram Wiring yang Diunggah
            </h4>
            <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1 mb-4 leading-relaxed">
              Klik di sini untuk mengunggah berkas diagram wiring elektrikal hasil desain. Mendukung gambar teknik{" "}
              <strong>AutoCAD DWG (.dwg)</strong>, DXF, maupun dokumen <strong>PDF (.pdf)</strong>. Berkas akan tersimpan aman dan siap diunduh tim engineering kapan saja.
            </p>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 group-hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs">
              <Upload className="w-4 h-4" />
              Pilih Berkas DWG / PDF dari Komputer
            </span>
          </div>
        ) : isDwg || isDxf ? (
          /* ================= TAMPILAN KHUSUS BERKAS AUTOCAD DWG / DXF ================= */
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white border border-slate-700 shadow-sm">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Compass className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 uppercase tracking-wide">
                      {isDwg ? "AutoCAD DWG Drawing" : "CAD DXF Drawing"}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan &amp; Siap Diunduh
                    </span>
                  </div>
                  <h4 className="font-extrabold text-white text-base mt-1 break-all">
                    {fileName || (isDwg ? "Diagram_Wiring.dwg" : "Diagram_Wiring.dxf")}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                    Berkas gambar teknik CAD diagram wiring elektrikal telah tersimpan aman di server proyek.
                    Dapat diunduh kapan saja oleh tim untuk dibuka di AutoCAD, Autodesk TrueView, atau CAD viewer.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end md:self-center">
                <a
                  href={fileUrl}
                  download={fileName || (isDwg ? "Diagram_Wiring.dwg" : "Diagram_Wiring.dxf")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold transition shadow-md"
                >
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>Unduh Berkas DWG</span>
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
                  title="Hapus berkas DWG ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Info Box Bantuan DWG */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-cyan-100 text-cyan-800 shrink-0 mt-0.5">
                <FileCode2 className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-800">
                  Tentang Berkas Format AutoCAD DWG (.dwg):
                </p>
                <p className="leading-relaxed">
                  Format berkas <code>.dwg</code> adalah standar industri gambar teknik CAD asli (AutoCAD Electrical / DraftSight).
                  Sistem menyimpan berkas ini secara utuh sehingga Anda dapat mengunduhnya dan membukanya di workstation teknisi kapan pun revisi wiring dibutuhkan.
                </p>
              </div>
            </div>
          </div>
        ) : isPdf ? (
          /* ================= TAMPILAN BERKAS PDF (DOKUMEN DENGAN INLINE VIEWER) ================= */
          <div className="space-y-4">
            {/* Card Info Dokumen PDF */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-50/50 border border-rose-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-200 text-rose-800">
                      PDF Document
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Siap Dipratinjau
                    </span>
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm mt-0.5 break-all">
                    {fileName || "Diagram_Wiring_Elektrikal.pdf"}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <a
                  href={fileUrl}
                  download={fileName || "Diagram_Wiring.pdf"}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition"
                >
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>Unduh PDF</span>
                </a>

                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span>Pratinjau Layar Penuh</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteFile}
                  disabled={uploading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100/50 transition cursor-pointer"
                  title="Hapus berkas PDF ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Embedded Inline PDF Viewer */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 shadow-inner">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-white text-xs font-bold">
                <span className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-rose-400" />
                  <span>Pratinjau Diagram Wiring (Embedded Viewer)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Layar Penuh</span>
                </button>
              </div>
              <iframe
                src={`${fileUrl}#toolbar=1&view=FitH`}
                title="Diagram Wiring PDF"
                className="w-full h-[520px] bg-slate-100"
              />
            </div>
          </div>
        ) : (
          /* ================= TAMPILAN GAMBAR / BERKAS LAINNYA ================= */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-100 border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm break-all">
                    {fileName || "Diagram_Wiring"}
                  </h4>
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Berkas Siap Diunduh
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={fileUrl}
                  download={fileName || "Diagram_Wiring"}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Berkas</span>
                </a>
                <button
                  type="button"
                  onClick={handleDeleteFile}
                  disabled={uploading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100/50 transition cursor-pointer"
                  title="Hapus berkas ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isImage && (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl}
                  alt="Diagram Wiring"
                  className="max-h-[500px] object-contain rounded-lg"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Pratinjau Fullscreen (Untuk PDF) */}
      {isPreviewModalOpen && fileUrl && isPdf && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-xs">
          <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-rose-400" />
              <span className="font-bold text-sm">
                Pratinjau Diagram Wiring: {fileName || "Dokumen PDF"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={fileUrl}
                download={fileName || "Diagram_Wiring.pdf"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                Unduh
              </a>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 w-full h-full bg-slate-950 p-2 sm:p-4">
            <iframe
              src={`${fileUrl}#toolbar=1&view=Fit`}
              title="Fullscreen Diagram Wiring PDF"
              className="w-full h-full rounded-xl border border-slate-800 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
