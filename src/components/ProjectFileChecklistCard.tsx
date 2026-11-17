"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  ExternalLink,
  FileCode2,
  FileText,
  Layers,
  Monitor,
  RotateCcw,
  Workflow,
} from "lucide-react";
import {
  ChecklistDetectionSummary,
  FileChecklistState,
  ProjectChecklistKey,
  computeChecklistProgress,
  parseFileChecklistJson,
} from "@/lib/project-checklist";

export type { FileChecklistState };

export type ProjectDetailTabKey =
  | "alur-sekuens"
  | "layout-panel"
  | "komponen"
  | "jadwal"
  | "pengelamatan-plc";

interface ProjectFileChecklistCardProps {
  projectId: string;
  initialChecklistJson?: string | null;
  projectData: ChecklistDetectionSummary;
  onNavigateTab: (tab: ProjectDetailTabKey) => void;
  onChecklistChange?: (newState: FileChecklistState) => void;
}

interface ChecklistItemDef {
  key: ProjectChecklistKey;
  nomor: number;
  nama: string;
  icon: typeof ClipboardList;
  kategori: string;
  deskripsi: string;
  tabTarget: ProjectDetailTabKey;
  autoDetected: boolean;
  autoDetail: string;
}

export function ProjectFileChecklistCard({
  projectId,
  initialChecklistJson,
  projectData,
  onNavigateTab,
  onChecklistChange,
}: ProjectFileChecklistCardProps) {
  const [, startTransition] = useTransition();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Parse state checklist manual dari json
  const [checklistState, setChecklistState] = useState<FileChecklistState>(() =>
    parseFileChecklistJson(initialChecklistJson)
  );

  const {
    completedCount,
    totalCount,
    progressPct: progressPercent,
    autoByKey,
  } = computeChecklistProgress(checklistState, projectData);

  // Definisi 7 File/Dokumen Proyek sesuai urutan yang diminta pengguna
  const checklistItems: ChecklistItemDef[] = [
    {
      key: "komponen_pr",
      nomor: 1,
      nama: "Komponen PR",
      icon: ClipboardList,
      kategori: "Purchasing & Bill of Material",
      deskripsi: "Daftar kebutuhan part, sensor, silinder, supplier, & status PR.",
      tabTarget: "komponen",
      autoDetected: autoByKey.komponen_pr,
      autoDetail:
        projectData.componentsCount > 0
          ? `${projectData.componentsCount} item terdaftar (${projectData.prStatus})`
          : "Belum ada komponen PR",
    },
    {
      key: "schedule_pengerjaan",
      nomor: 2,
      nama: "Schedule pengerjaan",
      icon: Calendar,
      kategori: "Timeline & Manpower",
      deskripsi: "Matriks jadwal pekerjaan per hari, PIC pelaksana, & deadline target.",
      tabTarget: "jadwal",
      autoDetected: autoByKey.schedule_pengerjaan,
      autoDetail:
        projectData.scheduleCellsCount > 0
          ? `${projectData.lanesCount} lane aktif (${projectData.scheduleCellsCount} sel terisi)`
          : projectData.lanesCount > 0
          ? `${projectData.lanesCount} lane (jadwal belum diisi)`
          : "Belum ada schedule",
    },
    {
      key: "alamat_io",
      nomor: 3,
      nama: "Alamat IO",
      icon: Cpu,
      kategori: "PLC Hardware Addressing",
      deskripsi: "Tabel pemetaan Digital Input (X), Digital Output (Y), Analog, & Memory PLC.",
      tabTarget: "pengelamatan-plc",
      autoDetected: autoByKey.alamat_io,
      autoDetail: projectData.hasPlcAddresses
        ? `${projectData.plcAddressesCount} alamat I/O terdaftar`
        : "Belum ada data alamat I/O",
    },
    {
      key: "layout_panel_hmi",
      nomor: 4,
      nama: "Layout panel HMI",
      icon: Monitor,
      kategori: "Operator Interface / Front Panel",
      deskripsi: "Tata letak 2D layar touchscreen HMI, tombol PB, switch, buzzer, & E-Stop.",
      tabTarget: "layout-panel",
      autoDetected: autoByKey.layout_panel_hmi,
      autoDetail: projectData.hasPanelHmi
        ? `${projectData.panelHmiCount} komponen HMI/tombol terpasang`
        : "Belum disusun di layout panel",
    },
    {
      key: "layout_panel_utama",
      nomor: 5,
      nama: "Layout Panel Utama",
      icon: Layers,
      kategori: "Electrical Enclosure 2D",
      deskripsi: "Penataan MCB, Power Supply, CPU PLC, Relay, Terminal Block, & Wiring Duct.",
      tabTarget: "layout-panel",
      autoDetected: autoByKey.layout_panel_utama,
      autoDetail: projectData.hasPanelMain
        ? `${projectData.panelMainCount} komponen panel utama terpasang`
        : "Belum disusun di layout panel",
    },
    {
      key: "flowchart",
      nomor: 6,
      nama: "Flowchart",
      icon: Workflow,
      kategori: "Logic Sequence & Algorithm",
      deskripsi: "Diagram alur langkah kerja mesin SPM (Homing, Standby, Testing, OK/NG).",
      tabTarget: "alur-sekuens",
      autoDetected: autoByKey.flowchart,
      autoDetail: projectData.hasFlowchart
        ? "Diagram alur sekuens mesin siap"
        : "Belum ada data flowchart",
    },
    {
      key: "diagram_wiring",
      nomor: 7,
      nama: "Diagram Wiring",
      icon: FileText,
      kategori: "Schematic & Control Circuit",
      deskripsi: "Gambar skema kelistrikan (AutoCAD DWG / PDF), daya utama 3-phase, & kontrol 24VDC.",
      tabTarget: "alur-sekuens",
      autoDetected: autoByKey.diagram_wiring,
      autoDetail: projectData.hasWiringPdf
        ? `Berkas ${projectData.wiringPdfName || "Wiring Diagram"} terunggah`
        : "Belum ada berkas wiring",
    },
    {
      key: "pemprograman",
      nomor: 8,
      nama: "Program PLC & HMI",
      icon: FileCode2,
      kategori: "PLC Software & HMI Screen Design",
      deskripsi: "Cadangan berkas program PLC & file desain layar HMI (Keyence, Panasonic, Fatek, Omron, Mitsubishi, Pro-face, Weintek, Siemens, dll.) siap diunduh.",
      tabTarget: "alur-sekuens",
      autoDetected: autoByKey.pemprograman,
      autoDetail:
        projectData.hasPlcProgram && projectData.hasHmiProgram
          ? `Program PLC & HMI lengkap (${projectData.plcProgramFileName || "PLC"} + ${projectData.hmiProgramFileName || "HMI"})`
          : projectData.hasPlcProgram
          ? `Program PLC tersimpan (${projectData.plcProgramFileName || "PLC"})`
          : projectData.hasHmiProgram
          ? `Program HMI tersimpan (${projectData.hmiProgramFileName || "HMI"})`
          : "Belum ada berkas program PLC / HMI",
    },
  ];

  const isItemComplete = (item: ChecklistItemDef) => {
    const isManuallyChecked = checklistState[item.key]?.checked ?? false;
    return isManuallyChecked || item.autoDetected;
  };

  // Simpan perubahan checklist ke database
  const saveChecklist = async (newState: FileChecklistState) => {
    startTransition(async () => {
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileChecklistJson: JSON.stringify(newState),
          }),
        });
      } catch (err) {
        console.error("Gagal menyimpan ceklis berkas:", err);
      }
    });
  };

  const applyChecklistUpdate = (newState: FileChecklistState) => {
    setChecklistState(newState);
    onChecklistChange?.(newState);
    void saveChecklist(newState);
  };

  const handleToggleCheck = (key: string) => {
    const currentVal = checklistState[key]?.checked ?? false;
    applyChecklistUpdate({
      ...checklistState,
      [key]: {
        checked: !currentVal,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const handleCheckAll = () => {
    const newState: FileChecklistState = {};
    checklistItems.forEach((item) => {
      newState[item.key] = {
        checked: true,
        updatedAt: new Date().toISOString(),
      };
    });
    applyChecklistUpdate(newState);
  };

  const handleResetChecklist = () => {
    if (
      !window.confirm(
        "Reset centang manual ceklis berkas proyek? Status sistem otomatis tetap dipertahankan."
      )
    ) {
      return;
    }
    applyChecklistUpdate({});
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all">
      {/* Top Header Card */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shadow-inner">
            <ClipboardCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                Ceklis File &amp; Dokumen Proyek
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                8 Berkas Standar
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Kontrol kelengkapan 8 berkas inti engineering (Komponen, Jadwal, I/O, Layout HMI, Layout Panel, Flowchart, Wiring DWG/PDF, &amp; Pemprograman PLC).
            </p>
          </div>
        </div>

        {/* Status Counter & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-white/10 backdrop-blur-xs px-3.5 py-1.5 rounded-xl border border-white/10 text-right">
            <div className="text-[11px] font-medium text-slate-300 leading-none">
              Kelengkapan Berkas
            </div>
            <div className="text-sm font-extrabold text-emerald-400 mt-0.5">
              {completedCount} / {totalCount} Selesai ({progressPercent}%)
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition cursor-pointer border border-white/10"
            title={isCollapsed ? "Tampilkan Rincian" : "Sembunyikan Rincian"}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar Line */}
      <div className="h-1.5 w-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            progressPercent === 100
              ? "bg-emerald-500"
              : progressPercent >= 50
              ? "bg-indigo-600"
              : "bg-amber-500"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Body: Daftar 7 File Ceklis */}
      {!isCollapsed && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {checklistItems.map((item) => {
              const ItemIcon = item.icon;
              const isChecked = checklistState[item.key]?.checked ?? false;
              const isReady = isItemComplete(item);

              return (
                <div
                  key={item.key}
                  className={`relative flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
                    isReady
                      ? "bg-emerald-50/40 border-emerald-200 hover:border-emerald-300 shadow-2xs"
                      : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    {/* Header Item: Checkbox + Nomor & Nama */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleCheck(item.key)}
                          className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition cursor-pointer border ${
                            isChecked
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                              : item.autoDetected
                              ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                              : "bg-white border-slate-300 text-transparent hover:border-slate-400"
                          }`}
                          title={
                            isChecked
                              ? "Dicentang manual. Klik untuk membatalkan."
                              : item.autoDetected
                              ? "Terdeteksi otomatis di sistem. Klik untuk mencentang permanen."
                              : "Klik untuk menandai berkas sudah selesai."
                          }
                        >
                          <CheckCircle2
                            className={`w-3.5 h-3.5 ${
                              isChecked || item.autoDetected
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />
                        </button>

                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 block">
                            Berkas #{item.nomor}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1.5 mt-0.5">
                            <span>{item.nama}</span>
                          </h4>
                        </div>
                      </div>

                      <span
                        className={`p-1.5 rounded-lg ${
                          isReady
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        <ItemIcon className="w-4 h-4" />
                      </span>
                    </div>

                    {/* Deskripsi & Kategori */}
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                      {item.deskripsi}
                    </p>
                  </div>

                  {/* Footer Card: Status Otomatis & Tombol Buka Tab */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px] truncate">
                      {item.autoDetected ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1 truncate">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{item.autoDetail}</span>
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium flex items-center gap-1 truncate">
                          <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="truncate">{item.autoDetail}</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateTab(item.tabTarget)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold shadow-2xs transition shrink-0 cursor-pointer"
                      title={`Buka tab ${item.tabTarget}`}
                    >
                      <span>Buka</span>
                      <ExternalLink className="w-2.5 h-2.5 text-slate-600" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Toolbar */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>
                Ceklis hijau otomatis aktif jika data berkas telah diinput di sistem atau dicentang manual.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCheckAll}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
              >
                Centang Semua Selesai
              </button>
              <button
                type="button"
                onClick={handleResetChecklist}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-medium transition cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
