"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import {
  BrainCircuit,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Command,
  Download,
  FileSpreadsheet,
  FolderKanban,
  GitFork,
  Home,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
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

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: any;
  badge?: string;
  shortcut?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main Menu",
    items: [
      {
        href: "/",
        label: "Dashboard",
        shortLabel: "Home",
        icon: LayoutDashboard,
      },
      {
        href: "/proyek",
        label: "Manajemen Proyek",
        shortLabel: "Proyek",
        icon: FolderKanban,
      },
      {
        href: "/jadwal",
        label: "Jadwal & Kalender",
        shortLabel: "Jadwal",
        icon: CalendarDays,
      },
      {
        href: "/buat-pr",
        label: "Komponen PR",
        shortLabel: "PR",
        icon: ClipboardList,
      },
    ],
  },
  {
    title: "Favourites & AI",
    items: [
      {
        href: "/prioritas",
        label: "Prioritas Minggu Ini",
        shortLabel: "Prioritas",
        icon: ListOrdered,
      },
      {
        href: "/machine-learning",
        label: "Machine Learning",
        shortLabel: "AI Sizing",
        icon: BrainCircuit,
        badge: "AI",
      },
      {
        href: "/template",
        label: "Template Pekerjaan",
        shortLabel: "Template",
        icon: Layers,
      },
    ],
  },
  {
    title: "Import & Tools",
    items: [
      {
        href: "/jadwal/buat",
        label: "Buat Schedule Proyek",
        shortLabel: "Buat Sch",
        icon: CalendarPlus,
      },
      {
        href: "/import-schedule",
        label: "Import Schedule Excel",
        shortLabel: "Import Sch",
        icon: Upload,
      },
      {
        href: "/import-pr",
        label: "Import PR Excel",
        shortLabel: "Import PR",
        icon: FileSpreadsheet,
      },
      {
        href: "/convert-flowchart",
        label: "Konversi Flowchart",
        shortLabel: "Flowchart",
        icon: GitFork,
      },
    ],
  },
  {
    title: "Sistem",
    items: [
      {
        href: "/pengaturan",
        label: "Pengaturan",
        shortLabel: "Setelan",
        icon: Settings,
      },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((sec) => sec.items);

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [primaryActionOpen, setPrimaryActionOpen] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [fontScale, setFontScale] = useState<FontScale>("large");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryActionRef = useRef<HTMLDivElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Theme preference
    const savedTheme = window.localStorage.getItem("pm_theme");
    const initialTheme: ThemeMode = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    applyThemeToDom(initialTheme);

    // Font Scale preference
    const savedScale = window.localStorage.getItem(
      "pm_font_scale"
    ) as FontScale | null;
    const initialScale: FontScale =
      savedScale === "normal" || savedScale === "large" || savedScale === "xlarge"
        ? savedScale
        : "large";
    setFontScale(initialScale);
    document.documentElement.setAttribute("data-font-scale", initialScale);

    // Sidebar preference
    const savedCollapsed = window.localStorage.getItem("pm_sidebar_collapsed");
    if (savedCollapsed === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  // Shortcut Ctrl+K / Cmd+K untuk Quick Search Command Palette
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setQuickOpen(false);
        setPrimaryActionOpen(false);
        setFontMenuOpen(false);
        setProfileMenuOpen(false);
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Tutup popup saat klik di luar
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        primaryActionRef.current &&
        !primaryActionRef.current.contains(target)
      ) {
        setPrimaryActionOpen(false);
      }
      if (fontMenuRef.current && !fontMenuRef.current.contains(target)) {
        setFontMenuOpen(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target)
      ) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Tangkap prompt PWA Install
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

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
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

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("pm_sidebar_collapsed", String(next));
      return next;
    });
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
    if (!q) return ALL_NAV_ITEMS;
    return ALL_NAV_ITEMS.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.href.toLowerCase().includes(q)
    );
  }, [quickQuery]);

  const shortCompany = useMemo(() => {
    const cleaned = (companyName || "Twintech").replace(/^PT\.?\s*/i, "").trim();
    return cleaned.split(/\s+/)[0] || "Twintech";
  }, [companyName]);

  // Breadcrumbs Engine cerdas
  const breadcrumbs = useMemo(() => {
    if (!pathname || pathname === "/") {
      return [{ label: "Workspace", href: "/" }, { label: "Overview" }];
    }
    if (pathname === "/proyek") {
      return [{ label: "Workspace", href: "/" }, { label: "Manajemen Proyek" }];
    }
    if (pathname.startsWith("/proyek/")) {
      return [
        { label: "Workspace", href: "/" },
        { label: "Proyek", href: "/proyek" },
        { label: "Detail Proyek" },
      ];
    }
    if (pathname === "/jadwal") {
      return [{ label: "Workspace", href: "/" }, { label: "Jadwal & Kalender" }];
    }
    if (pathname === "/jadwal/buat") {
      return [
        { label: "Workspace", href: "/" },
        { label: "Jadwal", href: "/jadwal" },
        { label: "Buat Schedule" },
      ];
    }
    if (pathname.startsWith("/jadwal/lane/")) {
      return [
        { label: "Workspace", href: "/" },
        { label: "Jadwal", href: "/jadwal" },
        { label: "Lane Detail" },
      ];
    }
    if (pathname === "/buat-pr") {
      return [{ label: "Workspace", href: "/" }, { label: "Komponen PR" }];
    }
    if (pathname === "/import-pr") {
      return [
        { label: "Workspace", href: "/" },
        { label: "Komponen PR", href: "/buat-pr" },
        { label: "Import Excel" },
      ];
    }
    if (pathname === "/import-schedule") {
      return [
        { label: "Workspace", href: "/" },
        { label: "Jadwal", href: "/jadwal" },
        { label: "Import Excel" },
      ];
    }
    if (pathname === "/machine-learning") {
      return [
        { label: "Workspace", href: "/" },
        { label: "Machine Learning (AI Sizing)" },
      ];
    }
    if (pathname === "/prioritas") {
      return [
        { label: "Workspace", href: "/" },
        { label: "Prioritas Minggu Ini" },
      ];
    }
    if (pathname === "/template") {
      return [
        { label: "Workspace", href: "/" },
        { label: "Template Pekerjaan" },
      ];
    }
    if (pathname === "/convert-flowchart") {
      return [
        { label: "Workspace", href: "/" },
        { label: "Konversi Flowchart" },
      ];
    }
    if (pathname === "/pengaturan") {
      return [
        { label: "Workspace", href: "/" },
        { label: "Pengaturan Sistem" },
      ];
    }
    return [{ label: "Workspace", href: "/" }, { label: pathname.replace("/", "") }];
  }, [pathname]);

  return (
    <div className="min-h-screen flex w-full bg-[#f8f9fa] dark:bg-[#0f1117] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* ==================== DESKTOP MODERN LEFT SIDEBAR ==================== */}
      <aside
        aria-label="Sidebar Navigasi"
        className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-40 bg-white dark:bg-[#12141a] border-r border-slate-200/70 dark:border-white/[0.08] transition-all duration-200 ease-out select-none ${
          sidebarCollapsed ? "w-[72px]" : "w-64"
        }`}
      >
        {/* 1. Workspace Identity Header */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 min-w-0 rounded-xl p-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition group"
            title={`${companyName} - Workspace`}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F45B38] to-[#D9381E] flex items-center justify-center shadow-xs text-white font-black text-sm shrink-0 tracking-tight">
              T
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 leading-tight">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-[#F05232] transition">
                  {companyName}
                </div>
                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Electrical Suite</span>
                </div>
              </div>
            )}
          </Link>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Ciutkan Sidebar (Collapse)"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 2. Primary Action Button ("+ Buat Baru") */}
        <div className="p-3 border-b border-slate-100 dark:border-white/[0.06] shrink-0 relative" ref={primaryActionRef}>
          {!sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setPrimaryActionOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-xs hover:shadow-md hover:bg-neutral-800 dark:hover:bg-slate-100 transition-all duration-180 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-[#F05232] text-white flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span>Buat Baru</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-600 transition-transform duration-180 ${
                  primaryActionOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPrimaryActionOpen((v) => !v)}
              title="Buat Baru"
              className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs hover:shadow-md cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* Primary Action Dropdown Popover */}
          {primaryActionOpen && (
            <div
              className={`absolute top-full mt-1.5 w-60 rounded-2xl bg-white dark:bg-[#1a1c26] border border-slate-200/80 dark:border-white/10 shadow-xl p-1.5 z-50 animate-v14-in ${
                sidebarCollapsed ? "left-3" : "left-3 right-3"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2.5 py-1">
                Tindakan Cepat
              </div>
              <Link
                href="/proyek?action=baru"
                onClick={() => setPrimaryActionOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.08] transition"
              >
                <FolderKanban className="w-4 h-4 text-[#F05232]" />
                <div>
                  <div className="font-bold">Proyek Baru</div>
                  <div className="text-[10px] text-slate-400 font-normal">Buat proyek otomasi baru</div>
                </div>
              </Link>
              <Link
                href="/jadwal/buat"
                onClick={() => setPrimaryActionOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.08] transition"
              >
                <CalendarPlus className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="font-bold">Schedule Proyek</div>
                  <div className="text-[10px] text-slate-400 font-normal">Jadwalkan lane & tanggal kerja</div>
                </div>
              </Link>
              <Link
                href="/buat-pr"
                onClick={() => setPrimaryActionOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.08] transition"
              >
                <ClipboardList className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="font-bold">Susun PR dari Katalog</div>
                  <div className="text-[10px] text-slate-400 font-normal">Pilih part elektrikal cepat</div>
                </div>
              </Link>
              <div className="my-1 border-t border-slate-100 dark:border-white/[0.06]" />
              <Link
                href="/import-schedule"
                onClick={() => setPrimaryActionOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.08] transition"
              >
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span>Import Schedule Excel</span>
              </Link>
              <Link
                href="/import-pr"
                onClick={() => setPrimaryActionOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.08] transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                <span>Import PR Excel</span>
              </Link>
            </div>
          )}
        </div>

        {/* 3. Grouped Navigation Sections */}
        <nav
          aria-label="Menu Navigasi Sidebar"
          className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 no-scrollbar"
        >
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={section.title} className="space-y-1">
              {!sidebarCollapsed ? (
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1">
                  {section.title}
                </div>
              ) : (
                sIdx > 0 && (
                  <div className="w-6 mx-auto my-2 border-t border-slate-200/60 dark:border-white/[0.08]" />
                )
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                        sidebarCollapsed ? "justify-center px-0" : ""
                      } ${
                        active
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs font-bold"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                          active
                            ? "text-white dark:text-slate-900"
                            : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                        }`}
                      />

                      {!sidebarCollapsed && (
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                                active
                                  ? "bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900"
                                  : "bg-[#F05232]/10 text-[#F05232] dark:bg-[#F05232]/20"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Floating tooltip saat collapsed */}
                      {sidebarCollapsed && (
                        <span className="pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 fixed left-[80px] px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold whitespace-nowrap shadow-xl z-50">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 4. Footer Sidebar / User Profile Card */}
        <div className="p-3 border-t border-slate-100 dark:border-white/[0.06] shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="relative" ref={profileMenuRef}>
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition group">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span
                    className={`w-8 h-8 rounded-full text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 shadow-xs ring-2 ring-white dark:ring-[#12141a] ${
                      currentUser?.role === "ADMIN"
                        ? "bg-gradient-to-br from-[#F45B38] to-[#D9381E]"
                        : currentUser?.username === "rajip"
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                        : "bg-gradient-to-br from-sky-500 to-blue-600"
                    }`}
                  >
                    {currentUser?.avatarText ?? "TP"}
                  </span>
                  <div className="min-w-0 leading-tight">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      <span>{currentUser?.nama ?? "Engineering"}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {currentUser?.role === "ADMIN" ? "Admin" : "Member"} • {currentUser?.jabatan ?? "Twintech"}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.1] transition cursor-pointer"
                  >
                    {theme === "dark" ? (
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Moon className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((v) => !v)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                title={currentUser?.nama ?? "Akun Pengguna"}
                className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
              >
                <span
                  className={`w-8 h-8 rounded-full text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 shadow-xs ring-2 ring-white dark:ring-[#12141a] ${
                    currentUser?.role === "ADMIN"
                      ? "bg-gradient-to-br from-[#F45B38] to-[#D9381E]"
                      : currentUser?.username === "rajip"
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                      : "bg-gradient-to-br from-sky-500 to-blue-600"
                  }`}
                >
                  {currentUser?.avatarText ?? "TP"}
                </span>
              </button>
            )}

            {/* Profile Menu Popover */}
            {profileMenuOpen && (
              <div
                className={`absolute bottom-full mb-2 w-72 rounded-2xl bg-white dark:bg-[#1a1c26] border border-slate-200/80 dark:border-white/10 shadow-2xl p-2.5 z-50 animate-v14-in ${
                  sidebarCollapsed ? "left-2" : "left-0"
                }`}
              >
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] flex items-center gap-3">
                  <span
                    className={`w-9 h-9 rounded-xl text-white text-xs font-extrabold flex items-center justify-center shrink-0 shadow-xs ${
                      currentUser?.role === "ADMIN"
                        ? "bg-gradient-to-br from-[#F45B38] to-[#D9381E]"
                        : currentUser?.username === "rajip"
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                        : "bg-gradient-to-br from-sky-500 to-blue-600"
                    }`}
                  >
                    {currentUser?.avatarText ?? "TP"}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {currentUser?.nama ?? "Engineering"}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {currentUser?.role === "ADMIN" ? "Admin Akses Penuh" : "Member"} • {currentUser?.jabatan ?? companyName}
                    </div>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  <Link
                    href="/pengaturan#keamanan"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ubah Username &amp; Password</span>
                  </Link>

                  {installPrompt && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void handleInstallPwa();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 cursor-pointer transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Pasang Aplikasi (PWA)</span>
                    </button>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar Sesi</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ==================== MAIN PAGE WRAPPER ==================== */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-out ${
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64"
        }`}
      >
        {/* ==================== STICKY TOP BAR (Breadcrumbs + Search + Utilities) ==================== */}
        <header className="sticky top-0 z-30 h-14 bg-white/80 dark:bg-[#12141a]/80 backdrop-blur-md border-b border-slate-200/70 dark:border-white/[0.08] px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors">
          {/* Left: Sidebar Toggle + Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                title="Buka Sidebar (Expand)"
                className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka Menu Navigasi"
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Breadcrumbs Navigation */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
              <Link
                href="/"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition shrink-0"
                title="Home"
              >
                <Home className="w-3.5 h-3.5" />
              </Link>
              {breadcrumbs.map((bc, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <div key={bc.label} className="flex items-center gap-1.5 min-w-0">
                    <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                    {bc.href && !isLast ? (
                      <Link
                        href={bc.href}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium truncate transition"
                      >
                        {bc.label}
                      </Link>
                    ) : (
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {bc.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Right: Search Pill + Quick Utilities */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Search Pill (Command Palette Trigger) */}
            <button
              type="button"
              onClick={() => {
                setQuickQuery("");
                setQuickOpen(true);
              }}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200/60 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400 transition cursor-pointer w-44 sm:w-56 md:w-64 justify-between group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition" />
                <span className="truncate">Cari cepat...</span>
              </div>
              <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono font-bold bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded-md text-slate-400">
                ⌘K
              </span>
            </button>

            {/* Font Scale Button */}
            <div className="relative" ref={fontMenuRef}>
              <button
                type="button"
                onClick={() => setFontMenuOpen((v) => !v)}
                title="Ubah Ukuran Teks"
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition cursor-pointer ${
                  fontMenuOpen
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08]"
                }`}
              >
                <Type className="w-4 h-4" />
              </button>

              {fontMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-white dark:bg-[#1a1c26] border border-slate-200/80 dark:border-white/10 shadow-xl p-1.5 z-50 animate-v14-in">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2.5 py-1">
                    Skala Teks
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
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                        fontScale === scaleKey
                          ? "bg-[#F05232] text-white"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <span>{label}</span>
                      {fontScale === scaleKey && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Top Bar User Avatar */}
            <Link
              href="/pengaturan"
              title={`${currentUser?.nama ?? "Engineering"} • Pengaturan`}
              className="flex items-center gap-2 pl-1.5 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.08] transition"
            >
              <span
                className={`w-7 h-7 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 shadow-xs ring-2 ring-white dark:ring-[#12141a] ${
                  currentUser?.role === "ADMIN"
                    ? "bg-gradient-to-br from-[#F45B38] to-[#D9381E]"
                    : currentUser?.username === "rajip"
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                    : "bg-gradient-to-br from-sky-500 to-blue-600"
                }`}
              >
                {currentUser?.avatarText ?? "TP"}
              </span>
            </Link>
          </div>
        </header>

        {/* ==================== CONTENT BODY ==================== */}
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 max-w-[1720px] w-full mx-auto min-w-0 transition-all duration-200">
          {children}
        </main>
      </div>

      {/* ==================== MODAL QUICK COMMAND PALETTE (Ctrl+K) ==================== */}
      {quickOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-xs p-4 pt-16 sm:pt-24"
          onClick={() => setQuickOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#161822] border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden animate-v14-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
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
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.08] text-[10px] font-mono text-slate-500">
                <Command className="w-2.5 h-2.5" /> K
              </span>
              <button
                type="button"
                onClick={() => setQuickOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredQuickItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Tidak ditemukan halaman atau fitur yang sesuai.
                </div>
              ) : (
                filteredQuickItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setQuickOpen(false)}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                        active
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-semibold truncate">
                          {item.label}
                        </span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F05232]/10 text-[#F05232]">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MOBILE MENU DRAWER ==================== */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-start"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 max-w-[85vw] h-full bg-white dark:bg-[#12141a] p-4 flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F45B38] to-[#D9381E] flex items-center justify-center text-white font-black text-xs">
                    T
                  </div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {companyName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg bg-slate-100 dark:bg-white/[0.08]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Info Mobile */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] flex items-center gap-2.5">
                <span
                  className={`w-7 h-7 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                    currentUser?.role === "ADMIN"
                      ? "bg-gradient-to-br from-[#F45B38] to-[#D9381E]"
                      : currentUser?.username === "rajip"
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                      : "bg-gradient-to-br from-sky-500 to-blue-600"
                  }`}
                >
                  {currentUser?.avatarText ?? "TP"}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.nama ?? "Engineering"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {currentUser?.role === "ADMIN" ? "Admin" : "Member"}
                  </div>
                </div>
              </div>

              {/* Navigation Links Mobile */}
              <div className="space-y-3">
                {NAV_SECTIONS.map((section) => (
                  <div key={section.title} className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-0.5">
                      {section.title}
                    </div>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                            active
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Sesi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
