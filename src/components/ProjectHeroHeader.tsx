"use client";

import { useState, useRef } from "react";
import {
  Calendar,
  Camera,
  Edit3,
  GitFork,
  Image as ImageIcon,
  Maximize2,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import {
  PR_STATUS_LABELS,
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  type PrStatus,
  type ProjectPriority,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/constants";
import { formatTanggalId } from "@/lib/date-utils";

export interface ProjectHeroProps {
  project: {
    id: string;
    kode: string | null;
    nama: string;
    client: string;
    komponenInti?: string | null;
    deskripsi: string | null;
    tanggalMulai: string | null;
    deadline: string | null;
    prioritas: ProjectPriority;
    tipeProyek?: string;
    status: ProjectStatus;
    prStatus: PrStatus;
    catatan: string | null;
    warna: string;
    pic?: string | null;
    bolehParalel?: boolean;
    gambarUrl?: string | null;
  };
  onEditClick: () => void;
  onGambarUpdated?: (newUrl: string | null) => void;
}

export function ProjectHeroHeader({
  project,
  onEditClick,
  onGambarUpdated,
}: ProjectHeroProps) {
  const [gambarUrl, setGambarUrl] = useState<string | null>(
    project.gambarUrl ?? null
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Harap pilih berkas gambar (PNG, JPG, JPEG, WEBP)");
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "project-images");

      const resUpload = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!resUpload.ok) {
        const errData = await resUpload.json();
        throw new Error(errData.error || "Gagal mengunggah gambar proyek");
      }

      const uploadResult = await resUpload.json();
      const uploadedUrl = uploadResult.url;

      // Update proyek di database
      const resProject = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gambarUrl: uploadedUrl }),
      });

      if (!resProject.ok) {
        throw new Error("Gagal menyimpan gambar pada proyek");
      }

      setGambarUrl(uploadedUrl);
      onGambarUpdated?.(uploadedUrl);
    } catch (err) {
      console.error("Gagal mengunggah gambar:", err);
      alert(err instanceof Error ? err.message : "Gagal mengunggah gambar");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleDeleteImage() {
    if (!window.confirm("Hapus gambar proyek ini?")) return;
    setUploadingImage(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gambarUrl: null }),
      });
      if (res.ok) {
        setGambarUrl(null);
        onGambarUpdated?.(null);
      }
    } catch (err) {
      console.error("Gagal menghapus gambar:", err);
    } finally {
      setUploadingImage(false);
    }
  }

  const prioBadge =
    project.prioritas === "TINGGI"
      ? "bg-rose-100 text-rose-800 border-rose-200"
      : project.prioritas === "SEDANG"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImageUpload(f);
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 items-stretch">
        {/* Kolom Kiri: Foto / Render Gambar Mesin Proyek (Kompak / Press) */}
        <div className="md:col-span-4 lg:col-span-3 bg-gradient-to-br from-slate-900 to-slate-950 p-3 sm:p-3.5 flex flex-col justify-between relative group">
          {gambarUrl ? (
            <div className="relative w-full h-44 sm:h-48 md:h-full md:min-h-[160px] md:max-h-[210px] rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center p-1.5 border border-slate-800/80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gambarUrl}
                alt={project.nama}
                className="w-full h-full object-contain object-center group-hover:scale-102 transition duration-300 cursor-pointer"
                onClick={() => setIsImageLightboxOpen(true)}
              />
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 p-2">
                <button
                  type="button"
                  onClick={() => setIsImageLightboxOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-900 text-[11px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  Perbesar
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  Ganti
                </button>
                <button
                  type="button"
                  onClick={handleDeleteImage}
                  disabled={uploadingImage}
                  className="p-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-sm cursor-pointer"
                  title="Hapus gambar"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => imageInputRef.current?.click()}
              className="w-full h-44 sm:h-48 md:h-full md:min-h-[160px] md:max-h-[210px] border-2 border-dashed border-slate-700 hover:border-indigo-400 rounded-xl bg-slate-900/80 hover:bg-slate-850 p-4 flex flex-col items-center justify-center text-center transition cursor-pointer group/box"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-indigo-400 flex items-center justify-center mb-2 group-hover/box:scale-110 group-hover/box:bg-indigo-600 group-hover/box:text-white transition">
                <ImageIcon className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-white text-xs">
                Upload Foto Mesin
              </h4>
              <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition shadow-xs">
                <Upload className="w-3 h-3" />
                {uploadingImage ? "Mengunggah..." : "Pilih File"}
              </span>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>Visual Mesin</span>
            {gambarUrl && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="hover:text-indigo-300 font-semibold cursor-pointer underline"
              >
                Ganti
              </button>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Detail Informasi Proyek Lengkap (Padat / Press) */}
        <div className="md:col-span-8 lg:col-span-9 p-4 sm:p-5 flex flex-col justify-between gap-2.5">
          <div>
            {/* Badges Tipe, Status, Prioritas */}
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: project.warna }}
                />
                {project.kode && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-mono font-bold tracking-wider">
                    {project.kode}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                    project.tipeProyek === "IOT"
                      ? "bg-purple-100 text-purple-800"
                      : project.tipeProyek === "AUTOMATION_BESAR"
                        ? "bg-indigo-100 text-indigo-800"
                        : project.tipeProyek === "INTEGRASI_ROBOT"
                          ? "bg-rose-100 text-rose-800 border border-rose-300"
                          : project.tipeProyek === "AFTER_SALES"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-teal-100 text-teal-800"
                  }`}
                >
                  {
                    PROJECT_TYPE_LABELS[
                      (project.tipeProyek as ProjectType) || "AUTOMATION_KECIL"
                    ]
                  }
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${prioBadge}`}
                >
                  {PROJECT_PRIORITY_LABELS[project.prioritas]}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-extrabold border border-blue-200">
                  {PROJECT_STATUS_LABELS[project.status]}
                </span>
                {project.bolehParalel && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                    <GitFork className="w-3 h-3" /> Paralel OK
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={onEditClick}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3 h-3 text-blue-600" />
                Edit Proyek
              </button>
            </div>

            {/* Nama Proyek & Client */}
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
              {project.nama}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-xs font-bold text-slate-600 flex-wrap">
              <span>Client:</span>
              <span className="text-slate-900 font-extrabold bg-slate-100 px-2 py-0.5 rounded-md">
                {project.client}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-500">
                Status PR: {PR_STATUS_LABELS[project.prStatus]}
              </span>
            </div>

            {/* Deskripsi Proyek */}
            {project.deskripsi && (
              <p className="text-xs text-slate-600 mt-2 leading-relaxed bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg font-medium inline-block max-w-full">
                {project.deskripsi}
              </p>
            )}
          </div>

          {/* Metadata Footer: PIC, Tanggal Mulai, Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2.5 mt-1 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-400">PIC Proyek</div>
                <div className="font-extrabold text-slate-800 text-xs truncate">
                  {project.pic || "Belum ditentukan"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-400">Tanggal Mulai</div>
                <div className="font-extrabold text-slate-800 text-xs truncate">
                  {formatTanggalId(project.tanggalMulai, false)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-400">Target Deadline</div>
                <div className="font-extrabold text-rose-700 text-xs truncate">
                  {formatTanggalId(project.deadline, false)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal Gambar Fullscreen */}
      {isImageLightboxOpen && gambarUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xs p-4 cursor-pointer"
          onClick={() => setIsImageLightboxOpen(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gambarUrl}
              alt={project.nama}
              className="w-full h-full max-h-[85vh] object-contain"
            />
            <button
              type="button"
              onClick={() => setIsImageLightboxOpen(false)}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
