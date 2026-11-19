"use client";

import { useEffect, useState, useTransition } from "react";
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
  Lock,
  Monitor,
  RotateCcw,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import {
  ADMIN_MANUAL_CHECKLIST_KEYS,
  ChecklistDetectionSummary,
  FileChecklistState,
  ProjectChecklistKey,
  computeChecklistProgress,
  isAdminOnlyChecklistKey,
  parseFileChecklistJson,
} from "@/lib/project-checklist";
import type { UserRole } from "@/lib/users";

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
  currentUserRole?: UserRole;
  currentUserName?: string;
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
  isAdminOnly: boolean;
}

export function ProjectFileChecklistCard({
  projectId,
  initialChecklistJson,
  projectData,
  currentUserRole,
  currentUserName,
  onNavigateTab,
  onChecklistChange,
}: ProjectFileChecklistCardProps) {
  const [, startTransition] = useTransition();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(currentUserRole || "MEMBER");
  const [userName, setUserName] = useState<string>(currentUserName || "User");
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserRole) {
      setUserRole(currentUserRole);
      if (currentUserName) setUserName(currentUserName);
      return;
    }
    void fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.user?.role) {
          setUserRole(data.user.role);
          setUserName(data.user.nama || data.user.username);
        }
      })
      .catch(() => {});
  }, [currentUserRole, currentUserName]);

  const isAdmin = userRole === "ADMIN";

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

  // Definisi 8 Berkas Dokumen Proyek
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
      isAdminOnly: true,
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
      isAdminOnly: true,
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
      isAdminOnly: false,
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
      isAdminOnly: true,
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
      isAdminOnly: true,
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
      isAdminOnly: false,
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
      isAdminOnly: false,
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
      isAdminOnly: false,
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

  const handleToggleCheck = (key: ProjectChecklistKey) => {
    if (isAdminOnlyChecklistKey(key) && !isAdmin) {
      setAdminNotice(
        "Berkas Komponen PR, Schedule, dan Layout Panel/HMI khusus diverifikasi manual oleh Admin."
      );
      setTimeout(() => setAdminNotice(null), 4500);
      return;
    }

    const currentVal = checklistState[key]?.checked ?? false;
    applyChecklistUpdate({
      ...checklistState,
      [key]: {
        checked: !currentVal,
        updatedAt: new Date().toISOString(),
        updatedBy: `${userName} (${userRole})`,
      },
    });
  };

  const handleCheckAll = () => {
    const newState: FileChecklistState = { ...checklistState };
    checklistItems.forEach((item) => {
      // Jika bukan Admin, jangan centang berkas yang berstatus khusus Admin
      if (item.isAdminOnly && !isAdmin) {
        return;
      }
      newState[item.key] = {
        checked: true,
        updatedAt: new Date().toISOString(),
        updatedBy: `${userName} (${userRole})`,
      };
    });
    applyChecklistUpdate(newState);
  };

  const handleResetChecklist = () => {
    if (
      !window.confirm(
        isAdmin
          ? "Reset centang manual semua ceklis berkas proyek? Status sistem otomatis non-admin tetap dipertahankan."
          : "Reset centang manual berkas umum yang Anda kelola? Ceklis verifikasi Admin tetap dipertahankan."
      )
    ) {
      return;
    }
    const newState: FileChecklistState = {};
    if (!isAdmin) {
      // Pertahankan item khusus Admin yang sudah dicentang
      ADMIN_MANUAL_CHECKLIST_KEYS.forEach((key) => {
        if (checklistState[key]) {
          newState[key] = checklistState[key];
        }
      });
    }
    applyChecklistUpdate(newState);
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
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                Ceklis File &amp; Dokumen Proyek
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                8 Berkas Standar
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                isAdmin
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                  : "bg-slate-700/60 text-slate-300 border-slate-600/60"
              }`}>
                {isAdmin ? "Admin (Akses Penuh)" : "Member"}
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

      {/* Body: Daftar 8 File Ceklis */}
      {!isCollapsed && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Admin Notice Banner jika member mencoba mencentang berkas admin */}
          {adminNotice && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center justify-between gap-2 shadow-xs transition-all">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold">{adminNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setAdminNotice(null)}
                className="text-amber-700 hover:text-amber-900 text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {checklistItems.map((item) => {
              const ItemIcon = item.icon;
              const isChecked = checklistState[item.key]?.checked ?? false;
              const isReady = isItemComplete(item);
              const canToggle = !item.isAdminOnly || isAdmin;

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
                          className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition border ${
                            !canToggle
                              ? isChecked
                                ? "bg-emerald-600 border-emerald-600 text-white cursor-not-allowed opacity-90 shadow-2xs"
                                : "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed hover:border-amber-400"
                              : isChecked
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs cursor-pointer hover:bg-emerald-700"
                              : item.autoDetected
                              ? "bg-emerald-100 border-emerald-300 text-emerald-700 cursor-pointer hover:bg-emerald-200"
                              : "bg-white border-slate-300 text-transparent hover:border-slate-400 cursor-pointer"
                          }`}
                          title={
                            !canToggle
                              ? "Khusus Admin: Hanya Admin (Faruq) yang berhak memverifikasi berkas ini."
                              : isChecked
                              ? "Dicentang manual. Klik untuk membatalkan."
                              : item.autoDetected
                              ? "Terdeteksi otomatis di sistem. Klik untuk mencentang permanen."
                              : item.isAdminOnly
                              ? "Verifikasi Admin: Klik untuk menandai berkas sudah diverifikasi selesai."
                              : "Klik untuk menandai berkas sudah selesai."
                          }
                        >
                          {!canToggle && !isChecked ? (
                            <Lock className="w-3 h-3 text-slate-400" />
                          ) : (
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                isChecked || item.autoDetected
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                              Berkas #{item.nomor}
                            </span>
                            {item.isAdminOnly && (
                              <span
                                className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-300/80 inline-flex items-center gap-0.5 shadow-2xs"
                                title="Ceklis berkas ini diverifikasi manual khusus oleh Admin"
                              >
                                <ShieldCheck className="w-2.5 h-2.5 text-amber-600" />
                                Khusus Admin
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1.5 mt-0.5">
                            <span>{item.nama}</span>
                          </h4>
                        </div>
                      </div>

                      <span
                        className={`p-1.5 rounded-lg shrink-0 ${
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

                  {/* Footer Card: Status Verifikasi & Tombol Buka Tab */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px] truncate">
                      {item.isAdminOnly ? (
                        isChecked ? (
                          <span
                            className="text-emerald-700 font-semibold flex items-center gap-1 truncate"
                            title={`Diverifikasi oleh Admin. Data: ${item.autoDetail}`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">Terverifikasi Admin ({item.autoDetail})</span>
                          </span>
                        ) : (
                          <span
                            className="text-amber-700 font-medium flex items-center gap-1 truncate"
                            title={`Menunggu verifikasi checklist oleh Admin. Data: ${item.autoDetail}`}
                          >
                            <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">Menunggu verifikasi Admin ({item.autoDetail})</span>
                          </span>
                        )
                      ) : item.autoDetected || isChecked ? (
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
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 border-t border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="text-[11px] sm:text-xs">
                Berkas <strong>Komponen PR</strong>, <strong>Layout HMI</strong>, &amp; <strong>Layout Panel Utama</strong> khusus diverifikasi manual oleh <strong>Admin</strong>. Berkas lainnya otomatis aktif atau dicentang manual.
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  isAdmin
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                {isAdmin ? "Mode: Admin (Akses Penuh)" : "Mode: Member (Akses Terbatas)"}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCheckAll}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                title={
                  isAdmin
                    ? "Centang semua 8 berkas selesai"
                    : "Centang 5 berkas umum selesai (berkas khusus Admin tidak diubah)"
                }
              >
                Centang Semua Selesai
              </button>
              <button
                type="button"
                onClick={handleResetChecklist}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-medium transition cursor-pointer flex items-center gap-1"
                title={
                  isAdmin
                    ? "Reset semua status centang manual"
                    : "Reset status centang manual berkas umum (berkas verifikasi Admin dipertahankan)"
                }
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
