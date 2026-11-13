"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileImage,
  Sparkles,
  CheckCircle2,
  X,
  AlertCircle,
  Plus,
  Trash2,
  Key,
  ArrowUp,
  ArrowDown,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { FlowStepItem, generateDrawioXml } from "@/lib/flowchart-converter";

interface ProjectFlowchartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyConverted: (
    xml: string,
    steps: FlowStepItem[],
    imageUrl?: string,
    svgDataUrl?: string
  ) => void;
  projectId: string;
}

export function ProjectFlowchartImportModal({
  isOpen,
  onClose,
  onApplyConverted,
}: ProjectFlowchartImportModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [activePreviewIdx, setActivePreviewIdx] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [embedBackground, setEmbedBackground] = useState(true);
  const [selectedEngine, setSelectedEngine] = useState<"auto" | "gemini" | "ocr">("auto");

  // Status proses konversi
  const [converting, setConverting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hasil konversi
  const [convertedSteps, setConvertedSteps] = useState<FlowStepItem[] | null>(null);
  const [convertedXml, setConvertedXml] = useState<string | null>(null);
  const [diagramTitle, setDiagramTitle] = useState("Alur Sekuens Mesin SPM");
  const [serverImageUrls, setServerImageUrls] = useState<string[]>([]);
  const [stitchedSvgDataUrl, setStitchedSvgDataUrl] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<"gemini" | "ocr" | "template" | "exact_stitch" | null>(null);
  const [convertedImageCount, setConvertedImageCount] = useState<number>(1);
  const [viewStitchedCombined, setViewStitchedCombined] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Muat API key tersimpan dari localStorage saat modal dibuka
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("twintech_gemini_api_key") || "";
      if (savedKey) {
        setApiKey(savedKey);
        setShowApiKeyInput(true);
      }
    }
  }, []);

  // Update object URLs ketika daftar selectedFiles berubah
  useEffect(() => {
    const urls = selectedFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    if (activePreviewIdx >= selectedFiles.length) {
      setActivePreviewIdx(Math.max(0, selectedFiles.length - 1));
    }
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [selectedFiles]);

  if (!isOpen) return null;

  const handleAddFiles = (newFiles: FileList | File[]) => {
    const validMimes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/bmp",
    ];
    const incoming: File[] = [];
    let err: string | null = null;

    Array.from(newFiles).forEach((file) => {
      if (
        !validMimes.includes(file.type.toLowerCase()) &&
        !file.name.match(/\.(png|jpe?g|webp|bmp)$/i)
      ) {
        err = `Format "${file.name}" tidak didukung. Harap gunakan gambar PNG, JPG, atau WebP.`;
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        err = `Ukuran "${file.name}" terlalu besar (maksimal 25MB per gambar).`;
        return;
      }
      incoming.push(file);
    });

    if (err) setErrorMsg(err);
    else setErrorMsg(null);

    if (incoming.length > 0) {
      setSelectedFiles((prev) => [...prev, ...incoming]);
      // Reset hasil sebelumnya saat tambah gambar baru
      setConvertedSteps(null);
      setConvertedXml(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setConvertedSteps(null);
    setConvertedXml(null);
  };

  const handleMoveFile = (index: number, direction: "UP" | "DOWN") => {
    const targetIdx = direction === "UP" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= selectedFiles.length) return;

    const copy = [...selectedFiles];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    setSelectedFiles(copy);
    setActivePreviewIdx(targetIdx);
  };

  const handleStartConversion = async () => {
    if (selectedFiles.length === 0) {
      setErrorMsg("Pilih setidaknya 1 berkas gambar PNG atau JPG.");
      return;
    }

    setConverting(true);
    setErrorMsg(null);

    if (apiKey.trim()) {
      localStorage.setItem("twintech_gemini_api_key", apiKey.trim());
    }

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });
      if (apiKey.trim()) formData.append("apiKey", apiKey.trim());
      formData.append("embedBackground", embedBackground ? "true" : "false");
      formData.append("engine", selectedEngine);

      const res = await fetch("/api/flowchart/convert-image", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengonversi gambar ke flowchart.");
      }

      setConvertedSteps(json.steps);
      setConvertedXml(json.xml);
      setDiagramTitle(json.title || "Alur Sekuens Mesin SPM");
      setServerImageUrls(json.imageUrls || (json.imageUrl ? [json.imageUrl] : []));
      setStitchedSvgDataUrl(json.svgDataUrl || null);
      setEngineUsed(json.engineUsed);
      setConvertedImageCount(json.imageCount || selectedFiles.length);
      setViewStitchedCombined(true);
      setActivePreviewIdx(0);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memproses konversi gambar."
      );
    } finally {
      setConverting(false);
    }
  };

  const handleUpdateStep = (idx: number, patch: Partial<FlowStepItem>) => {
    if (!convertedSteps) return;
    const updated = [...convertedSteps];
    updated[idx] = { ...updated[idx], ...patch };
    setConvertedSteps(updated);

    const newXml = generateDrawioXml(updated, {
      backgroundImageUrls: embedBackground ? serverImageUrls : undefined,
      diagramName: diagramTitle,
    });
    setConvertedXml(newXml);
  };

  const handleAddStep = () => {
    if (!convertedSteps) return;
    const newStep: FlowStepItem = {
      id: `manual-step-${Date.now().toString(36)}`,
      nomor: String(convertedSteps.length),
      judul: "LANGKAH BARU",
      deskripsi: "Instruksi aktuator & sensor baru.",
      tipe: "STEP",
    };
    const updated = [...convertedSteps];
    const finishIdx = updated.findIndex((s) => s.tipe === "FINISH");
    if (finishIdx !== -1) {
      updated.splice(finishIdx, 0, newStep);
    } else {
      updated.push(newStep);
    }
    setConvertedSteps(updated);

    const newXml = generateDrawioXml(updated, {
      backgroundImageUrls: embedBackground ? serverImageUrls : undefined,
      diagramName: diagramTitle,
    });
    setConvertedXml(newXml);
  };

  const handleDeleteStep = (idx: number) => {
    if (!convertedSteps) return;
    const updated = convertedSteps.filter((_, i) => i !== idx);
    setConvertedSteps(updated);

    const newXml = generateDrawioXml(updated, {
      backgroundImageUrls: embedBackground ? serverImageUrls : undefined,
      diagramName: diagramTitle,
    });
    setConvertedXml(newXml);
  };

  const handleApply = () => {
    if (!convertedSteps || !convertedXml) return;
    onApplyConverted(
      convertedXml,
      convertedSteps,
      serverImageUrls[0] || undefined,
      stitchedSvgDataUrl || undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-600/80 text-white shadow-xs">
              <FileImage className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                <span>Import &amp; Gabung Gambar PNG ke 1 Flowchart</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-500/40 text-indigo-200 border border-indigo-400/30">
                  Multi-Gambar (1 &rarr; N)
                </span>
              </h3>
              <p className="text-xs text-indigo-200">
                Unggah 1, 2, atau beberapa gambar diagram sekuens mesin. Sistem akan menggabungkannya secara runtut menjadi 1 diagram alur Draw.io yang utuh.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isi Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-semibold">{errorMsg}</div>
            </div>
          )}

          {/* JIKA BELUM ADA HASIL KONVERSI: AREA UPLOAD & PENGATURAN */}
          {!convertedSteps ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Kolom Kiri: Multi-Image Upload & List File (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleAddFiles(e.target.files);
                      e.target.value = "";
                    }
                  }}
                />

                {/* Dropzone Box */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center ${
                    selectedFiles.length > 0 ? "min-h-[120px]" : "min-h-[220px]"
                  } ${
                    isDragging
                      ? "border-indigo-600 bg-indigo-50/50"
                      : "border-slate-300 hover:border-indigo-500 hover:bg-slate-50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto shadow-2xs mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="font-extrabold text-xs sm:text-sm text-slate-800">
                    {selectedFiles.length === 0
                      ? "Tarik & lepas gambar PNG di sini (Bisa pilih lebih dari 1 gambar)"
                      : "+ Klik atau tarik untuk menambah gambar berikutnya"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Mendukung PNG, JPG, WebP • Contoh: Gambar 1 (Safety/Power) &amp; Gambar 2 (Auto Running)
                  </div>
                </div>

                {/* Daftar Gambar yang Telah Dipilih (Reorder & Remove) */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Urutan Gambar yang Akan Digabung ({selectedFiles.length} Gambar):</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-indigo-600 hover:text-indigo-800 text-[11px] underline cursor-pointer"
                      >
                        + Tambah Gambar Lain
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {selectedFiles.map((file, idx) => {
                        const thumbUrl = previewUrls[idx];
                        return (
                          <div
                            key={`${file.name}-${idx}`}
                            className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>

                              {thumbUrl && (
                                <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={thumbUrl}
                                    alt={file.name}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="font-extrabold text-xs text-slate-900 truncate">
                                  {file.name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Halaman/Bagian {idx + 1} • {(file.size / 1024).toFixed(0)} KB
                                </div>
                              </div>
                            </div>

                            {/* Tombol Reorder & Delete */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveFile(idx, "UP")}
                                className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                title="Geser ke atas (Dahulukan)"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === selectedFiles.length - 1}
                                onClick={() => handleMoveFile(idx, "DOWN")}
                                className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                title="Geser ke bawah (Jadikan lanjutan)"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(idx)}
                                className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 cursor-pointer ml-1"
                                title="Hapus gambar ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>
                        Seluruh {selectedFiles.length} gambar di atas akan dianalisis secara berkesinambungan dan disatukan menjadi <strong>1 diagram alur Draw.io</strong>.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Kolom Kanan: Pilihan Mesin Konversi & Opsi (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
                  <div className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Mesin Konversi &amp; Penggabungan</span>
                  </div>

                  {/* Mode Pilihan */}
                  <div className="space-y-2">
                    <label
                      onClick={() => setSelectedEngine("auto")}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        selectedEngine === "auto"
                          ? "bg-white border-indigo-500 shadow-xs"
                          : "border-slate-200 hover:bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="engine"
                        checked={selectedEngine === "auto"}
                        onChange={() => setSelectedEngine("auto")}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div>
                        <div className="font-extrabold text-slate-900 flex items-center gap-1">
                          <span>Otomatis (AI Multi-Image + Fallback OCR)</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                            Disarankan
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          AI membaca hubungan logika antar-gambar dan menggabungkannya secara cerdas.
                        </div>
                      </div>
                    </label>

                    <label
                      onClick={() => setSelectedEngine("ocr")}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        selectedEngine === "ocr"
                          ? "bg-white border-indigo-500 shadow-xs"
                          : "border-slate-200 hover:bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="engine"
                        checked={selectedEngine === "ocr"}
                        onChange={() => setSelectedEngine("ocr")}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div>
                        <div className="font-extrabold text-slate-900">
                          OCR Lokal Tesseract (100% Offline)
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          Mengekstrak teks tiap gambar di server lalu menyambungkannya secara berurutan.
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Pengaturan API Key Gemini Opsional */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowApiKeyInput((s) => !s)}
                      className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        {showApiKeyInput
                          ? "Sembunyikan Pengaturan API Key"
                          : "Gunakan Google Gemini API Key (Akurasi Multi-Gambar)"}
                      </span>
                    </button>

                    {showApiKeyInput && (
                      <div className="space-y-1.5 animate-in fade-in duration-150">
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="AIzaSy... (Gemini API Key)"
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="text-[10px] text-slate-500">
                          API Key disimpan di peramban lokal. Gemini akan menganalisis semua gambar sekaligus untuk merangkai 1 alur utuh.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Opsi Sematkan Gambar Asli */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={embedBackground}
                        onChange={(e) => setEmbedBackground(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Sematkan gambar-gambar asli di Draw.io (sebagai layer referensi)</span>
                    </label>
                  </div>
                </div>

                {/* Tombol Mulai Konversi */}
                <button
                  type="button"
                  onClick={handleStartConversion}
                  disabled={selectedFiles.length === 0 || converting}
                  className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {converting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>
                        Menganalisis &amp; Menggabungkan {selectedFiles.length} Gambar...
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-indigo-200" />
                      <span>
                        {selectedFiles.length > 1
                          ? `Gabungkan ${selectedFiles.length} Gambar Menjadi 1 Flowchart`
                          : "Konversi Gambar ke Flowchart Editable"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* JIKA HASIL SUDAH ADA: TAMPILKAN REVIEW GABUNGAN & EDITOR LANGKAH */
            <div className="space-y-4">
              {/* Status Bar Hasil Gabungan */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-extrabold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Berhasil Menggabungkan {convertedImageCount} Gambar Menjadi 1 Flowchart! ({convertedSteps.length} langkah total)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-200/70 text-emerald-800">
                    {engineUsed === "gemini" ? "Google Gemini Multi-Image AI ✨" : "OCR Lokal Tesseract ⚡"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setConvertedSteps(null);
                    setConvertedXml(null);
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 underline font-bold cursor-pointer"
                >
                  &larr; Unggah / Susun Ulang Gambar
                </button>
              </div>

              {/* Tampilan Dua Kolom: Gambar-Gambar Sumber vs 1 Daftar Langkah Gabungan */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Kolom Kiri: Switcher Gambar Asli & Hasil Gabungan (5 cols) */}
                <div className="lg:col-span-5 bg-slate-900 rounded-2xl p-3 border border-slate-800 flex flex-col items-center justify-between max-h-[500px]">
                  <div className="w-full flex items-center justify-between text-[11px] text-slate-400 font-bold mb-2">
                    <span>Pratinjau Visual (Sama Persis):</span>
                    <span className="text-[10px] text-emerald-400 font-bold">1:1 Presisi</span>
                  </div>

                  {/* Tab Switcher: Pilihan Tampilan Gabungan vs Per Gambar */}
                  <div className="w-full flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
                    {stitchedSvgDataUrl && (
                      <button
                        type="button"
                        onClick={() => setViewStitchedCombined(true)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                          viewStitchedCombined
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        <Sparkles className="w-3 h-3 text-emerald-200" />
                        <span>Hasil Gabungan (1 Flowchart)</span>
                      </button>
                    )}

                    {selectedFiles.map((file, idx) => (
                      <button
                        key={`tab-${idx}`}
                        type="button"
                        onClick={() => {
                          setViewStitchedCombined(false);
                          setActivePreviewIdx(idx);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                          !viewStitchedCombined && activePreviewIdx === idx
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        Gambar {idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Area Gambar Aktif / Hasil Gabungan */}
                  <div className="overflow-auto w-full max-h-[400px] flex items-center justify-center flex-1 bg-white rounded-lg p-2 border border-slate-700">
                    {viewStitchedCombined && stitchedSvgDataUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={stitchedSvgDataUrl}
                        alt="Hasil Gabungan Alur Sekuens Mesin"
                        className="max-h-[380px] max-w-full object-contain rounded"
                      />
                    ) : (
                      previewUrls[activePreviewIdx] && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={previewUrls[activePreviewIdx]}
                          alt={`Gambar Bagian ${activePreviewIdx + 1}`}
                          className="max-h-[380px] max-w-full object-contain rounded"
                        />
                      )
                    )}
                  </div>

                  <div className="w-full text-center text-[10px] text-slate-400 mt-2 truncate">
                    {viewStitchedCombined
                      ? "Hasil gabungan kedua gambar alur (100% sama persis dengan aslinya)"
                      : selectedFiles[activePreviewIdx]?.name}
                  </div>
                </div>

                {/* Kolom Kanan: Langkah Sekuens Gabungan yang Dapat Diedit (7 cols) */}
                <div className="lg:col-span-7 bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col max-h-[500px]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Daftar 1 Flowchart Gabungan (Bisa Diedit):</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Alur tersambung otomatis dari Gambar 1 ke gambar berikutnya. Sesuaikan judul dan parameter bila diperlukan.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Langkah</span>
                    </button>
                  </div>

                  <div className="overflow-y-auto space-y-2 pr-1 flex-1">
                    {convertedSteps.map((st, idx) => {
                      const isDecision = st.tipe === "DECISION";
                      const isOk = st.tipe === "OK";
                      const isNg = st.tipe === "NG";
                      const isStart = st.tipe === "START";
                      const isFinish = st.tipe === "FINISH";

                      const badgeColor = isStart
                        ? "bg-blue-100 text-blue-800 border-blue-200"
                        : isDecision
                        ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                        : isOk
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : isNg
                        ? "bg-rose-100 text-rose-800 border-rose-200"
                        : isFinish
                        ? "bg-blue-100 text-blue-900 border-blue-300"
                        : "bg-slate-200 text-slate-800 border-slate-300";

                      return (
                        <div
                          key={st.id}
                          className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <select
                                value={st.tipe}
                                onChange={(e) =>
                                  handleUpdateStep(idx, {
                                    tipe: e.target.value as FlowStepItem["tipe"],
                                  })
                                }
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${badgeColor} cursor-pointer`}
                              >
                                <option value="START">START</option>
                                <option value="STEP">PROSES (STEP)</option>
                                <option value="DECISION">KEPUTUSAN (DIAMOND)</option>
                                <option value="OK">CABANG OK</option>
                                <option value="NG">CABANG NG</option>
                                <option value="FINISH">SELESAI (FINISH)</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteStep(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Hapus langkah ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-1">
                            <input
                              type="text"
                              value={st.judul}
                              onChange={(e) => handleUpdateStep(idx, { judul: e.target.value })}
                              placeholder="Judul langkah..."
                              className="w-full text-xs font-bold text-slate-900 bg-transparent border-b border-dashed border-slate-200 focus:border-indigo-500 focus:outline-none pb-0.5"
                            />
                            <input
                              type="text"
                              value={st.deskripsi}
                              onChange={(e) => handleUpdateStep(idx, { deskripsi: e.target.value })}
                              placeholder="Rincian aksi silinder, sensor, atau perintah..."
                              className="w-full text-[11px] text-slate-600 bg-transparent focus:outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            💡 Diagram hasil gabungan langsung tersimpan di proyek dan dapat diedit visual di <strong>Draw.io</strong> &amp; <strong>Editor Sekuens</strong>.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Tutup
            </button>

            {convertedSteps && (
              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>
                  {convertedImageCount > 1
                    ? `Terapkan 1 Flowchart Gabungan (${convertedSteps.length} Langkah) & Buka Editor \u2192`
                    : "Terapkan ke Flowchart & Buka Editor \u2192"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
