"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import {
  BrainCircuit,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Command,
  Download,
  FileSpreadsheet,
  FolderKanban,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Type,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type FontScale = "normal" | "large" | "xlarge";
type ThemeMode = "light" | "dark";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, group: "Utama" },
  {
    href: "/proyek",
    label: "Manajemen Proyek",
    shortLabel: "Proyek",
    icon: FolderKanban,
    group: "Utama",
  },
  {
    href: "/jadwal/buat",
    label: "Buat Schedule Proyek",
    shortLabel: "Buat",
    icon: CalendarPlus,
    group: "Jadwal",
  },
  {
    href: "/jadwal",
    label: "Jadwal & Kalender",
    shortLabel: "Jadwal",
    icon: CalendarDays,
    group: "Jadwal",
  },
  {
    href: "/import-schedule",
    label: "Import Schedule Excel",
    shortLabel: "Import Sch",
    icon: Upload,
    group: "Jadwal",
  },
  {
    href: "/buat-pr",
    label: "Buat / List Komponen PR",
    shortLabel: "Buat PR",
    icon: ClipboardList,
    group: "PR & Komponen",
  },
  {
    href: "/import-pr",
    label: "Import PR Excel",
    shortLabel: "Import PR",
    icon: FileSpreadsheet,
    group: "PR & Komponen",
  },
  {
    href: "/machine-learning",
    label: "Machine Learning",
    shortLabel: "AI Sizing",
    icon: BrainCircuit,
    group: "AI & Analitik",
  },
  {
    href: "/prioritas",
    label: "Prioritas Minggu Ini",
    shortLabel: "Prioritas",
    icon: ListOrdered,
    group: "AI & Analitik",
  },
  {
    href: "/template",
    label: "Template Pekerjaan",
    shortLabel: "Template",
    icon: Layers,
    group: "Sistem",
  },
  {
    href: "/pengaturan",
    label: "Pengaturan",
    shortLabel: "Setelan",
    icon: Settings,
    group: "Sistem",
  },
];

// 6 menu utama pada Floating Top Pill ala Dashboard V14
const TOP_PILL_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/proyek", label: "Proyek" },
  { href: "/jadwal", label: "Jadwal" },
  { href: "/buat-pr", label: "Buat PR" },
  { href: "/machine-learning", label: "AI Sizing" },
  { href: "/prioritas", label: "Prioritas" },
];

export function AppShell({
  companyName,
  logoBase64,
  currentUser,
  children,
}: {
  companyName: string;
  logoBase64?: string | null;
  currentUser?: SessionUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [fontScale, setFontScale] = useState<FontScale>("large");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fontMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("pm_theme");
    const initialTheme: ThemeMode = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    applyThemeToDom(initialTheme);

    const saved = window.localStorage.getItem("pm_font_scale") as FontScale | null;
    const initialScale: FontScale =
      saved === "normal" || saved === "large" || saved === "xlarge"
        ? saved
        : "large";
    setFontScale(initialScale);
    document.documentElement.setAttribute("data-font-scale", initialScale);
  }, []);

  // Shortcut Ctrl+K / Cmd+K untuk Quick Navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setQuickOpen(false);
        setFontMenuOpen(false);
        setProfileMenuOpen(false);
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Tutup popover saat klik di luar
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      if (fontMenuRef.current && !fontMenuRef.current.contains(target)) {
        setFontMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function applyThemeToDom(next: ThemeMode) {
    if (next === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }

  function changeTheme(next: ThemeMode) {
    setTheme(next);
    applyThemeToDom(next);
    window.localStorage.setItem("pm_theme", next);
  }

  function changeFontScale(next: FontScale) {
    setFontScale(next);
    document.documentElement.setAttribute("data-font-scale", next);
    window.localStorage.setItem("pm_font_scale", next);
    setFontMenuOpen(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleInstallPwa() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    if (href === "/jadwal") {
      return (
        pathname === "/jadwal" ||
        (pathname.startsWith("/jadwal/") && !pathname.startsWith("/jadwal/buat"))
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const filteredQuickItems = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.group.toLowerCase().includes(q) ||
        it.href.toLowerCase().includes(q)
    );
  }, [quickQuery]);

  const shortCompany = useMemo(() => {
    const cleaned = (companyName || "Twintech").replace(/^PT\.?\s*/i, "").trim();
    return cleaned.split(/\s+/)[0] || "Twintech";
  }, [companyName]);

  return (
    <div className="min-h-screen flex flex-col w-full overflow-x-hidden min-w-0">
      {/* ==================== DESKTOP TOP FLOATING HEADER BAR ==================== */}
      <header className="hidden lg:block sticky top-0 z-40 pt-3.5 pb-2 px-5 xl:px-7 bg-[#f4f5f7]/85 dark:bg-[#0d0e12]/85 backdrop-blur-md transition-colors duration-300">
        <div className="max-w-[1680px] mx-auto flex items-center justify-between gap-4">
          {/* Left Floating Brand Pill */}
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-full bg-white dark:bg-[#16181f] border border-black/[0.06] dark:border-white/[0.08] pl-2 pr-4 py-1.5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:shadow-md transition-all shrink-0"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F45B38] to-[#D9381E] flex items-center justify-center shadow-xs shrink-0 text-white font-black text-sm tracking-tighter">
              T
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                {shortCompany}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Monitoring
              </div>
            </div>
          </Link>

          {/* Center Floating Pill Nav Tabs */}
          <nav
            aria-label="Navigasi Utama"
            className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-[#16181f] border border-black/[0.06] dark:border-white/[0.08] p-1.5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition-colors duration-300"
          >
            {TOP_PILL_ITEMS.map((tab) => {
              const active = isActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    active
                      ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216] shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.08]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Utility & Profile Pills */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Utility Icon Pill */}
            <div className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-[#16181f] border border-black/[0.06] dark:border-white/[0.08] p-1.5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <button
                type="button"
                onClick={() => {
                  setQuickQuery("");
                  setQuickOpen(true);
                }}
                title="Cari Menu / Cepat Lompat (Ctrl+K)"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Font Scale Selector */}
              <div className="relative" ref={fontMenuRef}>
                <button
                  type="button"
                  onClick={() => setFontMenuOpen((v) => !v)}
                  title="Ubah Ukuran Teks"
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                    fontMenuOpen
                      ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216]"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08]"
                  }`}
                >
                  <Type className="w-4 h-4" />
                </button>
                {fontMenuOpen && (
                  <div className="absolute right-0 mt-2.5 w-44 rounded-2xl bg-white dark:bg-[#1b1e27] border border-black/[0.08] dark:border-white/[0.1] shadow-xl p-2 z-50">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2.5 py-1">
                      Ukuran Teks
                    </div>
                    {(
                      [
                        ["normal", "Normal (16px)"],
                        ["large", "Besar (18px)"],
                        ["xlarge", "Ekstra (19.5px)"],
                      ] as const
                    ).map(([scaleKey, label]) => (
                      <button
                        key={scaleKey}
                        type="button"
                        onClick={() => changeFontScale(scaleKey)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          fontScale === scaleKey
                            ? "bg-[#F05232] text-white"
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/pengaturan"
                title="Pengaturan Aplikasi"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                  isActive("/pengaturan")
                    ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216]"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08]"
                }`}
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>

            {/* Workspace Profile Pill + Quick Drawer Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2.5 rounded-full bg-white dark:bg-[#16181f] border border-black/[0.06] dark:border-white/[0.08] pl-1.5 pr-3 py-1.5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:shadow-md transition cursor-pointer"
              >
                <span
                  className={`w-7 h-7 rounded-full text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 shadow-xs ${
                    currentUser?.role === "ADMIN"
                      ? "bg-gradient-to-br from-[#F45B38] to-[#D9381E]"
                      : currentUser?.username === "rajip"
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                      : "bg-gradient-to-br from-sky-500 to-blue-600"
                  }`}
                >
                  {currentUser?.avatarText ?? "TP"}
                </span>
                <div className="text-left leading-tight hidden xl:block">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{currentUser?.nama ?? "Engineering"}</span>
                    {currentUser?.role === "ADMIN" ? (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-[#F05232]">
                        Admin
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400">
                        Member
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                    {currentUser?.jabatan ?? companyName}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2.5 w-72 rounded-2xl bg-white dark:bg-[#1b1e27] border border-black/[0.08] dark:border-white/[0.1] shadow-xl p-2.5 z-50 space-y-2">
                  {/* Active User Card */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] flex items-center gap-3">
                    <span
                      className={`w-10 h-10 rounded-xl text-white text-sm font-extrabold flex items-center justify-center shrink-0 shadow-sm ${
                        currentUser?.role === "ADMIN"
                          ? "bg-gradient-to-br from-[#F45B38] to-[#D9381E]"
                          : currentUser?.username === "rajip"
                          ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                          : "bg-gradient-to-br from-sky-500 to-blue-600"
                      }`}
                    >
                      {currentUser?.avatarText ?? "TP"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          {currentUser?.nama ?? "Engineering"}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            currentUser?.role === "ADMIN"
                              ? "bg-[#F05232] text-white"
                              : "bg-sky-500 text-white"
                          }`}
                        >
                          {currentUser?.role === "ADMIN" ? "Admin" : "Member"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {currentUser?.jabatan ?? companyName}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 px-1 uppercase tracking-wider">
                    {currentUser?.role === "ADMIN" ? "Menu Admin & Penjadwalan" : "Menu Member"}
                  </div>

                  {currentUser?.role === "ADMIN" ? (
                    <>
                      <Link
                        href="/jadwal/buat"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
                      >
                        <CalendarPlus className="w-4 h-4 text-[#F05232]" />
                        <div>
                          <div>Buat &amp; Jadwalkan Proyek</div>
                          <div className="text-[10px] text-slate-400 font-normal">Tentukan tanggal &amp; delegasi PIC</div>
                        </div>
                      </Link>
                      <Link
                        href="/import-schedule"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
                      >
                        <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        Import Schedule Excel
                      </Link>
                      <Link
                        href="/import-pr"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        Import PR Excel
                      </Link>
                      <Link
                        href="/template"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
                      >
                        <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        Template Pekerjaan
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
                      >
                        <LayoutDashboard className="w-4 h-4 text-sky-500" />
                        <div>
                          <div>Notifikasi Pekerjaan Hari Ini</div>
                          <div className="text-[10px] text-slate-400 font-normal">Lihat tugas yang diberikan Admin Faruq</div>
                        </div>
                      </Link>
                      <Link
                        href="/jadwal"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
                      >
                        <CalendarDays className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        Jadwal &amp; Kalender Proyek
                      </Link>
                    </>
                  )}

                  <Link
                    href="/pengaturan#keamanan"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    <div>
                      <div>Ubah Username &amp; Password</div>
                      <div className="text-[10px] text-slate-400 font-normal">Pengaturan kredensial akun</div>
                    </div>
                  </Link>

                  {installPrompt && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void handleInstallPwa();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Pasang Aplikasi (PWA)
                    </button>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-white/[0.08]">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Ganti Akun / Keluar Sesi
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ==================== DESKTOP LEFT FLOATING ICON RAIL ==================== */}
      <aside
        aria-label="Rail Alat & Navigasi"
        className="hidden lg:flex flex-col justify-between fixed left-4 xl:left-5 top-[78px] bottom-5 z-40 w-[52px] pointer-events-none"
      >
        <div className="flex flex-col items-center gap-3">
          {/* Pill 1: Light / Dark Theme Switcher */}
          <div className="pointer-events-auto rounded-full bg-white dark:bg-[#16181f] border border-black/[0.06] dark:border-white/[0.08] p-1 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col gap-1 transition-colors duration-300">
            <button
              type="button"
              onClick={() => changeTheme("light")}
              title="Mode Terang (Light)"
              aria-label="Aktifkan Mode Terang"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                theme === "light"
                  ? "bg-[#141518] text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => changeTheme("dark")}
              title="Mode Gelap (Dark)"
              aria-label="Aktifkan Mode Gelap"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-white text-[#111216] shadow-xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>

          {/* Pill 2: Main Route Icons Rail */}
          <nav className="pointer-events-auto rounded-[28px] bg-white dark:bg-[#16181f] border border-black/[0.06] dark:border-white/[0.08] p-1 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col gap-1 transition-colors duration-300 max-h-[calc(100vh-280px)] overflow-y-auto overflow-x-visible no-scrollbar">
            {NAV_ITEMS.slice(0, 10).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const isCreateBtn = item.href === "/jadwal/buat";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={`group relative w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    active
                      ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216] shadow-xs"
                      : isCreateBtn
                        ? "text-[#F05232] bg-[#F05232]/10 hover:bg-[#F05232] hover:text-white"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 fixed left-[76px] px-3 py-1.5 rounded-full bg-[#141518] dark:bg-white text-white dark:text-[#111216] text-xs font-bold whitespace-nowrap shadow-lg z-50">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Pill 3: Bottom Utility & Logout */}
        <div className="pointer-events-auto rounded-full bg-white dark:bg-[#16181f] border border-black/[0.06] dark:border-white/[0.08] p-1 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col gap-1 transition-colors duration-300">
          <Link
            href="/pengaturan"
            aria-label="Pengaturan"
            className={`group relative w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isActive("/pengaturan")
                ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216]"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 fixed left-[76px] px-3 py-1.5 rounded-full bg-[#141518] dark:bg-white text-white dark:text-[#111216] text-xs font-bold whitespace-nowrap shadow-lg z-50">
              Pengaturan
            </span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Keluar Sesi"
            className="group relative w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 fixed left-[76px] px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-bold whitespace-nowrap shadow-lg z-50">
              Keluar Sesi
            </span>
          </button>
        </div>
      </aside>

      {/* ==================== MOBILE FLOATING TOP BAR ==================== */}
      <header className="lg:hidden sticky top-0 z-40 px-3 pt-2.5 pb-1.5 bg-[#f4f5f7]/90 dark:bg-[#0d0e12]/90 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 rounded-full bg-white dark:bg-[#16181f] border border-black/[0.06] dark:border-white/[0.08] px-2.5 py-1.5 shadow-xs">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#F45B38] to-[#D9381E] text-white font-black text-xs flex items-center justify-center shrink-0">
              T
            </div>
            <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
              {shortCompany}
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => changeTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Ganti Tema"
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200 flex items-center justify-center"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                changeFontScale(
                  fontScale === "normal"
                    ? "large"
                    : fontScale === "large"
                      ? "xlarge"
                      : "normal"
                )
              }
              className="px-2.5 h-8 rounded-full bg-slate-100 dark:bg-white/[0.08] text-[11px] font-extrabold text-slate-700 dark:text-slate-200"
            >
              A+
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu Lengkap"
              className="w-8 h-8 rounded-full bg-[#141518] dark:bg-white text-white dark:text-[#111216] flex items-center justify-center"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <main className="flex-1 min-w-0 max-w-full lg:pl-[86px] lg:pr-6 pb-24 lg:pb-10 transition-all duration-300">
        <div className="w-full max-w-[1680px] mx-auto px-3.5 sm:px-5 lg:px-3 pt-3 lg:pt-2 min-w-0">
          {children}
        </div>
      </main>

      {/* ==================== MOBILE FLOATING BOTTOM NAV ==================== */}
      <nav className="lg:hidden fixed bottom-2.5 inset-x-3 z-40 rounded-2xl bg-white/95 dark:bg-[#16181f]/95 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.1] shadow-xl grid grid-cols-5 px-1.5 py-1.5">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-semibold transition ${
                active
                  ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216]"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate max-w-[60px]">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>

      {/* ==================== MODAL QUICK SEARCH / COMMAND PALETTE (Ctrl+K) ==================== */}
      {quickOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-xs p-4 pt-20"
          onClick={() => setQuickOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#16181f] border border-black/[0.08] dark:border-white/[0.1] shadow-2xl overflow-hidden animate-v14-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-white/[0.08]">
              <Search className="w-4 h-4 text-[#F05232] shrink-0" />
              <input
                type="text"
                autoFocus
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredQuickItems.length > 0) {
                    router.push(filteredQuickItems[0].href);
                    setQuickOpen(false);
                  }
                }}
                placeholder="Lompat cepat ke halaman atau modul (mis. PR, Jadwal, Proyek)..."
                className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
              />
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.08] text-[10px] font-bold text-slate-500">
                <Command className="w-2.5 h-2.5" /> K
              </span>
              <button
                type="button"
                onClick={() => setQuickOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredQuickItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setQuickOpen(false)}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl transition ${
                      active
                        ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216]"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-bold truncate">
                        {item.label}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        active
                          ? "bg-white/20 text-white dark:bg-black/10 dark:text-black"
                          : "bg-slate-100 dark:bg-white/[0.07] text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {item.group}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MOBILE FULL MENU DRAWER ==================== */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-80 max-w-[85vw] h-full bg-white dark:bg-[#16181f] p-4 flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
                <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {companyName}
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Active User Banner */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 flex items-center gap-3">
                <span
                  className={`w-9 h-9 rounded-xl text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs ${
                    currentUser?.role === "ADMIN"
                      ? "bg-gradient-to-br from-[#F45B38] to-[#D9381E]"
                      : currentUser?.username === "rajip"
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                      : "bg-gradient-to-br from-sky-500 to-blue-600"
                  }`}
                >
                  {currentUser?.avatarText ?? "TP"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {currentUser?.nama ?? "Engineering"}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full ${
                        currentUser?.role === "ADMIN"
                          ? "bg-[#F05232] text-white"
                          : "bg-sky-500 text-white"
                      }`}
                    >
                      {currentUser?.role === "ADMIN" ? "Admin" : "Member"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser?.jabatan ?? "Sistem Aktif"}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition ${
                        active
                          ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216]"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07]"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] space-y-2">
              {installPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void handleInstallPwa();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-emerald-600 text-white text-xs font-bold"
                >
                  <Download className="w-4 h-4" />
                  Pasang Aplikasi (PWA)
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-bold"
              >
                <LogOut className="w-4 h-4" />
                Keluar Sesi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
