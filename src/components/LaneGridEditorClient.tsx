"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookmarkPlus,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Edit3,
  Eraser,
  GitFork,
  Layers,
  ListOrdered,
  MessageSquare,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  ARRIVED_PURCHASE_STATUSES,
  PURCHASE_STATUS_LABELS,
  SCHEDULE_CELL_LABELS,
  SCHEDULE_CELL_STATUSES,
  SCHEDULE_STATUS_RGB,
  WORK_TYPES,
  WORK_TYPE_LABELS,
  isLightHexColor,
  type PurchaseStatus,
  type ScheduleCellStatus,
  type WorkType,
} from "@/lib/constants";
import { SYSTEM_PICS } from "@/lib/users";
import {
  addDaysIso,
  formatHariTanggalSingkat,
  formatTanggalId,
  isTanggalMerah,
  laneDatesIso,
  todayIsoLocal,
} from "@/lib/date-utils";
import {
  ScheduleFeedbackModals,
  type ComponentWarningModalState,
  type ConflictModalState,
} from "./ScheduleFeedbackModals";

interface WorkItemDTO {
  id: string;
  urutan: number;
  jenis: WorkType;
  judul: string;
  bolehParalel: boolean;
  pic: string | null;
  deadline: string | null;
  componentIds: string[];
  subScopes: {
    id: string;
    urutan: number;
    judul: string;
    details: { id: string; urutan: number; teks: string }[];
  }[];
  scheduleCells: {
    id: string;
    subScopeId?: string | null;
    taskDetailId?: string | null;
    tanggal: string;
    status: ScheduleCellStatus;
    warnaCustom: string | null;
    catatan: string | null;
  }[];
}

interface ProjectComponentSimple {
  id: string;
  kelompok: string;
  partType: string;
  partName: string;
  statusPembelian: PurchaseStatus;
  estimasiTiba: string | null;
}

interface TemplateOption {
  id: string;
  nama: string;
  jenis: WorkType;
  subScopesCount: number;
}

export function LaneGridEditorClient({
  lane,
  project,
  projectComponents,
  otherLanesInProject,
  globalOccupantsByDate,
  templates,
}: {
  lane: {
    id: string;
    nama: string;
    subjudul: string;
    tanggalMulai: string;
    jumlahHari: number;
    deadline: string | null;
    pic: string | null;
    customDatesJson?: string | null;
    workItems: WorkItemDTO[];
  };
  project: {
    id: string;
    kode: string | null;
    nama: string;
    client: string;
    warna: string;
    pic: string | null;
    deadline: string | null;
    bolehParalel: boolean;
    prioritas?: string | null;
  };
  projectComponents: ProjectComponentSimple[];
  otherLanesInProject: { id: string; nama: string; jumlahHari: number }[];
  globalOccupantsByDate: Record<
    string,
    { workItemId: string; label: string }[]
  >;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [activeBrush, setActiveBrush] = useState<ScheduleCellStatus | "ERASE">(
    "TARGET"
  );
  // brushCustomColor dihapus — warna selalu mengikuti status aktif kuas
  const [isDraggingBrush, setIsDraggingBrush] = useState(false);
  const [busy, setBusy] = useState(false);
  const [includeExportDates, setIncludeExportDates] = useState(false);

  // Conflict & Warning Modals
  const [conflictModal, setConflictModal] =
    useState<ConflictModalState | null>(null);
  const [warningModal, setWarningModal] =
    useState<ComponentWarningModalState | null>(null);

  // Reorder Work Items State
  const [singleReorder, setSingleReorder] = useState<{
    workItem: WorkItemDTO;
    currentUrutan: number;
    targetUrutan: number;
  } | null>(null);
  const [fullReorderOpen, setFullReorderOpen] = useState(false);
  const [reorderingItems, setReorderingItems] = useState<WorkItemDTO[]>([]);

  async function handleQuickMove(
    _workItemId: string,
    currentIdx: number,
    targetIdx: number
  ) {
    if (targetIdx < 0 || targetIdx >= lane.workItems.length || busy) return;
    setBusy(true);
    try {
      const newItems = [...lane.workItems];
      const [moved] = newItems.splice(currentIdx, 1);
      newItems.splice(targetIdx, 0, moved);
      const orderedIds = newItems.map((x) => x.id);

      const res = await fetch("/api/work-items/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: lane.id, orderedIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Gagal mengubah urutan.");
        return;
      }
      router.refresh();
    } catch {
      alert("Terjadi kesalahan saat memindahkan urutan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApplySingleReorder() {
    if (!singleReorder || busy) return;
    const { workItem, targetUrutan } = singleReorder;
    if (targetUrutan < 1 || targetUrutan > lane.workItems.length) {
      alert(`Nomor urut harus antara 1 sampai ${lane.workItems.length}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/work-items/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laneId: lane.id,
          workItemId: workItem.id,
          newUrutan: targetUrutan,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Gagal mengubah urutan.");
        return;
      }
      setSingleReorder(null);
      router.refresh();
    } catch {
      alert("Terjadi kesalahan saat memindahkan urutan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveFullReorder() {
    if (reorderingItems.length === 0 || busy) return;
    setBusy(true);
    try {
      const orderedIds = reorderingItems.map((x) => x.id);
      const res = await fetch("/api/work-items/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: lane.id, orderedIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan urutan.");
        return;
      }
      setFullReorderOpen(false);
      router.refresh();
    } catch {
      alert("Terjadi kesalahan saat menyimpan urutan.");
    } finally {
      setBusy(false);
    }
  }

  // Edit Pengaturan Lane Modal
  const [laneModalOpen, setLaneModalOpen] = useState(false);
  const [laneForm, setLaneForm] = useState({
    nama: lane.nama,
    subjudul: lane.subjudul,
    tanggalMulai: lane.tanggalMulai,
    jumlahHari: lane.jumlahHari,
    deadline: lane.deadline ?? project.deadline ?? "",
    pic: lane.pic ?? project.pic ?? "",
  });

  // Custom Dates per kolom DAY (bisa disesuaikan manual)
  const [customDates, setCustomDates] = useState<string[]>(() => {
    if (lane.customDatesJson) {
      try {
        const parsed = JSON.parse(lane.customDatesJson);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [];
  });
  const [dateChangeToast, setDateChangeToast] = useState<string | null>(null);
  const [laneFormCustomDates, setLaneFormCustomDates] = useState<string[]>([]);

  // Modal Tambah/Edit Pekerjaan Hierarkis
  const [wiModalOpen, setWiModalOpen] = useState(false);
  const [editingWi, setEditingWi] = useState<WorkItemDTO | null>(null);
  const [wiJudul, setWiJudul] = useState("");
  const [wiJenis, setWiJenis] = useState<WorkType>("WIRING");
  const [wiParalel, setWiParalel] = useState(false);
  const [wiPic, setWiPic] = useState("");
  const [wiDeadline, setWiDeadline] = useState("");
  const [wiCompIds, setWiCompIds] = useState<string[]>([]);
  const [wiSubScopes, setWiSubScopes] = useState<
    { judul: string; detailsText: string }[]
  >([
    {
      judul: "1. Ruang Lingkup Utama",
      detailsText: "a. Pengecekan instalasi dan persiapan alat kerja.",
    },
  ]);

  // Modal Terapkan Template
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [selectedTplId, setSelectedTplId] = useState(templates[0]?.id ?? "");
  const [customTplJudul, setCustomTplJudul] = useState("");

  // Modal Komentar & Ubah Warna Kolom Harian
  const [noteModal, setNoteModal] = useState<{
    workItemId: string;
    workItemJudul: string;
    subScopeId?: string | null;
    subScopeJudul?: string | null;
    taskDetailId?: string | null;
    taskDetailTeks?: string | null;
    allDetailIds?: string[] | null;
    tanggal: string;
    status: ScheduleCellStatus;
    warnaCustom: string | null;
    catatan: string;
  } | null>(null);

  // Modal Ubah Tanggal Pengerjaan & Atur Bentrok / Prioritas
  const [rescheduleModal, setRescheduleModal] = useState<{
    workItem: WorkItemDTO;
    subScopeId: string | null; // null = semua sub-pekerjaan
    startDate: string;
    durationDays: number;
    status: ScheduleCellStatus;
  } | null>(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleFeedback, setRescheduleFeedback] = useState<{
    type: "success" | "error" | "conflict";
    message: string;
  } | null>(null);

  const projectedDates = useMemo(() => {
    if (!rescheduleModal?.startDate) return [];
    return Array.from({ length: rescheduleModal.durationDays || 1 }, (_, i) =>
      addDaysIso(rescheduleModal.startDate, i)
    );
  }, [rescheduleModal?.startDate, rescheduleModal?.durationDays]);

  const conflictsInProjectedRange = useMemo(() => {
    if (!rescheduleModal) return [];
    const list: {
      date: string;
      occupants: { workItemId: string; label: string }[];
    }[] = [];
    for (const dIso of projectedDates) {
      const occs = (globalOccupantsByDate[dIso] ?? []).filter(
        (o) => o.workItemId !== rescheduleModal.workItem.id
      );
      if (occs.length > 0) {
        list.push({ date: dIso, occupants: occs });
      }
    }
    return list;
  }, [rescheduleModal, projectedDates, globalOccupantsByDate]);

  async function handleExecuteReschedule(
    mode: "MANUAL" | "AUTO_FREE_SLOT" | "BY_PRIORITY"
  ) {
    if (!rescheduleModal || rescheduleBusy) return;
    setRescheduleBusy(true);
    setRescheduleFeedback(null);
    try {
      const res = await fetch("/api/schedule/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workItemId: rescheduleModal.workItem.id,
          subScopeId: rescheduleModal.subScopeId || null,
          newStartDate: rescheduleModal.startDate,
          durationDays: rescheduleModal.durationDays,
          status: rescheduleModal.status,
          mode,
          allowParallelOverride: mode === "BY_PRIORITY",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRescheduleFeedback({
          type: "conflict",
          message: data.error || "Terjadi bentrok kapasitas jadwal.",
        });
        return;
      }
      setRescheduleFeedback({
        type: "success",
        message: data.message || "Jadwal berhasil disesuaikan!",
      });
      setTimeout(() => {
        setRescheduleModal(null);
        router.refresh();
      }, 700);
    } catch {
      setRescheduleFeedback({
        type: "error",
        message: "Gagal menghubungkan ke server.",
      });
    } finally {
      setRescheduleBusy(false);
    }
  }

  const dayDates = useMemo(
    () => laneDatesIso(lane.tanggalMulai, lane.jumlahHari, customDates),
    [lane.tanggalMulai, lane.jumlahHari, customDates]
  );

  // Fitur Shift + Scroll Mouse untuk menggeser kolom Hari secara horizontal
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        // Cegah scroll vertikal saat menahan Shift, lalu alihkan ke scroll horizontal tabel
        e.preventDefault();
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        el.scrollLeft += delta;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  async function handleDayDateChange(dayIndex: number, newDate: string) {
    if (!newDate) return;
    const oldDate = dayDates[dayIndex];
    if (oldDate === newDate) return;

    // Buat salinan seluruh tanggal Day saat ini
    const updatedDates = [...dayDates];
    updatedDates[dayIndex] = newDate;

    // Update optimis ke state lokal
    setCustomDates(updatedDates);

    const isDay1 = dayIndex === 0;
    const payload: {
      customDatesJson: string;
      oldDate: string;
      newDate: string;
      tanggalMulai?: string;
    } = {
      customDatesJson: JSON.stringify(updatedDates),
      oldDate,
      newDate,
    };
    if (isDay1) {
      payload.tanggalMulai = newDate;
    }

    setDateChangeToast(`Menyimpan tanggal Day ${dayIndex + 1} (${newDate})...`);
    try {
      const res = await fetch(`/api/lanes/${lane.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setDateChangeToast(
          `Tanggal Day ${dayIndex + 1} berhasil diubah ke ${formatHariTanggalSingkat(newDate)}!`
        );
        setTimeout(() => setDateChangeToast(null), 3000);
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal mengubah tanggal kolom Day.");
        router.refresh();
      }
    } catch {
      alert("Gagal menghubungi server saat mengubah tanggal.");
      router.refresh();
    }
  }

  async function handleResetSequentialDates() {
    if (
      !window.confirm(
        "Urutkan kembali seluruh tanggal Day secara berurutan mulai dari Day 1?"
      )
    ) {
      return;
    }
    const start = dayDates[0] || lane.tanggalMulai;
    const seq = Array.from({ length: lane.jumlahHari }, (_, i) =>
      addDaysIso(start, i)
    );
    setCustomDates(seq);
    setDateChangeToast("Mengurutkan tanggal secara otomatis...");
    try {
      const res = await fetch(`/api/lanes/${lane.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDatesJson: JSON.stringify(seq),
        }),
      });
      if (res.ok) {
        setDateChangeToast("Tanggal berhasil diurutkan kembali!");
        setTimeout(() => setDateChangeToast(null), 3000);
        router.refresh();
      }
    } catch {
      router.refresh();
    }
  }

  async function toggleProjectParallel() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bolehParalel: !project.bolehParalel }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function applyCellAction(
    workItemId: string,
    tanggal: string,
    brush: ScheduleCellStatus | "ERASE",
    options?: {
      subScopeId?: string | null;
      subScopeJudul?: string | null;
      taskDetailId?: string | null;
      allDetailIds?: string[] | null;
      isShiftClick?: boolean;
      acknowledgeComponentWarning?: boolean;
      allowParallelOverride?: boolean;
      warnaCustomOverride?: string | null;
    }
  ) {
    if (busy) return;
    setBusy(true);
    try {
      if (brush === "ERASE") {
        const qs = new URLSearchParams({
          workItemId,
          tanggal,
        });
        if (options?.subScopeId) qs.set("subScopeId", options.subScopeId);
        if (options?.taskDetailId) qs.set("taskDetailId", options.taskDetailId);
        if (options?.allDetailIds && options.allDetailIds.length > 0) {
          qs.set("allDetailIds", JSON.stringify(options.allDetailIds));
        }
        if (options?.isShiftClick) qs.set("isShiftClick", "true");
        await fetch(`/api/schedule?${qs.toString()}`, { method: "DELETE" });
        router.refresh();
        return;
      }

      const chosenCustomColor =
        options?.warnaCustomOverride !== undefined
          ? options.warnaCustomOverride
          : null; // warna kustom bebas dihapus, selalu null kecuali override eksplisit

      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workItemId,
          subScopeId: options?.subScopeId || null,
          taskDetailId: options?.taskDetailId || null,
          allDetailIds: options?.allDetailIds || null,
          isShiftClick: options?.isShiftClick ?? false,
          tanggal,
          status: brush,
          warnaCustom: chosenCustomColor,
          acknowledgeComponentWarning:
            options?.acknowledgeComponentWarning ?? false,
          allowParallelOverride: options?.allowParallelOverride ?? false,
        }),
      });
      const data = await res.json();

      if (res.status === 409 && data.blocked) {
        setIsDraggingBrush(false);
        setConflictModal({
          message: data.error,
          suggestions: data.conflict?.suggestions ?? [],
          onPickSuggestion: (suggestedDate) => {
            setConflictModal(null);
            void applyCellAction(workItemId, suggestedDate, brush, {
              subScopeId: options?.subScopeId,
              subScopeJudul: options?.subScopeJudul,
              taskDetailId: options?.taskDetailId,
              allDetailIds: options?.allDetailIds,
              isShiftClick: options?.isShiftClick,
              warnaCustomOverride: chosenCustomColor,
            });
          },
          onForceParallel: () => {
            setConflictModal(null);
            void applyCellAction(workItemId, tanggal, brush, {
              subScopeId: options?.subScopeId,
              subScopeJudul: options?.subScopeJudul,
              taskDetailId: options?.taskDetailId,
              allDetailIds: options?.allDetailIds,
              isShiftClick: options?.isShiftClick,
              allowParallelOverride: true,
              warnaCustomOverride: chosenCustomColor,
            });
          },
        });
        return;
      }

      if (data.requiresWarningConfirm && data.warning) {
        setIsDraggingBrush(false);
        setWarningModal({
          message: data.warning.message,
          scope: data.warning.scope,
          missingComponents: data.warning.missingComponents,
          onConfirmSave: () => {
            setWarningModal(null);
            void applyCellAction(workItemId, tanggal, brush, {
              subScopeId: options?.subScopeId,
              subScopeJudul: options?.subScopeJudul,
              taskDetailId: options?.taskDetailId,
              allDetailIds: options?.allDetailIds,
              isShiftClick: options?.isShiftClick,
              acknowledgeComponentWarning: true,
              allowParallelOverride: options?.allowParallelOverride,
              warnaCustomOverride: chosenCustomColor,
            });
          },
        });
        return;
      }

      if (res.ok) {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function openCreateWorkItem() {
    setEditingWi(null);
    setWiJudul("");
    setWiJenis("WIRING");
    setWiParalel(project.bolehParalel);
    setWiPic(lane.pic ?? project.pic ?? "");
    setWiDeadline(lane.deadline ?? project.deadline ?? "");
    setWiCompIds([]);
    setWiSubScopes([
      {
        judul: "1. Persiapan & Instalasi",
        detailsText:
          "a. Pengecekan komponen dan jalur kabel.\nb. Pemasangan dan terminasi.",
      },
    ]);
    setWiModalOpen(true);
  }

  function openEditWorkItem(wi: WorkItemDTO) {
    setEditingWi(wi);
    setWiJudul(wi.judul);
    setWiJenis(wi.jenis);
    setWiParalel(wi.bolehParalel);
    setWiPic(wi.pic ?? "");
    setWiDeadline(wi.deadline ?? "");
    setWiCompIds(wi.componentIds);
    setWiSubScopes(
      wi.subScopes.map((ss) => ({
        judul: ss.judul,
        detailsText: ss.details.map((d) => d.teks).join("\n"),
      }))
    );
    setWiModalOpen(true);
  }

  async function handleSaveWorkItem(e: React.FormEvent) {
    e.preventDefault();
    const formattedSubScopes = wiSubScopes
      .map((ss) => ({
        judul: ss.judul.trim(),
        details: ss.detailsText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      }))
      .filter((ss) => ss.judul && ss.details.length > 0);

    if (formattedSubScopes.length === 0) return;

    setBusy(true);
    try {
      const url = editingWi
        ? `/api/work-items/${editingWi.id}`
        : "/api/work-items";
      const method = editingWi ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingWi ? {} : { laneId: lane.id }),
          judul: wiJudul,
          jenis: wiJenis,
          bolehParalel: wiParalel,
          pic: wiPic.trim() || null,
          deadline: wiDeadline || null,
          componentIds: wiCompIds,
          subScopes: formattedSubScopes,
        }),
      });
      if (res.ok) {
        setWiModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal menyimpan pekerjaan.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteWorkItem(wi: WorkItemDTO) {
    if (!window.confirm(`Hapus pekerjaan "${wi.judul}" dari lane ini?`)) return;
    await fetch(`/api/work-items/${wi.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleSaveAsTemplate(wi: WorkItemDTO) {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama: wi.judul,
        jenis: wi.jenis,
        bolehParalel: wi.bolehParalel,
        deskripsi: `Disimpan dari proyek ${project.nama} (${lane.nama})`,
        subScopes: wi.subScopes.map((ss) => ({
          judul: ss.judul,
          details: ss.details.map((d) => d.teks),
        })),
      }),
    });
    if (res.ok) {
      window.alert(`"${wi.judul}" berhasil disimpan ke Template Pekerjaan!`);
      router.refresh();
    }
  }

  async function handleApplyTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTplId) return;
    const res = await fetch("/api/templates/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        laneId: lane.id,
        templateId: selectedTplId,
        judul: customTplJudul.trim() || undefined,
      }),
    });
    if (res.ok) {
      setTplModalOpen(false);
      setCustomTplJudul("");
      router.refresh();
    }
  }

  function handleOpenLaneSettings() {
    setLaneForm({
      nama: lane.nama,
      subjudul: lane.subjudul,
      tanggalMulai: dayDates[0] || lane.tanggalMulai,
      jumlahHari: lane.jumlahHari,
      deadline: lane.deadline ?? project.deadline ?? "",
      pic: lane.pic ?? project.pic ?? "",
    });
    setLaneFormCustomDates([...dayDates]);
    setLaneModalOpen(true);
  }

  async function handleSaveLaneSettings(e: React.FormEvent) {
    e.preventDefault();
    const startDt = laneFormCustomDates[0] || laneForm.tanggalMulai;
    const finalDates = Array.from({ length: laneForm.jumlahHari }, (_, i) => {
      if (laneFormCustomDates[i]) return laneFormCustomDates[i];
      return addDaysIso(startDt, i);
    });

    const res = await fetch(`/api/lanes/${lane.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...laneForm,
        tanggalMulai: finalDates[0] || laneForm.tanggalMulai,
        deadline: laneForm.deadline || null,
        pic: laneForm.pic.trim() || null,
        customDatesJson: JSON.stringify(finalDates),
      }),
    });
    if (res.ok) {
      setCustomDates(finalDates);
      setLaneModalOpen(false);
      router.refresh();
    }
  }

  async function handleSaveCellNoteAndColor(e: React.FormEvent) {
    e.preventDefault();
    if (!noteModal) return;
    setBusy(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workItemId: noteModal.workItemId,
          subScopeId: noteModal.subScopeId || null,
          taskDetailId: noteModal.taskDetailId || null,
          allDetailIds: noteModal.allDetailIds || null,
          tanggal: noteModal.tanggal,
          status: noteModal.status,
          warnaCustom: noteModal.warnaCustom,
          catatan: noteModal.catatan,
          acknowledgeComponentWarning: true,
          allowParallelOverride: true,
        }),
      });
      if (res.ok) {
        setNoteModal(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleClearCellFromModal() {
    if (!noteModal) return;
    setBusy(true);
    try {
      const qs = new URLSearchParams({
        workItemId: noteModal.workItemId,
        tanggal: noteModal.tanggal,
      });
      if (noteModal.subScopeId) qs.set("subScopeId", noteModal.subScopeId);
      if (noteModal.taskDetailId) qs.set("taskDetailId", noteModal.taskDetailId);
      if (noteModal.allDetailIds && noteModal.allDetailIds.length > 0) {
        qs.set("allDetailIds", JSON.stringify(noteModal.allDetailIds));
      }
      await fetch(`/api/schedule?${qs.toString()}`, { method: "DELETE" });
      setNoteModal(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const effectiveLanePic = lane.pic ?? project.pic;
  const effectiveLaneDeadline = lane.deadline ?? project.deadline;

  return (
    <div
      className="space-y-4 select-none min-w-0 w-full max-w-full"
      onMouseUp={() => setIsDraggingBrush(false)}
      onMouseLeave={() => setIsDraggingBrush(false)}
    >
      {/* Header Lane */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-600 mb-1.5">
              <Link
                href={`/proyek/${project.id}?tab=jadwal`}
                className="inline-flex items-center gap-1.5 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4" /> {project.nama}
              </Link>
              <span>•</span>
              <Link
                href="/jadwal"
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700"
              >
                <Calendar className="w-4 h-4" /> Buka Tampilan Kalender
              </Link>
              <span>•</span>
              <Link
                href={`/jadwal/buat?projectId=${project.id}`}
                className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800"
              >
                <CalendarPlus className="w-4 h-4" /> Buat Schedule Proyek Baru
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Schedule Lane {lane.nama}
              </h1>
              <button
                type="button"
                disabled={busy}
                onClick={toggleProjectParallel}
                title="Klik untuk mengaktifkan/menonaktifkan mode Proyek Paralel agar proyek ini bisa jalan bersamaan di hari yang sama dengan proyek lain"
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border transition cursor-pointer ${
                  project.bolehParalel
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-800"
                }`}
              >
                <GitFork className="w-3.5 h-3.5" />
                {project.bolehParalel
                  ? "Proyek Paralel: AKTIF"
                  : "Aktifkan Proyek Paralel"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 mt-1">
              <span>
                Sheet: <strong>{project.client} | {lane.nama}</strong>
              </span>
              <span>
                • Mulai Day 1:{" "}
                <strong>{formatTanggalId(lane.tanggalMulai)}</strong> (
                <strong>{lane.jumlahHari} Hari</strong>)
              </span>
              {effectiveLaneDeadline && (
                <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                  <Clock className="w-4 h-4" /> Deadline:{" "}
                  {formatTanggalId(effectiveLaneDeadline, false)}
                </span>
              )}
              {effectiveLanePic && (
                <span className="inline-flex items-center gap-1 text-slate-800 font-bold">
                  <User className="w-4 h-4 text-blue-600" /> PIC:{" "}
                  {effectiveLanePic}
                </span>
              )}
            </div>

            {/* Switch Cepat Antar Lane dalam Proyek yang Sama */}
            {otherLanesInProject.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {otherLanesInProject.map((ol) => (
                  <Link
                    key={ol.id}
                    href={`/jadwal/lane/${ol.id}`}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${
                      ol.id === lane.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {ol.nama} ({ol.jumlahHari}h)
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/import-schedule?projectId=${project.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 border border-teal-300 hover:bg-teal-100 text-sm font-bold text-teal-800"
            >
              <Upload className="w-4 h-4 text-teal-600" /> Import Schedule
            </Link>
            <button
              type="button"
              onClick={handleOpenLaneSettings}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-bold text-slate-800 cursor-pointer"
            >
              <Settings2 className="w-4 h-4" /> Info, PIC & Durasi Lane
            </button>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeExportDates}
                onChange={(e) => setIncludeExportDates(e.target.checked)}
              />
              Tanggal di Excel
            </label>
            <a
              href={`/api/export/jadwal?laneId=${lane.id}${
                includeExportDates ? "&includeDates=1" : ""
              }`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-bold text-slate-900"
            >
              <Download className="w-4 h-4" /> Export Lane Ini
            </a>
            <a
              href={`/api/export/jadwal?projectId=${project.id}${
                includeExportDates ? "&includeDates=1" : ""
              }`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold"
            >
              <Download className="w-4 h-4" /> Export Semua Lane
            </a>
          </div>
        </div>
      </div>

      {/* Bar Kuas Status, Pemilih Warna Kolom Bebas, & Tombol Tambah Pekerjaan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-700 mr-1">
              Pilih Status Kuas:
            </span>
            {SCHEDULE_CELL_STATUSES.map((st) => {
              const hex = `#${SCHEDULE_STATUS_RGB[st]}`;
              const dark = isLightHexColor(hex);
              const active = activeBrush === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setActiveBrush(st);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-sm font-extrabold transition cursor-pointer ${
                    active
                      ? "ring-2 ring-offset-2 ring-slate-900 scale-105"
                      : "opacity-85 hover:opacity-100"
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
            <button
              type="button"
              onClick={() => setActiveBrush("ERASE")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border transition cursor-pointer ${
                activeBrush === "ERASE"
                  ? "bg-rose-600 border-rose-600 text-white ring-2 ring-offset-2 ring-rose-500"
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Eraser className="w-4 h-4" /> Kosongkan Sel
            </button>

            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 ml-1">
              <span>💡</span>
              <span>
                <strong>Klik:</strong> 1 sub-point (a, b, c) &bull;{" "}
                <strong>Shift + Klik:</strong> 1 grup sub-pekerjaan
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {lane.workItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const firstWi = lane.workItems[0];
                  const firstCell = firstWi.scheduleCells[0];
                  setRescheduleModal({
                    workItem: firstWi,
                    subScopeId: null,
                    startDate: firstCell ? firstCell.tanggal : lane.tanggalMulai,
                    durationDays: Math.max(1, firstWi.scheduleCells.length),
                    status: (firstCell?.status as ScheduleCellStatus) || "TARGET",
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-bold cursor-pointer transition shadow-xs"
                title="Ubah Tanggal Pengerjaan & Sesuaikan Prioritas Tanpa Bentrok"
              >
                <CalendarDays className="w-4 h-4 text-emerald-600" /> Atur Tanggal & Bebaskan Bentrok
              </button>
            )}
            {templates.length > 0 && (
              <button
                type="button"
                onClick={() => setTplModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-sm font-bold cursor-pointer"
              >
                <Layers className="w-4 h-4" /> Dari Template
              </button>
            )}
            {lane.workItems.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setReorderingItems([...lane.workItems]);
                  setFullReorderOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold cursor-pointer transition shadow-2xs"
                title="Atur urutan seluruh pekerjaan dalam lane ini"
              >
                <ListOrdered className="w-4 h-4 text-blue-600" /> Atur Urutan
              </button>
            )}
            <button
              type="button"
              onClick={openCreateWorkItem}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tambah Pekerjaan
            </button>
          </div>
        </div>

      </div>

      {/* GRID EDITOR DENGAN TEKS BESAR, KOMENTAR LANGSUNG DI KOLOM BERWARNA, & UBAH WARNA */}
      <div className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-xs min-w-0 w-full max-w-full">
        {/* Kontainer Tabel Utama dengan Dukungan Shift + Scroll Mouse */}
        <div
          ref={tableScrollRef}
          className="overflow-x-auto w-full max-w-full schedule-scrollbar"
        >
          <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th
                  rowSpan={2}
                  className="sticky left-0 top-0 z-40 bg-slate-900 text-white border-b border-r border-slate-700 px-2 py-2 w-[44px] min-w-[44px] max-w-[44px] text-center font-black text-xs"
                >
                  NO
                </th>
                <th
                  rowSpan={2}
                  colSpan={2}
                  className="sticky left-[44px] top-0 z-40 bg-slate-900 text-white border-b border-r border-slate-700 px-2.5 py-2 text-center font-black text-xs sm:text-sm w-[400px] min-w-[400px] max-w-[400px]"
                >
                  DESCRIPTION (Pekerjaan & Sub-Pekerjaan)
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[444px] top-0 z-40 bg-slate-900 text-white border-b border-r-2 border-r-slate-500 px-2.5 py-2 text-center font-black text-xs sm:text-sm w-[280px] min-w-[280px] max-w-[280px] shadow-[4px_0_10px_-2px_rgba(0,0,0,0.35)]"
                >
                  SCOPE of WORK (Rincian Tugas)
                </th>
                <th
                  colSpan={dayDates.length}
                  className="border-b border-r border-slate-700 px-3 py-2 text-center font-extrabold text-xs sm:text-sm tracking-wider bg-slate-900 text-white"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <span className="text-xs uppercase tracking-wider text-slate-300">
                      DAY (Klik tombol kalender/tanggal di bawah untuk tentukan tanggal manual)
                    </span>
                    <button
                      type="button"
                      onClick={handleResetSequentialDates}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                      title="Urutkan kembali semua tanggal Day secara berurutan mulai dari Day 1"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-300" />
                      Auto-Urutkan
                    </button>
                  </div>
                </th>
              </tr>
              <tr className="bg-slate-800 text-white">
                {dayDates.map((dtIso, idx) => {
                  const occ = globalOccupantsByDate[dtIso] ?? [];
                  const tglMerah = isTanggalMerah(dtIso);
                  const isToday = dtIso === todayIsoLocal();
                  return (
                    <th
                      key={`day-${idx}-${dtIso}`}
                      className={`border-b border-r px-2 py-2 min-w-[125px] text-center transition-colors relative group/dayth ${
                        isToday
                          ? "ring-2 ring-blue-500 ring-inset bg-blue-950/70 border-blue-400"
                          : tglMerah.isRed
                            ? "bg-rose-950 text-rose-100 border-rose-800 shadow-inner"
                            : "bg-slate-800 text-white border-slate-700"
                      }`}
                    >
                      {/* Badge HARI INI */}
                      {isToday && (
                        <div className="mb-1 flex items-center justify-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider shadow-sm ring-1 ring-blue-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Hari Ini
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`text-sm font-black px-1.5 py-0.5 rounded ${
                            isToday
                              ? "bg-blue-600 text-white"
                              : tglMerah.isRed
                                ? "bg-rose-900/80 text-rose-200"
                                : "bg-slate-700 text-white"
                          }`}
                        >
                          DAY {idx + 1}
                        </span>

                        <label
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer transition shadow-xs"
                          title={`Ubah tanggal DAY ${idx + 1}`}
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Ubah</span>
                          <input
                            type="date"
                            value={dtIso}
                            onChange={(e) =>
                              handleDayDateChange(idx, e.target.value)
                            }
                            className="sr-only"
                            onClick={(e) => {
                              try {
                                (e.target as HTMLInputElement).showPicker?.();
                              } catch {}
                            }}
                          />
                        </label>
                      </div>

                      {/* Tampilan Tanggal yang bisa diklik */}
                      <label
                        className="block cursor-pointer group-hover/dayth:opacity-95"
                        title={`Klik untuk ubah tanggal DAY ${idx + 1}`}
                      >
                        <div
                          className={`text-xs font-extrabold whitespace-nowrap px-1.5 py-1 rounded-md transition border ${
                            isToday
                              ? "bg-blue-900/80 border-blue-400 text-blue-100 font-black shadow-xs"
                              : tglMerah.isRed
                                ? "bg-rose-900/60 border-rose-700/60 text-rose-100 hover:bg-rose-800/80"
                                : "bg-slate-700/60 border-slate-600/70 text-slate-100 hover:bg-slate-600"
                          }`}
                        >
                          {formatHariTanggalSingkat(dtIso)}
                        </div>
                        <input
                          type="date"
                          value={dtIso}
                          onChange={(e) =>
                            handleDayDateChange(idx, e.target.value)
                          }
                          className="sr-only"
                          onClick={(e) => {
                            try {
                              (e.target as HTMLInputElement).showPicker?.();
                            } catch {}
                          }}
                        />
                      </label>

                      {tglMerah.isRed && (
                        <div
                          title={tglMerah.keterangan}
                          className="mt-1 px-1.5 py-0.5 rounded bg-rose-600/30 text-rose-200 border border-rose-500/40 text-[10px] font-bold truncate max-w-[120px] mx-auto tracking-tight"
                        >
                          {tglMerah.keterangan || "Libur"}
                        </div>
                      )}
                      {occ.length > 0 && (
                        <div
                          title={`Terisi: ${occ.map((o) => o.label).join(", ")}`}
                          className="mt-1 px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 text-[10px] font-bold truncate max-w-[120px] mx-auto"
                        >
                          {occ.length} agenda
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {lane.workItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={4 + dayDates.length}
                    className="p-12 text-center text-base text-slate-500"
                  >
                    Belum ada pekerjaan pada lane ini. Klik &ldquo;Tambah
                    Pekerjaan&rdquo; atau &ldquo;Dari Template&rdquo;.
                  </td>
                </tr>
              ) : (
                lane.workItems.map((wi, wiIdx) => {
                  const cellByDetailAndDate = new Map<
                    string,
                    (typeof wi.scheduleCells)[0]
                  >();
                  const cellBySubScopeAndDate = new Map<
                    string,
                    (typeof wi.scheduleCells)[0]
                  >();
                  const cellByDate = new Map<
                    string,
                    (typeof wi.scheduleCells)[0]
                  >();

                  for (const sc of wi.scheduleCells) {
                    if (sc.taskDetailId) {
                      cellByDetailAndDate.set(
                        `${sc.taskDetailId}_${sc.tanggal}`,
                        sc
                      );
                    } else if (sc.subScopeId) {
                      cellBySubScopeAndDate.set(
                        `${sc.subScopeId}_${sc.tanggal}`,
                        sc
                      );
                    } else {
                      cellByDate.set(sc.tanggal, sc);
                    }
                  }
                  const subScopes =
                    wi.subScopes.length > 0
                      ? wi.subScopes
                      : [
                          {
                            id: "empty-ss",
                            urutan: 1,
                            judul: "-",
                            details: [{ id: "empty-d", urutan: 1, teks: "-" }],
                          },
                        ];

                  const totalDetailRows = subScopes.reduce(
                    (sum, ss) => sum + Math.max(1, ss.details.length),
                    0
                  );

                  const displayPic = wi.pic ?? lane.pic ?? project.pic;
                  const displayDeadline = wi.deadline ?? lane.deadline;

                  let renderedWiFirstRow = false;

                  return subScopes.flatMap((ss, ssIdx) => {
                    const details =
                      ss.details.length > 0
                        ? ss.details
                        : [{ id: "empty-d", urutan: 1, teks: "-" }];
                    let renderedSsFirstRow = false;

                    return details.map((det) => {
                      const isWiFirst = !renderedWiFirstRow;
                      renderedWiFirstRow = true;
                      const isSsFirst = !renderedSsFirstRow;
                      renderedSsFirstRow = true;

                      return (
                        <tr
                          key={`${wi.id}-${ss.id}-${det.id}`}
                          className={
                            isWiFirst
                              ? "border-t-2 border-t-slate-900"
                              : "border-t border-t-slate-200"
                          }
                        >
                          {isWiFirst && (
                            <td
                              rowSpan={totalDetailRows}
                              className="sticky left-0 z-30 bg-slate-100 border-b border-r border-slate-300 px-1 py-1.5 text-center font-black text-xs text-slate-800 align-middle w-[44px] min-w-[44px] max-w-[44px]"
                            >
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={wiIdx === 0 || busy}
                                  onClick={() => handleQuickMove(wi.id, wiIdx, wiIdx - 1)}
                                  className="p-0.5 rounded hover:bg-slate-300 text-slate-400 hover:text-slate-800 disabled:opacity-15 disabled:hover:bg-transparent transition cursor-pointer"
                                  title={`Geser naik ke No. ${wiIdx}`}
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setSingleReorder({
                                      workItem: wi,
                                      currentUrutan: wiIdx + 1,
                                      targetUrutan: wiIdx + 1,
                                    })
                                  }
                                  className="w-7 h-7 rounded-lg bg-white hover:bg-blue-600 hover:text-white border border-slate-300 hover:border-blue-600 shadow-2xs font-black text-xs flex items-center justify-center transition cursor-pointer text-slate-800"
                                  title={`Nomor Urut ${wiIdx + 1}. Klik untuk mengubah nomor urutan`}
                                >
                                  {wiIdx + 1}
                                </button>

                                <button
                                  type="button"
                                  disabled={wiIdx === lane.workItems.length - 1 || busy}
                                  onClick={() => handleQuickMove(wi.id, wiIdx, wiIdx + 1)}
                                  className="p-0.5 rounded hover:bg-slate-300 text-slate-400 hover:text-slate-800 disabled:opacity-15 disabled:hover:bg-transparent transition cursor-pointer"
                                  title={`Geser turun ke No. ${wiIdx + 2}`}
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}

                          {isWiFirst && (
                            <td
                              rowSpan={totalDetailRows}
                              className="sticky left-[44px] z-30 bg-white border-b border-r border-slate-300 p-2.5 align-middle w-[210px] min-w-[210px] max-w-[210px]"
                            >
                              <div className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug">
                                {wi.judul}
                              </div>

                              <div className="flex flex-wrap gap-1 mt-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                  {WORK_TYPE_LABELS[wi.jenis]}
                                </span>
                                {(wi.bolehParalel || project.bolehParalel) && (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                                    Paralel
                                  </span>
                                )}
                              </div>

                              {(displayPic || displayDeadline) && (
                                <div className="mt-2 space-y-0.5 text-[11px] font-semibold text-slate-600">
                                  {displayPic && (
                                    <div className="flex items-center gap-1">
                                      <User className="w-3 h-3 text-blue-600 shrink-0" />
                                      <span className="truncate">PIC: {displayPic}</span>
                                    </div>
                                  )}
                                  {displayDeadline && (
                                    <div className="flex items-center gap-1 text-rose-700 font-bold">
                                      <Clock className="w-3 h-3 shrink-0" />
                                      <span>
                                        DL: {formatTanggalId(displayDeadline, false)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center gap-1 mt-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const firstCell = wi.scheduleCells[0];
                                    setRescheduleModal({
                                      workItem: wi,
                                      subScopeId: null,
                                      startDate: firstCell
                                        ? firstCell.tanggal
                                        : lane.tanggalMulai,
                                      durationDays: Math.max(
                                        1,
                                        wi.scheduleCells.length
                                      ),
                                      status:
                                        (firstCell?.status as ScheduleCellStatus) ||
                                        "TARGET",
                                    });
                                  }}
                                  className="p-1 rounded hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                                  title="Ubah Tanggal Pengerjaan & Sesuaikan Prioritas Tanpa Bentrok"
                                >
                                  <CalendarDays className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditWorkItem(wi)}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                                  title="Edit Pekerjaan, PIC, Deadline & Sub-Scope"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveAsTemplate(wi)}
                                  className="p-1 rounded hover:bg-indigo-100 text-indigo-600 cursor-pointer"
                                  title="Simpan sebagai Template Pekerjaan"
                                >
                                  <BookmarkPlus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSingleReorder({
                                      workItem: wi,
                                      currentUrutan: wiIdx + 1,
                                      targetUrutan: wiIdx + 1,
                                    })
                                  }
                                  className="p-1 rounded hover:bg-amber-100 text-amber-700 cursor-pointer"
                                  title={`Ubah Nomor Urut (saat ini No. ${wiIdx + 1})`}
                                >
                                  <ListOrdered className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteWorkItem(wi)}
                                  className="p-1 rounded hover:bg-rose-100 text-rose-600 cursor-pointer"
                                  title="Hapus Pekerjaan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}

                          {isSsFirst && (
                            <td
                              rowSpan={details.length}
                              className="sticky left-[254px] z-30 bg-white border-b border-r border-slate-300 p-2 align-middle w-[190px] min-w-[190px] max-w-[190px] font-bold text-xs text-slate-900"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="leading-snug">{ss.judul}</span>
                                {ss.id && !ss.id.startsWith("empty-") && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const subCells = wi.scheduleCells.filter(
                                        (c) => c.subScopeId === ss.id
                                      );
                                      setRescheduleModal({
                                        workItem: wi,
                                        subScopeId: ss.id,
                                        startDate: subCells[0]
                                          ? subCells[0].tanggal
                                          : lane.tanggalMulai,
                                        durationDays: Math.max(
                                          1,
                                          subCells.length
                                        ),
                                        status:
                                          (subCells[0]
                                            ?.status as ScheduleCellStatus) ||
                                          "TARGET",
                                      });
                                    }}
                                    className="text-slate-400 hover:text-emerald-700 p-0.5 rounded hover:bg-emerald-50 transition cursor-pointer shrink-0"
                                    title={`Ubah tanggal untuk sub-pekerjaan: ${ss.judul}`}
                                  >
                                    <CalendarDays className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}

                          <td className="sticky left-[444px] z-30 bg-white border-b border-r-2 border-r-slate-400 p-2 text-xs font-normal text-slate-700 whitespace-pre-line leading-relaxed w-[280px] min-w-[280px] max-w-[280px] shadow-[4px_0_10px_-2px_rgba(0,0,0,0.12)]">
                            {det.teks}
                          </td>

                          {/* Sel Hari Day 1..N: Setiap sub point (a, b, c, dst) memiliki kotak sendiri */}
                          {dayDates.map((dtIso) => {
                            const isFirstSubScope = ssIdx === 0;
                            const hasSubScopeCellsForDate =
                              wi.scheduleCells.some(
                                (c) =>
                                  (c.subScopeId || c.taskDetailId) &&
                                  c.tanggal === dtIso
                              );

                            const hasDetailCellsForSs = details.some(
                              (d) =>
                                d.id &&
                                cellByDetailAndDate.has(`${d.id}_${dtIso}`)
                            );

                            const detailScheduled =
                              det.id && !det.id.startsWith("empty-")
                                ? cellByDetailAndDate.get(`${det.id}_${dtIso}`)
                                : undefined;

                            const subScopeScheduled =
                              !hasDetailCellsForSs &&
                              ss.id &&
                              !ss.id.startsWith("empty-")
                                ? cellBySubScopeAndDate.get(`${ss.id}_${dtIso}`)
                                : undefined;

                            const workItemScheduled =
                              !hasSubScopeCellsForDate && isFirstSubScope
                                ? cellByDate.get(dtIso)
                                : undefined;

                            const scheduled =
                              detailScheduled ??
                              subScopeScheduled ??
                              workItemScheduled;

                            const bgHex = scheduled
                              ? scheduled.warnaCustom ||
                                `#${SCHEDULE_STATUS_RGB[scheduled.status]}`
                              : undefined;
                            const otherOcc = (
                              globalOccupantsByDate[dtIso] ?? []
                            ).filter((o) => o.workItemId !== wi.id);

                            const tglMerah = isTanggalMerah(dtIso);

                            const subScopeIdParam =
                              ss.id && !ss.id.startsWith("empty-")
                                ? ss.id
                                : null;
                            const subScopeJudulParam =
                              ss.judul !== "-" ? ss.judul : null;
                            const validDetailId =
                              det.id && !det.id.startsWith("empty-")
                                ? det.id
                                : null;
                            const allValidDetailIds = details
                              .map((d) => d.id)
                              .filter((id) => id && !id.startsWith("empty-"));

                            return (
                              <td
                                key={dtIso}
                                onMouseDown={(e) => {
                                  setIsDraggingBrush(true);
                                  const isShift = e.shiftKey;
                                  void applyCellAction(
                                    wi.id,
                                    dtIso,
                                    activeBrush,
                                    {
                                      subScopeId: subScopeIdParam,
                                      subScopeJudul: subScopeJudulParam,
                                      taskDetailId: isShift
                                        ? null
                                        : validDetailId,
                                      allDetailIds: allValidDetailIds,
                                      isShiftClick: isShift,
                                    }
                                  );
                                }}
                                onMouseEnter={(e) => {
                                  if (isDraggingBrush) {
                                    const isShift = e.shiftKey;
                                    void applyCellAction(
                                      wi.id,
                                      dtIso,
                                      activeBrush,
                                      {
                                        subScopeId: subScopeIdParam,
                                        subScopeJudul: subScopeJudulParam,
                                        taskDetailId: isShift
                                          ? null
                                          : validDetailId,
                                        allDetailIds: allValidDetailIds,
                                        isShiftClick: isShift,
                                      }
                                    );
                                  }
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (scheduled) {
                                    setNoteModal({
                                      workItemId: wi.id,
                                      workItemJudul: wi.judul,
                                      subScopeId: subScopeIdParam,
                                      subScopeJudul: subScopeJudulParam,
                                      taskDetailId: validDetailId,
                                      taskDetailTeks:
                                        det.teks !== "-" ? det.teks : null,
                                      allDetailIds: allValidDetailIds,
                                      tanggal: dtIso,
                                      status: scheduled.status,
                                      warnaCustom: scheduled.warnaCustom,
                                      catatan: scheduled.catatan ?? "",
                                    });
                                  }
                                }}
                                title={
                                  scheduled
                                    ? `${tglMerah.isRed ? `[Tanggal Merah: ${tglMerah.keterangan}] ` : ""}${SCHEDULE_CELL_LABELS[scheduled.status]}${
                                        scheduled.catatan
                                          ? ` — Komentar: ${scheduled.catatan}`
                                          : ""
                                      } [${subScopeJudulParam || wi.judul} — ${det.teks.slice(0, 35)}] (Klik: ubah point ini, Shift+Klik: ubah 1 grup, Klik 2x: komentar)`
                                    : otherOcc.length > 0
                                      ? `${tglMerah.isRed ? `[Tanggal Merah: ${tglMerah.keterangan}] ` : ""}Terisi: ${otherOcc
                                          .map((o) => o.label)
                                          .join(", ")}`
                                      : `${tglMerah.isRed ? `[Tanggal Merah: ${tglMerah.keterangan}] ` : ""}Klik: warnai point ini, Shift+Klik: warnai 1 grup [${
                                          subScopeJudulParam || wi.judul
                                        }] (${activeBrush})`
                                }
                                className={`p-1 text-center cursor-pointer transition relative select-none group border-b border-r ${
                                  !scheduled && tglMerah.isRed
                                    ? "bg-rose-100/70 hover:bg-rose-200/80 border-rose-300/90"
                                    : !scheduled && otherOcc.length > 0
                                      ? "bg-rose-50/40 hover:bg-rose-100/50 border-slate-300"
                                      : !scheduled
                                        ? "hover:bg-blue-50 border-slate-300"
                                        : tglMerah.isRed
                                          ? "border-rose-400 hover:brightness-95"
                                          : "border-slate-300 hover:brightness-95"
                                }`}
                                style={
                                  bgHex ? { backgroundColor: bgHex } : undefined
                                }
                              >
                                {scheduled && scheduled.catatan && (
                                  <div
                                    className="w-full max-w-[135px] mx-auto rounded-lg bg-white/95 text-slate-900 px-2 py-1 shadow-xs border border-slate-900/15 text-left cursor-pointer hover:bg-white"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNoteModal({
                                        workItemId: wi.id,
                                        workItemJudul: wi.judul,
                                        subScopeId: subScopeIdParam,
                                        subScopeJudul: subScopeJudulParam,
                                        taskDetailId: validDetailId,
                                        taskDetailTeks:
                                          det.teks !== "-" ? det.teks : null,
                                        allDetailIds: allValidDetailIds,
                                        tanggal: dtIso,
                                        status: scheduled.status,
                                        warnaCustom: scheduled.warnaCustom,
                                        catatan: scheduled.catatan ?? "",
                                      });
                                    }}
                                    title="Klik untuk membuka catatan"
                                  >
                                    <div className="flex items-center gap-1 text-[11px] font-extrabold text-blue-700">
                                      <MessageSquare className="w-3 h-3 shrink-0" />
                                      <span>Catatan</span>
                                    </div>
                                    <div className="text-xs font-semibold leading-snug line-clamp-3 mt-0.5 break-words">
                                      {scheduled.catatan}
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  });
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legenda Warna Persis File 2 + Info Interaksi */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-t border-slate-200 text-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-bold text-slate-700">Legenda Status:</span>
            {SCHEDULE_CELL_STATUSES.map((st) => (
              <span
                key={st}
                className="px-3 py-1 rounded-lg font-extrabold text-xs"
                style={{
                  backgroundColor: `#${SCHEDULE_STATUS_RGB[st]}`,
                  color: isLightHexColor(`#${SCHEDULE_STATUS_RGB[st]}`)
                    ? "#0f172a"
                    : "#ffffff",
                }}
              >
                {SCHEDULE_CELL_LABELS[st]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-extrabold text-xs bg-rose-950 text-rose-200 border border-rose-800">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              Tanggal Merah (Minggu & Libur Nasional)
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            Tips: Klik 1x pada kolom untuk mewarnai langsung sesuai status kuas, atau klik 2x (double-click) untuk membuka catatan komentar.
          </span>
        </div>
      </div>

      {/* Modal Feedback Konflik & Warning Komponen */}
      <ScheduleFeedbackModals
        conflict={conflictModal}
        onCloseConflict={() => setConflictModal(null)}
        warning={warningModal}
        onCloseWarning={() => setWarningModal(null)}
        busy={busy}
      />

      {/* Modal Tambah / Edit Pekerjaan Hierarkis */}
      {wiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h2 className="font-bold text-base">
                {editingWi
                  ? "Edit Pekerjaan, PIC, Deadline & Sub-Pekerjaan"
                  : "Tambah Pekerjaan Baru ke Lane"}
              </h2>
              <button
                type="button"
                onClick={() => setWiModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveWorkItem}
              className="p-5 space-y-4 overflow-y-auto text-sm"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold mb-1">
                    Pekerjaan yang Dikerjakan (Kolom DESCRIPTION) *
                  </label>
                  <input
                    type="text"
                    required
                    value={wiJudul}
                    onChange={(e) => setWiJudul(e.target.value)}
                    placeholder="Contoh: Instalasi Motor pada Rotary Table"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Jenis Pekerjaan
                  </label>
                  <select
                    value={wiJenis}
                    onChange={(e) => setWiJenis(e.target.value as WorkType)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {WORK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {WORK_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Yang Mengerjakan / PIC (Siapa)
                  </label>
                  <input
                    type="text"
                    value={wiPic}
                    onChange={(e) => setWiPic(e.target.value)}
                    placeholder="Pilih atau ketik nama PIC..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {SYSTEM_PICS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setWiPic(p.value)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ${
                          wiPic === p.value
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.value}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Deadline Pekerjaan
                  </label>
                  <input
                    type="date"
                    value={wiDeadline}
                    onChange={(e) => setWiDeadline(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 bg-indigo-50 border border-indigo-200 px-3.5 py-2.5 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={wiParalel}
                  onChange={(e) => setWiParalel(e.target.checked)}
                />
                Boleh dikerjakan paralel di hari yang sama dengan proyek/pekerjaan
                lain
              </label>

              {/* Sub-Scopes & Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase">
                    Daftar Sub-Pekerjaan & Rincian Tugas (Satu baris per rincian
                    a, b, c...)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setWiSubScopes([
                        ...wiSubScopes,
                        {
                          judul: `${wiSubScopes.length + 1}. Sub-Pekerjaan Baru`,
                          detailsText: "a. Rincian pekerjaan...",
                        },
                      ])
                    }
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold cursor-pointer"
                  >
                    + Tambah Sub-Pekerjaan
                  </button>
                </div>

                {wiSubScopes.map((ss, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={ss.judul}
                        onChange={(e) => {
                          const copy = [...wiSubScopes];
                          copy[idx] = { ...copy[idx], judul: e.target.value };
                          setWiSubScopes(copy);
                        }}
                        placeholder="Contoh: 1. Electrical & Pneumatic Integration"
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-bold"
                      />
                      {wiSubScopes.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setWiSubScopes(
                              wiSubScopes.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      required
                      value={ss.detailsText}
                      onChange={(e) => {
                        const copy = [...wiSubScopes];
                        copy[idx] = {
                          ...copy[idx],
                          detailsText: e.target.value,
                        };
                        setWiSubScopes(copy);
                      }}
                      placeholder={
                        "Pisahkan tiap rincian tugas dengan baris baru:\na. Detail pertama\nb. Detail kedua"
                      }
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                ))}
              </div>

              {/* Tautan Komponen Tertentu (WorkItemComponent Opsional) */}
              {projectComponents.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tautkan Komponen Tertentu (Opsional — untuk akurasi warning
                    komponen belum datang)
                  </label>
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50 text-xs">
                    {projectComponents.map((c) => {
                      const arrived = ARRIVED_PURCHASE_STATUSES.includes(
                        c.statusPembelian
                      );
                      return (
                        <label
                          key={c.id}
                          className="flex items-start gap-2 p-1.5 rounded bg-white border border-slate-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={wiCompIds.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setWiCompIds([...wiCompIds, c.id]);
                              } else {
                                setWiCompIds(
                                  wiCompIds.filter((id) => id !== c.id)
                                );
                              }
                            }}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate">
                              {c.partName} — {c.partType}
                            </div>
                            <div
                              className={`text-[11px] font-semibold ${
                                arrived ? "text-emerald-700" : "text-amber-700"
                              }`}
                            >
                              {PURCHASE_STATUS_LABELS[c.statusPembelian]}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWiModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold cursor-pointer"
                >
                  Simpan Pekerjaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Terapkan Template */}
      {tplModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white font-bold">
              Tambah Pekerjaan dari Template
            </div>
            <form onSubmit={handleApplyTemplate} className="p-5 space-y-3 text-sm">
              <div>
                <label className="block font-bold mb-1">Pilih Template *</label>
                <select
                  value={selectedTplId}
                  onChange={(e) => setSelectedTplId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama} ({WORK_TYPE_LABELS[t.jenis]} • {t.subScopesCount}{" "}
                      sub-scope)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">
                  Judul Kustom (Opsional)
                </label>
                <input
                  type="text"
                  value={customTplJudul}
                  onChange={(e) => setCustomTplJudul(e.target.value)}
                  placeholder="Kosongkan untuk memakai nama template"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTplModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold cursor-pointer"
                >
                  Tambahkan ke Lane
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pengaturan Lane (Judul Pengerjaan, PIC, Deadline, Durasi) */}
      {laneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white font-bold">
              Pengaturan Judul Pengerjaan (Lane), PIC & Deadline
            </div>
            <form
              onSubmit={handleSaveLaneSettings}
              className="p-5 space-y-3.5 text-sm"
            >
              <div>
                <label className="block font-bold mb-1">
                  Judul Pengerjaan / Nama Lane *
                </label>
                <input
                  type="text"
                  required
                  value={laneForm.nama}
                  onChange={(e) =>
                    setLaneForm({ ...laneForm, nama: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Subjudul Export</label>
                <input
                  type="text"
                  value={laneForm.subjudul}
                  onChange={(e) =>
                    setLaneForm({ ...laneForm, subjudul: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">
                    Tanggal Mulai (Day 1)
                  </label>
                  <input
                    type="date"
                    required
                    value={laneForm.tanggalMulai}
                    onChange={(e) =>
                      setLaneForm({ ...laneForm, tanggalMulai: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Jumlah Hari</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    required
                    value={laneForm.jumlahHari}
                    onChange={(e) =>
                      setLaneForm({
                        ...laneForm,
                        jumlahHari: Number(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">
                    Yang Mengerjakan (PIC)
                  </label>
                  <input
                    type="text"
                    value={laneForm.pic}
                    onChange={(e) =>
                      setLaneForm({ ...laneForm, pic: e.target.value })
                    }
                    placeholder="Pilih atau ketik PIC..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {SYSTEM_PICS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() =>
                          setLaneForm({ ...laneForm, pic: p.value })
                        }
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ${
                          laneForm.pic === p.value
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.value}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-bold mb-1">Deadline</label>
                  <input
                    type="date"
                    value={laneForm.deadline}
                    onChange={(e) =>
                      setLaneForm({ ...laneForm, deadline: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* Penyesuaian Tanggal Manual per Kolom DAY */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs text-slate-800">
                    Penyesuaian Tanggal Manual Kolom DAY (1..{laneForm.jumlahHari})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const start = laneFormCustomDates[0] || laneForm.tanggalMulai;
                      const seq = Array.from({ length: laneForm.jumlahHari }, (_, i) =>
                        addDaysIso(start, i)
                      );
                      setLaneFormCustomDates(seq);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Auto-Urutkan dari Day 1
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {Array.from({ length: laneForm.jumlahHari }, (_, i) => {
                    const currentVal =
                      laneFormCustomDates[i] ||
                      addDaysIso(laneFormCustomDates[0] || laneForm.tanggalMulai, i);
                    return (
                      <div
                        key={`modal-day-${i}`}
                        className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200"
                      >
                        <span className="text-xs font-bold font-mono text-slate-700 w-14 shrink-0">
                          DAY {i + 1}
                        </span>
                        <input
                          type="date"
                          value={currentVal}
                          onChange={(e) => {
                            const newDates = Array.from(
                              { length: laneForm.jumlahHari },
                              (_, idx) =>
                                laneFormCustomDates[idx] ||
                                addDaysIso(
                                  laneFormCustomDates[0] || laneForm.tanggalMulai,
                                  idx
                                )
                            );
                            newDates[i] = e.target.value;
                            setLaneFormCustomDates(newDates);
                            if (i === 0) {
                              setLaneForm({ ...laneForm, tanggalMulai: e.target.value });
                            }
                          }}
                          className="w-full text-xs px-2 py-1 border border-slate-300 rounded font-medium"
                        />
                        <span className="text-[11px] text-slate-500 font-semibold whitespace-nowrap min-w-[70px]">
                          {formatHariTanggalSingkat(currentVal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLaneModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Komentar & Ubah Warna Kolom Harian */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="font-bold text-base">
                Komentar & Warna Kolom — {formatTanggalId(noteModal.tanggal)}
              </div>
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCellNoteAndColor}
              className="p-5 space-y-4 text-sm"
            >
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900">
                <div className="font-extrabold text-base leading-snug">
                  {noteModal.workItemJudul}
                </div>
                {noteModal.subScopeJudul && (
                  <div className="text-xs font-bold text-blue-700 mt-1 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] uppercase font-extrabold">
                      Sub-Pekerjaan
                    </span>
                    <span>{noteModal.subScopeJudul}</span>
                  </div>
                )}
                {noteModal.taskDetailTeks && (
                  <div className="text-xs font-semibold text-emerald-800 mt-1 flex items-start gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] uppercase font-extrabold shrink-0 mt-0.5">
                      Sub-Point
                    </span>
                    <span className="leading-snug">{noteModal.taskDetailTeks}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Komentar / Catatan pada Kolom Ini
                </label>
                <textarea
                  rows={3}
                  autoFocus
                  value={noteModal.catatan}
                  onChange={(e) =>
                    setNoteModal({ ...noteModal, catatan: e.target.value })
                  }
                  placeholder="Tulis komentar, progress, PIC harian, atau kendala di kolom ini..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Status Progres
                </label>
                <select
                  value={noteModal.status}
                  onChange={(e) =>
                    setNoteModal({
                      ...noteModal,
                      status: e.target.value as ScheduleCellStatus,
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                >
                  {SCHEDULE_CELL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {SCHEDULE_CELL_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleClearCellFromModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Kosongkan Kolom
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const foundWi = lane.workItems.find(
                        (w) => w.id === noteModal.workItemId
                      );
                      if (foundWi) {
                        setNoteModal(null);
                        setRescheduleModal({
                          workItem: foundWi,
                          subScopeId: noteModal.subScopeId || null,
                          startDate: noteModal.tanggal,
                          durationDays: 1,
                          status: noteModal.status,
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs cursor-pointer"
                    title="Ubah atau geser tanggal untuk sub-pekerjaan ini"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-emerald-600" /> Ubah Tanggal
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                  >
                    Simpan Komentar & Warna
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UBAH TANGGAL PENGERJAAN & BEBASKAN BENTROK / SESUAIKAN PRIORITAS */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold leading-tight">
                    Ubah & Atur Tanggal Pengerjaan
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Proyek: {project.nama} • Prioritas:{" "}
                    <span className="font-extrabold uppercase text-amber-200">
                      {project.prioritas || "SEDANG"}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModal(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm max-h-[85vh] overflow-y-auto">
              {/* Box Pekerjaan yang Dipilih */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold text-slate-500 uppercase">
                  Pekerjaan Terpilih
                </div>
                <div className="font-extrabold text-base text-slate-900 mt-0.5">
                  {rescheduleModal.workItem.judul}
                </div>

                {/* Dropdown Pemilihan Sub-Pekerjaan */}
                {rescheduleModal.workItem.subScopes.length > 0 && (
                  <div className="mt-2.5">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ruang Lingkup Target:
                    </label>
                    <select
                      value={rescheduleModal.subScopeId ?? ""}
                      onChange={(e) =>
                        setRescheduleModal({
                          ...rescheduleModal,
                          subScopeId: e.target.value || null,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-xs text-slate-800"
                    >
                      <option value="">
                        Semua Sub-Pekerjaan Sekaligus (Seluruh Baris Pekerjaan)
                      </option>
                      {rescheduleModal.workItem.subScopes.map((ss) => (
                        <option key={ss.id} value={ss.id}>
                          Sub {ss.urutan}: {ss.judul}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Input Tanggal Mulai, Durasi, & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 text-xs mb-1">
                    Tanggal Mulai Baru
                  </label>
                  <input
                    type="date"
                    value={rescheduleModal.startDate}
                    onChange={(e) =>
                      setRescheduleModal({
                        ...rescheduleModal,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 text-xs mb-1">
                    Durasi Pengerjaan
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={rescheduleModal.durationDays}
                      onChange={(e) =>
                        setRescheduleModal({
                          ...rescheduleModal,
                          durationDays: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-sm text-center"
                    />
                    <span className="text-xs font-bold text-slate-600">Hari</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 text-xs mb-1">
                    Status Blok
                  </label>
                  <select
                    value={rescheduleModal.status}
                    onChange={(e) =>
                      setRescheduleModal({
                        ...rescheduleModal,
                        status: e.target.value as ScheduleCellStatus,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-sm"
                  >
                    {SCHEDULE_CELL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {SCHEDULE_CELL_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Bentrok Kapasitas Real-time */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">
                  Status Ketersediaan Slot Tanggal:
                </div>
                {conflictsInProjectedRange.length === 0 ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-sm">
                        Bebas Bentrok — Slot Kapasitas Tersedia
                      </div>
                      <div className="text-xs text-emerald-800 mt-0.5">
                        Rentang tanggal{" "}
                        <span className="font-bold">
                          {projectedDates[0]} s/d{" "}
                          {projectedDates[projectedDates.length - 1]}
                        </span>{" "}
                        aman dikerjakan tanpa tumpang tindih dengan proyek lain.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-extrabold text-sm text-amber-900">
                          Perhatian: Bentrok Jadwal Terdeteksi!
                        </div>
                        <div className="text-xs text-amber-800 mt-0.5">
                          Terdapat {conflictsInProjectedRange.length} hari yang
                          sudah terisi agenda pengerjaan lain:
                        </div>
                      </div>
                    </div>
                    <ul className="pl-7 list-disc text-xs text-amber-900 space-y-1">
                      {conflictsInProjectedRange.slice(0, 3).map((c) => (
                        <li key={c.date}>
                          <span className="font-bold">
                            {formatHariTanggalSingkat(c.date)}:
                          </span>{" "}
                          {c.occupants.map((o) => o.label).join(", ")}
                        </li>
                      ))}
                      {conflictsInProjectedRange.length > 3 && (
                        <li>
                          ...dan {conflictsInProjectedRange.length - 3} tanggal
                          lainnya
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Feedback Pesan Eksekusi */}
              {rescheduleFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold border ${
                    rescheduleFeedback.type === "success"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                      : "bg-rose-50 border-rose-300 text-rose-900"
                  }`}
                >
                  {rescheduleFeedback.message}
                </div>
              )}

              {/* Tombol-tombol Solusi Otomatis */}
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <div className="text-xs font-bold text-slate-700">
                  Pilih Cara Penyesuaian Jadwal:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={rescheduleBusy}
                    onClick={() => handleExecuteReschedule("AUTO_FREE_SLOT")}
                    className="p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-left cursor-pointer transition"
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs text-emerald-900">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Bebaskan Bentrok (Slot Kosong)
                    </div>
                    <div className="text-[11px] text-emerald-800 mt-1 leading-snug">
                      Otomatis cari slot tanggal terdekat yang tidak ada bentrok
                      sama sekali.
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={rescheduleBusy}
                    onClick={() => handleExecuteReschedule("BY_PRIORITY")}
                    className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-left cursor-pointer transition"
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs text-amber-900">
                      <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                      Sesuaikan Sesuai Prioritas
                    </div>
                    <div className="text-[11px] text-amber-800 mt-1 leading-snug">
                      Proyek prioritas tinggi diutamakan; prioritas lebih rendah
                      bergeser ke hari berikutnya.
                    </div>
                  </button>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRescheduleModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={rescheduleBusy}
                  onClick={() => handleExecuteReschedule("MANUAL")}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                >
                  {rescheduleBusy ? "Menyimpan..." : "Terapkan Tanggal Pilihan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Cepat Ubah Nomor Urut Pekerjaan */}
      {singleReorder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <ListOrdered className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Ubah Nomor Urut Pekerjaan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sesuaikan urutan pekerjaan dalam lane ini
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSingleReorder(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">
                  Nama Pekerjaan:
                </div>
                <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                  {singleReorder.workItem.judul}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Nomor urut saat ini:{" "}
                  <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    No. {singleReorder.currentUrutan}
                  </span>{" "}
                  dari {lane.workItems.length} pekerjaan
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pindahkan ke Nomor Urut Baru:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={lane.workItems.length}
                    value={singleReorder.targetUrutan}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setSingleReorder({
                        ...singleReorder,
                        targetUrutan: isNaN(val) ? 1 : val,
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleApplySingleReorder();
                      }
                    }}
                    className="w-24 text-center font-black text-xl px-3 py-2 border-2 border-blue-500 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                    autoFocus
                  />
                  <span className="text-xs text-slate-500">
                    (Ketik angka 1 s/d {lane.workItems.length})
                  </span>
                </div>
              </div>

              {/* Tombol Pintas Cepat */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setSingleReorder({ ...singleReorder, targetUrutan: 1 })
                  }
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    singleReorder.targetUrutan === 1
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  🚀 Paling Atas (No. 1)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSingleReorder({
                      ...singleReorder,
                      targetUrutan: lane.workItems.length,
                    })
                  }
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    singleReorder.targetUrutan === lane.workItems.length
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  🔻 Paling Bawah (No. {lane.workItems.length})
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSingleReorder(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleApplySingleReorder}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {busy
                    ? "Menyimpan..."
                    : `Pindahkan ke No. ${singleReorder.targetUrutan}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Atur Semua Urutan Pekerjaan */}
      {fullReorderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <ListOrdered className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Atur Urutan Seluruh Pekerjaan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gunakan tombol panah atau tombol Top untuk menyusun urutan pekerjaan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFullReorderOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 py-1">
              {reorderingItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 truncate">
                        {item.judul}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {WORK_TYPE_LABELS[item.jenis]} • {item.subScopes.length} sub-scope
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const copy = [...reorderingItems];
                        const [moved] = copy.splice(idx, 1);
                        copy.splice(idx - 1, 0, moved);
                        setReorderingItems(copy);
                      }}
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-20 cursor-pointer"
                      title="Geser Naik"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === reorderingItems.length - 1}
                      onClick={() => {
                        const copy = [...reorderingItems];
                        const [moved] = copy.splice(idx, 1);
                        copy.splice(idx + 1, 0, moved);
                        setReorderingItems(copy);
                      }}
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-20 cursor-pointer"
                      title="Geser Turun"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const copy = [...reorderingItems];
                        const [moved] = copy.splice(idx, 1);
                        copy.unshift(moved);
                        setReorderingItems(copy);
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-[11px] font-bold text-slate-700 disabled:opacity-20 cursor-pointer"
                      title="Jadikan Paling Atas (No. 1)"
                    >
                      Paling Atas
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-2">
              <button
                type="button"
                onClick={() => setFullReorderOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveFullReorder}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-50"
              >
                {busy ? "Menyimpan..." : "Simpan Urutan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifikasi Perubahan Tanggal Kolom Day */}
      {dateChangeToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold">{dateChangeToast}</span>
        </div>
      )}
    </div>
  );
}
