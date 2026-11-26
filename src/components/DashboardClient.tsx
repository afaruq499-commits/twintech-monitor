"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  FolderKanban,
  Loader2,
  PackageCheck,
  PackageSearch,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { isTaskAssignedToUser } from "@/lib/users";
import {
  SCHEDULE_CELL_LABELS,
  SCHEDULE_STATUS_RGB,
  WORK_TYPE_LABELS,
  isLightHexColor,
  type ScheduleCellStatus,
  type WorkType,
} from "@/lib/constants";
import type {
  DashboardAlertItem,
  ProjectChecklistSummaryItem,
} from "@/lib/data-queries";
import { formatTanggalId } from "@/lib/date-utils";

interface TaskItem {
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
  tanggal: string;
  status: ScheduleCellStatus;
  warnaCustom?: string | null;
  catatan: string | null;
}

interface TopPriorityItem {
  rank: number;
  isManualOverride: boolean;
  reasonSummary: string;
  componentReadinessPct: number;
  isDeadlineRisk: boolean;
  project: {
    id: string;
    kode: string | null;
    nama: string;
    client: string;
    warna?: string;
  };
}

interface DailyScheduleStat {
  date: string;
  shortDay: string;
  dayNum: string;
  doneCount: number;
  activeCount: number;
  delayCount: number;
  totalCount: number;
}

interface ReadinessStats {
  totalComponents: number;
  arrivedComponents: number;
  orderedComponents: number;
  notYetPrComponents: number;
  readinessPct: number;
}

function useAnimatedNumber(target: number, duration = 550) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (reduced) {
        setVal(target);
        return;
      }
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}

export function DashboardClient({
  todayIso,
  tomorrowIso,
  cards,
  readinessStats,
  dailyScheduleStats,
  todayTasks,
  tomorrowTasks,
  alerts,
  topPriorities,
  projectChecklists,
  currentUser,
}: {
  todayIso: string;
  tomorrowIso: string;
  cards: {
    activeProjectsCount: number;
    missingComponentsCount: number;
    next7DaysCount: number;
    atRiskProjectsCount: number;
    needsCheckCount: number;
  };
  readinessStats: ReadinessStats;
  dailyScheduleStats: DailyScheduleStat[];
  todayTasks: TaskItem[];
  tomorrowTasks: TaskItem[];
  alerts: DashboardAlertItem[];
  topPriorities: TopPriorityItem[];
  projectChecklists?: ProjectChecklistSummaryItem[];
  currentUser?: SessionUser | null;
}) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Selamat datang");
  const [mounted, setMounted] = useState(false);
  const [agendaTab, setAgendaTab] = useState<"ALL" | "TODAY" | "TOMORROW">("ALL");
  const [agendaSearch, setAgendaSearch] = useState("");
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [checklistSearch, setChecklistSearch] = useState("");
  const [checklistFilter, setChecklistFilter] = useState<"ALL" | "INCOMPLETE" | "COMPLETE">("ALL");

  const isMember = currentUser?.role === "MEMBER";
  const isAdmin = currentUser?.role === "ADMIN" || !isMember;
  const userNama = currentUser?.nama || (isAdmin ? "Faruq" : "Member");

  const [picFilter, setPicFilter] = useState<string>(isMember ? "MY_TASKS" : "ALL");
  const [optimisticStatusMap, setOptimisticStatusMap] = useState<Record<string, ScheduleCellStatus>>({});
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const hr = new Date().getHours();
    if (hr < 11) setGreeting("Selamat pagi");
    else if (hr < 15) setGreeting("Selamat siang");
    else if (hr < 18) setGreeting("Selamat sore");
    else setGreeting("Selamat malam");
  }, []);

  const animActiveProjects = useAnimatedNumber(cards.activeProjectsCount);
  const animMissingComps = useAnimatedNumber(cards.missingComponentsCount);
  const animNext7 = useAnimatedNumber(cards.next7DaysCount);
  const animAtRisk = useAnimatedNumber(cards.atRiskProjectsCount);
  const animReadiness = useAnimatedNumber(readinessStats.readinessPct);

  const maxDailyTotal = useMemo(() => {
    const m = Math.max(1, ...dailyScheduleStats.map((d) => d.totalCount));
    return m;
  }, [dailyScheduleStats]);

  const myTodayTasks = useMemo(() => {
    return todayTasks
      .map((t) => ({
        ...t,
        status: optimisticStatusMap[t.id] || t.status,
      }))
      .filter((t) => isTaskAssignedToUser(t.workItemPic, userNama));
  }, [todayTasks, optimisticStatusMap, userNama]);

  const myTomorrowTasks = useMemo(() => {
    return tomorrowTasks
      .map((t) => ({
        ...t,
        status: optimisticStatusMap[t.id] || t.status,
      }))
      .filter((t) => isTaskAssignedToUser(t.workItemPic, userNama));
  }, [tomorrowTasks, optimisticStatusMap, userNama]);

  const myDoneCount = myTodayTasks.filter((t) => t.status === "DONE").length;

  const faruqTodayTasks = useMemo(() => {
    return todayTasks.filter((t) => isTaskAssignedToUser(t.workItemPic, "Faruq"));
  }, [todayTasks]);

  const apipTodayTasks = useMemo(() => {
    return todayTasks.filter((t) => isTaskAssignedToUser(t.workItemPic, "Apip"));
  }, [todayTasks]);

  const ijlalTodayTasks = useMemo(() => {
    return todayTasks.filter((t) => isTaskAssignedToUser(t.workItemPic, "Ijlal"));
  }, [todayTasks]);

  async function handleDismissAlert(alertKey: string) {
    setBusyKey(alertKey);
    try {
      await fetch("/api/alerts/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertKey }),
      });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleConfirmDelay(
    cellId: string,
    action: "CONFIRM_DELAY" | "DISMISS",
    alertKey: string
  ) {
    setBusyKey(alertKey);
    try {
      await fetch("/api/schedule/delay-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cellId, action }),
      });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleQuickStatusChange(
    task: TaskItem,
    nextStatus: ScheduleCellStatus,
    e?: React.MouseEvent
  ) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setUpdatingTaskId(task.id);
    setOptimisticStatusMap((prev) => ({ ...prev, [task.id]: nextStatus }));

    try {
      const res = await fetch("/api/schedule/task-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cellId: task.id,
          workItemId: task.workItemId,
          tanggal: task.tanggal,
          subScopeId: task.subScopeId,
          status: nextStatus,
        }),
      });
      if (!res.ok) {
        setOptimisticStatusMap((prev) => {
          const next = { ...prev };
          delete next[task.id];
          return next;
        });
      } else {
        router.refresh();
      }
    } catch {
      setOptimisticStatusMap((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function filterTasks(list: TaskItem[]) {
    const mapped = list.map((t) => ({
      ...t,
      status: optimisticStatusMap[t.id] || t.status,
    }));

    let byPic = mapped;
    if (picFilter === "MY_TASKS") {
      byPic = mapped.filter((t) => isTaskAssignedToUser(t.workItemPic, userNama));
    } else if (picFilter === "FARUQ") {
      byPic = mapped.filter((t) => isTaskAssignedToUser(t.workItemPic, "Faruq"));
    } else if (picFilter === "APIP") {
      byPic = mapped.filter((t) => isTaskAssignedToUser(t.workItemPic, "Apip"));
    } else if (picFilter === "IJLAL") {
      byPic = mapped.filter((t) => isTaskAssignedToUser(t.workItemPic, "Ijlal"));
    }

    const q = agendaSearch.trim().toLowerCase();
    if (!q) return byPic;
    return byPic.filter((t) => {
      const hay = `${t.projectNama} ${t.projectClient} ${t.laneNama} ${t.workItemJudul} ${t.subScopeJudul ?? ""} ${t.workItemPic ?? ""} ${t.catatan ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const filteredToday = filterTasks(todayTasks);
  const filteredTomorrow = filterTasks(tomorrowTasks);

  const checklistList = useMemo(
    () => (projectChecklists ?? []).filter((p) => p.tipeProyek !== "AFTER_SALES"),
    [projectChecklists]
  );

  const { completeCount, incompleteCount } = useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    for (const p of checklistList) {
      if (p.completedCount === p.totalCount && p.totalCount > 0) complete++;
      else incomplete++;
    }
    return { completeCount: complete, incompleteCount: incomplete };
  }, [checklistList]);

  const filteredProjectChecklists = useMemo(() => {
    const q = checklistSearch.trim().toLowerCase();
    return checklistList.filter((p) => {
      const matchesSearch =
        !q ||
        p.nama.toLowerCase().includes(q) ||
        (p.kode && p.kode.toLowerCase().includes(q)) ||
        p.client.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (checklistFilter === "INCOMPLETE") {
        return p.completedCount < p.totalCount;
      }
      if (checklistFilter === "COMPLETE") {
        return p.completedCount === p.totalCount && p.totalCount > 0;
      }
      return true;
    });
  }, [checklistList, checklistSearch, checklistFilter]);

  const checklistStats = useMemo(() => {
    const list = checklistList;
    if (list.length === 0)
      return { completeProjects: 0, totalProjects: 0, avgPct: 0 };
    const completeProjects = list.filter(
      (p) => p.completedCount === p.totalCount && p.totalCount > 0
    ).length;
    const avgPct = Math.round(
      list.reduce((sum, p) => sum + p.progressPct, 0) / list.length
    );
    return { completeProjects, totalProjects: list.length, avgPct };
  }, [checklistList]);

  function renderTaskCard(task: TaskItem) {
    const currentStatus = optimisticStatusMap[task.id] || task.status;
    const bgHex = task.warnaCustom || `#${SCHEDULE_STATUS_RGB[currentStatus]}`;
    const darkText = isLightHexColor(bgHex);
    const displayJudul = task.subScopeJudul || task.workItemJudul;
    const hasSubScope = Boolean(task.subScopeJudul);
    const isUpdating = updatingTaskId === task.id;

    return (
      <div
        key={task.id}
        className="group block p-3.5 rounded-2xl v14-subcard hover:border-[#F05232]/50 transition-all"
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <Link href={`/jadwal/lane/${task.laneId}`} className="block">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white dark:ring-[#16181f]"
                  style={{ backgroundColor: task.projectWarna }}
                />
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                  {task.projectClient} • {task.laneNama}
                </span>
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white leading-snug whitespace-pre-line group-hover:text-[#F05232] transition-colors">
                {displayJudul}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-2">
                <span>
                  {hasSubScope
                    ? task.workItemJudul
                    : `${task.projectNama} • ${WORK_TYPE_LABELS[task.jenis]}`}
                </span>
                {task.workItemPic && (
                  <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                    • <User className="w-3 h-3 text-[#F05232]" /> {task.workItemPic}
                  </span>
                )}
              </div>
            </Link>

            {task.catatan && (
              <div className="text-xs text-slate-700 dark:text-slate-300 mt-2 bg-white dark:bg-[#16181f] px-2.5 py-1.5 rounded-xl border border-black/[0.05] dark:border-white/[0.06]">
                💬 {task.catatan}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              data-keep-light="true"
              className="px-2.5 py-1 rounded-full text-[11px] font-extrabold shadow-2xs"
              style={{
                backgroundColor: bgHex,
                color: darkText ? "#0f172a" : "#ffffff",
              }}
            >
              {SCHEDULE_CELL_LABELS[currentStatus]}
            </span>

            {/* Quick 1-click status actions */}
            {currentStatus === "TARGET" && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={(e) => handleQuickStatusChange(task, "ON_PROGRESS", e)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold shadow-2xs transition cursor-pointer"
                title="Mulai kerjakan pekerjaan ini"
              >
                {isUpdating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                Mulai
              </button>
            )}

            {currentStatus === "ON_PROGRESS" && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={(e) => handleQuickStatusChange(task, "DONE", e)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-2xs transition cursor-pointer"
                title="Tandai pekerjaan ini selesai"
              >
                {isUpdating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Selesai
              </button>
            )}

            {currentStatus === "DONE" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" /> Done
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* ==================== HERO GREETING BAR (V14 STYLE) ==================== */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-v14-in">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight flex items-center gap-2.5">
            <span>
              {greeting}, {userNama}
            </span>
            <span
              className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isAdmin
                  ? "bg-[#F05232] text-white"
                  : "bg-sky-500 text-white"
              }`}
            >
              {isAdmin ? "Admin" : "Member"}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin
              ? "Menentukan pekerjaan, tanggal pengerjaan, & delegasi PIC (Faruq, Apip, Ijlal) — "
              : "Pantau notifikasi tugas harian & pekerjaan yang diberikan oleh Admin Faruq — "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {formatTanggalId(todayIso)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAdmin ? (
            <>
              <Link
                href="/jadwal/buat"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#141518] hover:bg-neutral-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-[#111216] text-xs font-bold shadow-sm transition hover:-translate-y-0.5"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Buat Schedule &amp; Delegasi
              </Link>
              <Link
                href="/buat-pr"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full v14-card hover:bg-slate-50 dark:hover:bg-[#1e212a] text-slate-800 dark:text-slate-100 text-xs font-bold transition hover:-translate-y-0.5"
              >
                <ClipboardList className="w-3.5 h-3.5 text-[#F05232]" />
                Susun PR
              </Link>
              <a
                href="/api/export/jadwal"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full v14-card hover:bg-slate-50 dark:hover:bg-[#1e212a] text-slate-800 dark:text-slate-100 text-xs font-bold transition hover:-translate-y-0.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Export Jadwal
              </a>
            </>
          ) : (
            <>
              <Link
                href="/jadwal"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition hover:-translate-y-0.5"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                Buka Kalender Jadwal
              </Link>
              <Link
                href="/proyek"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full v14-card hover:bg-slate-50 dark:hover:bg-[#1e212a] text-slate-800 dark:text-slate-100 text-xs font-bold transition hover:-translate-y-0.5"
              >
                <FolderKanban className="w-3.5 h-3.5 text-sky-500" />
                Semua Proyek
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ==================== NOTIFIKASI TUGAS HARIAN MEMBER ==================== */}
      {isMember && (
        <section className="v14-card rounded-[26px] p-5 sm:p-6 border-l-4 border-l-sky-500 bg-sky-50/40 dark:bg-sky-950/20 animate-v14-in space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
                <Bell className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Notifikasi Tugas Hari Ini — {userNama}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-500 text-white">
                    Member
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Admin Faruq telah menugaskan{" "}
                  <strong className="text-sky-600 dark:text-sky-400 font-extrabold">
                    {myTodayTasks.length} pekerjaan
                  </strong>{" "}
                  untuk Anda kerjakan hari ini ({formatTanggalId(todayIso)}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-[#1a1e28] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10 shadow-2xs">
                Progres: {myDoneCount}/{myTodayTasks.length} Selesai
              </span>
            </div>
          </div>

          {myTodayTasks.length === 0 ? (
            <div className="rounded-2xl v14-subcard p-6 text-center text-xs text-slate-500 dark:text-slate-400 border-dashed">
              🎉 Tidak ada jadwal pekerjaan aktif yang ditugaskan kepada Anda hari ini. Bersiap untuk agenda berikutnya!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {myTodayTasks.map((task) => {
                const currentStatus = optimisticStatusMap[task.id] || task.status;
                const isUpdating = updatingTaskId === task.id;
                const displayJudul = task.subScopeJudul || task.workItemJudul;

                return (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-2xl v14-subcard border hover:border-sky-400 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: task.projectWarna }}
                          />
                          <span className="text-[11px] font-bold text-slate-500 truncate">
                            {task.projectClient} • {task.laneNama}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                            currentStatus === "DONE"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                              : currentStatus === "ON_PROGRESS"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"
                          }`}
                        >
                          {SCHEDULE_CELL_LABELS[currentStatus]}
                        </span>
                      </div>

                      <div className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">
                        {displayJudul}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {task.projectNama} • {WORK_TYPE_LABELS[task.jenis]}
                      </div>
                      {task.catatan && (
                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-[#12141a] px-2.5 py-1 rounded-lg border border-black/5">
                          💬 {task.catatan}
                        </div>
                      )}
                    </div>

                    {/* 1-Click Status Controls for Member */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-2">
                      <Link
                        href={`/jadwal/lane/${task.laneId}`}
                        className="text-[11px] font-semibold text-slate-500 hover:text-sky-600 flex items-center gap-0.5"
                      >
                        Detail <ArrowRight className="w-3 h-3" />
                      </Link>

                      {currentStatus === "TARGET" && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={(e) => handleQuickStatusChange(task, "ON_PROGRESS", e)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 fill-current" />
                          )}
                          Mulai Kerjakan
                        </button>
                      )}

                      {currentStatus === "ON_PROGRESS" && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={(e) => handleQuickStatusChange(task, "DONE", e)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Tandai Selesai
                        </button>
                      )}

                      {currentStatus === "DONE" && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Selesai Dikerjakan
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ==================== RINGKASAN DELEGASI TIM ADMIN ==================== */}
      {isAdmin && (
        <section className="v14-card rounded-[26px] p-5 sm:p-6 border-l-4 border-l-[#F05232] bg-orange-50/30 dark:bg-orange-950/15 animate-v14-in space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#F45B38] to-[#D9381E] text-white flex items-center justify-center shadow-md shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Delegasi Pekerjaan Tim &amp; Penjadwalan
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#F05232] text-white">
                    Admin Faruq
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Tentukan pekerjaan, jadwalkan tanggal, &amp; pilih siapa PIC yang mengerjakan (Admin juga dapat bekerja).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/jadwal/buat"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#141518] hover:bg-neutral-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-[#111216] text-xs font-bold shadow-xs transition"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Jadwalkan / Delegasikan Tugas
              </Link>
            </div>
          </div>

          {/* Team Member Distribution Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setPicFilter(picFilter === "FARUQ" ? "ALL" : "FARUQ")}
              className={`p-3.5 rounded-2xl v14-subcard flex items-center justify-between transition text-left cursor-pointer ${
                picFilter === "FARUQ" ? "ring-2 ring-[#F05232] bg-orange-50/80 dark:bg-orange-500/10" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F45B38] to-[#D9381E] text-white text-xs font-extrabold flex items-center justify-center shrink-0 shadow-xs">
                  FQ
                </span>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Faruq
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-orange-100 text-[#F05232]">
                      Admin
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Pekerjaan Hari Ini</div>
                </div>
              </div>
              <div className="text-lg font-black text-[#F05232]">
                {faruqTodayTasks.length} <span className="text-xs font-semibold text-slate-400">tugas</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPicFilter(picFilter === "APIP" ? "ALL" : "APIP")}
              className={`p-3.5 rounded-2xl v14-subcard flex items-center justify-between transition text-left cursor-pointer ${
                picFilter === "APIP" ? "ring-2 ring-sky-500 bg-sky-50/80 dark:bg-sky-500/10" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 shadow-xs">
                  AP
                </span>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Apip
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-600">
                      Member
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Pekerjaan Hari Ini</div>
                </div>
              </div>
              <div className="text-lg font-black text-sky-600">
                {apipTodayTasks.length} <span className="text-xs font-semibold text-slate-400">tugas</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPicFilter(picFilter === "IJLAL" ? "ALL" : "IJLAL")}
              className={`p-3.5 rounded-2xl v14-subcard flex items-center justify-between transition text-left cursor-pointer ${
                picFilter === "IJLAL" ? "ring-2 ring-emerald-500 bg-emerald-50/80 dark:bg-emerald-500/10" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 shadow-xs">
                  IJ
                </span>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Ijlal
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-600">
                      Member
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Pekerjaan Hari Ini</div>
                </div>
              </div>
              <div className="text-lg font-black text-emerald-600">
                {ijlalTodayTasks.length} <span className="text-xs font-semibold text-slate-400">tugas</span>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* ==================== ZONE 1: ALERT & TINDAK LANJUT (FULL WIDTH ACTION PANEL) ==================== */}
      {alerts.length > 0 && (
        <section className="v14-card rounded-[24px] p-4 sm:p-5 border-l-4 border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/15 animate-v14-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  Perhatian &amp; Tindak Lanjut Segera
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">
                    {alerts.length} Notifikasi Aktif
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Notifikasi deadline mepet, risiko keterlambatan jadwal, atau komponen PR yang membutuhkan konfirmasi
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {alerts.map((a) => {
              const isBusy = busyKey === a.key;
              const accentClass =
                a.severity === "DANGER"
                  ? "bg-white dark:bg-[#1a1518] border-rose-200 dark:border-rose-900/40 text-slate-900 dark:text-white"
                  : a.severity === "WARNING"
                  ? "bg-white dark:bg-[#1a1815] border-amber-200 dark:border-amber-900/40 text-slate-900 dark:text-white"
                  : "bg-white dark:bg-[#15171a] border-blue-200 dark:border-blue-900/40 text-slate-900 dark:text-white";
              const dotClass =
                a.severity === "DANGER"
                  ? "bg-rose-500"
                  : a.severity === "WARNING"
                  ? "bg-amber-500"
                  : "bg-blue-500";

              return (
                <div
                  key={a.key}
                  className={`rounded-2xl border p-3.5 sm:p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${accentClass}`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${dotClass}`}
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {a.title}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {a.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    {a.category === "DELAY" && a.cellId ? (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleConfirmDelay(
                              a.cellId!,
                              "CONFIRM_DELAY",
                              a.key
                            )
                          }
                          className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition shadow-2xs"
                        >
                          Konfirmasi DELAY
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleConfirmDelay(a.cellId!, "DISMISS", a.key)
                          }
                          className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition"
                        >
                          Biarkan
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href={a.href}
                          className="px-4 py-1.5 rounded-full bg-[#141518] hover:bg-neutral-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-[#111216] text-xs font-bold transition shadow-2xs"
                        >
                          Buka
                        </Link>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDismissAlert(a.key)}
                          className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition"
                        >
                          Selesai
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ==================== ZONE 2: 4 METRIC CARDS UTAMA (1 BARIS RINGKAS) ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-v14-in">
        {/* Card 1: Proyek Berjalan */}
        <Link
          href="/proyek"
          className="v14-coral-card rounded-[22px] p-5 text-white flex flex-col justify-between min-h-[148px] relative overflow-hidden transition-transform hover:-translate-y-0.5 group"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold text-white/90">Proyek Aktif</span>
            <span className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <FolderKanban className="w-4 h-4 text-white" />
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums leading-none">
              {animActiveProjects}
            </div>
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/90">
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            <span>Semua proyek berjalan</span>
          </div>
        </Link>

        {/* Card 2: Kesiapan Material PR */}
        <Link
          href="/proyek"
          className="v14-card v14-card-interactive rounded-[22px] p-5 flex flex-col justify-between min-h-[148px] group"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Kesiapan Material PR
            </span>
            <span className="w-8 h-8 rounded-full v14-subcard flex items-center justify-center shrink-0 text-[#F05232]">
              <PackageCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">
                {animReadiness}%
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                ({readinessStats.arrivedComponents}/{readinessStats.totalComponents} Siap)
              </span>
            </div>
            {/* Slim progress bar */}
            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F45B38] to-[#D9381E] transition-all duration-700 ease-out"
                style={{ width: mounted ? `${readinessStats.readinessPct}%` : "0%" }}
              />
            </div>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
            {readinessStats.orderedComponents} dipesan • {readinessStats.notYetPrComponents} belum PR
          </div>
        </Link>

        {/* Card 3: Jadwal Kerja 7 Hari */}
        <Link
          href="/jadwal"
          className="v14-card v14-card-interactive rounded-[22px] p-5 flex flex-col justify-between min-h-[148px] group"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Slot Jadwal Minggu Ini
            </span>
            <span className="w-8 h-8 rounded-full v14-subcard flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
              <CalendarClock className="w-4 h-4" />
            </span>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">
                {animNext7}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Aktivitas
              </span>
            </div>
          </div>
          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            <span>{todayTasks.length} Hari Ini • {tomorrowTasks.length} Besok</span>
          </div>
        </Link>

        {/* Card 4: Kesiapan 8 Dokumen Engineering */}
        <div className="v14-card rounded-[22px] p-5 flex flex-col justify-between min-h-[148px]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Kelengkapan 8 Dokumen
            </span>
            <span className="w-8 h-8 rounded-full v14-subcard flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
              <ClipboardCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">
                {checklistStats.avgPct}%
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Rata-rata
              </span>
            </div>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
            {checklistStats.completeProjects} dari {checklistStats.totalProjects} proyek 100% lengkap
          </div>
        </div>
      </div>

      {/* ==================== ZONE 3: MONITOR CEKLIS 8 DOKUMEN TIAP PROYEK (FULL WIDTH) ==================== */}
      <section className="v14-card rounded-[26px] p-5 sm:p-6 animate-v14-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-[#F05232]/10 dark:bg-[#F05232]/20 text-[#F05232] flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Monitor Ceklis &amp; Kesiapan Dokumen Tiap Proyek
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Overview status 8 berkas engineering per proyek (PR, Jadwal, I/O, Layout HMI, Layout Panel, Flowchart, Wiring, &amp; Program)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={checklistSearch}
                onChange={(e) => setChecklistSearch(e.target.value)}
                placeholder="Cari proyek / client..."
                className="pl-8 pr-3 py-1.5 rounded-full v14-subcard text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F05232]/40 w-44 sm:w-52"
              />
            </div>

            {/* Segmented Filter Pills */}
            <div className="inline-flex items-center rounded-full v14-subcard p-1 gap-0.5">
              {(
                [
                  ["ALL", `Semua (${checklistList.length})`],
                  ["INCOMPLETE", `Belum Lengkap (${incompleteCount})`],
                  ["COMPLETE", `Lengkap (${completeCount})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChecklistFilter(key)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                    checklistFilter === key
                      ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216]"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredProjectChecklists.length === 0 ? (
          <div className="rounded-2xl v14-subcard border-dashed p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {checklistSearch
              ? `Tidak ditemukan proyek yang cocok dengan kata kunci "${checklistSearch}".`
              : "Belum ada data proyek untuk dimonitor."}
          </div>
        ) : (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {filteredProjectChecklists.map((p) => {
              const isAllDone =
                p.completedCount === p.totalCount && p.totalCount > 0;
              return (
                <div
                  key={p.id}
                  className="rounded-2xl v14-subcard p-4 sm:p-4.5 transition-all hover:border-[#F05232]/40 hover:shadow-xs group"
                >
                  {/* Top Bar: Project Info + Progress Counter */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white dark:ring-[#16181f] shadow-xs"
                        style={{ backgroundColor: p.warna || "#6366f1" }}
                      />
                      {p.kode && (
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 shrink-0">
                          {p.kode}
                        </span>
                      )}
                      <Link
                        href={`/proyek/${p.id}`}
                        className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-[#F05232] transition-colors truncate"
                      >
                        {p.nama}
                      </Link>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        • {p.client}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {isAllDone ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          {p.completedCount}/{p.totalCount} Lengkap (100%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30">
                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          {p.completedCount}/{p.totalCount} Selesai ({p.progressPct}%)
                        </span>
                      )}

                      <Link
                        href={`/proyek/${p.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-[#F05232] dark:hover:text-[#F05232] transition ml-1"
                      >
                        Detail <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Slim Progress Bar */}
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden my-2.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isAllDone
                          ? "bg-emerald-500"
                          : "bg-gradient-to-r from-[#F45B38] to-[#D9381E]"
                      }`}
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>

                  {/* 8 Checklist Items Grid / Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-0.5">
                    {p.items.map((item) =>
                      item.isComplete ? (
                        <div
                          key={item.key}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/25 text-[11px] font-bold min-w-0"
                          title={`${item.label}: Sudah selesai & diceklis`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>
                      ) : (
                        <div
                          key={item.key}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500 border border-slate-200/60 dark:border-white/[0.06] text-[11px] font-medium min-w-0"
                          title={`${item.label}: Belum diceklis / belum lengkap`}
                        >
                          <span className="w-2 h-2 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================== ZONE 4: OPERASIONAL (2 KOLOM SEIMBANG: 50% : 50%) ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Kolom Kiri (50%): Agenda Hari Ini & Besok */}
        <section className="v14-card rounded-[26px] p-5 sm:p-6 animate-v14-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#F05232]" />
                Agenda Pekerjaan
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pekerjaan teknis aktif di workshop &amp; site
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* PIC Filter Pills */}
              <div className="inline-flex items-center rounded-full v14-subcard p-1 gap-0.5">
                {isMember ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPicFilter("MY_TASKS")}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                        picFilter === "MY_TASKS"
                          ? "bg-sky-500 text-white shadow-2xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Tugas Saya
                    </button>
                    <button
                      type="button"
                      onClick={() => setPicFilter("ALL")}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                        picFilter === "ALL"
                          ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216]"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Semua Tim
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setPicFilter("ALL")}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                        picFilter === "ALL"
                          ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216]"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setPicFilter("FARUQ")}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                        picFilter === "FARUQ"
                          ? "bg-[#F05232] text-white shadow-2xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Faruq
                    </button>
                    <button
                      type="button"
                      onClick={() => setPicFilter("APIP")}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                        picFilter === "APIP"
                          ? "bg-sky-500 text-white shadow-2xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Apip
                    </button>
                    <button
                      type="button"
                      onClick={() => setPicFilter("IJLAL")}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                        picFilter === "IJLAL"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Ijlal
                    </button>
                  </>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={agendaSearch}
                  onChange={(e) => setAgendaSearch(e.target.value)}
                  placeholder="Cari agenda..."
                  className="pl-8 pr-3 py-1.5 rounded-full v14-subcard text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F05232]/40 w-32 sm:w-40"
                />
              </div>

              {/* Segmented Filter Pills */}
              <div className="inline-flex items-center rounded-full v14-subcard p-1 gap-0.5">
                {(
                  [
                    ["ALL", "Semua"],
                    ["TODAY", `Hari Ini (${filteredToday.length})`],
                    ["TOMORROW", `Besok (${filteredTomorrow.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAgendaTab(key)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                      agendaTab === key
                        ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216]"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className={`grid gap-4 ${
              agendaTab === "ALL" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {(agendaTab === "ALL" || agendaTab === "TODAY") && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200">
                    <Clock className="w-3.5 h-3.5 text-[#F05232]" />
                    Hari Ini
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {formatTanggalId(todayIso, false)}
                  </span>
                </div>
                {filteredToday.length === 0 ? (
                  <div className="rounded-2xl v14-subcard border-dashed p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Tidak ada pekerjaan terjadwal hari ini.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {filteredToday.map(renderTaskCard)}
                  </div>
                )}
              </div>
            )}

            {(agendaTab === "ALL" || agendaTab === "TOMORROW") && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200">
                    <CalendarClock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Besok
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {formatTanggalId(tomorrowIso, false)}
                  </span>
                </div>
                {filteredTomorrow.length === 0 ? (
                  <div className="rounded-2xl v14-subcard border-dashed p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Belum ada agenda untuk besok.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {filteredTomorrow.map(renderTaskCard)}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Kolom Kanan (50%): Prioritas Minggu Ini */}
        <section className="v14-card rounded-[26px] p-5 sm:p-6 animate-v14-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F05232]" />
                Prioritas Minggu Ini
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Peringkat prioritas berdasarkan deadline &amp; kesiapan material
              </p>
            </div>
            <Link
              href="/prioritas"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full v14-subcard hover:bg-slate-100 dark:hover:bg-[#262a36] text-[11px] font-bold text-slate-700 dark:text-slate-200 transition"
            >
              Atur <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {topPriorities.length === 0 ? (
            <div className="rounded-2xl v14-subcard p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Belum ada proyek aktif yang diprioritaskan.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[410px] overflow-y-auto pr-1">
              {topPriorities.map((item) => (
                <Link
                  key={item.project.id}
                  href={`/proyek/${item.project.id}`}
                  className="group block p-3.5 rounded-2xl v14-subcard hover:border-[#F05232]/50 hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 ${
                          item.rank === 1
                            ? "bg-gradient-to-br from-[#F45B38] to-[#D9381E] text-white shadow-xs"
                            : "bg-[#141518] dark:bg-white text-white dark:text-[#111216]"
                        }`}
                      >
                        #{item.rank}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-[#F05232] transition-colors">
                          {item.project.nama}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {item.project.client} • Kesiapan PR {item.componentReadinessPct}%
                        </div>
                      </div>
                    </div>
                    {item.isDeadlineRisk && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold shrink-0">
                        Risiko
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 pl-9">
                    {item.reasonSummary}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
