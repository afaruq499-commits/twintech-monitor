"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventDropArg } from "@fullcalendar/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Download,
  ExternalLink,
  GitFork,
  Grid,
  Plus,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  SCHEDULE_CELL_LABELS,
  SCHEDULE_CELL_STATUSES,
  SCHEDULE_CUSTOM_COLOR_SWATCHES,
  SCHEDULE_STATUS_RGB,
  WORK_TYPE_LABELS,
  isLightHexColor,
  type ScheduleCellStatus,
  type WorkType,
} from "@/lib/constants";
import {
  formatHariTanggalSingkat,
  formatTanggalId,
  isTanggalMerah,
  toIsoDateStr,
  todayIsoLocal,
} from "@/lib/date-utils";
import {
  ScheduleFeedbackModals,
  type ComponentWarningModalState,
  type ConflictModalState,
} from "./ScheduleFeedbackModals";

interface CalendarCellItem {
  id: string;
  workItemId: string;
  workItemJudul: string;
  workItemPic?: string | null;
  workItemUrutan?: number | null;
  subScopeId?: string | null;
  subScopeJudul?: string | null;
  subScopeUrutan?: number | null;
  taskDetailId?: string | null;
  taskDetailTeks?: string | null;
  taskDetailUrutan?: number | null;
  jenis: WorkType;
  bolehParalel: boolean;
  laneId: string;
  laneNama: string;
  projectId: string;
  projectNama: string;
  projectClient: string;
  projectWarna: string;
  projectParalel?: boolean;
  tanggal: string;
  status: ScheduleCellStatus;
  warnaCustom?: string | null;
  catatan: string | null;
}

interface CalendarGroupedEvent {
  id: string;
  tanggal: string;
  ptName: string;
  projectId: string;
  projectClient: string;
  projectNama: string;
  projectWarna: string;
  repStatus: ScheduleCellStatus;
  cells: CalendarCellItem[];
}

interface WorkItemPickerOption {
  id: string;
  judul: string;
  pic?: string | null;
  jenis: WorkType;
  laneId: string;
  laneNama: string;
  projectId: string;
  projectNama: string;
  projectClient: string;
}

interface LaneDirectoryItem {
  id: string;
  nama: string;
  tanggalMulai: string;
  jumlahHari: number;
  workItemsCount: number;
  projectId: string;
  projectNama: string;
  projectClient: string;
  projectWarna: string;
  projectParalel?: boolean;
  pic?: string | null;
}

export function ScheduleCalendarClient({
  cells,
  workItemOptions,
  lanes,
  proposedDelays,
}: {
  cells: CalendarCellItem[];
  workItemOptions: WorkItemPickerOption[];
  lanes: LaneDirectoryItem[];
  proposedDelays: {
    id: string;
    workItemJudul: string;
    projectNama: string;
    laneNama: string;
    laneId: string;
    tanggal: string;
    status: ScheduleCellStatus;
  }[];
}) {
  const router = useRouter();
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [includeExportDates, setIncludeExportDates] = useState(false);
  const [busy, setBusy] = useState(false);

  const [conflictModal, setConflictModal] =
    useState<ConflictModalState | null>(null);
  const [warningModal, setWarningModal] =
    useState<ComponentWarningModalState | null>(null);

  // Modal Tambah Jadwal pada Tanggal
  const [addModal, setAddModal] = useState<{
    tanggal: string;
    workItemId: string;
    status: ScheduleCellStatus;
    catatan: string;
  } | null>(null);

  // Modal Detail / Edit Event (Grouped per PT)
  const [selectedGroup, setSelectedGroup] =
    useState<CalendarGroupedEvent | null>(null);
  const [activeCellInGroup, setActiveCellInGroup] =
    useState<CalendarCellItem | null>(null);

  const distinctProjects = Array.from(
    new Map(
      lanes.map((l) => [
        l.projectId,
        { id: l.projectId, nama: l.projectNama, warna: l.projectWarna },
      ])
    ).values()
  );

  const visibleCells = cells.filter(
    (c) => projectFilter === "ALL" || c.projectId === projectFilter
  );

  // Mengelompokkan per tanggal dan per nama PT / Proyek
  // Sehingga 1 tanggal hanya menampilkan 1 entri per nama PT,
  // dan jika ada PT lain yang berbeda pada tanggal tersebut, PT lain tersebut tetap disertakan.
  const calendarEvents = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        tanggal: string;
        ptName: string;
        projectId: string;
        projectClient: string;
        projectNama: string;
        projectWarna: string;
        cells: CalendarCellItem[];
      }
    >();

    for (const c of visibleCells) {
      const ptName = (c.projectClient || c.projectNama || "Proyek").trim();
      const key = `${c.tanggal}___${ptName.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          tanggal: c.tanggal,
          ptName,
          projectId: c.projectId,
          projectClient: c.projectClient,
          projectNama: c.projectNama,
          projectWarna: c.projectWarna,
          cells: [c],
        });
      } else {
        map.get(key)!.cells.push(c);
      }
    }

    return Array.from(map.values()).map((grp) => {
      // Urutkan agenda di dalam grup berdasarkan urutan pekerjaan, sub-scope, dan task detail (point a, b, c)
      grp.cells.sort((a, b) => {
        if ((a.workItemUrutan ?? 0) !== (b.workItemUrutan ?? 0)) {
          return (a.workItemUrutan ?? 0) - (b.workItemUrutan ?? 0);
        }
        if ((a.subScopeUrutan ?? 0) !== (b.subScopeUrutan ?? 0)) {
          return (a.subScopeUrutan ?? 0) - (b.subScopeUrutan ?? 0);
        }
        if ((a.taskDetailUrutan ?? 0) !== (b.taskDetailUrutan ?? 0)) {
          return (a.taskDetailUrutan ?? 0) - (b.taskDetailUrutan ?? 0);
        }
        return a.id.localeCompare(b.id);
      });

      // Prioritas penentuan status badge: DELAY > ON_PROGRESS > DONE > TARGET
      const statuses = grp.cells.map((c) => c.status);
      let repStatus: ScheduleCellStatus = "TARGET";
      if (statuses.includes("DELAY")) repStatus = "DELAY";
      else if (statuses.includes("ON_PROGRESS")) repStatus = "ON_PROGRESS";
      else if (statuses.length > 0 && statuses.every((s) => s === "DONE"))
        repStatus = "DONE";
      else if (statuses.includes("TARGET")) repStatus = "TARGET";
      else repStatus = statuses[0] || "TARGET";

      const color =
        grp.cells.find((c) => c.warnaCustom)?.warnaCustom || grp.projectWarna;
      const textColor = isLightHexColor(color) ? "#0f172a" : "#ffffff";

      const groupData: CalendarGroupedEvent = {
        ...grp,
        repStatus,
      };

      return {
        id: grp.id,
        title: `[${SCHEDULE_CELL_LABELS[repStatus]}] ${grp.ptName}`,
        start: grp.tanggal,
        allDay: true,
        backgroundColor: color,
        borderColor: color,
        textColor,
        extendedProps: groupData,
      };
    });
  }, [visibleCells]);

  async function submitScheduleMutation(params: {
    workItemId: string;
    subScopeId?: string | null;
    taskDetailId?: string | null;
    tanggal: string;
    status: ScheduleCellStatus;
    warnaCustom?: string | null;
    catatan?: string | null;
    moveFromTanggal?: string | null;
    acknowledgeComponentWarning?: boolean;
    allowParallelOverride?: boolean;
    onRevert?: () => void;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workItemId: params.workItemId,
          subScopeId: params.subScopeId ?? null,
          taskDetailId: params.taskDetailId ?? null,
          tanggal: params.tanggal,
          status: params.status,
          ...(params.warnaCustom !== undefined
            ? { warnaCustom: params.warnaCustom }
            : {}),
          catatan: params.catatan,
          moveFromTanggal: params.moveFromTanggal ?? null,
          acknowledgeComponentWarning:
            params.acknowledgeComponentWarning ?? false,
          allowParallelOverride: params.allowParallelOverride ?? false,
        }),
      });
      const data = await res.json();

      if (res.status === 409 && data.blocked) {
        params.onRevert?.();
        setAddModal(null);
        setSelectedGroup(null);
        setActiveCellInGroup(null);
        setConflictModal({
          message: data.error,
          suggestions: data.conflict?.suggestions ?? [],
          onPickSuggestion: (suggestedDate) => {
            setConflictModal(null);
            void submitScheduleMutation({
              ...params,
              tanggal: suggestedDate,
              onRevert: undefined,
            });
          },
          onForceParallel: () => {
            setConflictModal(null);
            void submitScheduleMutation({
              ...params,
              allowParallelOverride: true,
              onRevert: undefined,
            });
          },
        });
        return false;
      }

      if (data.requiresWarningConfirm && data.warning) {
        params.onRevert?.();
        setAddModal(null);
        setSelectedGroup(null);
        setActiveCellInGroup(null);
        setWarningModal({
          message: data.warning.message,
          scope: data.warning.scope,
          missingComponents: data.warning.missingComponents,
          onConfirmSave: () => {
            setWarningModal(null);
            void submitScheduleMutation({
              ...params,
              acknowledgeComponentWarning: true,
              onRevert: undefined,
            });
          },
        });
        return false;
      }

      if (res.ok) {
        setAddModal(null);
        setSelectedGroup(null);
        setActiveCellInGroup(null);
        router.refresh();
        return true;
      }

      alert(data.error || "Gagal menyimpan jadwal.");
      params.onRevert?.();
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleEventDrop(info: EventDropArg) {
    const grp = info.event.extendedProps as CalendarGroupedEvent;
    const newDateIso = toIsoDateStr(info.event.start);
    if (!newDateIso || newDateIso === grp.tanggal) return;

    if (grp.cells.length > 1) {
      const confirmMove = window.confirm(
        `Pindahkan seluruh agenda (${grp.cells.length} pekerjaan) untuk ${grp.ptName} dari ${formatTanggalId(grp.tanggal)} ke ${formatTanggalId(newDateIso)}?`
      );
      if (!confirmMove) {
        info.revert();
        return;
      }
    }

    setBusy(true);
    try {
      for (const cell of grp.cells) {
        await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workItemId: cell.workItemId,
            subScopeId: cell.subScopeId ?? null,
            taskDetailId: cell.taskDetailId ?? null,
            tanggal: newDateIso,
            moveFromTanggal: grp.tanggal,
            status: cell.status,
            warnaCustom: cell.warnaCustom ?? null,
            catatan: cell.catatan,
            acknowledgeComponentWarning: true,
            allowParallelOverride: true,
          }),
        });
      }
      router.refresh();
    } catch {
      info.revert();
      alert("Gagal memindahkan jadwal.");
    } finally {
      setBusy(false);
    }
  }

  function handleEventClick(arg: EventClickArg) {
    const grp = arg.event.extendedProps as CalendarGroupedEvent;
    setSelectedGroup(grp);
    if (grp.cells.length === 1) {
      setActiveCellInGroup({ ...grp.cells[0] });
    } else {
      setActiveCellInGroup(null);
    }
  }

  async function handleConfirmDelay(
    cellId: string,
    action: "CONFIRM_DELAY" | "DISMISS"
  ) {
    setBusy(true);
    try {
      await fetch("/api/schedule/delay-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cellId, action }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Aksi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Jadwal & Kalender Lintas Proyek
          </h1>
          <p className="text-sm text-slate-600">
            Seret agenda (drag & drop) untuk memindahkan tanggal — aturan
            bentrok 1 pekerjaan utama/hari divalidasi otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/jadwal/buat"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
          >
            <CalendarPlus className="w-4 h-4" /> Buat Schedule Proyek
          </Link>

          <Link
            href="/import-schedule"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 border border-teal-300 hover:bg-teal-100 text-teal-800 text-xs font-bold"
          >
            <Upload className="w-4 h-4 text-teal-600" /> Import Schedule
          </Link>

          <button
            type="button"
            disabled={workItemOptions.length === 0}
            onClick={() =>
              setAddModal({
                tanggal: new Date().toISOString().slice(0, 10),
                workItemId: workItemOptions[0]?.id ?? "",
                status: "TARGET",
                catatan: "",
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Jadwalkan Pekerjaan
          </button>

          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={includeExportDates}
              onChange={(e) => setIncludeExportDates(e.target.checked)}
            />
            Tanggal di Excel
          </label>

          <a
            href={`/api/export/jadwal${
              includeExportDates ? "?includeDates=1" : ""
            }`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
          >
            <Download className="w-4 h-4" /> Export Semua Lane
          </a>
        </div>
      </div>

      {/* Usulan Status DELAY Otomatis */}
      {proposedDelays.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-rose-900 font-extrabold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>
              Usulan Status DELAY Otomatis ({proposedDelays.length} jadwal lewat
              tanggal masih TARGET / ON PROGRES)
            </span>
          </div>
          <div className="space-y-2">
            {proposedDelays.map((pd) => (
              <div
                key={pd.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-xl border border-rose-200 p-3 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">
                    {pd.workItemJudul}
                  </span>{" "}
                  <span className="text-slate-600">
                    • {pd.projectNama} ({pd.laneNama}) • Tanggal:{" "}
                    <strong>{formatTanggalId(pd.tanggal)}</strong> (masih{" "}
                    {SCHEDULE_CELL_LABELS[pd.status]})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleConfirmDelay(pd.id, "CONFIRM_DELAY")}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                  >
                    Konfirmasi DELAY
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleConfirmDelay(pd.id, "DISMISS")}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                  >
                    Abaikan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Warna Proyek */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setProjectFilter("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
            projectFilter === "ALL"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          Semua Proyek
        </button>
        {distinctProjects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProjectFilter(p.id)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
              projectFilter === p.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: p.warna }}
            />
            {p.nama}
          </button>
        ))}
      </div>

      {/* FullCalendar Bulanan / Mingguan / Harian */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        {/* Bar Info Hari Ini & Legenda Tanggal Merah */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 text-white font-extrabold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>HARI INI:</span>
              <span className="text-blue-100 font-black">
                {formatHariTanggalSingkat(todayIsoLocal())}
              </span>
            </div>
            <span className="text-slate-600 font-semibold hidden sm:inline">
              ({formatTanggalId(todayIsoLocal(), true)})
            </span>
          </div>

          {/* Legenda Warna */}
          <div className="flex items-center gap-3.5 flex-wrap font-bold text-slate-700">
            <span className="text-slate-400 font-medium text-[11px]">Keterangan:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-blue-100 border-2 border-blue-600 inline-block shadow-2xs" />
              <span className="text-blue-900">Hari Ini</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-rose-100 border border-rose-400 inline-block shadow-2xs" />
              <span className="text-rose-700">Sabtu & Minggu / Tgl Merah</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-white border border-slate-300 inline-block shadow-2xs" />
              <span className="text-slate-600">Hari Kerja (Sen - Jum)</span>
            </span>
          </div>
        </div>

        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="id"
          firstDay={1}
          editable={true}
          selectable={true}
          height="auto"
          dayCellClassNames={(arg) => {
            const tglMerah = isTanggalMerah(arg.date);
            const classes: string[] = [];
            if (tglMerah.isRed) {
              classes.push("cal-tanggal-merah");
            }
            if (arg.isToday) {
              classes.push("cal-hari-ini");
            }
            return classes;
          }}
          dayHeaderClassNames={(arg) => {
            const day = arg.date.getDay();
            const classes: string[] = [];
            if (day === 0 || day === 6) {
              classes.push("cal-header-weekend");
            }
            if (arg.isToday) {
              classes.push("cal-header-today");
            }
            return classes;
          }}
          dayHeaderContent={(arg) => {
            const day = arg.date.getDay();
            const isWeekend = day === 0 || day === 6;
            const isToday = arg.isToday;
            return (
              <div className="py-1 flex flex-col items-center justify-center">
                <span
                  className={`text-xs uppercase tracking-wider font-black ${
                    isToday
                      ? "text-blue-700"
                      : isWeekend
                        ? "text-rose-600"
                        : "text-slate-700"
                  }`}
                >
                  {arg.text}
                </span>
                {isToday && (
                  <span className="mt-0.5 text-[9px] font-black px-1.5 py-0.2 rounded bg-blue-600 text-white shadow-xs">
                    Hari Ini
                  </span>
                )}
                {isWeekend && !isToday && (
                  <span className="text-[9px] font-extrabold text-rose-500">
                    Libur
                  </span>
                )}
              </div>
            );
          }}
          dayCellContent={(arg) => {
            const tglMerah = isTanggalMerah(arg.date);
            return (
              <div className="flex items-center justify-between w-full px-1.5 pt-1">
                <div className="flex items-center gap-1">
                  {arg.isToday ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white font-black text-xs shadow-sm ring-2 ring-blue-300"
                      title="Hari Ini"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                      <span className="text-[10px] tracking-tight uppercase font-black">
                        HARI INI
                      </span>
                      <span>•</span>
                      <span>{arg.dayNumberText}</span>
                    </span>
                  ) : (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-black ${
                        tglMerah.isRed
                          ? "text-rose-600 bg-rose-100/70"
                          : "text-slate-800"
                      }`}
                    >
                      {arg.dayNumberText}
                    </span>
                  )}
                </div>

                {tglMerah.isRed && tglMerah.keterangan && tglMerah.isHoliday && (
                  <span
                    title={tglMerah.keterangan}
                    className="text-[10px] font-bold text-rose-700 bg-rose-100/90 border border-rose-300/60 px-1.5 py-0.5 rounded truncate max-w-[110px]"
                  >
                    {tglMerah.keterangan}
                  </span>
                )}
              </div>
            );
          }}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek,dayGridDay",
          }}
          buttonText={{
            today: "Hari Ini",
            month: "Bulanan",
            week: "Mingguan",
            day: "Harian",
          }}
          events={calendarEvents}
          eventDrop={handleEventDrop}
          eventClick={handleEventClick}
          eventDidMount={(info) => {
            const grp = info.event.extendedProps as CalendarGroupedEvent;
            if (!grp) return;
            const count = grp.cells.length;
            const summary = grp.cells
              .map((c) => c.workItemJudul)
              .slice(0, 3)
              .join(", ");
            const more = count > 3 ? ` ...dan ${count - 3} lainnya` : "";
            info.el.setAttribute(
              "title",
              `${grp.ptName} (${count} agenda): ${summary}${more} (Klik untuk rincian)`
            );
          }}
          dateClick={(arg) => {
            if (workItemOptions.length === 0) return;
            setAddModal({
              tanggal: arg.dateStr.slice(0, 10),
              workItemId: workItemOptions[0].id,
              status: "TARGET",
              catatan: "",
            });
          }}
        />
      </div>

      {/* Direktori Cepat Editor Grid per Lane */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h2 className="font-bold text-slate-900 mb-3">
          Buka Editor Grid Hierarkis (Format Sheet Client | Lane)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lanes.map((l) => (
            <div
              key={l.id}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 transition flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: l.projectWarna }}
                  />
                  <span className="text-xs font-extrabold text-slate-900 truncate">
                    {l.projectClient} | {l.nama}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {l.projectNama} • {l.jumlahHari} hari ({l.workItemsCount}{" "}
                  pekerjaan)
                </div>
              </div>
              <Link
                href={`/jadwal/lane/${l.id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold shrink-0"
              >
                <Grid className="w-3.5 h-3.5" /> Grid
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Konflik & Warning Komponen */}
      <ScheduleFeedbackModals
        conflict={conflictModal}
        onCloseConflict={() => setConflictModal(null)}
        warning={warningModal}
        onCloseWarning={() => setWarningModal(null)}
        busy={busy}
      />

      {/* Modal Jadwalkan Pekerjaan pada Tanggal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h2 className="font-bold text-sm">
                Jadwalkan Pekerjaan — {formatTanggalId(addModal.tanggal)}
              </h2>
              <button
                type="button"
                onClick={() => setAddModal(null)}
                className="p-1 rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitScheduleMutation({
                  workItemId: addModal.workItemId,
                  tanggal: addModal.tanggal,
                  status: addModal.status,
                  catatan: addModal.catatan,
                });
              }}
              className="p-5 space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold mb-1">Tanggal *</label>
                <input
                  type="date"
                  required
                  value={addModal.tanggal}
                  onChange={(e) =>
                    setAddModal({ ...addModal, tanggal: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">
                  Pilih Pekerjaan (Proyek • Lane) *
                </label>
                <select
                  value={addModal.workItemId}
                  onChange={(e) =>
                    setAddModal({ ...addModal, workItemId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  {workItemOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      [{w.projectClient} | {w.laneNama}] {w.judul} (
                      {WORK_TYPE_LABELS[w.jenis]})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Status</label>
                <select
                  value={addModal.status}
                  onChange={(e) =>
                    setAddModal({
                      ...addModal,
                      status: e.target.value as ScheduleCellStatus,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                >
                  {SCHEDULE_CELL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {SCHEDULE_CELL_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={addModal.catatan}
                  onChange={(e) =>
                    setAddModal({ ...addModal, catatan: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold cursor-pointer"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Klik Event Kalender (Grouped per PT) */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="min-w-0 pr-2">
                <div className="font-bold text-sm truncate">
                  {activeCellInGroup
                    ? `Edit Agenda — ${activeCellInGroup.projectClient}`
                    : `Agenda Proyek — ${selectedGroup.ptName}`}
                </div>
                <div className="text-[11px] text-slate-300 font-medium">
                  {formatTanggalId(selectedGroup.tanggal)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroup(null);
                  setActiveCellInGroup(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Jika sedang memilih 1 task spesifik untuk diedit */}
            {activeCellInGroup ? (
              <div className="p-5 space-y-3.5 text-xs">
                {selectedGroup.cells.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setActiveCellInGroup(null)}
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-bold mb-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Agenda ({selectedGroup.cells.length})
                  </button>
                )}

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-slate-500 font-semibold flex flex-wrap items-center gap-1.5">
                    <span>
                      {activeCellInGroup.projectClient} &bull; {activeCellInGroup.projectNama} (
                      {activeCellInGroup.laneNama})
                    </span>
                    {activeCellInGroup.bolehParalel && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                        <GitFork className="w-3 h-3" /> Paralel
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 mt-1 leading-snug whitespace-pre-line">
                    {activeCellInGroup.taskDetailTeks?.trim() ||
                      activeCellInGroup.subScopeJudul ||
                      activeCellInGroup.workItemJudul}
                  </div>
                  {activeCellInGroup.taskDetailTeks && (
                    <div className="text-[11px] text-slate-500 mt-1 font-medium">
                      Pekerjaan:{" "}
                      <span className="font-bold text-slate-700">
                        {activeCellInGroup.workItemJudul}
                      </span>
                      {activeCellInGroup.subScopeJudul && (
                        <span> &bull; {activeCellInGroup.subScopeJudul}</span>
                      )}
                    </div>
                  )}
                  {activeCellInGroup.workItemPic && (
                    <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 mt-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>PIC: {activeCellInGroup.workItemPic}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold mb-1.5 text-slate-800">
                    Ubah Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SCHEDULE_CELL_STATUSES.map((st) => {
                      const hex = `#${SCHEDULE_STATUS_RGB[st]}`;
                      const dark = st === "ON_PROGRESS" || st === "DELAY";
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() =>
                            setActiveCellInGroup({
                              ...activeCellInGroup,
                              status: st,
                            })
                          }
                          className={`py-2 px-3 rounded-xl font-extrabold cursor-pointer transition ${
                            activeCellInGroup.status === st
                              ? "ring-2 ring-offset-1 ring-slate-900 scale-[1.02]"
                              : "opacity-80 hover:opacity-100"
                          }`}
                          style={{
                            backgroundColor: hex,
                            color: dark ? "#0f172a" : "#ffffff",
                          }}
                        >
                          {SCHEDULE_CELL_LABELS[st]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800">
                    Warna Kolom / Event (Opsional)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {SCHEDULE_CUSTOM_COLOR_SWATCHES.slice(0, 7).map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        title={sw.label}
                        onClick={() =>
                          setActiveCellInGroup({
                            ...activeCellInGroup,
                            warnaCustom: sw.hex,
                          })
                        }
                        className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                          activeCellInGroup.warnaCustom?.toLowerCase() ===
                          sw.hex.toLowerCase()
                            ? "border-slate-950 scale-110"
                            : "border-slate-200"
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      />
                    ))}
                    <input
                      type="color"
                      value={
                        activeCellInGroup.warnaCustom ||
                        activeCellInGroup.projectWarna
                      }
                      onChange={(e) =>
                        setActiveCellInGroup({
                          ...activeCellInGroup,
                          warnaCustom: e.target.value,
                        })
                      }
                      className="w-6 h-6 border-0 bg-transparent cursor-pointer"
                    />
                    {activeCellInGroup.warnaCustom && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveCellInGroup({
                            ...activeCellInGroup,
                            warnaCustom: null,
                          })
                        }
                        className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Reset Warna
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800">
                    Komentar / Catatan
                  </label>
                  <textarea
                    rows={2}
                    value={activeCellInGroup.catatan ?? ""}
                    onChange={(e) =>
                      setActiveCellInGroup({
                        ...activeCellInGroup,
                        catatan: e.target.value,
                      })
                    }
                    placeholder="Tulis catatan harian untuk agenda ini..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const label =
                          activeCellInGroup.taskDetailTeks?.trim() ||
                          activeCellInGroup.workItemJudul;
                        if (
                          !window.confirm(
                            `Hapus agenda "${label}" pada tanggal ini?`
                          )
                        )
                          return;
                        await fetch(
                          `/api/schedule?cellId=${activeCellInGroup.id}`,
                          { method: "DELETE" }
                        );
                        setSelectedGroup(null);
                        setActiveCellInGroup(null);
                        router.refresh();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                    <Link
                      href={`/jadwal/lane/${activeCellInGroup.laneId}`}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Buka Grid
                    </Link>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void submitScheduleMutation({
                        workItemId: activeCellInGroup.workItemId,
                        subScopeId: activeCellInGroup.subScopeId,
                        taskDetailId: activeCellInGroup.taskDetailId,
                        tanggal: activeCellInGroup.tanggal,
                        status: activeCellInGroup.status,
                        warnaCustom: activeCellInGroup.warnaCustom ?? null,
                        catatan: activeCellInGroup.catatan,
                        acknowledgeComponentWarning: true,
                        allowParallelOverride: true,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            ) : (
              /* Tampilan Daftar Seluruh Pekerjaan pada PT ini di Tanggal Terpilih */
              <div className="p-5 space-y-3.5 text-xs">
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5 text-blue-950">
                  <div>
                    <div className="font-extrabold text-sm">
                      {selectedGroup.projectNama}
                    </div>
                    <div className="text-[11px] text-blue-700 mt-0.5">
                      Terdapat {selectedGroup.cells.length} agenda pekerjaan terjadwal hari ini
                    </div>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-lg text-xs font-black shadow-xs shrink-0"
                    style={{
                      backgroundColor:
                        selectedGroup.cells.find((c) => c.warnaCustom)
                          ?.warnaCustom || selectedGroup.projectWarna,
                      color: isLightHexColor(
                        selectedGroup.cells.find((c) => c.warnaCustom)
                          ?.warnaCustom || selectedGroup.projectWarna
                      )
                        ? "#0f172a"
                        : "#ffffff",
                    }}
                  >
                    {SCHEDULE_CELL_LABELS[selectedGroup.repStatus]}
                  </span>
                </div>

                <div className="max-h-[50vh] overflow-y-auto space-y-2.5 pr-1">
                  {selectedGroup.cells.map((c, idx) => (
                    <div
                      key={c.id || idx}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-400 transition space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-slate-500">
                            {c.laneNama}
                          </div>
                          <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5 leading-snug whitespace-pre-line">
                            {c.taskDetailTeks?.trim() ||
                              c.subScopeJudul ||
                              c.workItemJudul}
                          </div>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-black shrink-0"
                          style={{
                            backgroundColor:
                              c.warnaCustom || `#${SCHEDULE_STATUS_RGB[c.status]}`,
                            color: isLightHexColor(
                              c.warnaCustom || `#${SCHEDULE_STATUS_RGB[c.status]}`
                            )
                              ? "#0f172a"
                              : "#ffffff",
                          }}
                        >
                          {SCHEDULE_CELL_LABELS[c.status]}
                        </span>
                      </div>

                      {c.workItemPic && (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                          <User className="w-3 h-3 text-blue-600 shrink-0" />
                          <span>PIC: {c.workItemPic}</span>
                        </div>
                      )}

                      {c.catatan && (
                        <div className="p-2 rounded-lg bg-slate-50 text-[11px] text-slate-700 italic border border-slate-100">
                          &ldquo;{c.catatan}&rdquo;
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <button
                          type="button"
                          onClick={() => setActiveCellInGroup({ ...c })}
                          className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                        >
                          Kelola & Ubah Status &rarr;
                        </button>
                        <Link
                          href={`/jadwal/lane/${c.laneId}`}
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold"
                        >
                          <ExternalLink className="w-3 h-3" /> Buka Grid Lane
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer hover:bg-slate-50"
                  >
                    Tutup
                  </button>
                  <Link
                    href={`/jadwal/lane/${selectedGroup.cells[0]?.laneId}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                  >
                    <Grid className="w-4 h-4" /> Buka Grid Sheet
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
