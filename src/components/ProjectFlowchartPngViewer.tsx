"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  FileImage,
  Upload,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Layers,
  Eye,
  FileCode,
  FileUp,
  Workflow,
} from "lucide-react";
import {
  normalizeFlowchartPayload,
  validatePngMagicBytes,
  saveFlowchartBlob,
  StoredFlowchartPayload,
} from "@/lib/flowchart-storage";

interface ProjectFlowchartPngViewerProps {
  projectId: string;
  projectName?: string;
  initialDataJson?: string | null;
  onUpdateSuccess?: () => void;
}

export function ProjectFlowchartPngViewer({
  projectId,
  projectName = "Proyek",
  initialDataJson,
  onUpdateSuccess,
}: ProjectFlowchartPngViewerProps) {
  const [data, setData] = useState<StoredFlowchartPayload | null>(() =>
    normalizeFlowchartPayload(initialDataJson, projectId)
  );

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mode tampilan untuk proyek multi-gambar ("merged" = gabungan 1 kanvas, atau nomor indeks gambar)
  const [activeMultiIndex, setActiveMultiIndex] = useState<number | "merged">("merged");

  // Fallback image error state
  const [imageLoadError, setImageLoadError] = useState(false);
  const [usedFallbackSrc, setUsedFallbackSrc] = useState(false);

  // State Modal Upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State Modal Import JSON
  const [importingJson, setImportingJson] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync prop changes
  useEffect(() => {
    setData(normalizeFlowchartPayload(initialDataJson, projectId));
    setImageLoadError(false);
    setUsedFallbackSrc(false);
    setActiveMultiIndex("merged");
  }, [initialDataJson, projectId]);

  // Handle preview object URLs with proper cleanup
  useEffect(() => {
    const urls = selectedFiles.map((f) => URL.createObjectURL(f));
    setFilePreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [selectedFiles]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.2, 3.0));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.2, 0.4));
  const handleZoomReset = () => setZoomLevel(1.0);

  // Menentukan sumber gambar utama & fallback
  const isMulti = (data?.imageUrls?.length ?? 0) > 1;
  let resolvedSrc: string | null = null;

  if (isMulti && activeMultiIndex !== "merged" && typeof activeMultiIndex === "number") {
    resolvedSrc = data?.imageUrls?.[activeMultiIndex] || null;
  } else if (isMulti && data?.svgDataUrl) {
    // Tampilan default 2 gambar: kanvas gabungan SVG 1:1 berdampingan
    resolvedSrc = data.svgDataUrl;
  } else {
    // Tampilan 1 gambar
    resolvedSrc = data?.primaryImageUrl || data?.imageUrls?.[0] || data?.svgDataUrl || null;
  }

  const primaryCandidate = resolvedSrc;
  const secondaryCandidate =
    primaryCandidate === data?.svgDataUrl
      ? data?.primaryImageUrl || data?.imageUrls?.[0] || null
      : data?.svgDataUrl || null;

  let imageDisplaySrc: string | null = null;
  if (!usedFallbackSrc) {
    imageDisplaySrc = primaryCandidate || secondaryCandidate;
  } else {
    // Jika candidate utama gagal, coba secondary
    imageDisplaySrc =
      secondaryCandidate && secondaryCandidate !== primaryCandidate
        ? secondaryCandidate
        : null;
  }

  // Handle error saat gambar gagal di-render oleh browser
  const handleImageError = () => {
    console.warn("Gambar flowchart gagal dimuat:", imageDisplaySrc);
    if (!usedFallbackSrc && secondaryCandidate && secondaryCandidate !== primaryCandidate) {
      setUsedFallbackSrc(true);
    } else {
      setImageLoadError(true);
    }
  };

  // Memilih file baru di modal upload dengan validasi
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);

    const newArr: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size === 0) {
        setUploadError(`Berkas "${file.name}" kosong (0 bytes).`);
        return;
      }

      if (file.size > 25 * 1024 * 1024) {
        setUploadError(`Berkas "${file.name}" terlalu besar (maksimal 25MB per berkas).`);
        return;
      }

      if (
        !file.type.startsWith("image/") &&
        !file.name.match(/\.(png|jpe?g|webp|bmp)$/i)
      ) {
        setUploadError(`Berkas "${file.name}" bukan format gambar PNG, JPG, atau WebP yang valid.`);
        return;
      }

      if (file.name.toLowerCase().endsWith(".png")) {
        const isPngValid = await validatePngMagicBytes(file);
        if (!isPngValid) {
          setUploadError(`Berkas "${file.name}" tidak memiliki signature PNG yang valid.`);
          return;
        }
      }

      newArr.push(file);
    }

    if (newArr.length === 0) {
      setUploadError("Pilih berkas gambar PNG, JPG, atau WebP yang valid.");
      return;
    }

    setSelectedFiles((prev) => [...prev, ...newArr]);
  };

  const handleMoveFile = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= selectedFiles.length) return;
    const copy = [...selectedFiles];
    const [item] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, item);
    setSelectedFiles(copy);
  };

  const handleRemoveFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit upload PNG
  const handleSubmitUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError("Pilih setidaknya 1 berkas gambar PNG.");
      return;
    }
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append("files", f));
      formData.append("engine", "auto");

      const res = await fetch("/api/flowchart/convert-image", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengunggah berkas gambar.");
      }

      const imageUrls: string[] = json.imageUrls || (json.imageUrl ? [json.imageUrl] : []);
      const primaryImageUrl: string | null = json.primaryImageUrl || imageUrls[0] || null;

      const updatedPayload: StoredFlowchartPayload = {
        schemaVersion: 2,
        projectId,
        primaryImageUrl,
        imageUrls,
        svgDataUrl: json.svgDataUrl || null,
        xml: json.xml || data?.xml || null,
        updatedAt: new Date().toISOString(),
      };

      // Patch ke database proyek
      const patchRes = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowSequenceJson: JSON.stringify(updatedPayload),
        }),
      });

      if (!patchRes.ok) {
        throw new Error("Gagal menyimpan gambar ke data proyek.");
      }

      // Cache blob pertama ke IndexedDB
      if (selectedFiles[0]) {
        void saveFlowchartBlob(projectId, selectedFiles[0]);
      }

      setData(updatedPayload);
      setImageLoadError(false);
      setUsedFallbackSrc(false);
      setActiveMultiIndex("merged");
      setShowUploadModal(false);
      setSelectedFiles([]);
      onUpdateSuccess?.();
      showToast("Gambar flowchart PNG berhasil disimpan ke proyek!");
    } catch (err) {
      console.error("Gagal simpan gambar flowchart:", err);
      setUploadError(err instanceof Error ? err.message : "Terjadi kesalahan saat mengunggah.");
    } finally {
      setUploading(false);
    }
  };

  // Hapus gambar flowchart dari proyek
  const handleDeleteImage = async () => {
    if (!window.confirm("Hapus gambar flowchart dari proyek ini?")) return;
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowSequenceJson: null }),
      });
      setData(null);
      setImageLoadError(false);
      setUsedFallbackSrc(false);
      setActiveMultiIndex("merged");
      onUpdateSuccess?.();
      showToast("Gambar flowchart berhasil dihapus dari proyek.");
    } catch (err) {
      console.error("Gagal menghapus gambar flowchart:", err);
      alert("Gagal menghapus gambar flowchart.");
    }
  };

  // Unduh gambar PNG / SVG saat ini
  const handleDownloadImage = () => {
    if (!imageDisplaySrc) return;
    const a = document.createElement("a");
    a.href = imageDisplaySrc;
    const ext = imageDisplaySrc.startsWith("data:image/svg") ? "svg" : "png";
    const suffix =
      isMulti && activeMultiIndex !== "merged"
        ? `-Bagian-${Number(activeMultiIndex) + 1}`
        : isMulti
        ? "-Gabungan-Lengkap"
        : "";
    a.download = `Flowchart-${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}${suffix}.${ext}`;
    a.click();
  };

  // Ekspor Data Flowchart Lengkap sebagai JSON
  const handleExportJson = () => {
    if (!data) return;
    const exportData = {
      ...data,
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      projectName,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Backup-Flowchart-${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Berkas cadangan JSON berhasil diunduh!");
  };

  // Impor Data Flowchart dari JSON
  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingJson(true);
    setImportError(null);

    try {
      const text = await file.text();
      if (!text || !text.trim()) {
        throw new Error("Berkas JSON kosong.");
      }

      const normalized = normalizeFlowchartPayload(text, projectId);
      if (!normalized) {
        throw new Error(
          "Struktur berkas JSON tidak sesuai atau rusak. Pastikan berkas adalah hasil ekspor flowchart yang valid."
        );
      }

      // Validasi keberadaan konten visual atau XML
      if (!normalized.primaryImageUrl && !normalized.svgDataUrl && !normalized.xml && normalized.imageUrls.length === 0) {
        throw new Error(
          "Berkas JSON tidak memiliki data gambar atau XML diagram yang dapat ditampilkan."
        );
      }

      // Simpan ke database proyek
      const patchRes = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowSequenceJson: JSON.stringify(normalized),
        }),
      });

      if (!patchRes.ok) {
        throw new Error("Gagal menyimpan data impor ke server proyek.");
      }

      setData(normalized);
      setImageLoadError(false);
      setUsedFallbackSrc(false);
      setShowImportModal(false);
      onUpdateSuccess?.();
      showToast("Data flowchart berhasil dipulihkan dari berkas JSON!");
    } catch (err) {
      console.error("Gagal impor berkas JSON:", err);
      setImportError(err instanceof Error ? err.message : "Gagal memproses berkas JSON.");
    } finally {
      setImportingJson(false);
      if (jsonFileInputRef.current) {
        jsonFileInputRef.current.value = "";
      }
    }
  };

  const hasAnyFlowData = Boolean(data && (primaryCandidate || secondaryCandidate || data.xml));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Toast Notifikasi */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-white to-slate-50">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <FileImage className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-800">
              Flowchart
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wider">
              Dokumentasi Mesin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Menampilkan dokumentasi visual alur operasional mesin resmi untuk proyek ini.
          </p>
        </div>

        {/* Action Buttons Header */}
        <div className="flex flex-wrap items-center gap-2">
          {hasAnyFlowData ? (
            <>
              {/* Buka & Edit di Studio Flowchart */}
              <Link
                href={`/convert-flowchart?projectId=${projectId}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                title="Buka dan edit flowchart ini di Studio Flowchart"
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>Edit di Studio Flowchart</span>
              </Link>

              {/* Tombol Import / Ganti PNG */}
              <button
                type="button"
                onClick={() => {
                  setSelectedFiles([]);
                  setUploadError(null);
                  setShowUploadModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Ganti gambar flowchart PNG"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Ganti Gambar PNG</span>
              </button>

              {/* Unduh Gambar */}
              {imageDisplaySrc && (
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
                  title="Unduh berkas gambar alur"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Unduh Gambar</span>
                </button>
              )}

              {/* Ekspor JSON */}
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Ekspor data cadangan JSON flowchart"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                <span>Ekspor JSON</span>
              </button>

              {/* Impor JSON */}
              <button
                type="button"
                onClick={() => {
                  setImportError(null);
                  setShowImportModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Impor atau pulihkan data flowchart dari JSON"
              >
                <FileUp className="w-3.5 h-3.5 text-slate-500" />
                <span>Impor JSON</span>
              </button>

              {/* Hapus */}
              <button
                type="button"
                onClick={handleDeleteImage}
                className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                title="Hapus gambar flowchart"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href={`/convert-flowchart?projectId=${projectId}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-sm"
                title="Rancang flowchart alur sekuens mesin di Studio Flowchart"
              >
                <Workflow className="w-4 h-4" />
                <span>Buat Flowchart di Studio</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setSelectedFiles([]);
                  setUploadError(null);
                  setShowUploadModal(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Import Gambar PNG</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setImportError(null);
                  setShowImportModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <FileUp className="w-3.5 h-3.5 text-slate-500" />
                <span>Impor Cadangan JSON</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Area Gambar PNG */}
      <div className="p-4 sm:p-5">
        {imageLoadError ? (
          /* Error Fallback Box: Menghindari area blank kosong */
          <div className="rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/50 p-8 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              Gambar Flowchart Tidak Dapat Ditampilkan
            </h4>
            <p className="text-xs text-slate-500 max-w-md">
              Berkas gambar mungkin telah dipindahkan atau format data lama tidak dapat di-decode oleh
              browser. Anda dapat mengunggah ulang gambar atau memulihkan dari berkas cadangan JSON.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setImageLoadError(false);
                  setUsedFallbackSrc(false);
                }}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Coba Muat Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFiles([]);
                  setUploadError(null);
                  setShowUploadModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Unggah Ulang Gambar
              </button>
            </div>
          </div>
        ) : imageDisplaySrc ? (
          <div className="space-y-3">
            {/* Tab Pilihan Tampilan Multi-Gambar */}
            {isMulti && (
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMultiIndex("merged");
                    setImageLoadError(false);
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeMultiIndex === "merged"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Gabungan (1 Kanvas)</span>
                  </span>
                </button>
                {data?.imageUrls?.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveMultiIndex(idx);
                      setImageLoadError(false);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      activeMultiIndex === idx
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Gambar {idx + 1}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Toolbar Zoom & Layar Penuh */}
            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <div className="flex items-center gap-2 font-medium">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Skala Tampilan: {Math.round(zoomLevel * 100)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.4}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-40 cursor-pointer"
                  title="Perkecil (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="px-2 py-0.5 rounded-lg hover:bg-slate-200 text-slate-600 font-bold text-[11px] cursor-pointer"
                  title="Kembalikan ke 100%"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3.0}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-40 cursor-pointer"
                  title="Perbesar (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="h-4 w-[1px] bg-slate-300 mx-1" />
                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                  title="Buka ukuran penuh (Fullscreen Lightbox)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Ukuran Penuh</span>
                </button>
              </div>
            </div>

            {/* Kanvas Pembungkus Gambar */}
            <div className="relative rounded-2xl overflow-auto border border-slate-200 bg-white p-4 sm:p-6 shadow-inner flex items-center justify-center min-h-[460px] max-h-[750px]">
              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease-out",
                }}
                className="max-w-full flex items-center justify-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageDisplaySrc}
                  alt={`Flowchart alur ${projectName}`}
                  onError={handleImageError}
                  className="max-w-full h-auto object-contain rounded-xl shadow-md border border-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>
                Format berkas gambar:{" "}
                <span className="font-semibold text-slate-600">
                  {imageDisplaySrc.startsWith("data:image/svg")
                    ? "Vector SVG Stitched"
                    : "PNG Asli"}
                </span>
              </span>
              {data?.updatedAt && (
                <span>
                  Diperbarui:{" "}
                  {new Date(data.updatedAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Empty State: Belum ada gambar PNG */
          <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-8 sm:p-12 text-center bg-slate-50/50 hover:bg-blue-50/30 transition flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4 text-blue-600">
              <FileImage className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">
              Belum Ada Gambar Flowchart PNG
            </h4>
            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              Unggah gambar alur proses operasional mesin (format PNG/JPG). Anda bisa memilih 1 gambar
              atau beberapa gambar sekaligus untuk digabung berdampingan menjadi 1 kanvas alur resmi.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedFiles([]);
                  setUploadError(null);
                  setShowUploadModal(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import Gambar PNG</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setImportError(null);
                  setShowImportModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <FileUp className="w-4 h-4 text-slate-500" />
                <span>Impor Cadangan JSON</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL FULLSCREEN LIGHTBOX ================= */}
      {isFullscreen && imageDisplaySrc && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col p-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 rounded-2xl border border-slate-800 mb-3 text-white">
            <div className="flex items-center gap-2 text-sm font-bold">
              <FileImage className="w-4 h-4 text-blue-400" />
              <span>Flowchart Alur Mesin — {projectName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadImage}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="Tutup (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDisplaySrc}
              alt="Flowchart ukuran penuh"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl bg-white"
            />
          </div>
        </div>
      )}

      {/* ================= MODAL IMPORT / UPLOAD GAMBAR PNG ================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <Upload className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Import Gambar PNG Flowchart
                  </h4>
                  <p className="text-xs text-slate-500">
                    Unggah 1 atau beberapa gambar PNG alur untuk ditampilkan di proyek
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Isi Modal */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Area Pilih File dengan Reset Input Value */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onClick={(e) => {
                  (e.target as HTMLInputElement).value = "";
                }}
                onChange={(e) => {
                  void handleFilesSelected(e.target.files);
                  e.target.value = "";
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/40 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center"
              >
                <Upload className="w-8 h-8 text-blue-600 mb-2" />
                <div className="text-sm font-bold text-slate-800">
                  Klik untuk Memilih Berkas Gambar PNG
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Mendukung multi-file PNG/JPG (bisa pilih lebih dari 1 gambar)
                </div>
              </div>

              {/* Daftar File Terpilih */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Berkas Terpilih ({selectedFiles.length}):</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:underline cursor-pointer"
                    >
                      + Tambah Gambar Lain
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}_${file.size}_${idx}`}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                      >
                        {filePreviews[idx] ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={filePreviews[idx]}
                            alt={file.name}
                            className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0 bg-white"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-200 shrink-0 flex items-center justify-center">
                            <FileImage className="w-6 h-6 text-slate-400" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 truncate">
                            Bagian {idx + 1}: {file.name}
                          </div>
                          <div className="text-slate-400 text-[11px]">
                            {(file.size / 1024).toFixed(1)} KB
                          </div>
                        </div>

                        {/* Kontrol Urutan */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveFile(idx, "up")}
                            disabled={idx === 0}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                            title="Pindah ke Atas"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveFile(idx, "down")}
                            disabled={idx === selectedFiles.length - 1}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                            title="Pindah ke Bawah"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="p-1 rounded hover:bg-rose-100 text-rose-500 cursor-pointer ml-1"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedFiles.length > 1 && (
                    <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-800 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Kedua/seluruh gambar di atas akan <strong>otomatis digabungkan berdampingan</strong> (1:1 sama persis) menjadi 1 kanvas flowchart utuh.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitUpload}
                disabled={uploading || selectedFiles.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold transition cursor-pointer shadow-sm"
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Mengunggah & Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan & Tampilkan Gambar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL IMPOR CADANGAN JSON ================= */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <FileUp className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Impor Cadangan Flowchart (JSON)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Pulihkan data gambar dan XML dari berkas backup JSON
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {importError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <input
                ref={jsonFileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onClick={(e) => {
                  (e.target as HTMLInputElement).value = "";
                }}
                onChange={(e) => void handleImportJsonFile(e)}
              />

              <div
                onClick={() => jsonFileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center"
              >
                <FileCode className="w-8 h-8 text-indigo-600 mb-2" />
                <div className="text-sm font-bold text-slate-800">
                  Klik untuk Memilih Berkas Backup .json
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Mendukung skema Flowchart Versi 2 & format cadangan sebelumnya
                </div>
              </div>

              {importingJson && (
                <div className="text-center py-2 text-xs text-indigo-600 font-semibold flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span>Sedang memvalidasi dan memulihkan data...</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}