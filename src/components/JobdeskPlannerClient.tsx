"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Flame,
  GripVertical,
  HelpCircle,
  Layers,
  Link2,
  ListChecks,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Wand2,
  X,
} from "lucide-react";
import {
  autoDistributeUnassignedJobdesks,
  buildAssignmentMap,
  countWorkingDaysInRange,
  DEFAULT_SUB_JOBDESK_NOTE,
  formatDayShortLabel,
  generateConsecutiveDayColumns,
  getEntryDateRange,
  inferCategoryFromText,
  isWeekendIso,
  JOBDESK_CATEGORIES,
  JOBDESK_CATEGORY_LABELS,
  JOBDESK_CATEGORY_STYLES,
  packPicScheduleTracks,
  stepWorkingDaysIso,
  type AvailableJobdeskItem,
  type JobdeskCategory,
  type JobdeskCellEntry,
  type JobdeskPlanData,
  type SubJobdeskItem,
} from "@/lib/jobdesk-plan";
import { SYSTEM_PICS } from "@/lib/users";

interface JobdeskPlannerClientProps {
  initialPlan: JobdeskPlanData;
  availableJobdesks: AvailableJobdeskItem[];
  initialUpdatedAt: string | null;
  initialUpdatedBy: string | null;
  todayIso: string;
}

interface CellModalTarget {
  pic: string;
  dayId: string;
  dayDateIso: string;
  dayLabel: string;
  editingEntry?: JobdeskCellEntry | null;
}

interface DragPayload {
  kind: "AVAILABLE" | "CELL_ENTRY" | "SUB_ITEM";
  availableItem?: AvailableJobdeskItem;
  fromPic?: string;
  fromDayId?: string;
  cellEntry?: JobdeskCellEntry;
  subItem?: SubJobdeskItem;
}

interface ActiveResizeState {
  pic: string;
  storageDayId: string;
  entryId: string;
  startDateIso: string;
  startColIdx: number;
  urgent: boolean;
  previewEndIso: string;
  previewEndColIdx: number;
}

function makeUid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getPicDotColor(picName: string): string {
  const found = SYSTEM_PICS.find(
    (p) => p.value.toLowerCase() === picName.trim().toLowerCase()
  );
  return found?.color ?? "#64748b";
}

export function JobdeskPlannerClient({
  initialPlan,
  availableJobdesks: initialAvailableJobdesks,
  initialUpdatedAt,
  initialUpdatedBy,
  todayIso,
}: JobdeskPlannerClientProps) {
  const [plan, setPlan] = useState<JobdeskPlanData>(initialPlan);
  const [availableJobdesks, setAvailableJobdesks] = useState<
    AvailableJobdeskItem[]
  >(initialAvailableJobdesks);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialUpdatedAt);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(initialUpdatedBy);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Panel antrian (kiri) & filter
  const [showQueuePanel, setShowQueuePanel] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const [searchQueue, setSearchQueue] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "BELUM_DIBAGI" | "SEMUA" | "DELAY"
  >("BELUM_DIBAGI");
  const [categoryFilter, setCategoryFilter] = useState<JobdeskCategory | "ALL">(
    "ALL"
  );
  const [quickAssignKey, setQuickAssignKey] = useState<string | null>(null);

  // Pengaturan Tanggal (Day) & Libur Sabtu-Minggu
  const skipWeekends = plan.skipWeekends ?? true;
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [newPicName, setNewPicName] = useState("");
  const [showAddPicInput, setShowAddPicInput] = useState(false);

  // Refs untuk mengukur posisi kolom saat Drag Range Hari (tarik tepi kanan)
  const dayHeaderRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [resizeState, setResizeState] = useState<ActiveResizeState | null>(null);
  const resizeStateRef = useRef<ActiveResizeState | null>(null);
  resizeStateRef.current = resizeState;
  const isResizingActive = resizeState !== null;

  // Modal Tambah/Edit Cell (dengan Range & Urgent)
  const [cellModal, setCellModal] = useState<CellModalTarget | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalCategory, setModalCategory] = useState<JobdeskCategory>("PROGRAM");
  const [modalStartIso, setModalStartIso] = useState(todayIso);
  const [modalEndIso, setModalEndIso] = useState(todayIso);
  const [modalUrgent, setModalUrgent] = useState(false);
  const [modalNote, setModalNote] = useState("");
  const [modalSearchQueue, setModalSearchQueue] = useState("");

  // Sub jobdesk input & promote target
  const [newSubTitle, setNewSubTitle] = useState("");
  const [newSubCategory, setNewSubCategory] = useState<JobdeskCategory>("HMI");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubText, setEditingSubText] = useState("");
  const [promoteSubId, setPromoteSubId] = useState<string | null>(null);

  // Drag & Drop kartu antar panel/sel
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  function beginDrag(e: ReactDragEvent<HTMLElement>, payload: DragPayload) {
    dragPayloadRef.current = payload;
    setDragPayload(payload);
    try {
      const id =
        payload.availableItem?.sourceKey ||
        payload.cellEntry?.id ||
        payload.subItem?.id ||
        "jobdesk";
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "copyMove";
    } catch {
      // Abaikan jika browser membatasi akses dataTransfer
    }
  }

  function endDrag() {
    dragPayloadRef.current = null;
    setDragPayload(null);
    setDragOverTarget(null);
  }

  function resolveDayByClientX(clientX: number) {
    for (let i = 0; i < plan.days.length; i++) {
      const el = dayHeaderRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return plan.days[i];
      }
    }
    return null;
  }

  const assignmentMap = useMemo(() => buildAssignmentMap(plan), [plan]);

  const queueStats = useMemo(() => {
    let unassigned = 0;
    let delayed = 0;
    for (const item of availableJobdesks) {
      const key = item.sourceKey;
      const altKey = `title:${item.title.trim().toLowerCase()}`;
      const isAssigned = assignmentMap.has(key) || assignmentMap.has(altKey);
      if (!isAssigned) unassigned += 1;
      if (item.isWiringDelayed) delayed += 1;
    }
    return {
      total: availableJobdesks.length,
      unassigned,
      assigned: availableJobdesks.length - unassigned,
      delayed,
    };
  }, [availableJobdesks, assignmentMap]);

  const filteredQueue = useMemo(() => {
    const q = searchQueue.trim().toLowerCase();
    return availableJobdesks.filter((item) => {
      const assigned =
        assignmentMap.has(item.sourceKey) ||
        assignmentMap.has(`title:${item.title.trim().toLowerCase()}`);

      if (statusFilter === "BELUM_DIBAGI" && assigned) return false;
      if (statusFilter === "DELAY" && !item.isWiringDelayed) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.title} ${item.projectCode} ${item.projectName} ${item.client}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    availableJobdesks,
    assignmentMap,
    statusFilter,
    categoryFilter,
    searchQueue,
  ]);

  // Packed tracks per PIC & ringkasan item di luar rentang tampilan
  const packedByPic = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof packPicScheduleTracks>
    >();
    for (const pic of plan.pics) {
      map.set(pic, packPicScheduleTracks(plan.cells[pic], plan.days));
    }
    return map;
  }, [plan.pics, plan.cells, plan.days]);

  const totalOutOfRange = useMemo(() => {
    let count = 0;
    for (const packed of packedByPic.values()) {
      count += packed.outOfRangeEntries.length;
    }
    return count;
  }, [packedByPic]);

  function updatePlan(updater: (prev: JobdeskPlanData) => JobdeskPlanData) {
    setPlan((prev) => updater(prev));
    setHasUnsavedChanges(true);
  }

  function showToast(type: "success" | "error" | "info", text: string) {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((curr) => (curr?.text === text ? null : curr));
    }, 4800);
  }

  // ==================== POINTER RESIZE (TARIK RANGE HARI) ====================

  useEffect(() => {
    if (!isResizingActive) return;

    function handlePointerMove(ev: PointerEvent) {
      const curr = resizeStateRef.current;
      if (!curr) return;

      let hoverColIdx = curr.startColIdx;
      for (let i = 0; i < plan.days.length; i++) {
        const el = dayHeaderRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (ev.clientX >= rect.left - 8) {
          hoverColIdx = i;
        }
      }

      if (hoverColIdx < curr.startColIdx) {
        hoverColIdx = curr.startColIdx;
      }

      // Bila kolom target adalah Sabtu/Minggu dan tugas tidak Urgent, geser ke hari kerja terdekat
      let chosenCol = plan.days[hoverColIdx];
      if (!curr.urgent && chosenCol && isWeekendIso(chosenCol.dateIso)) {
        for (let j = hoverColIdx - 1; j >= curr.startColIdx; j--) {
          if (!isWeekendIso(plan.days[j].dateIso)) {
            hoverColIdx = j;
            chosenCol = plan.days[j];
            break;
          }
        }
      }

      if (!chosenCol) return;
      const nextEndIso =
        chosenCol.dateIso >= curr.startDateIso
          ? chosenCol.dateIso
          : curr.startDateIso;

      if (
        nextEndIso !== curr.previewEndIso ||
        hoverColIdx !== curr.previewEndColIdx
      ) {
        setResizeState((prev) =>
          prev
            ? {
                ...prev,
                previewEndIso: nextEndIso,
                previewEndColIdx: hoverColIdx,
              }
            : null
        );
      }
    }

    function handlePointerUp() {
      const curr = resizeStateRef.current;
      if (curr) {
        updatePlan((prev) => ({
          ...prev,
          cells: {
            ...prev.cells,
            [curr.pic]: {
              ...(prev.cells[curr.pic] ?? {}),
              [curr.storageDayId]: (
                prev.cells[curr.pic]?.[curr.storageDayId] ?? []
              ).map((e) =>
                e.id === curr.entryId
                  ? {
                      ...e,
                      startDateIso: curr.startDateIso,
                      endDateIso: curr.previewEndIso,
                    }
                  : e
              ),
            },
          },
        }));
      }
      setResizeState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizingActive, plan.days]);

  // ==================== AUTO-SAVE + API SAVE, SYNC SCHEDULE & EXPORT ====================

  const latestPlanRef = useRef<JobdeskPlanData>(plan);
  latestPlanRef.current = plan;
  const hasUnsavedRef = useRef<boolean>(hasUnsavedChanges);
  hasUnsavedRef.current = hasUnsavedChanges;

  useEffect(() => {
    if (!hasUnsavedChanges || saving) return;

    const timer = setTimeout(() => {
      void handleSavePlan({ silent: true });
    }, 650);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, hasUnsavedChanges]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (!hasUnsavedRef.current) return;
      try {
        void fetch("/api/jobdesk-plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: latestPlanRef.current }),
          keepalive: true,
        });
      } catch {
        // ignore network errors on unload
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  async function handleSavePlan(options?: { silent?: boolean }) {
    setSaving(true);
    try {
      const snapshotToSave = latestPlanRef.current;
      const res = await fetch("/api/jobdesk-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: snapshotToSave }),
        keepalive: true,
      });
      const json = await res.json();
      if (!res.ok) {
        if (!options?.silent) {
          showToast("error", json?.error || "Gagal menyimpan jadwal jobdesk.");
        }
        return;
      }
      setHasUnsavedChanges(false);
      setLastSavedAt(json.updatedAt ?? new Date().toISOString());
      setLastSavedBy(json.updatedByName ?? null);
      if (!options?.silent) {
        const syncedCount = Number(json.syncedWorkItemsCount ?? 0);
        showToast(
          "success",
          syncedCount > 0
            ? `Pembagian jobdesk tersimpan & ${syncedCount} pekerjaan disinkronkan ke Schedule Proyek.`
            : "Pembagian jobdesk berhasil disimpan."
        );
      }
    } catch {
      if (!options?.silent) {
        showToast("error", "Terjadi kesalahan jaringan saat menyimpan.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshFromSchedule() {
    setSyncing(true);
    try {
      const res = await fetch("/api/jobdesk-plan?sync=1", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        showToast("error", json?.error || "Gagal sinkronisasi Schedule Proyek.");
        return;
      }
      setPlan(json.plan);
      latestPlanRef.current = json.plan;
      if (Array.isArray(json.availableJobdesks)) {
        setAvailableJobdesks(json.availableJobdesks);
      }
      setHasUnsavedChanges(true);
      setLastSavedAt(json.updatedAt ?? null);
      setLastSavedBy(json.updatedByName ?? null);
      showToast(
        "success",
        "Data Schedule Proyek terbaru berhasil ditarik dan otomatis tersimpan."
      );
    } catch {
      showToast("error", "Gagal menghubungi server untuk sinkronisasi.");
    } finally {
      setSyncing(false);
    }
  }

  function handleExportExcel() {
    setExporting(true);
    try {
      // Gunakan submit <form method="POST"> secara sinkron di dalam klik user
      // agar browser mengunduh langsung lewat header Content-Disposition: attachment
      // tanpa dianggap sebagai async blob automatic download.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/export/jobdesk";
      form.style.display = "none";

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "planJson";
      input.value = JSON.stringify(plan);
      form.appendChild(input);

      document.body.appendChild(form);
      form.submit();
      form.remove();

      showToast("success", "Mengunduh file Excel Pembagian Jobdesk...");
    } catch {
      showToast("error", "Gagal mengunduh file Excel.");
    } finally {
      setTimeout(() => setExporting(false), 800);
    }
  }

  // ==================== KOLOM TANGGAL (DAY / LIBUR SAB-MIN) ====================

  function handleRegenerateDays(
    newStartIso: string,
    count: number,
    nextSkipWeekends: boolean
  ) {
    // Kumpulkan tanggal urgent agar tetap muncul walau Sabtu/Minggu dilompati
    const urgentDates: string[] = [];
    for (const pic of plan.pics) {
      for (const [dayId, list] of Object.entries(plan.cells[pic] ?? {})) {
        const fallback = dayId.startsWith("day-") ? dayId.slice(4, 14) : newStartIso;
        for (const e of list) {
          if (e.urgent) {
            const r = getEntryDateRange(e, fallback);
            if (isWeekendIso(r.startIso)) urgentDates.push(r.startIso);
            if (isWeekendIso(r.endIso)) urgentDates.push(r.endIso);
          }
        }
      }
    }

    const newDays = generateConsecutiveDayColumns(
      newStartIso,
      count,
      nextSkipWeekends,
      urgentDates
    );

    updatePlan((prev) => ({
      ...prev,
      startDateIso: newDays[0]?.dateIso ?? newStartIso,
      skipWeekends: nextSkipWeekends,
      days: newDays,
    }));
  }

  function handleAddOneDay() {
    updatePlan((prev) => {
      const lastDay = prev.days[prev.days.length - 1];
      const baseIso = lastDay ? lastDay.dateIso : prev.startDateIso;
      const nextIso = stepWorkingDaysIso(baseIso, 1, !(prev.skipWeekends ?? true));
      if (prev.days.some((d) => d.dateIso === nextIso)) {
        return prev;
      }
      return {
        ...prev,
        days: [
          ...prev.days,
          {
            id: `day-${nextIso}`,
            dateIso: nextIso,
            label: formatDayShortLabel(nextIso),
            isWeekend: isWeekendIso(nextIso),
          },
        ].sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
      };
    });
  }

  function handleUpdateDayDate(colId: string, newDateIso: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateIso)) return;
    updatePlan((prev) => ({
      ...prev,
      days: prev.days
        .map((d) =>
          d.id === colId
            ? {
                ...d,
                dateIso: newDateIso,
                label: formatDayShortLabel(newDateIso),
                isWeekend: isWeekendIso(newDateIso),
              }
            : d
        )
        .sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
    }));
    setEditingColId(null);
  }

  function handleRemoveDay(colId: string) {
    if (plan.days.length <= 1) {
      showToast("info", "Minimal harus ada 1 kolom tanggal.");
      return;
    }
    updatePlan((prev) => ({
      ...prev,
      days: prev.days.filter((d) => d.id !== colId),
    }));
    setEditingColId(null);
  }

  function ensureColumnVisibleForDate(targetIso: string) {
    updatePlan((prev) => {
      if (prev.days.some((d) => d.dateIso === targetIso)) return prev;
      const nextDays = [
        ...prev.days,
        {
          id: `day-${targetIso}`,
          dateIso: targetIso,
          label: formatDayShortLabel(targetIso),
          isWeekend: isWeekendIso(targetIso),
        },
      ].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
      return { ...prev, days: nextDays };
    });
  }

  // ==================== PIC MANAGEMENT ====================

  function handleAddPic() {
    const trimmed = newPicName.trim();
    if (!trimmed) return;
    if (plan.pics.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      showToast("info", `Nama "${trimmed}" sudah ada di tabel.`);
      return;
    }
    updatePlan((prev) => ({
      ...prev,
      pics: [...prev.pics, trimmed],
      cells: { ...prev.cells, [trimmed]: {} },
    }));
    setNewPicName("");
    setShowAddPicInput(false);
  }

  function handleRemovePic(picName: string) {
    if (plan.pics.length <= 1) {
      showToast("info", "Minimal harus ada 1 orang PIC.");
      return;
    }
    updatePlan((prev) => {
      const nextCells = { ...prev.cells };
      delete nextCells[picName];
      return {
        ...prev,
        pics: prev.pics.filter((p) => p !== picName),
        cells: nextCells,
      };
    });
  }

  // ==================== ASSIGN, RANGE STEPPER & EDIT ====================

  function assignAvailableToCell(
    item: AvailableJobdeskItem,
    pic: string,
    dayId: string,
    dayDateIso: string
  ) {
    const workItemId =
      item.sourceType === "WORK_ITEM" && item.sourceKey.startsWith("wi:")
        ? item.sourceKey.slice(3)
        : null;

    const entry: JobdeskCellEntry = {
      id: makeUid("cell"),
      title: item.title,
      category: item.category,
      projectId: item.projectId,
      projectCode: item.projectCode,
      projectName: item.projectName,
      workItemId,
      sourceKey: item.sourceKey,
      startDateIso: dayDateIso,
      endDateIso: dayDateIso,
      urgent: item.projectPrioritas === "TINGGI" && isWeekendIso(dayDateIso),
      done: false,
      note: null,
    };

    updatePlan((prev) => ({
      ...prev,
      cells: {
        ...prev.cells,
        [pic]: {
          ...(prev.cells[pic] ?? {}),
          [dayId]: [...(prev.cells[pic]?.[dayId] ?? []), entry],
        },
      },
    }));
    setQuickAssignKey(null);
  }

  function handleStepEntryRange(
    pic: string,
    storageDayId: string,
    entry: JobdeskCellEntry,
    fallbackIso: string,
    deltaWorkingDays: number
  ) {
    const { startIso, endIso } = getEntryDateRange(entry, fallbackIso);
    const nextEndIso = stepWorkingDaysIso(
      endIso,
      deltaWorkingDays,
      Boolean(entry.urgent)
    );
    const clampedEnd = nextEndIso >= startIso ? nextEndIso : startIso;

    updatePlan((prev) => {
      let nextDays = prev.days;
      if (clampedEnd > (prev.days[prev.days.length - 1]?.dateIso ?? "")) {
        nextDays = [
          ...prev.days,
          {
            id: `day-${clampedEnd}`,
            dateIso: clampedEnd,
            label: formatDayShortLabel(clampedEnd),
            isWeekend: isWeekendIso(clampedEnd),
          },
        ].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
      }

      return {
        ...prev,
        days: nextDays,
        cells: {
          ...prev.cells,
          [pic]: {
            ...(prev.cells[pic] ?? {}),
            [storageDayId]: (prev.cells[pic]?.[storageDayId] ?? []).map((e) =>
              e.id === entry.id
                ? { ...e, startDateIso: startIso, endDateIso: clampedEnd }
                : e
            ),
          },
        },
      };
    });
  }

  function addAvailableToSubJobdesk(item: AvailableJobdeskItem) {
    const sub: SubJobdeskItem = {
      id: makeUid("sub"),
      title: item.title,
      category: item.category,
      projectId: item.projectId,
      projectCode: item.projectCode,
      projectName: item.projectName,
      sourceKey: item.sourceKey,
      done: false,
    };
    updatePlan((prev) => ({
      ...prev,
      subJobdesks: [...prev.subJobdesks, sub],
    }));
    showToast("info", `"${item.title}" ditambahkan ke Sub Jobdesk.`);
  }

  function openAddCellModal(pic: string, dayId: string, dayDateIso: string, dayLabel: string) {
    setCellModal({ pic, dayId, dayDateIso, dayLabel, editingEntry: null });
    setModalTitle("");
    setModalCategory("PROGRAM");
    setModalStartIso(dayDateIso);
    setModalEndIso(dayDateIso);
    setModalUrgent(isWeekendIso(dayDateIso));
    setModalNote("");
    setModalSearchQueue("");
  }

  function openEditCellModal(
    pic: string,
    dayId: string,
    dayDateIso: string,
    dayLabel: string,
    entry: JobdeskCellEntry
  ) {
    const range = getEntryDateRange(entry, dayDateIso);
    setCellModal({ pic, dayId, dayDateIso, dayLabel, editingEntry: entry });
    setModalTitle(entry.title);
    setModalCategory(entry.category);
    setModalStartIso(range.startIso);
    setModalEndIso(range.endIso);
    setModalUrgent(Boolean(entry.urgent));
    setModalNote(entry.note ?? "");
    setModalSearchQueue("");
  }

  function handleSaveCellModal() {
    if (!cellModal) return;
    const title = modalTitle.trim();
    if (!title) return;

    const safeStart = modalStartIso || cellModal.dayDateIso;
    const safeEnd =
      modalEndIso && modalEndIso >= safeStart ? modalEndIso : safeStart;

    if (!modalUrgent && isWeekendIso(safeEnd) && safeStart === safeEnd) {
      showToast(
        "info",
        "Sabtu & Minggu adalah hari libur. Centang 'Urgent' bila pekerjaan lembur di akhir pekan."
      );
      return;
    }

    const { pic, dayId, editingEntry } = cellModal;
    updatePlan((prev) => {
      const currentList = prev.cells[pic]?.[dayId] ?? [];
      const nextList = editingEntry
        ? currentList.map((e) =>
            e.id === editingEntry.id
              ? {
                  ...e,
                  title,
                  category: modalCategory,
                  startDateIso: safeStart,
                  endDateIso: safeEnd,
                  urgent: modalUrgent,
                  note: modalNote.trim() || null,
                }
              : e
          )
        : [
            ...currentList,
            {
              id: makeUid("cell"),
              title,
              category: modalCategory,
              startDateIso: safeStart,
              endDateIso: safeEnd,
              urgent: modalUrgent,
              note: modalNote.trim() || null,
              done: false,
            },
          ];

      // Tambahkan kolom tanggal akhir jika belum tampak (atau tanggal weekend Urgent)
      let nextDays = prev.days;
      const neededDates = [safeStart, safeEnd];
      for (const nIso of neededDates) {
        if (
          !nextDays.some((d) => d.dateIso === nIso) &&
          (!isWeekendIso(nIso) || modalUrgent)
        ) {
          nextDays = [
            ...nextDays,
            {
              id: `day-${nIso}`,
              dateIso: nIso,
              label: formatDayShortLabel(nIso),
              isWeekend: isWeekendIso(nIso),
            },
          ].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
        }
      }

      return {
        ...prev,
        days: nextDays,
        cells: {
          ...prev.cells,
          [pic]: {
            ...(prev.cells[pic] ?? {}),
            [dayId]: nextList,
          },
        },
      };
    });
    setCellModal(null);
  }

  function handleToggleCellDone(pic: string, dayId: string, entryId: string) {
    updatePlan((prev) => ({
      ...prev,
      cells: {
        ...prev.cells,
        [pic]: {
          ...(prev.cells[pic] ?? {}),
          [dayId]: (prev.cells[pic]?.[dayId] ?? []).map((e) =>
            e.id === entryId ? { ...e, done: !e.done } : e
          ),
        },
      },
    }));
  }

  function handleDeleteCellEntry(pic: string, dayId: string, entryId: string) {
    updatePlan((prev) => ({
      ...prev,
      cells: {
        ...prev.cells,
        [pic]: {
          ...(prev.cells[pic] ?? {}),
          [dayId]: (prev.cells[pic]?.[dayId] ?? []).filter(
            (e) => e.id !== entryId
          ),
        },
      },
    }));
  }

  // ==================== SUB JOBDESK ====================

  function handleAddManualSubJobdesk() {
    const title = newSubTitle.trim();
    if (!title) return;
    updatePlan((prev) => ({
      ...prev,
      subJobdesks: [
        ...prev.subJobdesks,
        {
          id: makeUid("sub"),
          title,
          category: newSubCategory,
          done: false,
        },
      ],
    }));
    setNewSubTitle("");
  }

  function handleToggleSubDone(subId: string) {
    updatePlan((prev) => ({
      ...prev,
      subJobdesks: prev.subJobdesks.map((s) =>
        s.id === subId ? { ...s, done: !s.done } : s
      ),
    }));
  }

  function handleSaveSubEdit(subId: string) {
    const trimmed = editingSubText.trim();
    if (!trimmed) {
      setEditingSubId(null);
      return;
    }
    updatePlan((prev) => ({
      ...prev,
      subJobdesks: prev.subJobdesks.map((s) =>
        s.id === subId ? { ...s, title: trimmed } : s
      ),
    }));
    setEditingSubId(null);
  }

  function handleDeleteSub(subId: string) {
    updatePlan((prev) => ({
      ...prev,
      subJobdesks: prev.subJobdesks.filter((s) => s.id !== subId),
    }));
  }

  function handlePromoteSubToCell(
    sub: SubJobdeskItem,
    pic: string,
    dayId: string,
    dayDateIso: string
  ) {
    updatePlan((prev) => ({
      ...prev,
      cells: {
        ...prev.cells,
        [pic]: {
          ...(prev.cells[pic] ?? {}),
          [dayId]: [
            ...(prev.cells[pic]?.[dayId] ?? []),
            {
              id: makeUid("cell"),
              title: sub.title,
              category: sub.category,
              projectId: sub.projectId,
              projectCode: sub.projectCode,
              projectName: sub.projectName,
              workItemId: sub.sourceKey?.startsWith("wi:")
                ? sub.sourceKey.slice(3)
                : null,
              sourceKey: sub.sourceKey,
              startDateIso: dayDateIso,
              endDateIso: dayDateIso,
              done: Boolean(sub.done),
            },
          ],
        },
      },
      subJobdesks: prev.subJobdesks.filter((s) => s.id !== sub.id),
    }));
    setPromoteSubId(null);
    showToast("info", `"${sub.title}" dipindahkan ke jadwal ${pic}.`);
  }

  function handleAutoDistribute() {
    updatePlan((prev) =>
      autoDistributeUnassignedJobdesks(prev, availableJobdesks, {
        putDelayedHmiToSub: true,
      })
    );
    showToast(
      "success",
      "Jobdesk antrian proyek yang belum dibagi otomatis dimasukkan ke slot hari kerja kosong."
    );
  }

  // ==================== DRAG & DROP HANDLERS ====================

  function handleDropOnCell(pic: string, dayId: string, targetDateIso: string) {
    setDragOverTarget(null);
    const activePayload = dragPayloadRef.current ?? dragPayload;
    if (!activePayload) return;

    if (activePayload.kind === "AVAILABLE" && activePayload.availableItem) {
      if (isWeekendIso(targetDateIso)) {
        showToast(
          "info",
          "Hari Sabtu/Minggu libur. Untuk tugas Urgent di akhir pekan, klik '+ Tambah Job' lalu centang Urgent."
        );
        endDrag();
        return;
      }
      assignAvailableToCell(activePayload.availableItem, pic, dayId, targetDateIso);
    } else if (
      activePayload.kind === "CELL_ENTRY" &&
      activePayload.cellEntry &&
      activePayload.fromPic &&
      activePayload.fromDayId
    ) {
      const { fromPic, fromDayId, cellEntry } = activePayload;
      if (isWeekendIso(targetDateIso) && !cellEntry.urgent) {
        showToast(
          "info",
          "Hari Sabtu/Minggu libur. Centang 'Urgent' di modal edit jika ingin menjadwalkan di akhir pekan."
        );
        endDrag();
        return;
      }

      // Pertahankan durasi hari kerja saat memindahkan bar multi-hari ke tanggal lain
      const oldRange = getEntryDateRange(cellEntry, targetDateIso);
      const workingCount = Math.max(
        1,
        countWorkingDaysInRange(
          oldRange.startIso,
          oldRange.endIso,
          Boolean(cellEntry.urgent)
        )
      );
      const nextEndIso =
        workingCount > 1
          ? stepWorkingDaysIso(
              targetDateIso,
              workingCount - 1,
              Boolean(cellEntry.urgent)
            )
          : targetDateIso;

      const movedEntry: JobdeskCellEntry = {
        ...cellEntry,
        startDateIso: targetDateIso,
        endDateIso: nextEndIso,
      };

      updatePlan((prev) => {
        const removedSource = (prev.cells[fromPic]?.[fromDayId] ?? []).filter(
          (e) => e.id !== cellEntry.id
        );
        const currentDest =
          fromPic === pic && fromDayId === dayId
            ? removedSource
            : prev.cells[pic]?.[dayId] ?? [];

        return {
          ...prev,
          cells: {
            ...prev.cells,
            [fromPic]: {
              ...(prev.cells[fromPic] ?? {}),
              [fromDayId]: removedSource,
            },
            [pic]: {
              ...(fromPic === pic ? prev.cells[fromPic] ?? {} : prev.cells[pic] ?? {}),
              ...(fromPic === pic && fromDayId !== dayId
                ? { [fromDayId]: removedSource }
                : {}),
              [dayId]: [...currentDest, movedEntry],
            },
          },
        };
      });
    } else if (activePayload.kind === "SUB_ITEM" && activePayload.subItem) {
      handlePromoteSubToCell(activePayload.subItem, pic, dayId, targetDateIso);
    }

    endDrag();
  }

  function handleDropOnSub() {
    setDragOverTarget(null);
    const activePayload = dragPayloadRef.current ?? dragPayload;
    if (!activePayload) return;

    if (activePayload.kind === "AVAILABLE" && activePayload.availableItem) {
      addAvailableToSubJobdesk(activePayload.availableItem);
    } else if (
      activePayload.kind === "CELL_ENTRY" &&
      activePayload.cellEntry &&
      activePayload.fromPic &&
      activePayload.fromDayId
    ) {
      const { fromPic, fromDayId, cellEntry } = activePayload;
      updatePlan((prev) => ({
        ...prev,
        cells: {
          ...prev.cells,
          [fromPic]: {
            ...(prev.cells[fromPic] ?? {}),
            [fromDayId]: (prev.cells[fromPic]?.[fromDayId] ?? []).filter(
              (e) => e.id !== cellEntry.id
            ),
          },
        },
        subJobdesks: [
          ...prev.subJobdesks,
          {
            id: makeUid("sub"),
            title: cellEntry.title,
            category: cellEntry.category,
            projectId: cellEntry.projectId,
            projectCode: cellEntry.projectCode,
            projectName: cellEntry.projectName,
            sourceKey: cellEntry.sourceKey,
            done: Boolean(cellEntry.done),
          },
        ],
      }));
    }
    endDrag();
  }

  const modalFilteredQueue = useMemo(() => {
    const q = modalSearchQueue.trim().toLowerCase();
    return availableJobdesks.filter((item) => {
      if (!q) return true;
      return `${item.title} ${item.projectCode} ${item.projectName}`
        .toLowerCase()
        .includes(q);
    });
  }, [availableJobdesks, modalSearchQueue]);

  return (
    <div className="space-y-4">
      {/* ==================== TOP HEADER & ACTIONS ==================== */}
      <div className="v14-card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#F05232]/10 text-[#F05232]">
                <ListChecks className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Pembagian Jobdesk Harian
              </h1>
              {hasUnsavedChanges ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  <Clock className="w-3 h-3" /> Belum disimpan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                  <CheckCircle2 className="w-3 h-3" />
                  {lastSavedAt ? "Tersimpan & Sinkron" : "Terhubung Schedule Proyek"}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Terintegrasi otomatis dengan{" "}
              <Link
                href="/jadwal"
                className="font-semibold text-[#F05232] hover:underline"
              >
                Schedule Proyek
              </Link>{" "}
              dan{" "}
              <Link
                href="/prioritas"
                className="font-semibold text-[#F05232] hover:underline"
              >
                Antrian Proyek
              </Link>
              . Tarik tepi kanan kartu jobdesk untuk rentang multi-hari; Sabtu &
              Minggu dilompati otomatis kecuali Urgent.
              {lastSavedBy && lastSavedAt && (
                <span className="text-slate-400 dark:text-slate-500">
                  {" "}
                  • Terakhir oleh {lastSavedBy}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshFromSchedule}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 dark:border-cyan-800/60 bg-cyan-50 dark:bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-950/70 transition-colors cursor-pointer"
              title="Ambil update PIC dan tanggal terbaru yang dibuat di Schedule Proyek"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Menyinkronkan..." : "Sinkron Schedule"}
            </button>

            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1d24] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              {showGuide ? "Tutup Panduan" : "Panduan"}
            </button>

            <button
              type="button"
              onClick={handleAutoDistribute}
              disabled={queueStats.unassigned === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Wand2 className="w-4 h-4" />
              Bagi Otomatis ({queueStats.unassigned})
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {exporting ? "Mengekspor..." : "Export Excel"}
            </button>

            <button
              type="button"
              onClick={() => void handleSavePlan({ silent: false })}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F05232] hover:bg-[#d94426] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-[#F05232]/25 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? "Menyimpan..." : "Simpan Jadwal"}
            </button>
          </div>
        </div>

        {/* Feedback Toast Inline */}
        {feedback && (
          <div
            className={`mt-3 flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium border ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300"
                : feedback.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300"
                : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-300"
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-0.5 hover:opacity-70 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Panduan Beginner-Friendly 3 Langkah */}
        {showGuide && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2.5 rounded-xl bg-slate-50/90 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] p-3">
            <div className="flex items-start gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F05232] text-[11px] font-bold text-white">
                1
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Tarik Range Hari (Multi-Hari)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Jobdesk tidak harus selesai 1 hari. <b>Tarik garis sisi kanan kartu</b> ke kolom tanggal berikutnya atau klik tombol <b>- / +</b> untuk memperpanjang hari kerja.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[11px] font-bold text-white">
                2
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Otomatis Sinkron Schedule Proyek
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Menetapkan PIC (mis. <b>Apip</b> di tgl 27) pada Schedule Proyek langsung mengisi tabel ini, dan menekan <b>Simpan Jadwal</b> memperbarui Schedule Proyek kembali.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                3
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Libur Sab/Min & Sub Jobdesk
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sabtu & Minggu otomatis dilompati kecuali pekerjaan ditandai <b>Urgent</b>. Job cadangan seperti HMI tetap bisa ditaruh di <b>+ Sub</b>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== CONTROL BAR TANGGAL (DAY / TGL) ==================== */}
      <div className="v14-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowQueuePanel((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1d24] px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
          >
            {showQueuePanel ? (
              <>
                <ChevronLeft className="w-3.5 h-3.5" /> Sembunyikan Antrian
              </>
            ) : (
              <>
                <ChevronRight className="w-3.5 h-3.5" /> Tampilkan Antrian (
                {queueStats.unassigned})
              </>
            )}
          </button>

          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <CalendarDays className="w-3.5 h-3.5 text-[#F05232]" />
            <span>Mulai Tgl:</span>
            <input
              type="date"
              value={plan.startDateIso}
              onChange={(e) => {
                if (e.target.value) {
                  handleRegenerateDays(
                    e.target.value,
                    plan.days.length,
                    skipWeekends
                  );
                }
              }}
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1d24] px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100"
            />
          </label>

          <div className="flex items-center gap-1">
            {[5, 7, 10, 14].map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() =>
                  handleRegenerateDays(plan.startDateIso, cnt, skipWeekends)
                }
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                  plan.days.length === cnt
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                }`}
              >
                {cnt} Hari
              </button>
            ))}
            <button
              type="button"
              onClick={handleAddOneDay}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 dark:border-white/20 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#F05232] hover:text-[#F05232] cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Hari
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none ml-1 rounded-lg bg-slate-100 dark:bg-white/5 px-2.5 py-1">
            <input
              type="checkbox"
              checked={skipWeekends}
              onChange={(e) => {
                const nextSkip = e.target.checked;
                handleRegenerateDays(
                  plan.startDateIso,
                  plan.days.length,
                  nextSkip
                );
              }}
              className="rounded border-slate-300 text-[#F05232] focus:ring-[#F05232]"
            />
            Libur Sabtu & Minggu (kecuali Urgent)
          </label>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {totalOutOfRange > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              {totalOutOfRange} jadwal di luar tanggal tampil
            </span>
          )}
          <span>
            Belum dibagi:{" "}
            <strong className="text-[#F05232]">{queueStats.unassigned}</strong>
          </span>
          <span>•</span>
          <span>
            Sudah terjadwal:{" "}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {queueStats.assigned}
            </strong>
          </span>
          <button
            type="button"
            onClick={() =>
              handleRegenerateDays(todayIso, plan.days.length, skipWeekends)
            }
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-[#F05232] cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Mulai Hari Ini
          </button>
        </div>
      </div>

      {/* ==================== MAIN WORKSPACE ==================== */}
      <div
        className={`grid gap-3 items-start ${
          showQueuePanel ? "grid-cols-1 xl:grid-cols-[270px_minmax(0,1fr)]" : "grid-cols-1"
        }`}
      >
        {/* PANEL KIRI: ANTRIAN JOBDESK PROYEK */}
        {showQueuePanel && (
          <aside className="v14-card p-3.5 space-y-3 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#F05232]" />
                  Antrian Jobdesk Proyek
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Urut prioritas proyek aktif yang belum selesai
                </p>
              </div>
              <span className="rounded-full bg-[#F05232]/10 px-2 py-0.5 text-[11px] font-bold text-[#F05232]">
                {filteredQueue.length} item
              </span>
            </div>

            {/* Search Queue */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQueue}
                onChange={(e) => setSearchQueue(e.target.value)}
                placeholder="Cari proyek atau tugas (TBI, AHM, HMI)..."
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1d24] pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F05232]/30"
              />
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-white/5 p-1">
              {[
                {
                  key: "BELUM_DIBAGI" as const,
                  label: `Belum (${queueStats.unassigned})`,
                },
                { key: "SEMUA" as const, label: `Semua (${queueStats.total})` },
                {
                  key: "DELAY" as const,
                  label: `Delay (${queueStats.delayed})`,
                },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setStatusFilter(t.key)}
                  className={`rounded-lg py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    statusFilter === t.key
                      ? "bg-white dark:bg-[#232732] text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCategoryFilter("ALL")}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                  categoryFilter === "ALL"
                    ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                }`}
              >
                Semua Jenis
              </button>
              {JOBDESK_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                    categoryFilter === cat
                      ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {JOBDESK_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Scrollable List of Available Jobdesks */}
            <div className="space-y-2 overflow-y-auto pr-1 xl:max-h-[calc(100vh-22rem)]">
              {filteredQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                  {statusFilter === "BELUM_DIBAGI" && availableJobdesks.length > 0
                    ? "Semua jobdesk antrian sudah dibagikan ke tabel atau sub jobdesk."
                    : "Tidak ada item antrian yang cocok dengan filter."}
                </div>
              ) : (
                filteredQueue.map((item) => {
                  const locations =
                    assignmentMap.get(item.sourceKey) ??
                    assignmentMap.get(`title:${item.title.trim().toLowerCase()}`) ??
                    [];
                  const isQuickOpen = quickAssignKey === item.sourceKey;
                  const catStyle = JOBDESK_CATEGORY_STYLES[item.category];

                  return (
                    <div
                      key={item.sourceKey}
                      draggable
                      onDragStart={(e) =>
                        beginDrag(e, { kind: "AVAILABLE", availableItem: item })
                      }
                      onDragEnd={endDrag}
                      className={`rounded-xl border border-slate-200/90 dark:border-white/10 border-l-4 ${catStyle.border} bg-white dark:bg-[#1a1d24] p-2.5 shadow-xs hover:shadow-sm transition-shadow cursor-grab active:cursor-grabbing`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1 mb-1">
                            <span className="inline-flex items-center rounded-md bg-slate-900 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              #{item.priorityRank}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${catStyle.badge}`}
                            >
                              {JOBDESK_CATEGORY_LABELS[item.category]}
                            </span>
                            {item.isWiringDelayed && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300"
                                title={`Komponen baru ${item.componentReadinessPct}% (${item.arrivedComponents}/${item.totalComponents})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Komponen {item.componentReadinessPct}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.projectName} • {item.client}
                          </p>
                        </div>

                        <GripVertical className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
                      </div>

                      {locations.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {locations.map((loc, i) => (
                            <span
                              key={`${loc.entryId}-${i}`}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                            >
                              <Check className="w-2.5 h-2.5" />
                              {loc.area === "SUB"
                                ? "Di Sub Jobdesk"
                                : `${loc.pic} (${loc.rangeLabel || loc.dayLabel})`}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setQuickAssignKey(isQuickOpen ? null : item.sourceKey)
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#F05232]/10 hover:bg-[#F05232] hover:text-white text-[#F05232] px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          {isQuickOpen ? "Tutup Pilihan" : "Jadwalkan"}
                        </button>
                        <button
                          type="button"
                          onClick={() => addAvailableToSubJobdesk(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          + Sub
                        </button>
                      </div>

                      {isQuickOpen && (
                        <div className="mt-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 p-2 space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            Pilih PIC & Tanggal mulai:
                          </p>
                          <div className="space-y-1.5 max-h-44 overflow-y-auto">
                            {plan.pics.map((pic) => (
                              <div key={pic} className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: getPicDotColor(pic) }}
                                  />
                                  {pic}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {plan.days
                                    .filter((d) => !d.isWeekend)
                                    .map((day) => (
                                      <button
                                        key={`${pic}-${day.id}`}
                                        type="button"
                                        onClick={() =>
                                          assignAvailableToCell(
                                            item,
                                            pic,
                                            day.id,
                                            day.dateIso
                                          )
                                        }
                                        className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#232732] hover:bg-[#F05232] hover:text-white hover:border-[#F05232] px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                                      >
                                        {day.label}
                                      </button>
                                    ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* PANEL KANAN: MATRIKS HARIAN MULTI-HARI + SUB JOBDESK */}
        <div className="space-y-4 min-w-0">
          <div className="v14-card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={plan.title}
                  onChange={(e) =>
                    updatePlan((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="bg-transparent text-sm font-bold text-slate-900 dark:text-white border-b border-transparent focus:border-[#F05232] focus:outline-none px-1 py-0.5"
                  aria-label="Judul tabel pembagian jobdesk"
                />
                <span className="text-[11px] text-slate-400">
                  (Tarik sisi kanan kartu untuk rentang multi-hari)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {showAddPicInput ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newPicName}
                      onChange={(e) => setNewPicName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddPic();
                        if (e.key === "Escape") setShowAddPicInput(false);
                      }}
                      placeholder="Nama PIC..."
                      autoFocus
                      className="w-28 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1a1d24] px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddPic}
                      className="rounded-lg bg-[#F05232] text-white px-2.5 py-1 text-xs font-semibold cursor-pointer"
                    >
                      Tambah
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddPicInput(false)}
                      className="rounded-lg px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-200/60 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddPicInput(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1d24] px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#F05232]" />
                    Tambah PIC
                  </button>
                )}
              </div>
            </div>

            {/* MATRIKS GANTT-GRID COMPACT */}
            <div className="overflow-x-auto select-none">
              <div
                style={{
                  minWidth: `${104 + plan.days.length * 130}px`,
                }}
              >
                {/* HEADER KOLOM TANGGAL */}
                <div
                  className="grid bg-slate-100/90 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/10"
                  style={{
                    gridTemplateColumns: `104px repeat(${plan.days.length}, minmax(130px, 1fr))`,
                  }}
                >
                  <div className="px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-white/10 sticky left-0 z-20 bg-slate-100 dark:bg-[#161920] flex items-center">
                    PIC / Tgl
                  </div>

                  {plan.days.map((day, idx) => {
                    const isToday = day.dateIso === todayIso;
                    const isEditingCol = editingColId === day.id;
                    const isWeekend = Boolean(day.isWeekend ?? isWeekendIso(day.dateIso));

                    return (
                      <div
                        key={day.id}
                        ref={(el) => {
                          dayHeaderRefs.current[idx] = el;
                        }}
                        className={`px-2.5 py-2 border-r border-slate-200 dark:border-white/10 ${
                          isToday
                            ? "bg-[#F05232]/[0.09] dark:bg-[#F05232]/15"
                            : isWeekend
                            ? "bg-rose-50/70 dark:bg-rose-950/20"
                            : ""
                        }`}
                      >
                        {isEditingCol ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              value={day.dateIso}
                              onChange={(e) =>
                                handleUpdateDayDate(day.id, e.target.value)
                              }
                              className="rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1a1d24] px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveDay(day.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                              title="Hapus kolom tanggal ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingColId(null)}
                              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingColId(day.id)}
                            className="w-full flex items-center justify-between gap-1.5 text-left group cursor-pointer"
                            title="Klik untuk ubah tanggal atau hapus kolom"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-xs font-bold ${
                                    isWeekend
                                      ? "text-rose-700 dark:text-rose-300"
                                      : "text-slate-900 dark:text-white"
                                  }`}
                                >
                                  {day.label}
                                </span>
                                {isToday && (
                                  <span className="rounded bg-[#F05232] px-1.5 py-0.2 text-[9px] font-bold text-white">
                                    Hari Ini
                                  </span>
                                )}
                                {isWeekend && (
                                  <span className="rounded bg-rose-100 dark:bg-rose-950/70 px-1.5 py-0.2 text-[9px] font-bold text-rose-700 dark:text-rose-300">
                                    Libur • Urgent
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-normal text-slate-400">
                                {day.dateIso}
                              </span>
                            </div>
                            <Edit3 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* BARIS PER PIC DENGAN SPAN MULTI-HARI */}
                <div className="divide-y divide-slate-200 dark:divide-white/10">
                  {plan.pics.map((pic) => {
                    const dotColor = getPicDotColor(pic);
                    const packed = packedByPic.get(pic) ?? {
                      tracks: [],
                      outOfRangeEntries: [],
                    };
                    const totalTrackRows = Math.max(1, packed.tracks.length + 1);

                    return (
                      <div
                        key={pic}
                        className="grid group/row bg-white dark:bg-[#12141a]"
                        style={{
                          gridTemplateColumns: `104px minmax(0, 1fr)`,
                        }}
                      >
                        {/* Kolom Nama PIC (Sticky Kiri) */}
                        <div className="px-2.5 py-2.5 border-r border-slate-200 dark:border-white/10 sticky left-0 z-20 bg-white dark:bg-[#12141a] flex flex-col justify-start gap-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: dotColor }}
                              />
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {pic}
                              </span>
                            </div>
                            {plan.pics.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePic(pic)}
                                className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-opacity cursor-pointer"
                                title={`Hapus baris ${pic}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {packed.outOfRangeEntries.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                ensureColumnVisibleForDate(
                                  packed.outOfRangeEntries[0].startDateIso
                                )
                              }
                              className="w-full text-left rounded bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/50 px-1.5 py-0.5 text-[9.5px] font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 cursor-pointer truncate"
                              title={packed.outOfRangeEntries
                                .map(
                                  (o) =>
                                    `${formatDayShortLabel(o.startDateIso)}: ${o.entry.title}`
                                )
                                .join("\n")}
                            >
                              ↗ +{packed.outOfRangeEntries.length} tgl lain
                            </button>
                          )}
                        </div>

                        {/* Area Grid Multi-Kolom Tanggal */}
                        <div
                          className="relative"
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer) {
                              e.dataTransfer.dropEffect = "move";
                            }
                            const matchedDay = resolveDayByClientX(e.clientX);
                            if (matchedDay) {
                              const targetKey = `cell:${pic}:${matchedDay.id}`;
                              if (dragOverTarget !== targetKey) {
                                setDragOverTarget(targetKey);
                              }
                            }
                          }}
                          onDragLeave={(e) => {
                            if (
                              !e.currentTarget.contains(
                                e.relatedTarget as Node | null
                              )
                            ) {
                              setDragOverTarget(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const matchedDay = resolveDayByClientX(e.clientX);
                            if (matchedDay) {
                              handleDropOnCell(
                                pic,
                                matchedDay.id,
                                matchedDay.dateIso
                              );
                            }
                          }}
                        >
                          {/* Layer 1: Background Kolom Dropzone */}
                          <div
                            className="grid absolute inset-0"
                            style={{
                              gridTemplateColumns: `repeat(${plan.days.length}, minmax(130px, 1fr))`,
                            }}
                          >
                            {plan.days.map((day) => {
                              const dropKey = `cell:${pic}:${day.id}`;
                              const isOver = dragOverTarget === dropKey;
                              const isWeekend = Boolean(
                                day.isWeekend ?? isWeekendIso(day.dateIso)
                              );

                              return (
                                <div
                                  key={`bg-${pic}-${day.id}`}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (e.dataTransfer) {
                                      e.dataTransfer.dropEffect = "move";
                                    }
                                    if (dragOverTarget !== dropKey) {
                                      setDragOverTarget(dropKey);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDropOnCell(pic, day.id, day.dateIso);
                                  }}
                                  className={`border-r border-slate-200 dark:border-white/10 transition-colors ${
                                    isOver
                                      ? "bg-[#F05232]/15 ring-2 ring-inset ring-[#F05232]"
                                      : isWeekend
                                      ? "bg-rose-50/40 dark:bg-rose-950/10"
                                      : ""
                                  }`}
                                />
                              );
                            })}
                          </div>

                          {/* Layer 2: Kartu Spanning Multi-Hari + Tombol Tambah di Bawah (pointer-events-none agar background tetap terima drag/drop) */}
                          <div
                            className="grid relative z-10 gap-y-1.5 p-1.5 items-start pointer-events-none"
                            style={{
                              gridTemplateColumns: `repeat(${plan.days.length}, minmax(130px, 1fr))`,
                              gridTemplateRows: `repeat(${totalTrackRows}, auto)`,
                            }}
                          >
                            {packed.tracks.map((track, trackIdx) =>
                              track.map((span) => {
                                const isResizingThis =
                                  resizeState?.pic === pic &&
                                  resizeState?.entryId === span.entry.id;

                                const effectiveEndIso = isResizingThis
                                  ? resizeState.previewEndIso
                                  : span.endDateIso;
                                const effectiveEndColIdx = isResizingThis
                                  ? resizeState.previewEndColIdx
                                  : span.endColIdx;
                                const effectiveColSpan = Math.max(
                                  1,
                                  effectiveEndColIdx - span.startColIdx + 1
                                );
                                const effectiveDaysCount = countWorkingDaysInRange(
                                  span.startDateIso,
                                  effectiveEndIso,
                                  Boolean(span.entry.urgent)
                                );

                                const catStyle =
                                  JOBDESK_CATEGORY_STYLES[span.entry.category] ??
                                  JOBDESK_CATEGORY_STYLES.LAINNYA;

                                return (
                                  <div
                                    key={span.entry.id}
                                    draggable={!resizeState}
                                    onDragStart={(e) => {
                                      if (resizeState) return;
                                      beginDrag(e, {
                                        kind: "CELL_ENTRY",
                                        fromPic: pic,
                                        fromDayId: span.storageDayId,
                                        cellEntry: span.entry,
                                      });
                                    }}
                                    onDragEnd={endDrag}
                                    style={{
                                      gridColumn: `${span.startColIdx + 1} / span ${effectiveColSpan}`,
                                      gridRow: trackIdx + 1,
                                    }}
                                    className={`group/entry pointer-events-auto relative self-start mx-0.5 rounded-lg border border-slate-200 dark:border-white/10 border-l-4 ${
                                      catStyle.border
                                    } pl-2 pr-3 py-1.5 text-[11px] shadow-2xs transition-shadow flex flex-col gap-1 ${
                                      span.entry.done
                                        ? "bg-emerald-50/75 dark:bg-emerald-950/25 opacity-80"
                                        : `${catStyle.barBg} hover:shadow-sm`
                                    } ${
                                      isResizingThis
                                        ? "ring-2 ring-[#F05232] shadow-md z-30"
                                        : "cursor-grab active:cursor-grabbing"
                                    }`}
                                  >
                                    {/* Baris Atas: Checkbox + Judul Ringkas + Tombol Hapus */}
                                    <div className="flex items-start gap-1.5 min-w-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleToggleCellDone(
                                            pic,
                                            span.storageDayId,
                                            span.entry.id
                                          )
                                        }
                                        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer ${
                                          span.entry.done
                                            ? "bg-emerald-500 border-emerald-500 text-white"
                                            : "border-slate-300 dark:border-white/25 bg-white dark:bg-[#12141a] hover:border-emerald-500"
                                        }`}
                                        title="Tandai selesai / belum selesai"
                                      >
                                        {span.entry.done && (
                                          <Check className="w-2.5 h-2.5" />
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          openEditCellModal(
                                            pic,
                                            span.storageDayId,
                                            span.startDateIso,
                                            formatDayShortLabel(
                                              span.startDateIso
                                            ),
                                            span.entry
                                          )
                                        }
                                        title={`${span.entry.title} (${formatDayShortLabel(
                                          span.startDateIso
                                        )}${
                                          effectiveDaysCount > 1
                                            ? ` → ${formatDayShortLabel(effectiveEndIso)}`
                                            : ""
                                        })`}
                                        className={`flex-1 min-w-0 text-left font-bold leading-tight line-clamp-2 hover:text-[#F05232] cursor-pointer ${
                                          span.entry.done
                                            ? "line-through text-slate-400"
                                            : "text-slate-900 dark:text-slate-100"
                                        }`}
                                      >
                                        {span.entry.title}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteCellEntry(
                                            pic,
                                            span.storageDayId,
                                            span.entry.id
                                          )
                                        }
                                        className="opacity-0 group-hover/entry:opacity-100 shrink-0 text-slate-400 hover:text-rose-500 p-0.5 rounded transition-opacity cursor-pointer"
                                        title="Hapus dari jadwal"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>

                                    {/* Baris Bawah: Badge Status & Stepper Range Ringkas */}
                                    <div className="flex items-center justify-between gap-1 pl-5">
                                      <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                        {span.entry.urgent && (
                                          <span
                                            className="inline-flex items-center gap-0.5 rounded bg-rose-100 dark:bg-rose-950/70 px-1 py-0.2 text-[9px] font-bold text-rose-700 dark:text-rose-300 shrink-0"
                                            title="Pekerjaan Urgent"
                                          >
                                            <Flame className="w-2.5 h-2.5" />
                                            Urg
                                          </span>
                                        )}

                                        {(span.entry.syncedFromSchedule ||
                                          span.entry.workItemId) && (
                                          <span
                                            className="inline-flex items-center gap-0.5 rounded bg-cyan-100 dark:bg-cyan-950/60 px-1 py-0.2 text-[9px] font-semibold text-cyan-800 dark:text-cyan-300 shrink-0"
                                            title="Terhubung dengan Schedule Proyek"
                                          >
                                            <Link2 className="w-2.5 h-2.5" />
                                            Sync
                                          </span>
                                        )}

                                        {effectiveDaysCount > 1 && (
                                          <span className="text-[9.5px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                            {formatDayShortLabel(span.startDateIso).replace(
                                              /^[A-Za-z]+,\s*/,
                                              ""
                                            )}
                                            →
                                            {formatDayShortLabel(effectiveEndIso).replace(
                                              /^[A-Za-z]+,\s*/,
                                              ""
                                            )}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center rounded border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#12141a]/90 shrink-0">
                                        <button
                                          type="button"
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            handleStepEntryRange(
                                              pic,
                                              span.storageDayId,
                                              span.entry,
                                              span.startDateIso,
                                              -1
                                            );
                                          }}
                                          disabled={effectiveDaysCount <= 1}
                                          className="p-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                                          title="Kurangi 1 hari kerja"
                                        >
                                          <Minus className="w-2.5 h-2.5" />
                                        </button>
                                        <span className="px-1 text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
                                          {effectiveDaysCount}h
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            handleStepEntryRange(
                                              pic,
                                              span.storageDayId,
                                              span.entry,
                                              span.startDateIso,
                                              1
                                            );
                                          }}
                                          className="p-0.5 text-slate-500 hover:text-[#F05232] cursor-pointer"
                                          title="Perpanjang +1 hari kerja"
                                        >
                                          <Plus className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Handle Tarik Range Horizontal di Sisi Kanan */}
                                    <div
                                      onPointerDown={(ev) => {
                                        ev.preventDefault();
                                        ev.stopPropagation();
                                        setResizeState({
                                          pic,
                                          storageDayId: span.storageDayId,
                                          entryId: span.entry.id,
                                          startDateIso: span.startDateIso,
                                          startColIdx: span.startColIdx,
                                          urgent: Boolean(span.entry.urgent),
                                          previewEndIso: span.endDateIso,
                                          previewEndColIdx: span.endColIdx,
                                        });
                                      }}
                                      title="Tarik ke kanan untuk memperpanjang range hari"
                                      className="absolute right-0 top-1 bottom-1 w-2 rounded-r bg-slate-300/60 dark:bg-white/15 hover:bg-[#F05232] flex items-center justify-center cursor-ew-resize transition-colors"
                                    >
                                      <span className="w-0.5 h-3 bg-current rounded-full opacity-60" />
                                    </div>
                                  </div>
                                );
                              })
                            )}

                            {/* Baris Tombol `+ Tambah Job` di bawah track setiap tanggal */}
                            {plan.days.map((day, colIdx) => {
                              const isWeekend = Boolean(
                                day.isWeekend ?? isWeekendIso(day.dateIso)
                              );
                              return (
                                <div
                                  key={`add-${pic}-${day.id}`}
                                  style={{
                                    gridColumn: colIdx + 1,
                                    gridRow: packed.tracks.length + 1,
                                  }}
                                  className="px-0.5 pt-0.5 pointer-events-auto"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openAddCellModal(
                                        pic,
                                        day.id,
                                        day.dateIso,
                                        day.label
                                      )
                                    }
                                    className={`w-full inline-flex items-center justify-center gap-1 rounded-lg border border-dashed py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                                      isWeekend
                                        ? "border-rose-200 dark:border-rose-900/40 text-rose-400 hover:border-rose-500 hover:text-rose-600"
                                        : "border-slate-200 dark:border-white/10 text-slate-400 hover:border-[#F05232] hover:text-[#F05232] hover:bg-[#F05232]/[0.04]"
                                    }`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    {isWeekend ? "Urgent" : "Tambah Job"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ==================== BLOK SUB JOBDESK & CATATAN ==================== */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              setDragOverTarget("sub-zone");
            }}
            onDragLeave={() => {
              if (dragOverTarget === "sub-zone") setDragOverTarget(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnSub();
            }}
            className={`v14-card p-4 sm:p-5 space-y-3 transition-colors ${
              dragOverTarget === "sub-zone"
                ? "ring-2 ring-amber-400 bg-amber-50/30 dark:bg-amber-950/10"
                : ""
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  sub jobdesk
                  <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                    {plan.subJobdesks.length} item
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Daftar pekerjaan cadangan bernomor (contoh: 1. HMI TBU-1105). Bisa
                  ditarik dari antrian kiri atau diketik langsung.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              {plan.subJobdesks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                  Belum ada <b>sub jobdesk</b>. Tarik kartu dari panel kiri ke sini,
                  klik tombol <b>+ Sub</b>, atau tambahkan manual di bawah.
                </div>
              ) : (
                plan.subJobdesks.map((sub, idx) => {
                  const isEditing = editingSubId === sub.id;
                  const isPromoting = promoteSubId === sub.id;
                  const catStyle =
                    JOBDESK_CATEGORY_STYLES[sub.category] ??
                    JOBDESK_CATEGORY_STYLES.HMI;

                  return (
                    <div
                      key={sub.id}
                      draggable
                      onDragStart={(e) =>
                        beginDrag(e, { kind: "SUB_ITEM", subItem: sub })
                      }
                      onDragEnd={endDrag}
                      className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#1a1d24] px-3 py-2 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                          <span className="w-6 text-xs font-bold text-slate-500 dark:text-slate-400">
                            {idx + 1}.
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleSubDone(sub.id)}
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer ${
                              sub.done
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-slate-300 dark:border-white/25 hover:border-emerald-500"
                            }`}
                          >
                            {sub.done && <Check className="w-2.5 h-2.5" />}
                          </button>

                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingSubText}
                                onChange={(e) => setEditingSubText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveSubEdit(sub.id);
                                  if (e.key === "Escape") setEditingSubId(null);
                                }}
                                autoFocus
                                className="flex-1 rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#12141a] px-2 py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveSubEdit(sub.id)}
                                className="rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                              >
                                OK
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSubId(sub.id);
                                setEditingSubText(sub.title);
                              }}
                              className={`text-left text-xs font-semibold hover:text-[#F05232] cursor-pointer ${
                                sub.done
                                  ? "line-through text-slate-400"
                                  : "text-slate-800 dark:text-slate-100"
                              }`}
                            >
                              {sub.title}
                            </button>
                          )}

                          <span
                            className={`hidden sm:inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${catStyle.badge}`}
                          >
                            {JOBDESK_CATEGORY_LABELS[sub.category]}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setPromoteSubId(isPromoting ? null : sub.id)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#232732] hover:border-[#F05232] hover:text-[#F05232] px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            Pindah ke Jadwal <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSub(sub.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isPromoting && (
                        <div className="pl-8 pt-1.5 border-t border-slate-200/70 dark:border-white/10 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold text-slate-500">
                            Pilih target PIC & Tgl:
                          </span>
                          {plan.pics.map((pic) =>
                            plan.days
                              .filter((d) => !d.isWeekend)
                              .map((day) => (
                                <button
                                  key={`${pic}-${day.id}`}
                                  type="button"
                                  onClick={() =>
                                    handlePromoteSubToCell(
                                      sub,
                                      pic,
                                      day.id,
                                      day.dateIso
                                    )
                                  }
                                  className="rounded-md bg-white dark:bg-[#232732] border border-slate-200 dark:border-white/10 hover:bg-[#F05232] hover:text-white px-2 py-0.5 text-[10px] font-medium cursor-pointer"
                                >
                                  {pic} • {day.label}
                                </button>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Tambah Sub Jobdesk Baru */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select
                value={newSubCategory}
                onChange={(e) =>
                  setNewSubCategory(e.target.value as JobdeskCategory)
                }
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1d24] px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {JOBDESK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {JOBDESK_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newSubTitle}
                onChange={(e) => setNewSubTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddManualSubJobdesk();
                }}
                placeholder="Tambah sub jobdesk baru (contoh: HMI AHM)..."
                className="flex-1 min-w-[200px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1d24] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleAddManualSubJobdesk}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Sub
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Catatan bawah:
              </span>
              <input
                type="text"
                value={plan.subNote}
                onChange={(e) =>
                  updatePlan((prev) => ({ ...prev, subNote: e.target.value }))
                }
                placeholder={DEFAULT_SUB_JOBDESK_NOTE}
                className="flex-1 min-w-[260px] rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-white/10 focus:border-[#F05232] bg-slate-50/70 dark:bg-white/[0.03] px-2.5 py-1 text-xs italic text-slate-700 dark:text-slate-300 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MODAL TAMBAH / EDIT CELL (DENGAN RANGE & URGENT) ==================== */}
      {cellModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setCellModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {cellModal.editingEntry ? "Edit Jobdesk" : "Tambah Jobdesk"} —{" "}
                  <span className="text-[#F05232]">{cellModal.pic}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mulai: {formatDayShortLabel(modalStartIso)}
                  {modalEndIso > modalStartIso &&
                    ` → Selesai: ${formatDayShortLabel(modalEndIso)} (${countWorkingDaysInRange(
                      modalStartIso,
                      modalEndIso,
                      modalUrgent
                    )} hari kerja)`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCellModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Nama Pekerjaan / Jobdesk
                  </label>
                  <input
                    type="text"
                    value={modalTitle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setModalTitle(val);
                      if (!cellModal.editingEntry && val.trim().length > 2) {
                        setModalCategory(inferCategoryFromText(val));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveCellModal();
                    }}
                    placeholder="Contoh: Program TBI-1023 dan TBI-1018"
                    autoFocus
                    className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#12141a] px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F05232]/30"
                  />
                </div>

                {/* Rentang Tanggal Pengerjaan (Start - End) + Preset Durasi */}
                <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Tanggal Mulai
                      </label>
                      <input
                        type="date"
                        value={modalStartIso}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          setModalStartIso(v);
                          if (modalEndIso < v) setModalEndIso(v);
                        }}
                        className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#12141a] px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Sampai Tanggal
                      </label>
                      <input
                        type="date"
                        min={modalStartIso}
                        value={modalEndIso}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          setModalEndIso(v >= modalStartIso ? v : modalStartIso);
                        }}
                        className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#12141a] px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold text-slate-500">
                        Durasi cepat:
                      </span>
                      {[1, 2, 3, 4, 5].map((daysLen) => {
                        const targetEnd = stepWorkingDaysIso(
                          modalStartIso,
                          daysLen - 1,
                          modalUrgent
                        );
                        const isSelected = modalEndIso === targetEnd;
                        return (
                          <button
                            key={daysLen}
                            type="button"
                            onClick={() => setModalEndIso(targetEnd)}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                              isSelected
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                : "bg-white dark:bg-[#1a1d24] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {daysLen} Hari
                          </button>
                        );
                      })}
                    </div>

                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalUrgent}
                        onChange={(e) => setModalUrgent(e.target.checked)}
                        className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                      />
                      Urgent (Boleh Sab/Min)
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Kategori Pekerjaan
                    </label>
                    <select
                      value={modalCategory}
                      onChange={(e) =>
                        setModalCategory(e.target.value as JobdeskCategory)
                      }
                      className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#12141a] px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      {JOBDESK_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {JOBDESK_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Catatan Singkat (Opsional)
                    </label>
                    <input
                      type="text"
                      value={modalNote}
                      onChange={(e) => setModalNote(e.target.value)}
                      placeholder="Misal: Prioritas urgent"
                      className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#12141a] px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {!cellModal.editingEntry && availableJobdesks.length > 0 && (
                <div className="border-t border-slate-200 dark:border-white/10 pt-3 space-y-2">
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                    Atau klik 1x dari Antrian Proyek Belum Dikerjakan:
                  </span>
                  <input
                    type="text"
                    value={modalSearchQueue}
                    onChange={(e) => setModalSearchQueue(e.target.value)}
                    placeholder="Filter antrian proyek..."
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#12141a] px-2.5 py-1.5 text-xs"
                  />
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {modalFilteredQueue.map((item) => {
                      const isAssigned =
                        assignmentMap.has(item.sourceKey) ||
                        assignmentMap.has(
                          `title:${item.title.trim().toLowerCase()}`
                        );
                      return (
                        <button
                          key={item.sourceKey}
                          type="button"
                          onClick={() => {
                            assignAvailableToCell(
                              item,
                              cellModal.pic,
                              cellModal.dayId,
                              cellModal.dayDateIso
                            );
                            setCellModal(null);
                          }}
                          className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-white/10 hover:border-[#F05232] hover:bg-[#F05232]/[0.04] px-2.5 py-1.5 text-left transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                              #{item.priorityRank} {item.title}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {item.projectName}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              isAssigned
                                ? "bg-slate-100 dark:bg-white/10 text-slate-500"
                                : "bg-[#F05232]/10 text-[#F05232]"
                            }`}
                          >
                            {isAssigned ? "Sudah dibagi" : "+ Pilih"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setCellModal(null)}
                className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCellModal}
                disabled={!modalTitle.trim()}
                className="rounded-xl bg-[#F05232] hover:bg-[#d94426] disabled:opacity-45 px-4 py-1.5 text-xs font-semibold text-white cursor-pointer"
              >
                {cellModal.editingEntry ? "Simpan Perubahan" : "Masukkan ke Tabel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
