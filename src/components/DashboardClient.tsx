"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  FolderKanban,
  PackageCheck,
  PackageSearch,
  Search,
  Sparkles,
  User,
} from "lucide-react";
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

  function filterTasks(list: TaskItem[]) {
    const q = agendaSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => {
      const hay = `${t.projectNama} ${t.projectClient} ${t.laneNama} ${t.workItemJudul} ${t.subScopeJudul ?? ""} ${t.workItemPic ?? ""} ${t.catatan ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const filteredToday = filterTasks(todayTasks);
  const filteredTomorrow = filterTasks(tomorrowTasks);

  const checklistList = useMemo(
    () => projectChecklists ?? [],
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

  function renderTaskCard(task: TaskItem) {
    const bgHex = task.warnaCustom || `#${SCHEDULE_STATUS_RGB[task.status]}`;
    const darkText = isLightHexColor(bgHex);
    const displayJudul = task.subScopeJudul || task.workItemJudul;
    const hasSubScope = Boolean(task.subScopeJudul);

    return (
      <Link
        key={task.id}
        href={`/jadwal/lane/${task.laneId}`}
        className="group block p-3.5 rounded-2xl v14-subcard hover:border-[#F05232]/50 hover:-translate-y-0.5 transition-all"
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
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
            {task.catatan && (
              <div className="text-xs text-slate-700 dark:text-slate-300 mt-2 bg-white dark:bg-[#16181f] px-2.5 py-1.5 rounded-xl border border-black/[0.05] dark:border-white/[0.06]">
                💬 {task.catatan}
              </div>
            )}
          </div>
          <span
            data-keep-light="true"
            className="px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0 shadow-2xs"
            style={{
              backgroundColor: bgHex,
              color: darkText ? "#0f172a" : "#ffffff",
            }}
          >
            {SCHEDULE_CELL_LABELS[task.status]}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* ==================== HERO GREETING BAR (V14 STYLE) ==================== */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-v14-in">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            {greeting}, Tim Engineering
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pantau kesiapan komponen PR, progres workshop, dan jadwal proyek —{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {formatTanggalId(todayIso)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/jadwal/buat"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#141518] hover:bg-neutral-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-[#111216] text-xs font-bold shadow-sm transition hover:-translate-y-0.5"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            Buat Schedule
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
        </div>
      </div>

      {/* ==================== ROW 1: BENTO 3-COLUMN HERO GRID (V14) ==================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* LEFT COLUMN (4 cols): Portfolio Readiness + Quick Module Pills (mirrors Total Balance + Wallets) */}
        <div className="xl:col-span-4 v14-card rounded-[26px] p-5 sm:p-6 flex flex-col justify-between gap-5 animate-v14-in v14-delay-1">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Kesiapan Material Proyek
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-4xl sm:text-[42px] font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">
                {animReadiness}%
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                komponen siap ({readinessStats.arrivedComponents}/
                {readinessStats.totalComponents})
              </span>
            </div>

            {/* Dual Pill CTAs matching Transfer & Request */}
            <div className="grid grid-cols-2 gap-2.5 mt-5">
              <Link
                href="/proyek"
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#141518] hover:bg-neutral-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-[#111216] text-xs font-bold shadow-xs transition"
              >
                <FolderKanban className="w-3.5 h-3.5" />
                Semua Proyek
              </Link>
              <Link
                href="/import-pr"
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-full v14-subcard hover:bg-slate-100 dark:hover:bg-[#262a36] text-slate-800 dark:text-slate-100 text-xs font-bold transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#F05232]" />
                Import PR
              </Link>
            </div>
          </div>

          {/* Inner Mini Grid (mirrors Wallets: USD / EUR / GBP) */}
          <div className="rounded-2xl v14-subcard p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                Ringkasan Harian
              </span>
              <span className="text-slate-400 font-medium">Workshop &amp; PR</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white dark:bg-[#16181f] border border-black/[0.05] dark:border-white/[0.06] p-2.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Hari Ini
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {todayTasks.length}
                </div>
                <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Agenda
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-[#16181f] border border-black/[0.05] dark:border-white/[0.06] p-2.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Besok
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {tomorrowTasks.length}
                </div>
                <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                  Terjadwal
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-[#16181f] border border-black/[0.05] dark:border-white/[0.06] p-2.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Perlu Cek
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {cards.needsCheckCount}
                </div>
                <div
                  className={`text-[10px] font-semibold mt-0.5 ${
                    cards.needsCheckCount > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {cards.needsCheckCount > 0 ? "Baris PR" : "Bersih"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN (4 cols): 2x2 Bento KPI Grid with signature Coral-Orange Card! */}
        <div className="xl:col-span-4 grid grid-cols-2 gap-4 animate-v14-in v14-delay-2">
          {/* Card 1: Vibrant Coral-Orange Signature Spotlight */}
          <Link
            href="/proyek"
            className="v14-coral-card rounded-[24px] p-5 text-white flex flex-col justify-between min-h-[154px] relative overflow-hidden"
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold text-white/90">
                Proyek Aktif
              </span>
              <span className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                <FolderKanban className="w-4 h-4 text-white" />
              </span>
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums leading-none">
                {animActiveProjects}
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/90">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Wiring, PLC &amp; Site</span>
            </div>
          </Link>

          {/* Card 2: Komponen Belum Datang */}
          <Link
            href="/proyek"
            className="v14-card v14-card-interactive rounded-[24px] p-5 flex flex-col justify-between min-h-[154px]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Belum Datang
              </span>
              <span className="w-8 h-8 rounded-full v14-subcard flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                <PackageSearch className="w-4 h-4" />
              </span>
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">
                {animMissingComps}
              </div>
            </div>
            <div className="text-[11px] font-bold">
              {readinessStats.orderedComponents > 0 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {readinessStats.orderedComponents} dalam pesanan
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">
                  ✓ Semua siap pakai
                </span>
              )}
            </div>
          </Link>

          {/* Card 3: Jadwal 7 Hari */}
          <Link
            href="/jadwal"
            className="v14-card v14-card-interactive rounded-[24px] p-5 flex flex-col justify-between min-h-[154px]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Slot 7 Hari
              </span>
              <span className="w-8 h-8 rounded-full v14-subcard flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                <CalendarClock className="w-4 h-4" />
              </span>
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">
                {animNext7}
              </div>
            </div>
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span>Jadwal minggu ini</span>
            </div>
          </Link>

          {/* Card 4: Berisiko Terlambat */}
          <Link
            href="/prioritas"
            className="v14-card v14-card-interactive rounded-[24px] p-5 flex flex-col justify-between min-h-[154px]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Berisiko
              </span>
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  cards.atRiskProjectsCount > 0
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                    : "v14-subcard text-emerald-600 dark:text-emerald-400"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <div className="my-2">
              <div
                className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums leading-none ${
                  cards.atRiskProjectsCount > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-900 dark:text-white"
                }`}
              >
                {animAtRisk}
              </div>
            </div>
            <div
              className={`text-[11px] font-bold ${
                cards.atRiskProjectsCount > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {cards.atRiskProjectsCount > 0
                ? "Deadline < 7 hari"
                : "Semua deadline aman"}
            </div>
          </Link>
        </div>

        {/* RIGHT COLUMN (4 cols): Stacked Rounded Bar Chart (mirrors Total Income / Profit & Loss) */}
        <div className="xl:col-span-4 v14-card rounded-[26px] p-5 sm:p-6 flex flex-col justify-between animate-v14-in v14-delay-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Beban Kerja 7 Hari
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Distribusi task selesai vs aktif terjadwal minggu ini.
            </p>
          </div>

          <div className="mt-4 rounded-2xl v14-subcard p-4 flex-1 flex flex-col justify-between min-h-[210px]">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                Task Harian
              </span>
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-[#F05232]" />
                  Aktif
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-[#141518] dark:bg-white" />
                  Selesai
                </span>
              </div>
            </div>

            {/* Rounded Stacked Bars */}
            <div className="grid grid-cols-7 gap-2.5 items-end h-[148px] pt-6">
              {dailyScheduleStats.map((day, idx) => {
                const activeAndDelay = day.activeCount + day.delayCount;
                const donePct = Math.round((day.doneCount / maxDailyTotal) * 100);
                const activePct = Math.round((activeAndDelay / maxDailyTotal) * 100);
                const isToday = idx === 0;
                const isHovered = hoveredDay === day.date;

                return (
                  <Link
                    key={day.date}
                    href="/jadwal"
                    onMouseEnter={() => setHoveredDay(day.date)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className="group relative flex flex-col items-center justify-end h-full gap-1.5"
                    title={`${day.shortDay} ${day.dayNum}: ${day.totalCount} tugas (${day.doneCount} selesai, ${activeAndDelay} aktif)`}
                  >
                    {isHovered && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#141518] dark:bg-white text-white dark:text-[#111216] text-[10px] font-extrabold whitespace-nowrap shadow-md z-10">
                        {day.totalCount} task
                      </div>
                    )}
                    <div className="w-full max-w-[26px] h-[104px] flex flex-col justify-end gap-1">
                      {day.totalCount === 0 ? (
                        <div className="w-full h-2.5 rounded-full bg-slate-200/80 dark:bg-white/[0.08] transition-all" />
                      ) : (
                        <>
                          {activeAndDelay > 0 && (
                            <div
                              className="w-full rounded-lg bg-gradient-to-b from-[#F45B38] to-[#D9381E] transition-all duration-700 ease-out group-hover:brightness-110"
                              style={{
                                height: mounted
                                  ? `${Math.max(14, activePct)}%`
                                  : "0%",
                              }}
                            />
                          )}
                          {day.doneCount > 0 && (
                            <div
                              className="w-full rounded-lg bg-[#141518] dark:bg-white transition-all duration-700 ease-out"
                              style={{
                                height: mounted
                                  ? `${Math.max(14, donePct)}%`
                                  : "0%",
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold ${
                        isToday
                          ? "text-[#F05232] font-extrabold"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {day.shortDay}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== ROW 2: PROGRESS STRIP + AGENDA AKTIVITAS (V14) ==================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Column (4 cols): Component Progress Limit Card + Prioritas Minggu Ini */}
        <div className="xl:col-span-4 space-y-5 animate-v14-in v14-delay-4">
          {/* Progress Kedatangan Komponen (mirrors Monthly Spending Limit) */}
          <div className="v14-card rounded-[26px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-[#F05232]" />
                Progres Pengadaan PR
              </h2>
              <span className="text-xs font-extrabold text-[#F05232] tabular-nums">
                {readinessStats.readinessPct}%
              </span>
            </div>

            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F45B38] to-[#D9381E] transition-all duration-700 ease-out"
                style={{
                  width: mounted ? `${readinessStats.readinessPct}%` : "0%",
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs mt-2.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                <strong className="text-slate-900 dark:text-white">
                  {readinessStats.arrivedComponents}
                </strong>{" "}
                sudah siap/datang
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Total {readinessStats.totalComponents} item
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-black/[0.06] dark:border-white/[0.07] text-center">
              <div className="rounded-xl v14-subcard py-2 px-1">
                <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {readinessStats.arrivedComponents}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Siap
                </div>
              </div>
              <div className="rounded-xl v14-subcard py-2 px-1">
                <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                  {readinessStats.orderedComponents}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Dipesan
                </div>
              </div>
              <div className="rounded-xl v14-subcard py-2 px-1">
                <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                  {readinessStats.notYetPrComponents}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Belum PR
                </div>
              </div>
            </div>
          </div>

          {/* Prioritas Minggu Ini Card */}
          <section className="v14-card rounded-[26px] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F05232]" />
                Prioritas Minggu Ini
              </h2>
              <Link
                href="/prioritas"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full v14-subcard hover:bg-slate-100 dark:hover:bg-[#262a36] text-[11px] font-bold text-slate-700 dark:text-slate-200 transition"
              >
                Atur <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {topPriorities.length === 0 ? (
              <div className="rounded-2xl v14-subcard p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                Belum ada proyek aktif yang diprioritaskan.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {topPriorities.map((item) => (
                  <Link
                    key={item.project.id}
                    href={`/proyek/${item.project.id}`}
                    className="group block p-3 rounded-2xl v14-subcard hover:border-[#F05232]/50 hover:-translate-y-0.5 transition-all"
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
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-[#F05232] transition-colors">
                            {item.project.nama}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {item.project.client} • PR{" "}
                            {item.componentReadinessPct}%
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

        {/* Right Column (8 cols): Agenda Hari Ini & Besok + Alert Tindak Lanjut */}
        <div className="xl:col-span-8 space-y-5 animate-v14-in v14-delay-5">
          {/* Agenda Kerja Card (mirrors Recent Activities card with search + pill filters) */}
          <section className="v14-card rounded-[26px] p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Agenda Pekerjaan Hari Ini &amp; Besok
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Klik agenda untuk langsung membuka grid jadwal &amp; update progres.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Inline Pill Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={agendaSearch}
                    onChange={(e) => setAgendaSearch(e.target.value)}
                    placeholder="Cari agenda, PIC..."
                    className="pl-8 pr-3 py-1.5 rounded-full v14-subcard text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F05232]/40 w-44 sm:w-52"
                  />
                </div>

                {/* Segmented Pill Tab */}
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
                    <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">{filteredToday.map(renderTaskCard)}</div>
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
                    <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                      {filteredTomorrow.map(renderTaskCard)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Alert & Tindak Lanjut Card */}
          <section className="v14-card rounded-[26px] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Alert &amp; Tindak Lanjut ({alerts.length})
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Notifikasi jadwal terlambat, risiko deadline, dan PR butuh pengecekan
                  </p>
                </div>
              </div>
            </div>

            {alerts.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/25 p-4 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Semua alert sudah ditangani. Operasional proyek berjalan lancar.
                </span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                {alerts.map((a) => {
                  const isBusy = busyKey === a.key;
                  const accentClass =
                    a.severity === "DANGER"
                      ? "bg-rose-50/90 dark:bg-rose-500/10 border-rose-200/80 dark:border-rose-500/25 text-rose-950 dark:text-rose-100"
                      : a.severity === "WARNING"
                        ? "bg-amber-50/90 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-500/25 text-amber-950 dark:text-amber-100"
                        : "bg-blue-50/90 dark:bg-blue-500/10 border-blue-200/80 dark:border-blue-500/25 text-blue-950 dark:text-blue-100";
                  const dotClass =
                    a.severity === "DANGER"
                      ? "bg-rose-500"
                      : a.severity === "WARNING"
                        ? "bg-amber-500"
                        : "bg-blue-500";

                  return (
                    <div
                      key={a.key}
                      className={`rounded-2xl border p-3.5 sm:p-4 transition ${accentClass}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotClass}`}
                          />
                          <div>
                            <div className="font-bold text-xs sm:text-sm">
                              {a.title}
                            </div>
                            <div className="text-xs opacity-85 mt-0.5">
                              {a.description}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0 pl-4 sm:pl-0">
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
                                className="px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition"
                              >
                                Konfirmasi DELAY
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleConfirmDelay(a.cellId!, "DISMISS", a.key)
                                }
                                className="px-3 py-1.5 rounded-full bg-white/90 dark:bg-white/10 hover:bg-white border border-rose-300 dark:border-rose-400/30 text-rose-800 dark:text-rose-200 text-xs font-bold cursor-pointer transition"
                              >
                                Biarkan
                              </button>
                            </>
                          ) : (
                            <>
                              <Link
                                href={a.href}
                                className="px-3.5 py-1.5 rounded-full bg-[#141518] hover:bg-neutral-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-[#111216] text-xs font-bold transition"
                              >
                                Buka
                              </Link>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDismissAlert(a.key)}
                                className="px-3 py-1.5 rounded-full bg-white/90 dark:bg-white/10 hover:bg-white border border-black/10 dark:border-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition"
                              >
                                Selesai
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ==================== ROW 3: MONITOR CEKLIS DOKUMEN TIAP PROYEK (1 KOLOM OVERVIEW) ==================== */}
      <section className="v14-card rounded-[26px] p-5 sm:p-6 animate-v14-in v14-delay-6">
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
                Overview status 8 berkas engineering per proyek: PR, Jadwal, I/O, Layout HMI, Layout Panel, Flowchart, Wiring, &amp; Program
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
    </div>
  );
}
