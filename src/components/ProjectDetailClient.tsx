"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Check,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Cpu,
  Download,
  FileSpreadsheet,
  Grid,
  Layers,
  Lock,
  Plus,
  Search,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import {
  ARRIVED_PURCHASE_STATUSES,
  isLightHexColor,
  PURCHASE_STATUSES,
  PURCHASE_STATUS_LABELS,
  SCHEDULE_CELL_LABELS,
  SCHEDULE_STATUS_RGB,
  WORK_TYPE_LABELS,
  type ComponentImportStatus,
  type PrStatus,
  type ProjectPriority,
  type ProjectStatus,
  type PurchaseStatus,
  type ScheduleCellStatus,
  type WorkType,
} from "@/lib/constants";
import { CatalogAutocompleteInput } from "@/components/CatalogAutocompleteInput";
import { PlcAddressTablePanel } from "@/components/PlcAddressTablePanel";
import type { CatalogComponentDTO } from "@/lib/catalog-queries";
import { formatRupiah, formatTanggalId } from "@/lib/date-utils";
import { formatCatalogItemForPr } from "@/lib/pr-catalog-default";
import type { UserRole } from "@/lib/users";
import {
  computeChecklistProgress,
  deriveChecklistDetection,
  parseFileChecklistJson,
  type FileChecklistState,
} from "@/lib/project-checklist";
import { ELECTRICAL_CHECKLIST_CATEGORIES } from "@/lib/electrical-checklist";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectHeroHeader } from "./ProjectHeroHeader";
import { ProjectFlowchartPngViewer } from "./ProjectFlowchartPngViewer";
import { ProjectWiringPdfPanel } from "./ProjectWiringPdfPanel";
import { ProjectControlPanelLayoutEditor } from "./ProjectControlPanelLayoutEditor";
import {
  ProjectFileChecklistCard,
  type ProjectDetailTabKey,
} from "./ProjectFileChecklistCard";
import { ProjectPlcProgramPanel } from "./ProjectPlcProgramPanel";
import { ProjectHmiProgramPanel } from "./ProjectHmiProgramPanel";

interface ComponentDTO {
  id: string;
  projectId: string;
  urutan: number;
  kelompok: string;
  noPr: string | null;
  partType: string;
  partName: string;
  supplier: string | null;
  qty: number;
  unit: string | null;
  catatanPr: string | null;
  tanggalPakai: string | null;
  hargaSatuan: number | null;
  hargaRaw: string | null;
  total: number | null;
  statusPembelian: PurchaseStatus;
  estimasiTiba: string | null;
  perluDicek: boolean;
  alasanDicek: string | null;
  statusImport: ComponentImportStatus;
  catatan: string | null;
}

interface LaneDTO {
  id: string;
  projectId: string;
  urutan: number;
  nama: string;
  subjudul: string;
  tanggalMulai: string;
  jumlahHari: number;
  deadline?: string | null;
  pic?: string | null;
  workItems: {
    id: string;
    urutan: number;
    jenis: WorkType;
    judul: string;
    bolehParalel: boolean;
    pic?: string | null;
    deadline?: string | null;
    subScopes: {
      id: string;
      judul: string;
      details: { id: string; teks: string }[];
    }[];
    scheduleCells: {
      id: string;
      tanggal: string;
      status: ScheduleCellStatus;
      warnaCustom?: string | null;
      catatan: string | null;
    }[];
  }[];
}

interface ProjectDetailDTO {
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
  plcAddressesJson?: string | null;
  gambarUrl?: string | null;
  flowSequenceJson?: string | null;
  wiringDiagramPdfUrl?: string | null;
  wiringDiagramPdfName?: string | null;
  plcProgramFileUrl?: string | null;
  plcProgramFileName?: string | null;
  plcProgramFileSize?: number | null;
  hmiProgramFileUrl?: string | null;
  hmiProgramFileName?: string | null;
  hmiProgramFileSize?: number | null;
  panelLayoutJson?: string | null;
  fileChecklistJson?: string | null;
  components: ComponentDTO[];
  prImports: {
    id: string;
    namaFile: string;
    tanggalRevisi: string | null;
    mode: string;
    createdAt: string;
  }[];
  lanes: LaneDTO[];
}

export function ProjectDetailClient({
  project,
  currentUserRole = "MEMBER",
  currentUserName = "Tim Engineering",
}: {
  project: ProjectDetailDTO;
  currentUserRole?: UserRole;
  currentUserName?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab: ProjectDetailTabKey =
    searchParams.get("tab") === "komponen"
      ? "komponen"
      : searchParams.get("tab") === "jadwal"
        ? "jadwal"
        : searchParams.get("tab") === "plc" || searchParams.get("tab") === "pengelamatan-plc"
          ? "pengelamatan-plc"
          : searchParams.get("tab") === "layout-panel" || searchParams.get("tab") === "panel"
            ? "layout-panel"
            : "alur-sekuens";

  const [tab, setTab] = useState<ProjectDetailTabKey>(initialTab);
  // Sub-accordions di dalam tab Flowchart, Wiring & Program (default tertutup saat awal):
  const [openAlurSubSections, setOpenAlurSubSections] = useState<Set<string>>(
    () => new Set()
  );
  const toggleAlurSubSection = (key: string) => {
    setOpenAlurSubSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Sub-accordions per kelompok di dalam tab Komponen PR (default tertutup saat awal):
  const [openCompGroups, setOpenCompGroups] = useState<Set<string>>(
    () => new Set()
  );
  const toggleCompGroup = (grp: string) => {
    setOpenCompGroups((prev) => {
      const next = new Set(prev);
      if (next.has(grp)) next.delete(grp);
      else next.add(grp);
      return next;
    });
  };
  const navigateToChecklistTarget = (targetTab: ProjectDetailTabKey, itemKey?: string) => {
    setTab(targetTab);
    if (targetTab === "alur-sekuens") {
      let subKey = "flowchart";
      let elementId = "sub-flowchart";
      if (itemKey === "diagram_wiring") {
        subKey = "wiring";
        elementId = "sub-wiring";
      } else if (itemKey === "pemprograman") {
        const needsPlc = !project.plcProgramFileUrl;
        subKey = needsPlc ? "plc" : "hmi";
        elementId = needsPlc ? "sub-plc" : "sub-hmi";
        setOpenAlurSubSections((prev) => new Set([...prev, "plc", "hmi"]));
        setTimeout(() => {
          document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
        return;
      }
      setOpenAlurSubSections((prev) => new Set([...prev, subKey]));
      setTimeout(() => {
        document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } else {
      setTimeout(() => {
        document.getElementById("project-main-tab-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }
  };
  const [checklistState, setChecklistState] = useState<FileChecklistState>(() =>
    parseFileChecklistJson(project.fileChecklistJson)
  );
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Filter Komponen
  const [compSearch, setCompSearch] = useState("");
  const [compGroupFilter, setCompGroupFilter] = useState("ALL");
  const [compStatusFilter, setCompStatusFilter] = useState("ALL");
  const [compImportFilter, setCompImportFilter] = useState("ALL");
  const [onlyNeedsCheck, setOnlyNeedsCheck] = useState(
    searchParams.get("filter") === "check"
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<PurchaseStatus>("SUDAH_DATANG");
  const [bulkEta, setBulkEta] = useState("");
  const [busyComp, setBusyComp] = useState(false);
  const [showElectricalChecklist, setShowElectricalChecklist] = useState(false);

  // Modal Tambah Komponen Manual
  const [addCompOpen, setAddCompOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogComponentDTO[]>([]);
  const [newComp, setNewComp] = useState({
    kelompok: "Panel Utama",
    noPr: "",
    partType: "",
    partName: "",
    supplier: "",
    qty: 1,
    unit: "pcs",
    hargaSatuan: "",
    statusPembelian: "BELUM_PR" as PurchaseStatus,
    estimasiTiba: "",
    catatan: "",
  });

  useEffect(() => {
    if (!addCompOpen || catalogItems.length > 0) return;
    fetch("/api/catalog")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items) setCatalogItems(data.items);
      })
      .catch(() => {});
  }, [addCompOpen, catalogItems.length]);

  // Modal Tambah Lane
  const [addLaneOpen, setAddLaneOpen] = useState(false);
  const [newLane, setNewLane] = useState({
    nama: "",
    subjudul: "(Timeline Onsite & Commissioning)",
    tanggalMulai: project.tanggalMulai ?? "2026-11-02",
    jumlahHari: 6,
  });
  const [includeExportDates, setIncludeExportDates] = useState(false);

  const activeComps = project.components.filter(
    (c) => c.statusImport !== "HILANG_DI_REVISI"
  );
  const missingRevisionComps = project.components.filter(
    (c) => c.statusImport === "HILANG_DI_REVISI"
  );

  // Status kelengkapan 13 Kategori Part Elektrikal Mesin & Panel (agar tidak ada part yang terlupa)
  const electricalChecklistStatus = useMemo(() => {
    return ELECTRICAL_CHECKLIST_CATEGORIES.map((cat) => {
      const matchedComps = activeComps.filter((c) => cat.matcher(c));
      return {
        ...cat,
        isFulfilled: matchedComps.length > 0,
        count: matchedComps.length,
        items: matchedComps,
      };
    });
  }, [activeComps]);

  const electricalFulfilledCount = useMemo(() => {
    return electricalChecklistStatus.filter((c) => c.isFulfilled).length;
  }, [electricalChecklistStatus]);

  const totalSchedCells = project.lanes.reduce(
    (sum, l) =>
      sum + l.workItems.reduce((ws, w) => ws + w.scheduleCells.length, 0),
    0
  );
  const checklistDetection = deriveChecklistDetection({
    prStatus: project.prStatus,
    componentsCount: activeComps.length,
    lanesCount: project.lanes.length,
    scheduleCellsCount: totalSchedCells,
    plcAddressesJson: project.plcAddressesJson,
    panelLayoutJson: project.panelLayoutJson,
    flowSequenceJson: project.flowSequenceJson,
    wiringDiagramPdfUrl: project.wiringDiagramPdfUrl,
    wiringDiagramPdfName: project.wiringDiagramPdfName,
    plcProgramFileUrl: project.plcProgramFileUrl,
    plcProgramFileName: project.plcProgramFileName,
    hmiProgramFileUrl: project.hmiProgramFileUrl,
    hmiProgramFileName: project.hmiProgramFileName,
  });
  const checklistProgress = computeChecklistProgress(
    checklistState,
    checklistDetection
  );

  const distinctGroups = Array.from(
    new Set(project.components.map((c) => c.kelompok))
  );

  const filteredComponents = project.components.filter((c) => {
    if (compGroupFilter !== "ALL" && c.kelompok !== compGroupFilter)
      return false;
    if (compStatusFilter !== "ALL" && c.statusPembelian !== compStatusFilter)
      return false;
    if (compImportFilter !== "ALL") {
      if (compImportFilter === "ACTIVE_ONLY" && c.statusImport === "HILANG_DI_REVISI")
        return false;
      if (compImportFilter === "HILANG_DI_REVISI" && c.statusImport !== "HILANG_DI_REVISI")
        return false;
      if (compImportFilter === "BARU" && c.statusImport !== "BARU")
        return false;
      if (compImportFilter === "NORMAL" && c.statusImport !== "NORMAL")
        return false;
    }
    if (onlyNeedsCheck && !c.perluDicek) return false;
    if (compSearch.trim()) {
      const q = compSearch.toLowerCase();
      const match =
        c.partType.toLowerCase().includes(q) ||
        c.partName.toLowerCase().includes(q) ||
        (c.supplier ?? "").toLowerCase().includes(q) ||
        (c.noPr ?? "").toLowerCase().includes(q) ||
        (c.catatanPr ?? "").toLowerCase().includes(q) ||
        (c.catatan ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Grupkan per kelompok
  const groupedComponents = distinctGroups
    .map((grp) => ({
      kelompok: grp,
      items: filteredComponents.filter((c) => c.kelompok === grp),
    }))
    .filter((g) => g.items.length > 0);

  async function quickUpdateComponent(
    id: string,
    patch: Record<string, unknown>
  ) {
    setBusyComp(true);
    try {
      await fetch(`/api/components/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      router.refresh();
    } finally {
      setBusyComp(false);
    }
  }

  async function handleBulkUpdate() {
    if (selectedIds.length === 0) return;
    setBusyComp(true);
    try {
      await fetch("/api/components/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentIds: selectedIds,
          statusPembelian: bulkStatus,
          ...(bulkEta ? { estimasiTiba: bulkEta } : {}),
        }),
      });
      setSelectedIds([]);
      setBulkEta("");
      router.refresh();
    } finally {
      setBusyComp(false);
    }
  }

  async function handleAddComponent(e: React.FormEvent) {
    e.preventDefault();
    setBusyComp(true);
    try {
      const res = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          kelompok: newComp.kelompok,
          noPr: newComp.noPr || null,
          partType: newComp.partType,
          partName: newComp.partName,
          supplier: newComp.supplier || null,
          qty: Number(newComp.qty) || 1,
          unit: newComp.unit || "pcs",
          hargaSatuan: newComp.hargaSatuan
            ? Number(newComp.hargaSatuan)
            : null,
          statusPembelian: newComp.statusPembelian,
          estimasiTiba: newComp.estimasiTiba || null,
          catatan: newComp.catatan || null,
        }),
      });
      if (res.ok) {
        setAddCompOpen(false);
        setNewComp({
          ...newComp,
          noPr: "",
          partType: "",
          partName: "",
          hargaSatuan: "",
          catatan: "",
        });
        router.refresh();
      }
    } finally {
      setBusyComp(false);
    }
  }

  async function handleDeleteComponent(id: string, name: string) {
    if (!window.confirm(`Hapus komponen "${name}"?`)) return;
    await fetch(`/api/components/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleAddLane(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/lanes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        ...newLane,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setAddLaneOpen(false);
      router.push(`/jadwal/lane/${data.lane.id}`);
    }
  }

  async function handleDeleteLane(laneId: string, nama: string) {
    if (!window.confirm(`Hapus lane "${nama}" beserta seluruh pekerjaannya?`))
      return;
    await fetch(`/api/lanes/${laneId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Tombol Kembali ke Daftar Proyek */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/proyek"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Daftar Proyek
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/jadwal/buat?projectId=${project.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            Buat Schedule
          </Link>
          <Link
            href={`/buat-pr?projectId=${project.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs"
          >
            <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
            Buat / List PR
          </Link>
          <Link
            href={`/import-pr?projectId=${project.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            Import / Revisi PR
          </Link>
        </div>
      </div>

      {/* Hero Header Proyek: Gambar Mesin SPM di Kiri, Judul & Metadata Lengkap di Kanan */}
      <ProjectHeroHeader
        project={project}
        onEditClick={() => setEditModalOpen(true)}
        onGambarUpdated={() => router.refresh()}
      />

      {/* Progress Proyek (8 Berkas Standar) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-bold text-slate-700">Progress Proyek</span>
          <span className="font-extrabold text-slate-900">
            {checklistProgress.completedCount} / {checklistProgress.totalCount}{" "}
            berkas selesai ({checklistProgress.progressPct}%)
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${checklistProgress.progressPct}%` }}
          />
        </div>
      </div>

      {/* Ceklis Kelengkapan Dokumen & File Proyek (8 Berkas Standar) */}
      <ProjectFileChecklistCard
        projectId={project.id}
        initialChecklistJson={project.fileChecklistJson}
        projectData={checklistDetection}
        currentUserRole={currentUserRole}
        currentUserName={currentUserName}
        onChecklistChange={setChecklistState}
        onNavigateTab={(targetTab, itemKey) => {
          navigateToChecklistTarget(targetTab, itemKey);
        }}
      />

      {/* Navigasi Tab Utama */}
      <div id="project-main-tab-content" className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-1 scroll-mt-20">
        <button
          type="button"
          onClick={() => setTab("alur-sekuens")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-extrabold border-b-2 -mb-px transition cursor-pointer whitespace-nowrap ${
            tab === "alur-sekuens"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Workflow className="w-4 h-4 text-slate-600" />
          <span>Flowchart, Wiring &amp; Program</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("layout-panel")}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 -mb-px transition cursor-pointer whitespace-nowrap ${
            tab === "layout-panel"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4 text-slate-600" />
          <span>Layout Panel</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("komponen")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 -mb-px transition cursor-pointer whitespace-nowrap ${
            tab === "komponen"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Komponen PR ({activeComps.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("jadwal")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 -mb-px transition cursor-pointer whitespace-nowrap ${
            tab === "jadwal"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Jadwal ({project.lanes.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("pengelamatan-plc")}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 -mb-px transition cursor-pointer whitespace-nowrap ${
            tab === "pengelamatan-plc"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-slate-600" /> Alamat I/O
        </button>
      </div>

      {/* TAB 0: FLOWCHART, WIRING & PROGRAM (SUB-ACCORDION) */}
      {tab === "alur-sekuens" && (
        <div className="space-y-3">
          {/* Sub-Accordion 1: Flowchart */}
          <div id="sub-flowchart" className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
            <button
              type="button"
              onClick={() => toggleAlurSubSection("flowchart")}
              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Workflow className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="font-bold text-sm text-slate-900">Flowchart</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">Dokumentasi Mesin</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                  openAlurSubSections.has("flowchart") ? "rotate-180" : ""
                }`}
              />
            </button>
            {openAlurSubSections.has("flowchart") && (
              <div className="border-t border-slate-100 p-4">
                <ProjectFlowchartPngViewer
                  projectId={project.id}
                  projectName={project.nama}
                  initialDataJson={project.flowSequenceJson}
                  onUpdateSuccess={() => router.refresh()}
                />
              </div>
            )}
          </div>

          {/* Sub-Accordion 2: Diagram Wiring */}
          <div id="sub-wiring" className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
            <button
              type="button"
              onClick={() => toggleAlurSubSection("wiring")}
              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="font-bold text-sm text-slate-900">Diagram Wiring</span>
                <span className="text-xs text-slate-500 font-medium">
                  {project.wiringDiagramPdfName ? `(${project.wiringDiagramPdfName})` : "(Belum Ada)"}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                  openAlurSubSections.has("wiring") ? "rotate-180" : ""
                }`}
              />
            </button>
            {openAlurSubSections.has("wiring") && (
              <div className="border-t border-slate-100 p-4">
                <ProjectWiringPdfPanel
                  projectId={project.id}
                  initialPdfUrl={project.wiringDiagramPdfUrl}
                  initialPdfName={project.wiringDiagramPdfName}
                  onUpdateSuccess={() => router.refresh()}
                />
              </div>
            )}
          </div>

          {/* Sub-Accordion 3: Program PLC */}
          <div id="sub-plc" className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
            <button
              type="button"
              onClick={() => toggleAlurSubSection("plc")}
              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="font-bold text-sm text-slate-900">Program PLC</span>
                <span className="text-xs text-slate-500 font-medium">
                  {project.plcProgramFileName ? `(${project.plcProgramFileName})` : "(Belum Ada)"}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                  openAlurSubSections.has("plc") ? "rotate-180" : ""
                }`}
              />
            </button>
            {openAlurSubSections.has("plc") && (
              <div className="border-t border-slate-100 p-4">
                <ProjectPlcProgramPanel
                  projectId={project.id}
                  initialFileUrl={project.plcProgramFileUrl}
                  initialFileName={project.plcProgramFileName}
                  initialFileSize={project.plcProgramFileSize}
                  onUpdateSuccess={() => router.refresh()}
                />
              </div>
            )}
          </div>

          {/* Sub-Accordion 4: Program HMI */}
          <div id="sub-hmi" className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
            <button
              type="button"
              onClick={() => toggleAlurSubSection("hmi")}
              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="font-bold text-sm text-slate-900">Program HMI</span>
                <span className="text-xs text-slate-500 font-medium">
                  {project.hmiProgramFileName ? `(${project.hmiProgramFileName})` : "(Belum Ada)"}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                  openAlurSubSections.has("hmi") ? "rotate-180" : ""
                }`}
              />
            </button>
            {openAlurSubSections.has("hmi") && (
              <div className="border-t border-slate-100 p-4">
                <ProjectHmiProgramPanel
                  projectId={project.id}
                  initialFileUrl={project.hmiProgramFileUrl}
                  initialFileName={project.hmiProgramFileName}
                  initialFileSize={project.hmiProgramFileSize}
                  onUpdateSuccess={() => router.refresh()}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: LAYOUT PANEL */}
      {tab === "layout-panel" && (
        <div id="section-layout-panel" className="space-y-4">
          <ProjectControlPanelLayoutEditor
            projectId={project.id}
            projectKode={project.kode}
            projectNama={project.nama}
            projectClient={project.client}
            projectPic={project.pic}
            components={project.components}
            initialLayoutJson={project.panelLayoutJson}
            onSaveSuccess={() => router.refresh()}
          />
        </div>
      )}

      {/* TAB 2: KOMPONEN PR */}
      {tab === "komponen" && (
        <div id="section-komponen" className="space-y-4">
          {/* Toolbar Filter & Export Komponen */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            {/* Baris 1: Filter & Pencarian */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={compSearch}
                  onChange={(e) => setCompSearch(e.target.value)}
                  placeholder="Cari tipe, merk, nama part, supplier, catatan..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <select
                value={compGroupFilter}
                onChange={(e) => setCompGroupFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold hover:border-slate-400 transition"
              >
                <option value="ALL">Semua Kelompok</option>
                {distinctGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <select
                value={compStatusFilter}
                onChange={(e) => setCompStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold cursor-pointer hover:border-slate-400 transition"
              >
                <option value="ALL">Semua Status Pembelian</option>
                {PURCHASE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PURCHASE_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>

              <select
                value={compImportFilter}
                onChange={(e) => setCompImportFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold cursor-pointer hover:border-slate-400 transition"
              >
                <option value="ALL">Semua Tipe Komponen ({project.components.length})</option>
                <option value="ACTIVE_ONLY">Komponen Aktif Saja ({activeComps.length})</option>
                <option value="HILANG_DI_REVISI">
                  Hilang di Revisi ({missingRevisionComps.length})
                </option>
                <option value="BARU">Baru di Revisi</option>
              </select>

              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-amber-100/70 transition">
                <input
                  type="checkbox"
                  checked={onlyNeedsCheck}
                  onChange={(e) => setOnlyNeedsCheck(e.target.checked)}
                />
                Hanya Perlu Dicek
              </label>

              <button
                type="button"
                onClick={() => {
                  if (openCompGroups.size === groupedComponents.length) {
                    setOpenCompGroups(new Set());
                  } else {
                    setOpenCompGroups(new Set(groupedComponents.map((g) => g.kelompok)));
                  }
                }}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer transition shadow-2xs"
                title="Buka atau tutup seluruh kelompok komponen sekaligus"
              >
                {openCompGroups.size === groupedComponents.length
                  ? "Tutup Semua Kelompok"
                  : "Buka Semua Kelompok"}
              </button>
            </div>

            {/* Baris 2: Tombol Aksi Komponen & Export */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/buat-pr?projectId=${project.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition"
                >
                  <ClipboardList className="w-3.5 h-3.5" /> Susun PR dari Katalog
                </Link>
                <button
                  type="button"
                  onClick={() => setShowElectricalChecklist((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition shadow-2xs ${
                    showElectricalChecklist
                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                  title="Ceklis kelengkapan part elektrikal mesin & panel agar tidak ada part penting yang terlupa saat menyusun PR"
                >
                  <CheckSquare
                    className={`w-3.5 h-3.5 ${
                      showElectricalChecklist ? "text-white" : "text-amber-600"
                    }`}
                  />
                  <span>
                    Ceklis Part Elektrikal ({electricalFulfilledCount}/
                    {ELECTRICAL_CHECKLIST_CATEGORIES.length})
                  </span>
                </button>
                <Link
                  href={`/import-pr?projectId=${project.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
                  title="Tambah komponen dari file Excel berbeda (Append) atau import ulang revisi"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" /> Tambah dari Excel (Import)
                </Link>
                <button
                  type="button"
                  onClick={() => setAddCompOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" /> Tambah 1 Item
                </button>
                <button
                  type="button"
                  onClick={() => navigateToChecklistTarget("pengelamatan-plc")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition shadow-2xs"
                  title="Lihat alokasi alamat I/O, AI, AO, dan Register PLC otomatis dari daftar komponen PR ini"
                >
                  <Cpu className="w-3.5 h-3.5 text-slate-500" />
                  Alamat I/O
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/export/pr?projectId=${project.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition"
                  title="Download Excel Purchase Requisition (part berstatus Sudah Ada / Sudah Datang / Terpasang otomatis dikecualikan)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export Format PR
                </a>
                <a
                  href={`/api/export/komponen?projectId=${project.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" /> Export Monitoring
                </a>
              </div>
            </div>

            {/* Bulk Update Bar */}
            {selectedIds.length > 0 && (() => {
              const selectedMissingCount = selectedIds.filter(
                (id) =>
                  project.components.find((c) => c.id === id)?.statusImport ===
                  "HILANG_DI_REVISI"
              ).length;

              return (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 bg-blue-50/70 p-3 rounded-xl">
                  <div className="text-xs font-bold text-blue-900">
                    {selectedIds.length} komponen dipilih
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedMissingCount > 0 && (
                      <button
                        type="button"
                        disabled={busyComp}
                        onClick={async () => {
                          setBusyComp(true);
                          try {
                            await fetch("/api/components/bulk", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                componentIds: selectedIds,
                                statusImport: "NORMAL",
                              }),
                            });
                            setSelectedIds([]);
                            router.refresh();
                          } finally {
                            setBusyComp(false);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                        title="Ubah komponen terpilih yang hilang di revisi kembali menjadi Normal"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Ubah {selectedMissingCount} Hilang Revisi Jadi Normal
                      </button>
                    )}
                    <select
                      value={bulkStatus}
                      onChange={(e) =>
                        setBulkStatus(e.target.value as PurchaseStatus)
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-blue-300 bg-white text-xs font-semibold"
                    >
                      {PURCHASE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          Set: {PURCHASE_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={bulkEta}
                      onChange={(e) => setBulkEta(e.target.value)}
                      title="Estimasi Tiba (opsional)"
                      className="px-2.5 py-1.5 rounded-lg border border-blue-300 bg-white text-xs"
                    />
                    <button
                      type="button"
                      disabled={busyComp}
                      onClick={handleBulkUpdate}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Terapkan Bulk Update
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-white cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Panel Ceklis Part Elektrikal Mesin & Panel (Panduan Kelengkapan agar Tidak Ada Part Penting yang Terlupa) */}
          {showElectricalChecklist && (
            <div className="bg-white rounded-2xl border-2 border-amber-300 p-4 sm:p-5 shadow-xs space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckSquare className="w-5 h-5 text-amber-600" />
                    <h3 className="font-extrabold text-base text-slate-900">
                      Ceklis Kelengkapan Part Elektrikal Mesin &amp; Panel
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                        electricalFulfilledCount ===
                        ELECTRICAL_CHECKLIST_CATEGORIES.length
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
                      }`}
                    >
                      {electricalFulfilledCount} /{" "}
                      {ELECTRICAL_CHECKLIST_CATEGORIES.length} Kategori Terpenuhi
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Gunakan panduan ceklis ini agar tidak ada part elektrikal penting yang terlupa sebelum PR diajukan.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/buat-pr?projectId=${project.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
                    title="Buka katalog lengkap dan paket standar FR-EG-EP-006"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Susun di Katalog
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowElectricalChecklist(false)}
                    className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Tutup Ceklis"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid 13 Kategori Elektrikal */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {electricalChecklistStatus.map((cat) => (
                  <div
                    key={cat.id}
                    className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                      cat.isFulfilled
                        ? "bg-emerald-50/50 border-emerald-200 hover:border-emerald-300"
                        : "bg-amber-50/30 border-amber-200 hover:border-amber-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                              cat.isFulfilled
                                ? "bg-emerald-600 text-white"
                                : "bg-white border-2 border-amber-400 text-transparent"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 leading-snug">
                              {cat.nama}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                              {cat.deskripsi}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 border ${
                            cat.isFulfilled
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          }`}
                        >
                          {cat.isFulfilled ? `${cat.count} item` : "Belum Ada"}
                        </span>
                      </div>
                    </div>

                    {cat.isFulfilled ? (
                      <div className="mt-2 pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-900 truncate">
                        <span className="font-semibold">Terdaftar:</span>{" "}
                        {cat.items
                          .map((i) => i.partType)
                          .slice(0, 2)
                          .join(", ")}
                        {cat.items.length > 2
                          ? ` (+${cat.items.length - 2} lainnya)`
                          : ""}
                      </div>
                    ) : (
                      <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                        <span className="text-amber-900 truncate text-[10px]" title={cat.contohPart}>
                          Misal: {cat.contohPart}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewComp((prev) => ({
                              ...prev,
                              partType: cat.contohPart.split("/")[0].trim(),
                              partName: cat.nama,
                              kelompok: "Panel Utama",
                            }));
                            setAddCompOpen(true);
                          }}
                          className="text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:underline shrink-0 ml-1 cursor-pointer"
                          title={`Tambah ${cat.nama} ke PR`}
                        >
                          + Tambah
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banner Peringatan & Aksi Cepat jika ada komponen Hilang di Revisi Baru */}
          {missingRevisionComps.length > 0 && (
            <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-start sm:items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-extrabold text-rose-950 text-sm">
                    Terdapat {missingRevisionComps.length} Komponen berstatus &quot;Hilang di Revisi Baru&quot;
                  </span>
                  <p className="text-rose-700 text-xs mt-0.5">
                    Komponen ini dinonaktifkan sementara dari kalkulasi PR &amp; layout karena tidak ada di file Excel revisi terakhir. Anda dapat memulihkannya kembali menjadi Normal kapan saja.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  disabled={busyComp}
                  onClick={() => {
                    setSelectedIds(missingRevisionComps.map((c) => c.id));
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 font-bold cursor-pointer shadow-2xs"
                >
                  Pilih Semua ({missingRevisionComps.length})
                </button>
                <button
                  type="button"
                  disabled={busyComp}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `Pulihkan ${missingRevisionComps.length} komponen yang hilang di revisi kembali menjadi Normal?`
                      )
                    ) {
                      return;
                    }
                    setBusyComp(true);
                    try {
                      await fetch("/api/components/bulk", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          componentIds: missingRevisionComps.map((c) => c.id),
                          statusImport: "NORMAL",
                        }),
                      });
                      router.refresh();
                    } finally {
                      setBusyComp(false);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  Pulihkan Semua Menjadi Normal
                </button>
              </div>
            </div>
          )}

          {/* Tabel Komponen per Kelompok */}
          {groupedComponents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
              Tidak ada komponen yang cocok. Silakan import file Excel PR atau
              tambah komponen manual.
            </div>
          ) : (
            groupedComponents.map((group) => {
              const groupIds = group.items.map((i) => i.id);
              const allGroupSelected = groupIds.every((id) =>
                selectedIds.includes(id)
              );

              return (
                <div
                  key={group.kelompok}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
                >
                  <div
                    onClick={() => toggleCompGroup(group.kelompok)}
                    className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={allGroupSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(
                              Array.from(new Set([...selectedIds, ...groupIds]))
                            );
                          } else {
                            setSelectedIds(
                              selectedIds.filter((id) => !groupIds.includes(id))
                            );
                          }
                        }}
                      />
                      <h3 className="font-bold text-sm">{group.kelompok}</h3>
                      <span className="text-xs text-slate-300 font-semibold">
                        ({group.items.length} item)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                        {openCompGroups.has(group.kelompok) || compSearch.trim().length > 0
                          ? "Tutup"
                          : "Buka"}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          openCompGroups.has(group.kelompok) || compSearch.trim().length > 0
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </div>
                  </div>

                  {(openCompGroups.has(group.kelompok) || compSearch.trim().length > 0) && (
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 w-8" />
                          <th className="text-left p-2.5 w-12">No PR</th>
                          <th className="text-left p-2.5">
                            Part Type & Kategori
                          </th>
                          <th className="text-center p-2.5">Qty</th>
                          <th className="text-right p-2.5">Harga / Total</th>
                          <th className="text-left p-2.5">Status Pembelian</th>
                          <th className="text-left p-2.5">Estimasi Tiba</th>
                          <th className="text-left p-2.5">Catatan</th>
                          <th className="p-2.5 w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.map((c) => {
                          const checked = selectedIds.includes(c.id);
                          const isMissingRev =
                            c.statusImport === "HILANG_DI_REVISI";
                          const isNewRev = c.statusImport === "BARU";

                          return (
                            <tr
                              key={c.id}
                              className={`hover:bg-slate-50 ${
                                isMissingRev ? "bg-rose-50/40 opacity-75" : ""
                              }`}
                            >
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedIds([...selectedIds, c.id]);
                                    } else {
                                      setSelectedIds(
                                        selectedIds.filter((x) => x !== c.id)
                                      );
                                    }
                                  }}
                                />
                              </td>
                              <td className="p-2.5 font-mono text-slate-500">
                                {c.noPr ?? "-"}
                              </td>
                              <td className="p-2.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`font-bold text-slate-900 ${
                                      isMissingRev ? "line-through" : ""
                                    }`}
                                  >
                                    {c.partType}
                                  </span>
                                  {c.perluDicek && (
                                    <span
                                      title={c.alasanDicek ?? "Perlu dicek"}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold"
                                    >
                                      <AlertTriangle className="w-3 h-3" />
                                      Perlu dicek
                                    </span>
                                  )}
                                  {isNewRev && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                      BARU (Revisi)
                                    </span>
                                  )}
                                  {isMissingRev && (
                                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                                        Hilang di Revisi Baru
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          quickUpdateComponent(c.id, {
                                            statusImport: "NORMAL",
                                          })
                                        }
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-extrabold shadow-2xs transition cursor-pointer border border-emerald-300"
                                        title="Ubah status komponen ini kembali menjadi Normal (aktif)"
                                      >
                                        <Check className="w-2.5 h-2.5 text-emerald-700" />
                                        Ubah ke Normal
                                      </button>
                                    </span>
                                  )}
                                  <select
                                    value={c.statusImport}
                                    onChange={(e) =>
                                      quickUpdateComponent(c.id, {
                                        statusImport: e.target.value,
                                      })
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                      isMissingRev
                                        ? "bg-rose-50 border-rose-300 text-rose-800"
                                        : isNewRev
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                                    }`}
                                    title="Edit status import / revisi komponen (Normal, Baru, Hilang di Revisi)"
                                  >
                                    <option value="NORMAL">Normal</option>
                                    <option value="BARU">Baru (Revisi)</option>
                                    <option value="HILANG_DI_REVISI">Hilang di Revisi</option>
                                  </select>
                                </div>
                                <div className="text-slate-500 mt-0.5">
                                  {c.partName}{" "}
                                  {c.supplier ? `• ${c.supplier}` : ""}
                                </div>
                                {c.perluDicek && (
                                  <div className="mt-1 flex items-center gap-2 text-[11px] text-amber-800">
                                    <span>
                                      {c.alasanDicek}
                                      {c.hargaRaw
                                        ? ` (Mentah: "${c.hargaRaw}")`
                                        : ""}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        quickUpdateComponent(c.id, {
                                          perluDicek: false,
                                        })
                                      }
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-200/70 hover:bg-amber-300 text-amber-950 font-bold cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" /> OK
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-800 whitespace-nowrap">
                                {c.qty} {c.unit ?? ""}
                              </td>
                              <td className="p-2.5 text-right whitespace-nowrap">
                                <div className="font-semibold text-slate-800">
                                  {formatRupiah(c.total)}
                                </div>
                                <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-slate-500">
                                  <span>@ Rp</span>
                                  <input
                                    key={`${c.id}-${c.hargaSatuan ?? "null"}`}
                                    type="number"
                                    min={0}
                                    step="any"
                                    defaultValue={
                                      c.hargaSatuan !== null &&
                                      c.hargaSatuan !== undefined
                                        ? String(c.hargaSatuan)
                                        : ""
                                    }
                                    placeholder="TBD"
                                    onFocus={(e) => e.currentTarget.select()}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const raw = e.target.value.trim();
                                      const nextHarga =
                                        raw === ""
                                          ? null
                                          : Number.isFinite(Number(raw)) &&
                                              Number(raw) >= 0
                                            ? Number(raw)
                                            : c.hargaSatuan;
                                      if (nextHarga !== (c.hargaSatuan ?? null)) {
                                        void quickUpdateComponent(c.id, {
                                          hargaSatuan: nextHarga,
                                        });
                                      }
                                    }}
                                    aria-label={`Edit harga ${c.partName}`}
                                    className="w-24 px-1.5 py-0.5 rounded border border-slate-200 hover:border-slate-300 focus:border-blue-500 bg-white text-right font-mono text-[11px] text-slate-700 focus:outline-none"
                                  />
                                </div>
                              </td>
                              <td className="p-2.5">
                                <select
                                  value={c.statusPembelian}
                                  onChange={(e) =>
                                    quickUpdateComponent(c.id, {
                                      statusPembelian: e.target.value,
                                    })
                                  }
                                  className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                                    ARRIVED_PURCHASE_STATUSES.includes(
                                      c.statusPembelian
                                    )
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                      : c.statusPembelian === "SUDAH_DIPESAN"
                                        ? "bg-blue-50 border-blue-300 text-blue-800"
                                        : "bg-slate-50 border-slate-300 text-slate-700"
                                  }`}
                                >
                                  {PURCHASE_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {PURCHASE_STATUS_LABELS[s]}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="date"
                                  defaultValue={c.estimasiTiba ?? ""}
                                  onBlur={(e) => {
                                    const val = e.target.value || null;
                                    if (val !== (c.estimasiTiba ?? null)) {
                                      quickUpdateComponent(c.id, {
                                        estimasiTiba: val,
                                      });
                                    }
                                  }}
                                  className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
                                />
                              </td>
                              <td className="p-2.5 min-w-[160px]">
                                {c.catatanPr && (
                                  <div className="flex items-start justify-between gap-1 text-[11px] text-slate-500 mb-1">
                                    <span>PR: {c.catatanPr}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void quickUpdateComponent(c.id, {
                                          catatanPr: null,
                                        })
                                      }
                                      className="text-slate-400 hover:text-rose-600 font-bold shrink-0 cursor-pointer"
                                      title="Hapus note PR"
                                    >
                                      ×
                                    </button>
                                  </div>
                                )}
                                <input
                                  type="text"
                                  defaultValue={c.catatan ?? ""}
                                  placeholder="Tambah catatan..."
                                  onBlur={(e) => {
                                    const val = e.target.value.trim() || null;
                                    if (val !== (c.catatan ?? null)) {
                                      quickUpdateComponent(c.id, {
                                        catatan: val,
                                      });
                                    }
                                  }}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs"
                                />
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteComponent(c.id, c.partType)
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Hapus Komponen"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: JADWAL */}
      {tab === "jadwal" && (
        <div id="section-jadwal" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">
                Daftar Lane / Area Jadwal Proyek
              </h2>
              <p className="text-xs text-slate-500">
                Setiap lane menjadi satu sheet Excel dengan format seperti file
                referensi MGS.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 px-3 py-2 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeExportDates}
                  onChange={(e) => setIncludeExportDates(e.target.checked)}
                />
                Sertakan Tanggal Aktual di Export
              </label>
              {project.lanes.length > 0 && (
                <a
                  href={`/api/export/jadwal?projectId=${project.id}${
                    includeExportDates ? "&includeDates=1" : ""
                  }`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" /> Export Semua Lane Proyek
                </a>
              )}
              <Link
                href={`/jadwal/buat?projectId=${project.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                <CalendarPlus className="w-3.5 h-3.5" /> Buat Schedule Lengkap
              </Link>
              <button
                type="button"
                onClick={() => setAddLaneOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Lane Kosong
              </button>
            </div>
          </div>

          {project.lanes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
              Proyek ini belum memiliki lane jadwal. Klik &ldquo;Buat Schedule
              Lengkap&rdquo; untuk menyusun judul pengerjaan, pekerjaan,
              sub-pekerjaan, deadline, dan PIC sekaligus.
            </div>
          ) : (
            <div className="space-y-4">
              {project.lanes.map((lane) => (
                <div
                  key={lane.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-blue-600 uppercase">
                        Sheet: {project.client} | {lane.nama}
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        Schedule Lane {lane.nama}
                      </h3>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          Mulai:{" "}
                          <strong>
                            {formatTanggalId(lane.tanggalMulai, true)}
                          </strong>
                        </span>
                        <span>• Durasi: <strong>{lane.jumlahHari} Hari</strong></span>
                        {lane.deadline && (
                          <span>
                            • Deadline:{" "}
                            <strong className="text-rose-700">
                              {formatTanggalId(lane.deadline, false)}
                            </strong>
                          </span>
                        )}
                        {lane.pic && (
                          <span>
                            • PIC: <strong className="text-emerald-800">{lane.pic}</strong>
                          </span>
                        )}
                        <span>• {lane.workItems.length} Pekerjaan</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/jadwal/lane/${lane.id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                      >
                        <Grid className="w-3.5 h-3.5" /> Buka Editor Grid
                      </Link>
                      <a
                        href={`/api/export/jadwal?laneId=${lane.id}${
                          includeExportDates ? "&includeDates=1" : ""
                        }`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800"
                      >
                        <Download className="w-3.5 h-3.5" /> Export Lane Ini
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteLane(lane.id, lane.nama)}
                        className="p-2 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        title="Hapus Lane"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Ringkasan pekerjaan dalam lane */}
                  <div className="mt-3 space-y-2">
                    {lane.workItems.map((wi, idx) => (
                      <div
                        key={wi.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                      >
                        <div>
                          <span className="font-extrabold text-slate-900">
                            {idx + 1}. {wi.judul}
                          </span>
                          <span className="ml-2 px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                            {WORK_TYPE_LABELS[wi.jenis]}
                          </span>
                          {wi.bolehParalel && (
                            <span className="ml-1.5 px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                              Boleh Paralel
                            </span>
                          )}
                          {wi.pic && (
                            <span className="ml-1.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                              PIC: {wi.pic}
                            </span>
                          )}
                          {wi.deadline && (
                            <span className="ml-1.5 px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                              DL: {formatTanggalId(wi.deadline, false)}
                            </span>
                          )}
                          <div className="text-slate-500 mt-0.5">
                            {wi.subScopes.length} sub-scope •{" "}
                            {wi.subScopes.reduce(
                              (s, ss) => s + ss.details.length,
                              0
                            )}{" "}
                            detail tugas
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {wi.scheduleCells.map((sc) => {
                            const bgHex =
                              sc.warnaCustom ||
                              `#${SCHEDULE_STATUS_RGB[sc.status]}`;
                            const lightBg = isLightHexColor(bgHex);
                            return (
                              <span
                                key={sc.id}
                                title={sc.catatan ?? undefined}
                                className="px-2 py-0.5 rounded text-[11px] font-bold"
                                style={{
                                  backgroundColor: bgHex,
                                  color: lightBg ? "#0f172a" : "#ffffff",
                                }}
                              >
                                {formatTanggalId(sc.tanggal, false)}:{" "}
                                {SCHEDULE_CELL_LABELS[sc.status]}
                                {sc.catatan ? ` 💬` : ""}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ALAMAT I/O */}
      {tab === "pengelamatan-plc" && (
        <div id="section-pengelamatan-plc" className="space-y-4">
          <PlcAddressTablePanel
            projectId={project.id}
            projectNama={project.nama}
            components={project.components}
            initialPlcAddressesJson={project.plcAddressesJson}
          />
        </div>
      )}

      {/* Modal Edit Proyek */}
      {editModalOpen && (
        <ProjectFormModal
          initial={project}
          onClose={() => setEditModalOpen(false)}
          onSaved={() => {
            setEditModalOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* Modal Tambah Komponen Manual */}
      {addCompOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white font-bold">
              Tambah Komponen Manual
            </div>
            <form onSubmit={handleAddComponent} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Kelompok *</label>
                  <input
                    type="text"
                    required
                    value={newComp.kelompok}
                    onChange={(e) =>
                      setNewComp({ ...newComp, kelompok: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">No PR</label>
                  <input
                    type="text"
                    value={newComp.noPr}
                    onChange={(e) =>
                      setNewComp({ ...newComp, noPr: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">
                    Part Type / Merk *
                  </label>
                  <CatalogAutocompleteInput
                    required
                    value={newComp.partType}
                    preferField="partType"
                    catalog={catalogItems}
                    onChange={(val) =>
                      setNewComp({ ...newComp, partType: val })
                    }
                    onSelectCatalogItem={(sug) => {
                      const pr = formatCatalogItemForPr(sug);
                      setNewComp({
                        ...newComp,
                        partType: pr.partType,
                        partName: pr.partName,
                        unit: pr.unit,
                        hargaSatuan:
                          pr.hargaSatuan !== null ? String(pr.hargaSatuan) : "",
                      });
                    }}
                    placeholder="Ketik tipe / merk (mis. P, FX5U...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">
                    Parts Name / Kategori *
                  </label>
                  <CatalogAutocompleteInput
                    required
                    value={newComp.partName}
                    preferField="partName"
                    catalog={catalogItems}
                    onChange={(val) =>
                      setNewComp({ ...newComp, partName: val })
                    }
                    onSelectCatalogItem={(sug) => {
                      const pr = formatCatalogItemForPr(sug);
                      setNewComp({
                        ...newComp,
                        partType: pr.partType,
                        partName: pr.partName,
                        unit: pr.unit,
                        hargaSatuan:
                          pr.hargaSatuan !== null ? String(pr.hargaSatuan) : "",
                      });
                    }}
                    placeholder="Ketik nama (mis. PLC, MCB...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold mb-1">Qty *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    value={newComp.qty}
                    onChange={(e) =>
                      setNewComp({ ...newComp, qty: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Unit</label>
                  <input
                    type="text"
                    value={newComp.unit}
                    onChange={(e) =>
                      setNewComp({ ...newComp, unit: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Harga Satuan</label>
                  <input
                    type="number"
                    value={newComp.hargaSatuan}
                    onChange={(e) =>
                      setNewComp({ ...newComp, hargaSatuan: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Supplier</label>
                  <input
                    type="text"
                    value={newComp.supplier}
                    onChange={(e) =>
                      setNewComp({ ...newComp, supplier: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Estimasi Tiba</label>
                  <input
                    type="date"
                    value={newComp.estimasiTiba}
                    onChange={(e) =>
                      setNewComp({ ...newComp, estimasiTiba: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddCompOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busyComp}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold cursor-pointer"
                >
                  Simpan Komponen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Lane Baru */}
      {addLaneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white font-bold">
              Tambah Lane / Area Baru
            </div>
            <form onSubmit={handleAddLane} className="p-5 space-y-3 text-sm">
              <div>
                <label className="block text-xs font-bold mb-1">
                  Nama Lane / Area *
                </label>
                <input
                  type="text"
                  required
                  value={newLane.nama}
                  onChange={(e) =>
                    setNewLane({ ...newLane, nama: e.target.value })
                  }
                  placeholder="Contoh: Glasstech / Panel Utama"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  Subjudul Export Excel
                </label>
                <input
                  type="text"
                  value={newLane.subjudul}
                  onChange={(e) =>
                    setNewLane({ ...newLane, subjudul: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Tanggal Mulai (Day 1) *
                  </label>
                  <input
                    type="date"
                    required
                    value={newLane.tanggalMulai}
                    onChange={(e) =>
                      setNewLane({ ...newLane, tanggalMulai: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Jumlah Hari (Day 1..N) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    required
                    value={newLane.jumlahHari}
                    onChange={(e) =>
                      setNewLane({
                        ...newLane,
                        jumlahHari: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddLaneOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
                >
                  Buat Lane & Buka Grid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
