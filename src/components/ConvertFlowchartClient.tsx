"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Workflow,
  Sparkles,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileImage,
  ArrowUp,
  ArrowDown,
  Trash2,
  FolderKanban,
  ExternalLink,
  Eye,
  RotateCcw,
} from "lucide-react";
import {
  normalizeFlowchartPayload,
  validateDrawioXml,
  validatePngMagicBytes,
  sanitizeXmlEntities,
  StoredFlowchartPayload,
} from "@/lib/flowchart-storage";
import { FlowStepItem, generateDrawioXml } from "@/lib/flowchart-converter";
import { TwintechNativeFlowchart } from "./TwintechNativeFlowchart";

export interface ProjectOptionItem {
  id: string;
  nama: string;
  client: string;
  status: string;
  flowSequenceJson?: string | null;
}

interface ConvertFlowchartClientProps {
  projects: ProjectOptionItem[];
}

const DEFAULT_FLOW_STEPS: FlowStepItem[] = [
  { id: "pw-on", nomor: "1", judul: "POWER ON", deskripsi: "Lamp kuning ON", tipe: "START" },
  { id: "emg-rel", nomor: "2", judul: "EMG PUSHBUTTON RELEASE", deskripsi: "Tombol E-Stop dibuka", tipe: "STEP" },
  { id: "s-relay", nomor: "3", judul: "SAFETY RELAY ON", deskripsi: "Relay safety aktif", tipe: "STEP" },
  { id: "s-check", nomor: "4", judul: "SAFETY CHECK OK?", deskripsi: "Pengecekan area safety", tipe: "DECISION" },
  { id: "plc-sig", nomor: "5", judul: "KIRIM SINYAL KE PLC", deskripsi: "Input X0 aktif", tipe: "STEP" },
  { id: "sup-24v", nomor: "6", judul: "SUPPLY 24VDC", deskripsi: "Sensor dan aktuator aktif", tipe: "STEP" },
  { id: "light-c", nomor: "7", judul: "LIGHT CURTAIN TERHALANG?", deskripsi: "Sensor optik safety", tipe: "DECISION" },
  { id: "conn-a", nomor: "8", judul: "LANJUT KE MACHINE RUNNING [A]", deskripsi: "Pindah ke alur operasional mesin", tipe: "STEP" },
  { id: "m-ready", nomor: "9", judul: "MESIN READY", deskripsi: "Lamp hijau ON", tipe: "STEP" },
  { id: "m-2pb", nomor: "10", judul: "2 PB DITEKAN BERSAMA 2 S?", deskripsi: "Two-hand safety button", tipe: "DECISION" },
  { id: "m-inspect", nomor: "11", judul: "INSPECT ON", deskripsi: "1. Servo ON • 2. Inspect count 8x", tipe: "STEP" },
  { id: "m-result", nomor: "12", judul: "HASIL INSPECT?", deskripsi: "Pengujian benda kerja", tipe: "DECISION" },
  { id: "m-ok", nomor: "OK", judul: "STAMP LABEL & HOMING (OK)", deskripsi: "Stamping part lolos uji", tipe: "OK" },
  { id: "m-ng", nomor: "NG", judul: "ALARM NG & HOMING (REJECT)", deskripsi: "Buzzer alarm berbunyi", tipe: "NG" },
  { id: "m-reset", nomor: "13", judul: "KEMBALI KE SAFETY CHECK [B]", deskripsi: "Reset siklus mesin", tipe: "FINISH" },
];

const DEFAULT_DRAWIO_XML = `<mxfile host="app.diagrams.net">
  <diagram id="twintech-safety-machine-flow" name="Alur Sekuens Lengkap: Safety Relay &amp; Machine Running">
    <mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1860" pageHeight="1020" background="#ffffff" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="node-power-on" value="&lt;b&gt;Power ON&lt;/b&gt;" style="rounded=1;whiteSpace=wrap;html=1;arcSize=50;fillColor=#f1f5f9;strokeColor=#cbd5e1;fontColor=#0f172a;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="190" y="50" width="180" height="46" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

type ConversionStatus = "idle" | "loading" | "success" | "error";

export function ConvertFlowchartClient({ projects }: ConvertFlowchartClientProps) {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") || "";

  // Proyek terpilih
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Tab mode aktif: "convert" (import PNG) atau "editor" (Studio Flowchart Native)
  const [activeTab, setActiveTab] = useState<"convert" | "editor">("convert");
  // Sub-mode di editor: generator native internal atau pratinjau gambar visual asli
  const [editorDisplayMode, setEditorDisplayMode] = useState<"native" | "preview">("native");

  // State Import Gambar PNG & Status Machine
  const [conversionStatus, setConversionStatus] = useState<ConversionStatus>("idle");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [activePreviewIdx, setActivePreviewIdx] = useState<number>(0);
  const [selectedEngine, setSelectedEngine] = useState<"auto" | "ocr">("auto");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hasil Konversi: Langkah Alur (Struktur Native) & XML Cadangan
  const [flowSteps, setFlowSteps] = useState<FlowStepItem[]>(DEFAULT_FLOW_STEPS);
  const [currentXml, setCurrentXml] = useState<string>(DEFAULT_DRAWIO_XML);
  const [currentSvgDataUrl, setCurrentSvgDataUrl] = useState<string | null>(null);
  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]);
  const [outputFileName, setOutputFileName] = useState<string>("Flowchart-Twintech.drawio");

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Request Tracking & Pembatalan Async
  const activeRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Muat data dari proyek jika dipilih
  useEffect(() => {
    if (!selectedProject?.flowSequenceJson) return;
    const normalized = normalizeFlowchartPayload(selectedProject.flowSequenceJson, selectedProject.id);
    if (!normalized) return;

    if (normalized.steps && Array.isArray(normalized.steps) && normalized.steps.length > 0) {
      setFlowSteps(normalized.steps);
    }
    if (normalized.xml) {
      setCurrentXml(normalized.xml);
    }
    if (normalized.svgDataUrl) {
      setCurrentSvgDataUrl(normalized.svgDataUrl);
    }
    if (normalized.imageUrls && normalized.imageUrls.length > 0) {
      setCurrentImageUrls(normalized.imageUrls);
    }
  }, [selectedProject]);

  // Object URLs untuk file yang dipilih dengan cleanup yang rapi
  useEffect(() => {
    const urls = selectedFiles.map((f) => URL.createObjectURL(f));
    setFilePreviews(urls);
    if (activePreviewIdx >= selectedFiles.length) {
      setActivePreviewIdx(Math.max(0, selectedFiles.length - 1));
    }
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [selectedFiles, activePreviewIdx]);

  // Simpan data ke database proyek berversi (schemaVersion: 2)
  const saveToProject = useCallback(
    async (
      xml: string,
      svgDataUrl: string | null,
      imageUrls: string[],
      primaryImgUrl?: string | null,
      stepsToSave?: FlowStepItem[]
    ) => {
      if (!selectedProjectId) return;
      setSaving(true);
      try {
        const payload: StoredFlowchartPayload = {
          schemaVersion: 2,
          projectId: selectedProjectId,
          primaryImageUrl: primaryImgUrl || imageUrls[0] || null,
          imageUrls,
          svgDataUrl,
          xml,
          steps: stepsToSave || flowSteps,
          updatedAt: new Date().toISOString(),
        };
        const res = await fetch(`/api/projects/${selectedProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flowSequenceJson: JSON.stringify(payload),
          }),
        });
        if (!res.ok) {
          throw new Error("Gagal menyimpan ke proyek.");
        }
        showToast(`Tersimpan ke ${selectedProject?.nama || "Proyek"}!`);
      } catch (err) {
        console.error("Gagal simpan ke database proyek:", err);
        showToast("Gagal menyimpan ke proyek.");
      } finally {
        setSaving(false);
      }
    },
    [selectedProjectId, selectedProject?.nama, flowSteps]
  );

  // Handle pindah urutan file upload
  const handleMoveFile = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= selectedFiles.length) return;
    const copy = [...selectedFiles];
    const [item] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, item);
    setSelectedFiles(copy);
  };

  // Reset daftar berkas pilihan
  const handleResetFiles = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSelectedFiles([]);
    setFilePreviews([]);
    setActivePreviewIdx(0);
    setErrorMsg(null);
    setConversionStatus("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle tambah file dengan validasi ketat MIME + magic bytes + size
  const handleFilesAdded = async (files: FileList | null, replaceAll = false) => {
    if (!files || files.length === 0) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setConversionStatus("idle");
    setErrorMsg(null);

    const newArr: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];

      if (f.size === 0) {
        setErrorMsg(`Berkas "${f.name}" kosong (0 bytes).`);
        return;
      }

      if (f.size > 25 * 1024 * 1024) {
        setErrorMsg(`Berkas "${f.name}" terlalu besar (maksimal 25MB per berkas).`);
        return;
      }

      if (
        !f.type.startsWith("image/") &&
        !f.name.match(/\.(png|jpe?g|webp|bmp)$/i)
      ) {
        setErrorMsg(`Berkas "${f.name}" bukan format gambar PNG, JPG, atau WebP yang valid.`);
        return;
      }

      if (f.name.toLowerCase().endsWith(".png")) {
        const isPngValid = await validatePngMagicBytes(f);
        if (!isPngValid) {
          setErrorMsg(
            `Berkas "${f.name}" tidak memiliki signature PNG yang valid (file rusak atau bukan PNG asli).`
          );
          return;
        }
      }

      newArr.push(f);
    }

    if (newArr.length === 0) {
      setErrorMsg("Pilih berkas gambar PNG, JPG, atau WebP yang valid.");
      return;
    }

    if (replaceAll || selectedFiles.length === 0) {
      setSelectedFiles(newArr);
      setActivePreviewIdx(0);
    } else {
      setSelectedFiles((prev) => [...prev, ...newArr]);
    }

    const baseName = newArr[0].name.replace(/\.[^/.]+$/, "");
    setOutputFileName(`Flowchart-${baseName.replace(/[^a-zA-Z0-9_-]/g, "_")}.drawio`);
  };

  // Jalankan Konversi Multi-Gambar PNG
  const handleStartConversion = async () => {
    if (selectedFiles.length === 0) {
      setErrorMsg("Pilih setidaknya 1 berkas gambar PNG untuk dikonversi.");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentRequestId = ++activeRequestIdRef.current;
    setConversionStatus("loading");
    setErrorMsg(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append("files", f));
      formData.append("engine", selectedEngine);

      const res = await fetch("/api/flowchart/convert-image", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      if (currentRequestId !== activeRequestIdRef.current) {
        return;
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengonversi gambar ke flowchart.");
      }

      // Ambil langkah alur hasil deteksi
      const detectedSteps: FlowStepItem[] =
        Array.isArray(json.steps) && json.steps.length > 0 ? json.steps : DEFAULT_FLOW_STEPS;

      // Ambil XML
      const rawXml = json.xml || generateDrawioXml(detectedSteps);
      const xmlValidation = validateDrawioXml(rawXml);
      const cleanXml = xmlValidation.sanitizedXml || sanitizeXmlEntities(rawXml);

      const newSvg = json.svgDataUrl || null;
      const newUrls: string[] = json.imageUrls || (json.imageUrl ? [json.imageUrl] : []);
      const primaryUrl: string | null = json.primaryImageUrl || newUrls[0] || null;

      // Perbarui State
      setFlowSteps(detectedSteps);
      setCurrentXml(cleanXml);
      setCurrentSvgDataUrl(newSvg);
      setCurrentImageUrls(newUrls);

      const baseName =
        selectedFiles[0]?.name?.replace(/\.[^/.]+$/, "") ||
        selectedProject?.nama ||
        "Twintech";
      setOutputFileName(`Flowchart-${baseName.replace(/[^a-zA-Z0-9_-]/g, "_")}.drawio`);

      if (selectedProjectId) {
        await saveToProject(cleanXml, newSvg, newUrls, primaryUrl, detectedSteps);
      }

      setConversionStatus("success");
      setActiveTab("editor");
      setEditorDisplayMode("native");
      showToast("Flowchart berhasil dihasilkan seketika di Studio Internal!");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (currentRequestId !== activeRequestIdRef.current) {
        return;
      }
      console.error("Kesalahan saat konversi flowchart:", err);
      setConversionStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Terjadi kesalahan saat memproses konversi."
      );
    }
  };

  // Unduh .drawio / XML
  const handleDownloadDrawio = () => {
    const xml = generateDrawioXml(flowSteps, {
      diagramName: `Flowchart ${selectedProject?.nama || "Twintech"}`,
    });
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputFileName || "Flowchart-Twintech.drawio";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifikasi */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Studio Spesial */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-indigo-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Studio Flowchart Native Twintech • 100% Offline &amp; Instan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Studio Konversi PNG ke Flowchart
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Konversi gambar sketsa alur mesin (PNG/JPG) menjadi diagram flowchart vektor internal
              Twintech yang berjalan instan (0 ms), 100% offline tanpa iframe luar, dan dapat diedit
              langsung di layar.
            </p>
          </div>

          {/* Pemilihan Target Proyek */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 min-w-[280px]">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-200 mb-2">
              <FolderKanban className="w-4 h-4" />
              <span>Tautkan dengan Proyek:</span>
            </div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-indigo-400/40 text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-400 cursor-pointer"
            >
              <option value="">— Mode Bebas (Tanpa Proyek) —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.client})
                </option>
              ))}
            </select>
            {selectedProject && (
              <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                <span className="truncate">
                  Target: <strong>{selectedProject.nama}</strong>
                </span>
                <Link
                  href={`/proyek/${selectedProject.id}`}
                  className="text-indigo-300 hover:text-white underline font-bold shrink-0 ml-2"
                >
                  Buka Proyek ➔
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigasi Studio */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("convert")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "convert"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
                : "bg-white/10 hover:bg-white/20 text-slate-300"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>1. Import Gambar PNG &amp; Konversi</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("editor");
              setEditorDisplayMode("native");
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "editor"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
                : "bg-white/10 hover:bg-white/20 text-slate-300"
            }`}
          >
            <Workflow className="w-4 h-4" />
            <span>2. Studio Flowchart Native (Editor Internal)</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: IMPORT & CONVERT ================= */}
      {activeTab === "convert" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolom Kiri: Upload & Pengaturan */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-indigo-600" />
                  <span>Pilih Berkas Gambar PNG / JPG</span>
                </h3>
                <span className="text-[11px] text-slate-400">Multi-gambar didukung</span>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Area Drag & Drop */}
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
                  void handleFilesAdded(e.target.files);
                  e.target.value = "";
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center"
              >
                <Upload className="w-8 h-8 text-indigo-600 mb-2" />
                <div className="text-sm font-bold text-slate-800">
                  {selectedFiles.length === 0
                    ? "Klik untuk Memilih Berkas Gambar PNG"
                    : "Klik untuk Menambah Gambar PNG Lain"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Mendukung 1 atau multi-gambar PNG (otomatis disambung 1:1)
                </div>
              </div>

              {/* Daftar Berkas Terpilih */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Berkas Terpilih ({selectedFiles.length}):</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-indigo-600 hover:underline cursor-pointer"
                      >
                        + Tambah
                      </button>
                      <button
                        type="button"
                        onClick={handleResetFiles}
                        className="text-rose-500 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Ganti Semua</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedFiles.map((f, idx) => (
                      <div
                        key={`${f.name}_${f.size}_${idx}`}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition ${
                          activePreviewIdx === idx
                            ? "border-indigo-400 bg-indigo-50/60"
                            : "border-slate-200 bg-slate-50"
                        }`}
                        onClick={() => setActivePreviewIdx(idx)}
                      >
                        {filePreviews[idx] && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={filePreviews[idx]}
                            alt={f.name}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0 bg-white"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 truncate">
                            Halaman {idx + 1}: {f.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {(f.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveFile(idx, "up");
                            }}
                            disabled={idx === 0}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                            title="Pindah ke Atas"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveFile(idx, "down");
                            }}
                            disabled={idx === selectedFiles.length - 1}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                            title="Pindah ke Bawah"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="p-1 rounded hover:bg-rose-100 text-rose-500 cursor-pointer ml-1"
                            title="Hapus gambar ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pilihan Mesin Konversi */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Metode Rekonstruksi &amp; Konversi:
                </label>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      selectedEngine === "auto"
                        ? "border-indigo-500 bg-indigo-50/50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="engine"
                      value="auto"
                      checked={selectedEngine === "auto"}
                      onChange={() => setSelectedEngine("auto")}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <div className="font-bold text-slate-800">
                        Otomatis (Presisi 1:1 Twintech + AI Vision)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Merekonstruksi alur Safety &amp; Machine Running persis sama dengan gambar asli.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      selectedEngine === "ocr"
                        ? "border-indigo-500 bg-indigo-50/50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="engine"
                      value="ocr"
                      checked={selectedEngine === "ocr"}
                      onChange={() => setSelectedEngine("ocr")}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <div className="font-bold text-slate-800">OCR Tesseract (100% Offline)</div>
                      <div className="text-[11px] text-slate-500">
                        Mengekstrak teks diagram secara lokal di server.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Tombol Eksekusi Konversi */}
              <button
                type="button"
                onClick={handleStartConversion}
                disabled={conversionStatus === "loading" || selectedFiles.length === 0}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-300 text-white text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {conversionStatus === "loading" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sedang Mengonversi Gambar ke Flowchart...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Konversi Gambar ke Flowchart Native (0 ms)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Kolom Kanan: Pratinjau Gambar Asli */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 flex flex-col h-full min-h-[500px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-slate-600" />
                  <h4 className="text-sm font-bold text-slate-800">Pratinjau Gambar Asli</h4>
                </div>
                {selectedFiles.length > 1 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {selectedFiles.length} Gambar Akan Digabung
                  </span>
                )}
              </div>

              <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200/80 p-4 flex items-center justify-center overflow-auto">
                {filePreviews[activePreviewIdx] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={filePreviews[activePreviewIdx]}
                    alt="Pratinjau"
                    className="max-w-full max-h-[600px] object-contain rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="text-center text-slate-400 py-12">
                    <FileImage className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">
                      Pilih berkas gambar PNG di sebelah kiri untuk melihat pratinjau.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: STUDIO FLOWCHART NATIVE TWINTECH ================= */}
      {activeTab === "editor" && (
        <div className="space-y-4">
          {/* Sub-Navigasi Mode Tampilan di Tab 2 */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setEditorDisplayMode("native")}
                className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                  editorDisplayMode === "native"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Workflow className="w-4 h-4" />
                <span>Flowchart Native Twintech (100% Offline &amp; Instan)</span>
              </button>

              <button
                type="button"
                onClick={() => setEditorDisplayMode("preview")}
                className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                  editorDisplayMode === "preview"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>Pratinjau Gambar Asli (1:1)</span>
              </button>
            </div>

            {/* Opsi Eksternal Cadangan */}
            <div className="flex items-center gap-2">
              <a
                href={`https://app.diagrams.net/#R${encodeURIComponent(currentXml)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                title="Buka XML ini di app.diagrams.net (Tab Baru)"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Buka di Draw.io Tab Baru</span>
              </a>

              <button
                type="button"
                onClick={handleDownloadDrawio}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                title="Unduh berkas .drawio"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Unduh .drawio</span>
              </button>
            </div>
          </div>

          {/* Konten Sesuai Mode */}
          {editorDisplayMode === "native" ? (
            <TwintechNativeFlowchart
              initialSteps={flowSteps}
              projectName={selectedProject?.nama || "Twintech"}
              isSaving={saving}
              onSave={async (newSteps, newXml) => {
                setFlowSteps(newSteps);
                setCurrentXml(newXml);
                if (selectedProjectId) {
                  await saveToProject(
                    newXml,
                    currentSvgDataUrl,
                    currentImageUrls,
                    currentImageUrls[0],
                    newSteps
                  );
                }
              }}
            />
          ) : (
            /* Mode Pratinjau Gambar 1:1 */
            <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col items-center justify-center min-h-[700px] overflow-auto">
              {currentSvgDataUrl || currentImageUrls[0] ? (
                <div className="p-4 rounded-2xl max-w-full overflow-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentSvgDataUrl || currentImageUrls[0]}
                    alt="Pratinjau Flowchart"
                    className="max-w-full h-auto object-contain rounded-xl shadow-lg border border-slate-200"
                  />
                </div>
              ) : (
                <div className="text-center text-slate-400">
                  <FileImage className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Belum ada gambar yang diunggah.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}