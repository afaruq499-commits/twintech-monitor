"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Database,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import {
  CatalogAutocompleteInput,
  HighlightedText,
} from "@/components/CatalogAutocompleteInput";
import type { CatalogComponentDTO } from "@/lib/catalog-queries";
import { searchCatalogComponents } from "@/lib/catalog-search";
import {
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABELS,
  filterExportablePrItems,
  isExcludedFromPrExport,
  type ProjectPriority,
} from "@/lib/constants";
import { formatRupiah } from "@/lib/date-utils";
import type { PrNoteCategory } from "@/lib/export/pr-exporter";
import {
  FR_EG_EP_006_PDF_COMPONENTS,
  formatCatalogItemForPr,
  type PdfPresetComponent,
} from "@/lib/pr-catalog-default";
import {
  MANDATORY_PR_GROUP,
  type MandatoryPrKey,
  type MandatoryPrSpec,
  buildPrSubmissionItems,
  matchMandatoryKey,
  mergeMandatoryPrRows,
} from "@/lib/pr-mandatory";

interface ProjectSummaryOption {
  id: string;
  kode: string | null;
  nama: string;
  client: string;
  pic: string | null;
  totalComponents: number;
}

interface PrDraftRow {
  tempId: string;
  kelompok: string;
  noPr: string;
  partType: string;
  partName: string;
  supplier: string;
  qty: number;
  unit: string;
  catatanPr: string;
  tanggalPakai: string;
  hargaSatuan: string; // string untuk input angka nyaman, kosong = null
  fromCatalogId?: string | null;
  mandatoryKey?: MandatoryPrKey | null;
  statusPembelian?: string | null;
}

const DEFAULT_GROUPS = [
  "Panel Utama",
  "OP Panel",
  "Sensor & Push Button",
];

const UNIT_OPTIONS = ["pcs", "set", "lsn", "m", "btg", "rol", "pack", "unit"];

const NOTE_CATEGORIES: PrNoteCategory[] = [
  "NEW PROJECT",
  "INVENTORY",
  "EXPENSES",
  "NON INVENTORY",
];

let rowCounter = 1;
function nextTempId() {
  rowCounter += 1;
  return `pr-row-${Date.now()}-${rowCounter}`;
}

function createMandatoryDraftRow(
  spec: MandatoryPrSpec,
  index: number,
  catalogList: CatalogComponentDTO[]
): PrDraftRow {
  const matchedCat = catalogList.find((c) => {
    const f = formatCatalogItemForPr(c);
    return (
      f.partType.toLowerCase() === spec.partType.toLowerCase() &&
      f.partName.toLowerCase() === spec.partName.toLowerCase()
    );
  });
  const prFields = matchedCat ? formatCatalogItemForPr(matchedCat) : null;
  return {
    tempId: nextTempId(),
    kelompok: spec.kelompok,
    noPr: String(index),
    partType: spec.partType,
    partName: spec.partName,
    supplier: spec.supplier,
    qty: spec.defaultQty,
    unit: prFields?.unit ?? spec.unit,
    catatanPr: spec.catatanPr,
    tanggalPakai: "",
    hargaSatuan:
      prFields?.hargaSatuan !== null && prFields?.hargaSatuan !== undefined
        ? String(prFields.hargaSatuan)
        : String(spec.hargaSatuan),
    fromCatalogId: matchedCat?.id ?? null,
    mandatoryKey: spec.key,
  };
}

export function PrBuilderClient({
  initialCatalog,
  projects,
  defaultTodayIso,
}: {
  initialCatalog: CatalogComponentDTO[];
  projects: ProjectSummaryOption[];
  defaultTodayIso: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get("projectId") ?? "";
  const preselectedProj = projects.find((p) => p.id === preselectedProjectId);

  // Tab halaman: Builder PR vs Master Katalog
  const [activeTab, setActiveTab] = useState<"builder" | "catalog">("builder");

  // State Katalog (bisa ditambah/diedit langsung di browser)
  const [catalog, setCatalog] = useState<CatalogComponentDTO[]>(initialCatalog);

  // Target Proyek
  const [targetMode, setTargetMode] = useState<
    "EXISTING_PROJECT" | "NEW_PROJECT"
  >(
    preselectedProj
      ? "EXISTING_PROJECT"
      : projects.length > 0
        ? "EXISTING_PROJECT"
        : "NEW_PROJECT"
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    preselectedProj?.id ?? projects[0]?.id ?? ""
  );
  const [saveMode, setSaveMode] = useState<"REPLACE" | "MERGE">("REPLACE");

  // Field Proyek Baru & Deskripsi Komponen Inti (Input Machine Learning)
  const [newProjNama, setNewProjNama] = useState("");
  const [newProjClient, setNewProjClient] = useState("");
  const [newProjKode, setNewProjKode] = useState("");
  const [newProjPrioritas, setNewProjPrioritas] =
    useState<ProjectPriority>("TINGGI");
  const [newProjDeadline, setNewProjDeadline] = useState("");

  // Metadata Header & Footer PR (Format File 1)
  const [showHeaderDetail, setShowHeaderDetail] = useState(false);
  const [department, setDepartment] = useState("ENGINEERING");
  const [noteCategory, setNoteCategory] =
    useState<PrNoteCategory>("NEW PROJECT");
  const [prepared, setPrepared] = useState(
    preselectedProj?.pic || "FARUQ"
  );
  const [checked, setChecked] = useState("IVAN");
  const [purchasing, setPurchasing] = useState("TETI NURBAETI");
  const [approved, setApproved] = useState("");
  const [tanggalPr, setTanggalPr] = useState(defaultTodayIso);

  const [partsName, setPartsName] = useState(preselectedProj?.nama ?? "");
  const [partsNumber, setPartsNumber] = useState("SPM");
  const [jobNumber, setJobNumber] = useState(preselectedProj?.kode ?? "");
  const [customer, setCustomer] = useState(preselectedProj?.client ?? "");
  const [defaultSupplier, setDefaultSupplier] = useState("");

  // Kelompok & Daftar Item PR
  const [groups, setGroups] = useState<string[]>(DEFAULT_GROUPS);
  const [activeGroup, setActiveGroup] = useState<string>(DEFAULT_GROUPS[0]);
  const [newGroupInput, setNewGroupInput] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);

  const [items, setItems] = useState<PrDraftRow[]>(() =>
    mergeMandatoryPrRows([], (spec, idx) =>
      createMandatoryDraftRow(spec, idx, initialCatalog)
    )
  );
  const [loadingProjectItems, setLoadingProjectItems] = useState(false);

  // Filter Pemilih Katalog Cepat
  const [catSearch, setCatSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [quickQtyMap, setQuickQtyMap] = useState<Record<string, number>>({});

  // Paket Komponen Standar Drawing PDF (FR-EG-EP-006)
  const [showPdfPreset, setShowPdfPreset] = useState(false);
  const [pdfPresetPageFilter, setPdfPresetPageFilter] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [pdfPresetQtyMap, setPdfPresetQtyMap] = useState<Record<string, number>>({});

  // Baris terakhir yang baru ditambahkan agar otomatis fokus ke kolom PART TYPE
  const [lastAddedRowId, setLastAddedRowId] = useState<string | null>(null);

  // Feedback / status
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // State CRUD Master Katalog (Tab 2)
  const [catalogTableSearch, setCatalogTableSearch] = useState("");
  const [catalogTableCategory, setCatalogTableCategory] = useState("ALL");
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [editingCatalogItem, setEditingCatalogItem] =
    useState<CatalogComponentDTO | null>(null);
  const [catalogForm, setCatalogForm] = useState({
    kategori: "Push Button & Switch",
    nama: "",
    merek: "",
    tipeModel: "",
    spesifikasi: "",
    estimasiHarga: "",
    defaultUnit: "pcs",
    fungsi: "",
  });

  // Sinkronkan footer otomatis saat memilih proyek pertama kali jika belum diset
  useEffect(() => {
    if (targetMode === "EXISTING_PROJECT" && selectedProjectId) {
      const p = projects.find((x) => x.id === selectedProjectId);
      if (p) {
        setPartsName(p.nama);
        setCustomer(p.client);
        setJobNumber(p.kode ?? "");
        if (p.pic) setPrepared(p.pic);
      }
    }
  }, [targetMode, selectedProjectId, projects]);

  // Jika dibuka dengan ?projectId=..., otomatis muat komponen proyek tersebut
  useEffect(() => {
    if (preselectedProjectId) {
      void loadExistingProjectComponents(preselectedProjectId, true);
    }
  }, [preselectedProjectId]);

  const categories = useMemo(() => {
    return Array.from(new Set(catalog.map((c) => c.kategori)));
  }, [catalog]);

  const pickerSearchResult = useMemo(() => {
    const byCategory =
      catFilter === "ALL"
        ? catalog
        : catalog.filter((c) => c.kategori === catFilter);
    return searchCatalogComponents(byCategory, catSearch, {
      limit: byCategory.length + 10,
      preferField: "partType",
    });
  }, [catalog, catSearch, catFilter]);

  const filteredCatalogPicker = pickerSearchResult.matches;
  const pickerSearchTokens = pickerSearchResult.tokens;

  const masterSearchResult = useMemo(() => {
    const byCategory =
      catalogTableCategory === "ALL"
        ? catalog
        : catalog.filter((c) => c.kategori === catalogTableCategory);
    return searchCatalogComponents(byCategory, catalogTableSearch, {
      limit: byCategory.length + 10,
      preferField: "partType",
    });
  }, [catalog, catalogTableSearch, catalogTableCategory]);

  const filteredCatalogMaster = masterSearchResult.matches;

  // Hitung jumlah yang sudah masuk ke PR per catalog item
  const qtyInPrByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of items) {
      const k = `${row.partType.trim().toLowerCase()}||${row.partName
        .trim()
        .toLowerCase()}`;
      map.set(k, (map.get(k) ?? 0) + (Number(row.qty) || 0));
    }
    return map;
  }, [items]);

  const grandTotal = useMemo(() => {
    return items.reduce((acc, r) => {
      const price = r.hargaSatuan.trim() !== "" ? Number(r.hargaSatuan) : NaN;
      const qty = Number(r.qty) || 0;
      if (Number.isFinite(price) && qty > 0) {
        return acc + Math.round(price * qty);
      }
      return acc;
    }, 0);
  }, [items]);

  const { activePrCount, excludedMandatoryCount } = useMemo(() => {
    let active = 0;
    let excluded = 0;
    for (const r of items) {
      if (r.mandatoryKey) {
        if ((Number(r.qty) || 0) > 0) active += 1;
        else excluded += 1;
      } else if (r.partType.trim() !== "" || r.partName.trim() !== "") {
        active += 1;
      }
    }
    return { activePrCount: active, excludedMandatoryCount: excluded };
  }, [items]);

  async function loadExistingProjectComponents(
    projId: string,
    silentIfEmpty = false
  ) {
    if (!projId) return;
    setLoadingProjectItems(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/pr/save-web?projectId=${projId}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Gagal memuat komponen proyek.");
        return;
      }

      if (data.project) {
        setPartsName(data.project.nama ?? "");
        setCustomer(data.project.client ?? "");
        setJobNumber(data.project.kode ?? "");
        if (data.project.pic) setPrepared(data.project.pic);
      }
      if (data.header) {
        if (data.header.department) setDepartment(data.header.department);
        if (data.header.noteCategory) setNoteCategory(data.header.noteCategory);
        if (data.header.prepared) setPrepared(data.header.prepared);
        if (data.header.checked) setChecked(data.header.checked);
        if (data.header.purchasing) setPurchasing(data.header.purchasing);
        if (data.header.approved) setApproved(data.header.approved);
      }
      if (data.footer) {
        if (data.footer.partsName) setPartsName(data.footer.partsName);
        if (data.footer.partsNumber) setPartsNumber(data.footer.partsNumber);
        if (data.footer.jobNumber) setJobNumber(data.footer.jobNumber);
        if (data.footer.customer) setCustomer(data.footer.customer);
      }

      const loaded: PrDraftRow[] = (data.items ?? []).map(
        (it: {
          kelompok: string;
          noPr: string;
          partType: string;
          partName: string;
          supplier: string;
          qty: number;
          unit: string;
          catatanPr: string;
          tanggalPakai: string;
          hargaSatuan: number | null;
          statusPembelian?: string | null;
        }) => ({
          tempId: nextTempId(),
          kelompok: it.kelompok || "Panel Utama",
          noPr: it.noPr ?? "",
          partType: it.partType ?? "",
          partName: it.partName ?? "",
          supplier: it.supplier ?? "",
          qty: Number(it.qty) || 1,
          unit: it.unit || "pcs",
          catatanPr: it.catatanPr ?? "",
          tanggalPakai: it.tanggalPakai ?? "",
          hargaSatuan:
            it.hargaSatuan !== null && it.hargaSatuan !== undefined
              ? String(it.hargaSatuan)
              : "",
          statusPembelian: it.statusPembelian ?? null,
        })
      );

      if (loaded.length > 0) {
        const merged = mergeMandatoryPrRows(loaded, (spec, idx) =>
          createMandatoryDraftRow(spec, idx, catalog)
        );
        const distinctGroups = Array.from(
          new Set([...merged.map((l) => l.kelompok), ...DEFAULT_GROUPS])
        );
        setGroups(distinctGroups);
        setActiveGroup(loaded[0].kelompok || DEFAULT_GROUPS[0]);
        setItems(merged);
        if (!silentIfEmpty) {
          setSuccessMsg(
            `Berhasil memuat ${loaded.length} komponen dari proyek + komponen wajib PR siap diedit.`
          );
        }
      } else {
        setGroups(DEFAULT_GROUPS);
        setActiveGroup(DEFAULT_GROUPS[0]);
        setItems(
          mergeMandatoryPrRows([], (spec, idx) =>
            createMandatoryDraftRow(spec, idx, catalog)
          )
        );
        if (!silentIfEmpty) {
          setSuccessMsg(
            "Proyek ini belum memiliki komponen PR. Komponen wajib PR sudah disiapkan (Qty 0 = tidak masuk PR)."
          );
        }
      }
    } catch {
      setErrorMsg("Gagal menghubungi server saat memuat komponen proyek.");
    } finally {
      setLoadingProjectItems(false);
    }
  }

  function addCatalogItemToPr(cat: CatalogComponentDTO) {
    setSuccessMsg(null);
    setErrorMsg(null);
    const prFields = formatCatalogItemForPr(cat);
    const addQty = Math.max(1, Number(quickQtyMap[cat.id] ?? 1) || 1);
    const matchedMandatory = matchMandatoryKey(prFields.partType, prFields.partName);

    setItems((prev) => {
      // Jika item katalog cocok dengan komponen wajib PR, tambahkan ke baris wajib tersebut
      if (matchedMandatory) {
        const mandIdx = prev.findIndex(
          (r) => r.mandatoryKey === matchedMandatory
        );
        if (mandIdx >= 0) {
          return prev.map((r, i) =>
            i === mandIdx ? { ...r, qty: (Number(r.qty) || 0) + addQty } : r
          );
        }
      }

      // Cek apakah komponen yang persis sama sudah ada di kelompok aktif -> tambahkan Qty
      const existingIdx = prev.findIndex(
        (r) =>
          r.kelompok === activeGroup &&
          r.partType.trim().toLowerCase() ===
            prFields.partType.toLowerCase() &&
          r.partName.trim().toLowerCase() === prFields.partName.toLowerCase()
      );
      if (existingIdx >= 0) {
        return prev.map((r, i) =>
          i === existingIdx ? { ...r, qty: (Number(r.qty) || 0) + addQty } : r
        );
      }

      const nextNo = String(prev.length + 1);
      return [
        ...prev,
        {
          tempId: nextTempId(),
          kelompok: activeGroup,
          noPr: nextNo,
          partType: prFields.partType,
          partName: prFields.partName,
          supplier: defaultSupplier.trim(),
          qty: addQty,
          unit: prFields.unit,
          catatanPr: "",
          tanggalPakai: "",
          hargaSatuan:
            prFields.hargaSatuan !== null ? String(prFields.hargaSatuan) : "",
          fromCatalogId: cat.id,
        },
      ];
    });
  }

  function findCatalogMatchForPreset(preset: PdfPresetComponent) {
    const needle = preset.lookupKeyword.trim().toLowerCase();
    return catalog.find((c) =>
      `${c.merek} ${c.tipeModel} ${c.nama}`.toLowerCase().includes(needle)
    );
  }

  function addPdfPresetItemsToPr(presets: PdfPresetComponent[], labelSummary?: string) {
    if (presets.length === 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const newGroupNames = presets.map((p) => p.kelompok);
    setGroups((prev) => Array.from(new Set([...prev, ...newGroupNames])));

    const isBatch = presets.length > 1;
    let addedCount = 0;
    let updatedCount = 0;

    setItems((prev) => {
      const updated = [...prev];
      for (const p of presets) {
        const matchedCat = findCatalogMatchForPreset(p);
        const addQty = Math.max(1, Number(pdfPresetQtyMap[p.id] ?? p.defaultQty) || 1);
        const existingIdx = updated.findIndex(
          (r) =>
            r.kelompok === p.kelompok &&
            r.partType.trim().toLowerCase() === p.partType.toLowerCase() &&
            r.partName.trim().toLowerCase() === p.partName.toLowerCase()
        );
        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            qty: isBatch
              ? Math.max(Number(updated[existingIdx].qty) || 0, addQty)
              : (Number(updated[existingIdx].qty) || 0) + addQty,
            catatanPr: updated[existingIdx].catatanPr,
          };
          updatedCount += 1;
        } else {
          updated.push({
            tempId: nextTempId(),
            kelompok: p.kelompok,
            noPr: String(updated.length + 1),
            partType: p.partType,
            partName: p.partName,
            supplier: defaultSupplier.trim(),
            qty: addQty,
            unit: p.unit || matchedCat?.defaultUnit || "pcs",
            catatanPr: "",
            tanggalPakai: "",
            hargaSatuan:
              matchedCat?.estimasiHarga != null ? String(matchedCat.estimasiHarga) : "",
            fromCatalogId: matchedCat?.id ?? null,
          });
          addedCount += 1;
        }
      }
      return updated;
    });

    setActiveGroup(presets[0].kelompok);
    setSuccessMsg(
      labelSummary
        ? `${labelSummary}: ${addedCount} komponen baru ditambahkan${updatedCount > 0 ? `, ${updatedCount} item sudah ada diperbarui` : ""} ke daftar PR.`
        : `Berhasil menambahkan ${presets[0].partName} ke kelompok ${presets[0].kelompok}.`
    );
  }

  function addManualBlankRow(targetGroup?: string) {
    const grp = targetGroup || activeGroup;
    if (!groups.includes(grp)) {
      setGroups((prev) => [...prev, grp]);
    }
    const newId = nextTempId();
    setItems((prev) => [
      ...prev,
      {
        tempId: newId,
        kelompok: grp,
        noPr: String(prev.length + 1),
        partType: "",
        partName: "",
        supplier: defaultSupplier.trim(),
        qty: 1,
        unit: "pcs",
        catatanPr: "",
        tanggalPakai: "",
        hargaSatuan: "",
        fromCatalogId: null,
      },
    ]);
    setLastAddedRowId(newId);
  }

  function updateRow(tempId: string, patch: Partial<PrDraftRow>) {
    setItems((prev) =>
      prev.map((r) => {
        if (r.tempId !== tempId) return r;
        // Komponen wajib PR: Qty, Harga Satuan, Supplier, Catatan PR, dan Tanggal Pakai boleh diubah; identitas komponen tetap terkunci
        if (r.mandatoryKey) {
          const nextRow = { ...r };
          let changed = false;
          if (patch.qty !== undefined) {
            const nextQty = Number(patch.qty);
            nextRow.qty = Number.isFinite(nextQty) && nextQty >= 0 ? nextQty : 0;
            changed = true;
          }
          if (patch.hargaSatuan !== undefined) {
            nextRow.hargaSatuan = patch.hargaSatuan;
            changed = true;
          }
          if (patch.supplier !== undefined) {
            nextRow.supplier = patch.supplier;
            changed = true;
          }
          if (patch.catatanPr !== undefined) {
            nextRow.catatanPr = patch.catatanPr;
            changed = true;
          }
          if (patch.tanggalPakai !== undefined) {
            nextRow.tanggalPakai = patch.tanggalPakai;
            changed = true;
          }
          return changed ? nextRow : r;
        }
        return { ...r, ...patch };
      })
    );
  }

  function applyCatalogSuggestionToRow(
    tempId: string,
    cat: CatalogComponentDTO
  ) {
    const prFields = formatCatalogItemForPr(cat);
    updateRow(tempId, {
      partType: prFields.partType,
      partName: prFields.partName,
      unit: prFields.unit,
      hargaSatuan:
        prFields.hargaSatuan !== null ? String(prFields.hargaSatuan) : "",
      fromCatalogId: cat.id,
    });
    setLastAddedRowId(null);
  }

  function removeRow(tempId: string) {
    setItems((prev) =>
      prev.filter((r) => r.tempId !== tempId || Boolean(r.mandatoryKey))
    );
  }

  function renumberAllRows() {
    setItems((prev) =>
      prev.map((r, idx) => ({
        ...r,
        noPr: String(idx + 1),
      }))
    );
  }

  function applySupplierToEmptyRows() {
    if (!defaultSupplier.trim()) return;
    setItems((prev) =>
      prev.map((r) =>
        r.mandatoryKey || r.supplier.trim()
          ? r
          : { ...r, supplier: defaultSupplier.trim() }
      )
    );
  }

  function handleAddGroup() {
    const clean = newGroupInput.trim();
    if (!clean) return;
    if (!groups.includes(clean)) {
      setGroups((prev) => [...prev, clean]);
    }
    setActiveGroup(clean);
    setNewGroupInput("");
    setAddingGroup(false);
  }

  function buildValidatedPayloadItems() {
    const result = buildPrSubmissionItems(items);
    if (result.error !== null || !result.items) {
      setErrorMsg(result.error ?? "Daftar komponen PR tidak valid.");
      return null;
    }
    return result.items;
  }

  function buildCurrentHeaderFooter() {
    const effectivePartsName =
      targetMode === "NEW_PROJECT"
        ? partsName.trim() || newProjNama.trim()
        : partsName.trim();
    const effectiveCustomer =
      targetMode === "NEW_PROJECT"
        ? customer.trim() || newProjClient.trim()
        : customer.trim();
    const effectiveJobNumber =
      targetMode === "NEW_PROJECT"
        ? jobNumber.trim() || newProjKode.trim()
        : jobNumber.trim();

    return {
      header: {
        department: department.trim() || "ENGINEERING",
        noteCategory,
        prepared: prepared.trim() || null,
        checked: checked.trim() || null,
        purchasing: purchasing.trim() || null,
        approved: approved.trim() || null,
        tanggalPr: tanggalPr || defaultTodayIso,
      },
      footer: {
        partsName: effectivePartsName || null,
        partsNumber: partsNumber.trim() || null,
        jobNumber: effectiveJobNumber || null,
        customer: effectiveCustomer || null,
      },
    };
  }

  async function handleExportExcelOnly() {
    setErrorMsg(null);
    setSuccessMsg(null);
    const payloadItems = buildValidatedPayloadItems();
    if (!payloadItems) return;

    const exportableItems = filterExportablePrItems(payloadItems);
    const skippedCount = payloadItems.length - exportableItems.length;
    if (exportableItems.length === 0) {
      setErrorMsg(
        "Semua item pada daftar berstatus Sudah Ada / Sudah Datang / Terpasang, sehingga tidak ada yang di-export ke PR."
      );
      return;
    }

    const { header, footer } = buildCurrentHeaderFooter();
    setBusyAction("export");
    try {
      const res = await fetch("/api/export/pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header,
          footer,
          items: exportableItems,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(
          errData.error ?? "Gagal mengekspor file Excel Purchase Requisition."
        );
        return;
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const fnMatch = disposition.match(/filename="([^"]+)"/);
      const downloadName =
        fnMatch?.[1] ?? `PURCHASE REQUISITION (${defaultTodayIso}).xlsx`;

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMsg(
        `File Excel "${downloadName}" berhasil diunduh (format 100% sesuai template Import PR)${
          skippedCount > 0
            ? ` • ${skippedCount} item berstatus Sudah Ada / Datang / Terpasang tidak dimasukkan.`
            : "."
        }`
      );
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan saat mengunduh Excel PR.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveToProject(alsoExport: boolean) {
    setErrorMsg(null);
    setSuccessMsg(null);
    const payloadItems = buildValidatedPayloadItems();
    if (!payloadItems) return;

    if (targetMode === "NEW_PROJECT") {
      if (!newProjNama.trim() || !newProjClient.trim()) {
        setErrorMsg(
          "Untuk proyek baru, isi Nama Proyek dan Client terlebih dahulu."
        );
        return;
      }
    } else if (!selectedProjectId) {
      setErrorMsg("Pilih proyek tujuan terlebih dahulu.");
      return;
    }

    const { header, footer } = buildCurrentHeaderFooter();
    setBusyAction(alsoExport ? "save-export" : "save");
    try {
      const res = await fetch("/api/pr/save-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMode,
          projectId:
            targetMode === "EXISTING_PROJECT" ? selectedProjectId : null,
          saveMode,
          newProject:
            targetMode === "NEW_PROJECT"
              ? {
                  kode: newProjKode.trim() || null,
                  nama: newProjNama.trim(),
                  client: newProjClient.trim(),
                  prioritas: newProjPrioritas,
                  deadline: newProjDeadline || null,
                }
              : null,
          header,
          footer,
          items: payloadItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Gagal menyimpan daftar komponen ke proyek.");
        return;
      }

      if (alsoExport) {
        await handleExportExcelOnly();
      }

      router.push(`/proyek/${data.projectId}?tab=komponen`);
      router.refresh();
    } catch {
      setErrorMsg("Gagal menghubungi server saat menyimpan komponen PR.");
    } finally {
      setBusyAction(null);
    }
  }

  async function quickSaveRowToCatalog(row: PrDraftRow) {
    if (!row.partType.trim() || !row.partName.trim()) {
      setErrorMsg("Isi PART TYPE dan PARTS NAME sebelum menyimpan ke katalog.");
      return;
    }
    setErrorMsg(null);
    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategori: row.kelompok || "Komponen Custom",
          nama: row.partName.trim(),
          merek: "Bebas",
          tipeModel: row.partType.trim(),
          spesifikasi: row.catatanPr.trim() || null,
          estimasiHarga:
            row.hargaSatuan.trim() !== "" ? Number(row.hargaSatuan) : null,
          defaultUnit: row.unit.trim() || "pcs",
          fungsi: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Gagal menyimpan ke katalog.");
        return;
      }
      setCatalog((prev) => [...prev, data.item]);
      updateRow(row.tempId, { fromCatalogId: data.item.id });
      setSuccessMsg(
        `"${row.partType}" berhasil ditambahkan ke Master Katalog Komponen!`
      );
    } catch {
      setErrorMsg("Gagal menyimpan komponen baru ke katalog.");
    }
  }

  function openNewCatalogModal() {
    setEditingCatalogItem(null);
    setCatalogForm({
      kategori: categories[0] ?? "Push Button & Switch",
      nama: "",
      merek: "",
      tipeModel: "",
      spesifikasi: "",
      estimasiHarga: "",
      defaultUnit: "pcs",
      fungsi: "",
    });
    setCatalogModalOpen(true);
  }

  function openEditCatalogModal(item: CatalogComponentDTO) {
    setEditingCatalogItem(item);
    setCatalogForm({
      kategori: item.kategori,
      nama: item.nama,
      merek: item.merek,
      tipeModel: item.tipeModel,
      spesifikasi: item.spesifikasi ?? "",
      estimasiHarga:
        item.estimasiHarga !== null ? String(item.estimasiHarga) : "",
      defaultUnit: item.defaultUnit || "pcs",
      fungsi: item.fungsi ?? "",
    });
    setCatalogModalOpen(true);
  }

  async function handleSaveCatalogModal(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const payload = {
      kategori: catalogForm.kategori.trim(),
      nama: catalogForm.nama.trim(),
      merek: catalogForm.merek.trim() || "Bebas",
      tipeModel: catalogForm.tipeModel.trim(),
      spesifikasi: catalogForm.spesifikasi.trim() || null,
      estimasiHarga:
        catalogForm.estimasiHarga.trim() !== ""
          ? Number(catalogForm.estimasiHarga)
          : null,
      defaultUnit: catalogForm.defaultUnit.trim() || "pcs",
      fungsi: catalogForm.fungsi.trim() || null,
    };

    if (editingCatalogItem) {
      const res = await fetch(`/api/catalog/${editingCatalogItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setCatalog((prev) =>
          prev.map((c) => (c.id === editingCatalogItem.id ? data.item : c))
        );
        setCatalogModalOpen(false);
      } else {
        setErrorMsg(data.error ?? "Gagal memperbarui katalog.");
      }
    } else {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setCatalog((prev) => [...prev, data.item]);
        setCatalogModalOpen(false);
      } else {
        setErrorMsg(data.error ?? "Gagal menambah item katalog.");
      }
    }
  }

  async function handleDeleteCatalogItem(item: CatalogComponentDTO) {
    if (
      !window.confirm(
        `Hapus "${item.merek} ${item.tipeModel}" dari Master Katalog?`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/catalog/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setCatalog((prev) => prev.filter((c) => c.id !== item.id));
    }
  }

  // Kelompok yang ditampilkan di tabel PR: semua kelompok yang punya item + kelompok di daftar groups
  const allDisplayGroups = useMemo(() => {
    const set = new Set([...groups, ...items.map((i) => i.kelompok)]);
    return Array.from(set);
  }, [groups, items]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header Halaman */}
      <div className="v14-card rounded-[26px] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F05232]/10 text-[#F05232] text-xs font-extrabold mb-2">
              <ClipboardList className="w-4 h-4" />
              PURCHASE REQUISITION BUILDER &amp; KATALOG KOMPONEN
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Buat / List Komponen PR
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Tinggal <strong>pilih dari {catalog.length} katalog komponen</strong>{" "}
              atau <strong>ketik langsung</strong> komponen yang ingin dipakai,
              simpan ke proyek, dan <strong>Export ke Excel</strong> dengan
              format yang sama persis dengan template Import PR.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/import-pr"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full v14-subcard hover:bg-slate-100 text-sm font-bold text-slate-800 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Import dari File Excel PR
            </Link>
          </div>
        </div>

        {/* Switch Tab: Susun PR vs Master Katalog */}
        <div className="inline-flex flex-wrap items-center gap-1.5 mt-5 p-1.5 rounded-full v14-subcard">
          <button
            type="button"
            onClick={() => setActiveTab("builder")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              activeTab === "builder"
                ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            1. Susun Daftar Komponen PR ({items.length} item)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              activeTab === "catalog"
                ? "bg-[#141518] text-white dark:bg-white dark:text-[#111216] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Database className="w-4 h-4" />
            2. Kelola Master Katalog Komponen ({catalog.length} item)
          </button>
        </div>
      </div>

      {/* Notifikasi Error / Sukses */}
      {errorMsg && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-bold text-rose-800">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-bold text-emerald-800 flex items-center gap-2">
          <Check className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ==================== TAB 1: SUSUN DAFTAR KOMPONEN PR ==================== */}
      {activeTab === "builder" && (
        <div className="space-y-6">
          {/* STEP 1: PROYEK & IDENTITAS DOKUMEN PR */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                Proyek Tujuan & Identitas Dokumen PR
              </h2>
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setTargetMode("EXISTING_PROJECT")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold cursor-pointer ${
                    targetMode === "EXISTING_PROJECT"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  Proyek Sudah Ada
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode("NEW_PROJECT")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold cursor-pointer ${
                    targetMode === "NEW_PROJECT"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  + Buat Proyek Baru
                </button>
              </div>
            </div>

            {targetMode === "EXISTING_PROJECT" ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
                <div className="lg:col-span-2">
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">
                    Pilih Proyek
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
                  >
                    {projects.length === 0 && (
                      <option value="">-- Belum ada proyek --</option>
                    )}
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.kode ? `[${p.kode}] ` : ""}
                        {p.nama} — {p.client} ({p.totalComponents} komponen)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    type="button"
                    disabled={!selectedProjectId || loadingProjectItems}
                    onClick={() =>
                      loadExistingProjectComponents(selectedProjectId, false)
                    }
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm font-bold cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${loadingProjectItems ? "animate-spin" : ""}`}
                    />
                    Muat Komponen Proyek Ini
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Proyek / Mesin Baru *
                  </label>
                  <input
                    type="text"
                    value={newProjNama}
                    onChange={(e) => {
                      setNewProjNama(e.target.value);
                      setPartsName(e.target.value);
                    }}
                    placeholder="Contoh: JIG INSERT COLLAR 23MJ2"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client / Customer *
                  </label>
                  <input
                    type="text"
                    value={newProjClient}
                    onChange={(e) => {
                      setNewProjClient(e.target.value);
                      setCustomer(e.target.value);
                    }}
                    placeholder="Contoh: PT ROKI INDONESIA"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kode Proyek (Job No.)
                  </label>
                  <input
                    type="text"
                    value={newProjKode}
                    onChange={(e) => {
                      setNewProjKode(e.target.value);
                      setJobNumber(e.target.value);
                    }}
                    placeholder="Contoh: 26 RKI 1012"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Prioritas
                    </label>
                    <select
                      value={newProjPrioritas}
                      onChange={(e) =>
                        setNewProjPrioritas(e.target.value as ProjectPriority)
                      }
                      className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold"
                    >
                      {PROJECT_PRIORITIES.map((pr) => (
                        <option key={pr} value={pr}>
                          {PROJECT_PRIORITY_LABELS[pr]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Deadline
                    </label>
                    <input
                      type="date"
                      value={newProjDeadline}
                      onChange={(e) => setNewProjDeadline(e.target.value)}
                      className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Baris Info Footer PR & Default Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Footer Excel: PARTS NAME
                </label>
                <input
                  type="text"
                  value={partsName}
                  onChange={(e) => setPartsName(e.target.value)}
                  placeholder="Nama Mesin / Proyek di PR"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Footer Excel: CUSTOMER
                </label>
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Nama Customer di PR"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Footer Excel: JOB NUMBER
                </label>
                <input
                  type="text"
                  value={jobNumber}
                  onChange={(e) => setJobNumber(e.target.value)}
                  placeholder="Mis. 26 RKI 1012"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Footer Excel: PARTS NUMBER
                </label>
                <input
                  type="text"
                  value={partsNumber}
                  onChange={(e) => setPartsNumber(e.target.value)}
                  placeholder="Mis. SPM"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Default Supplier (DESCRIPTION)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={defaultSupplier}
                    onChange={(e) => setDefaultSupplier(e.target.value)}
                    placeholder="Mis. Flexindomas"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                  <button
                    type="button"
                    onClick={applySupplierToEmptyRows}
                    title="Isi ke baris yang supplier-nya kosong"
                    className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 shrink-0 cursor-pointer"
                  >
                    Isi
                  </button>
                </div>
              </div>
            </div>

            {/* Accordion Detail Kotak Tanda Tangan Header PR */}
            <div>
              <button
                type="button"
                onClick={() => setShowHeaderDetail((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                {showHeaderDetail ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Pengaturan Header & Kotak Tanda Tangan Excel PR (Department:{" "}
                {department} • Kategori: {noteCategory} • Prepared: {prepared})
              </button>

              {showHeaderDetail && (
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-3 mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      DEPARTMENT
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      KATEGORI NOTE
                    </label>
                    <select
                      value={noteCategory}
                      onChange={(e) =>
                        setNoteCategory(e.target.value as PrNoteCategory)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold"
                    >
                      {NOTE_CATEGORIES.map((nc) => (
                        <option key={nc} value={nc}>
                          {nc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      PREPARED
                    </label>
                    <input
                      type="text"
                      value={prepared}
                      onChange={(e) => setPrepared(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      CHECKED
                    </label>
                    <input
                      type="text"
                      value={checked}
                      onChange={(e) => setChecked(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      PURCHASING
                    </label>
                    <input
                      type="text"
                      value={purchasing}
                      onChange={(e) => setPurchasing(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      APPROVED
                    </label>
                    <input
                      type="text"
                      value={approved}
                      onChange={(e) => setApproved(e.target.value)}
                      placeholder="(Kosongkan bila belum)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tanggal PR
                    </label>
                    <input
                      type="date"
                      value={tanggalPr}
                      onChange={(e) => setTanggalPr(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STEP 1B: PAKET LIST KOMPONEN STANDAR DRAWING PDF (FR-EG-EP-006 Hal. 1-4) */}
          <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span>List Komponen Drawing PDF (FR-EG-EP-006 — Main Panel & OP Panel)</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-extrabold border border-indigo-200">
                    4 Halaman • {FR_EG_EP_006_PDF_COMPONENTS.length} Item
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Semua part dari drawing approval <strong>FR-EG-EP-006</strong> (Hal. 1–4) siap ditambahkan satu per satu atau sekaligus ke PR proyek (dan otomatis di-layout ke template 2D panel).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    addPdfPresetItemsToPr(
                      FR_EG_EP_006_PDF_COMPONENTS,
                      "Paket Lengkap PDF FR-EG-EP-006 (Hal. 1–4)"
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Masukkan Semua ke PR ({FR_EG_EP_006_PDF_COMPONENTS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowPdfPreset((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  {showPdfPreset ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Tutup Daftar Item
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Pilih / Edit per Item PDF
                    </>
                  )}
                </button>
              </div>
            </div>

            {showPdfPreset && (
              <div className="space-y-3 pt-3 border-t border-indigo-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { page: 0, label: `Semua Halaman (${FR_EG_EP_006_PDF_COMPONENTS.length})` },
                        { page: 1, label: "Hal. 1 — Main Panel Box" },
                        { page: 2, label: "Hal. 2 — Mounting Control" },
                        { page: 3, label: "Hal. 3 — Pintu OP Panel" },
                        { page: 4, label: "Hal. 4 — Mounting OP" },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.page}
                        type="button"
                        onClick={() => setPdfPresetPageFilter(tab.page)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          pdfPresetPageFilter === tab.page
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {pdfPresetPageFilter !== 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        addPdfPresetItemsToPr(
                          FR_EG_EP_006_PDF_COMPONENTS.filter(
                            (p) => p.page === pdfPresetPageFilter
                          ),
                          `Bagian Halaman ${pdfPresetPageFilter} FR-EG-EP-006`
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Masukkan Bagian Hal. {pdfPresetPageFilter}
                    </button>
                  )}
                </div>

                <div className="max-h-[340px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {FR_EG_EP_006_PDF_COMPONENTS.filter(
                    (p) => pdfPresetPageFilter === 0 || p.page === pdfPresetPageFilter
                  ).map((p) => {
                    const matchedCat = findCatalogMatchForPreset(p);
                    const matchKey = `${p.partType.trim().toLowerCase()}||${p.partName.trim().toLowerCase()}`;
                    const alreadyQty = qtyInPrByKey.get(matchKey) ?? 0;
                    const inputQty = pdfPresetQtyMap[p.id] ?? p.defaultQty;

                    return (
                      <div
                        key={p.id}
                        className={`p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 ${
                          alreadyQty > 0 ? "bg-emerald-50/40" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-bold">
                              Hal. {p.page} • {p.kelompok}
                            </span>
                            <span className="font-extrabold text-slate-900 text-sm">
                              {p.partType}
                            </span>
                            {alreadyQty > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                                ✓ Sudah di PR: {alreadyQty} {p.unit}
                              </span>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5">
                            {p.partName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {p.catatanPr}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right mr-2">
                            <div className="text-sm font-extrabold text-slate-900">
                              {matchedCat?.estimasiHarga != null
                                ? formatRupiah(matchedCat.estimasiHarga)
                                : "TBD"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              per {p.unit}
                            </div>
                          </div>
                          <input
                            type="number"
                            min={1}
                            step="any"
                            value={inputQty}
                            onChange={(e) =>
                              setPdfPresetQtyMap({
                                ...pdfPresetQtyMap,
                                [p.id]: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="w-16 px-2 py-2 rounded-xl border border-slate-300 text-center text-sm font-bold"
                            title="Qty yang akan ditambahkan"
                          />
                          <button
                            type="button"
                            onClick={() => addPdfPresetItemsToPr([p])}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            Masuk PR
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: PILIH KELOMPOK AKTIF & PEMILIH CEPAT DARI KATALOG KOMPONEN */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Search className="w-5 h-5 text-emerald-600" />
                  Pilih Cepat dari Katalog Komponen ({catalog.length} Komponen
                  Siap Pakai)
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Pilih <strong>Kelompok Tujuan</strong> di kanan, lalu klik{" "}
                  <strong>+ Masuk PR</strong> pada komponen yang ingin dipakai.
                </p>
              </div>

              {/* Pemilih Kelompok Tujuan */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-extrabold text-slate-500 uppercase mr-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Masuk ke Kelompok:
                </span>
                {allDisplayGroups
                  .filter((g) => g !== MANDATORY_PR_GROUP)
                  .map((g) => {
                    const countInG = items.filter((i) => i.kelompok === g).length;
                    const active = activeGroup === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setActiveGroup(g)}
                        className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                          active
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {g} ({countInG})
                      </button>
                    );
                  })}
                {addingGroup ? (
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={newGroupInput}
                      onChange={(e) => setNewGroupInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddGroup();
                        }
                      }}
                      placeholder="Nama kelompok..."
                      className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddGroup}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingGroup(true)}
                    className="px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    + Kelompok Baru
                  </button>
                )}
              </div>
            </div>

            {/* Kotak Cari & Chip Kategori */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  placeholder="Ketik nama komponen, merek, tipe/model, atau aplikasi (contoh: FX5U, IDEC, Push Button, MCB, Proximity, SPB-120, NYAF)..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCatFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    catFilter === "ALL"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Semua Kategori ({catalog.length})
                </button>
                {categories.map((cat) => {
                  const cnt = catalog.filter((c) => c.kategori === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCatFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        catFilter === cat
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {cat} ({cnt})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daftar Hasil Katalog */}
            <div className="max-h-[340px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filteredCatalogPicker.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Tidak ada komponen di katalog yang cocok dengan &ldquo;
                  {catSearch}&rdquo;.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      addManualBlankRow(activeGroup);
                    }}
                    className="text-blue-600 font-bold underline cursor-pointer ml-1"
                  >
                    + Ketik komponen manual di tabel PR
                  </button>
                </div>
              ) : (
                filteredCatalogPicker.map((cat) => {
                  const prFields = formatCatalogItemForPr(cat);
                  const matchKey = `${prFields.partType.toLowerCase()}||${prFields.partName.toLowerCase()}`;
                  const alreadyQty = qtyInPrByKey.get(matchKey) ?? 0;
                  const inputQty = quickQtyMap[cat.id] ?? 1;

                  return (
                    <div
                      key={cat.id}
                      className={`p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition ${
                        alreadyQty > 0 ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-bold">
                            <HighlightedText
                              text={cat.kategori}
                              tokens={pickerSearchTokens}
                            />
                          </span>
                          <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                            <HighlightedText
                              text={prFields.partType}
                              tokens={pickerSearchTokens}
                            />
                          </span>
                          {alreadyQty > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                              ✓ Sudah di PR: {alreadyQty} {prFields.unit}
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5">
                          <HighlightedText
                            text={cat.nama}
                            tokens={pickerSearchTokens}
                          />
                          {cat.spesifikasi ? (
                            <span className="text-slate-500 font-normal">
                              {" "}
                              —{" "}
                              <HighlightedText
                                text={cat.spesifikasi}
                                tokens={pickerSearchTokens}
                              />
                            </span>
                          ) : null}
                        </div>
                        {cat.fungsi && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            Fungsi:{" "}
                            <HighlightedText
                              text={cat.fungsi}
                              tokens={pickerSearchTokens}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right mr-2">
                          <div className="text-sm font-extrabold text-slate-900">
                            {formatRupiah(cat.estimasiHarga)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            per {prFields.unit}
                          </div>
                        </div>

                        <input
                          type="number"
                          min={1}
                          step="any"
                          value={inputQty}
                          onChange={(e) =>
                            setQuickQtyMap({
                              ...quickQtyMap,
                              [cat.id]: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-16 px-2 py-2 rounded-xl border border-slate-300 text-center text-sm font-bold"
                          title="Qty yang akan ditambahkan"
                        />

                        <button
                          type="button"
                          onClick={() => addCatalogItemToPr(cat)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Masuk PR
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* STEP 3: TABEL DAFTAR KOMPONEN PR (EDIT INLINE + KETIK LANGSUNG + AUTOCOMPLETE) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Daftar Komponen di Dokumen PR ({activePrCount} Masuk PR
                  {excludedMandatoryCount > 0
                    ? ` • ${excludedMandatoryCount} Wajib Qty 0`
                    : ""}
                  )
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Anda juga bisa langsung mengetik komponen sendiri lewat tombol{" "}
                  <strong>+ Ketik Baris Manual</strong>. Komponen wajib tidak
                  dapat dihapus &amp; hanya nilai <strong>Qty</strong> yang bisa
                  diubah (<strong>0 = tidak masuk PR</strong>).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={renumberAllRows}
                    className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Urutkan Nomor (1..{items.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => addManualBlankRow(activeGroup)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-extrabold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Ketik Baris Manual ({activeGroup})
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center space-y-3">
                <p className="text-base font-bold text-slate-700">
                  Belum ada komponen yang dimasukkan ke daftar PR.
                </p>
                <p className="text-sm text-slate-500">
                  Klik tombol <strong>+ Masuk PR</strong> pada katalog komponen
                  di atas, atau klik tombol di bawah untuk mengetik baris
                  komponen secara langsung.
                </p>
                <button
                  type="button"
                  onClick={() => addManualBlankRow(activeGroup)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />+ Mulai Ketik Komponen Pertama
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {allDisplayGroups.map((grpName) => {
                  const groupRows = items.filter((r) => r.kelompok === grpName);
                  if (groupRows.length === 0) return null;

                  const isMandatoryGroup = grpName === MANDATORY_PR_GROUP;
                  const activeInGroup = groupRows.filter((r) =>
                    r.mandatoryKey ? (Number(r.qty) || 0) > 0 : true
                  ).length;

                  const groupSubtotal = groupRows.reduce((s, r) => {
                    const p =
                      r.hargaSatuan.trim() !== "" ? Number(r.hargaSatuan) : NaN;
                    const q = Number(r.qty) || 0;
                    return Number.isFinite(p) && q > 0
                      ? s + Math.round(p * q)
                      : s;
                  }, 0);

                  return (
                    <div
                      key={grpName}
                      className="rounded-2xl border border-slate-200 overflow-visible"
                    >
                      <div
                        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-white rounded-t-2xl ${
                          isMandatoryGroup ? "bg-slate-800" : "bg-slate-900"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm sm:text-base">
                            Kelompok: {grpName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 text-xs font-bold">
                            {isMandatoryGroup
                              ? `${activeInGroup} masuk PR / ${groupRows.length} wajib`
                              : `${groupRows.length} komponen`}
                          </span>
                          {isMandatoryGroup && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[11px] font-bold">
                              <Lock className="w-3 h-3" /> Tidak bisa dihapus • Qty (0 = tidak masuk PR), Supplier &amp; Harga bisa diubah
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs sm:text-sm font-bold text-amber-300">
                            Subtotal: {formatRupiah(groupSubtotal)}
                          </span>
                          {!isMandatoryGroup && (
                            <button
                              type="button"
                              onClick={() => addManualBlankRow(grpName)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Tambah Baris
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                          <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                            <tr>
                              <th className="p-2.5 text-center w-14">NO.</th>
                              <th className="p-2.5 text-left min-w-[240px]">
                                PART TYPE (Merk / Tipe / Spesifikasi)
                              </th>
                              <th className="p-2.5 text-left min-w-[200px]">
                                PARTS NAME (Nama / Jenis)
                              </th>
                              <th className="p-2.5 text-left w-32">
                                DESCRIPTION (Supplier)
                              </th>
                              <th className="p-2.5 text-center w-20">QTY</th>
                              <th className="p-2.5 text-center w-20">Unit</th>
                              <th className="p-2.5 text-right w-36">
                                HARGA (Rp)
                              </th>
                              <th className="p-2.5 text-right w-36">
                                TOTAL (Rp)
                              </th>
                              <th className="p-2.5 text-left min-w-[180px]">
                                NOTE & Tgl Pakai
                              </th>
                              <th className="p-2.5 text-left w-32">Kelompok</th>
                              <th className="p-2.5 text-center w-16">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {groupRows.map((row) => {
                              const isMandatory = Boolean(row.mandatoryKey);
                              const unitPrice =
                                row.hargaSatuan.trim() !== ""
                                  ? Number(row.hargaSatuan)
                                  : null;
                              const rowTotal =
                                unitPrice !== null &&
                                Number.isFinite(unitPrice) &&
                                row.qty > 0
                                  ? Math.round(unitPrice * row.qty)
                                  : null;

                              const exactInCatalog = catalog.some((c) => {
                                const f = formatCatalogItemForPr(c);
                                return (
                                  f.partType.toLowerCase() ===
                                    row.partType.trim().toLowerCase() &&
                                  f.partName.toLowerCase() ===
                                    row.partName.trim().toLowerCase()
                                );
                              });

                              return (
                                <tr
                                  key={row.tempId}
                                  className={`align-top ${
                                    isMandatory
                                      ? row.qty > 0
                                        ? "bg-emerald-50/40 hover:bg-emerald-50/70"
                                        : "bg-slate-50/70 hover:bg-slate-100/70"
                                      : "hover:bg-slate-50/80"
                                  }`}
                                >
                                  <td className="p-2">
                                    {isMandatory ? (
                                      <div className="w-12 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-center font-mono text-slate-600">
                                        {row.noPr}
                                      </div>
                                    ) : (
                                      <input
                                        type="text"
                                        value={row.noPr}
                                        onChange={(e) =>
                                          updateRow(row.tempId, {
                                            noPr: e.target.value,
                                          })
                                        }
                                        className="w-12 px-2 py-1.5 rounded-lg border border-slate-300 text-center font-mono"
                                      />
                                    )}
                                  </td>

                                  {/* PART TYPE + Floating Autocomplete Portal */}
                                  <td className="p-2">
                                    {isMandatory ? (
                                      <div className="space-y-1">
                                        <div className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 font-semibold text-slate-700 select-text">
                                          {row.partType}
                                        </div>
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                                          <Lock className="w-2.5 h-2.5" /> Komponen Wajib PR (Terkunci)
                                        </span>
                                      </div>
                                    ) : (
                                      <>
                                        <CatalogAutocompleteInput
                                          value={row.partType}
                                          autoFocus={lastAddedRowId === row.tempId}
                                          preferField="partType"
                                          catalog={catalog}
                                          onChange={(val) =>
                                            updateRow(row.tempId, {
                                              partType: val,
                                            })
                                          }
                                          onSelectCatalogItem={(sug) =>
                                            applyCatalogSuggestionToRow(
                                              row.tempId,
                                              sug
                                            )
                                          }
                                          placeholder="Ketik tipe / merk / nama (mis. P, IDEC, FX5U...)"
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                          {!exactInCatalog &&
                                            row.partType.trim() !== "" &&
                                            row.partName.trim() !== "" && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  quickSaveRowToCatalog(row)
                                                }
                                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                                                title="Simpan komponen custom ini ke Master Katalog agar ke depan tinggal klik"
                                              >
                                                <BookmarkPlus className="w-3.5 h-3.5" />
                                                Simpan ke Katalog
                                              </button>
                                            )}
                                          {isExcludedFromPrExport(
                                            row.statusPembelian
                                          ) && (
                                            <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                              Sudah Ada / Datang (tidak ikut Export PR)
                                            </span>
                                          )}
                                        </>
                                      )}
                                  </td>

                                  {/* PARTS NAME + Floating Autocomplete Portal */}
                                  <td className="p-2">
                                    {isMandatory ? (
                                      <div className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-700">
                                        {row.partName}
                                      </div>
                                    ) : (
                                      <CatalogAutocompleteInput
                                        value={row.partName}
                                        preferField="partName"
                                        catalog={catalog}
                                        onChange={(val) =>
                                          updateRow(row.tempId, {
                                            partName: val,
                                          })
                                        }
                                        onSelectCatalogItem={(sug) =>
                                          applyCatalogSuggestionToRow(
                                            row.tempId,
                                            sug
                                          )
                                        }
                                        placeholder="Ketik nama / jenis (mis. PLC, MCB, Push Button...)"
                                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                      />
                                    )}
                                  </td>

                                  {/* SUPPLIER */}
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={row.supplier}
                                      onChange={(e) =>
                                        updateRow(row.tempId, {
                                          supplier: e.target.value,
                                        })
                                      }
                                      placeholder="Supplier (kosong)"
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                                    />
                                  </td>

                                  {/* QTY */}
                                  <td className="p-2">
                                    {isMandatory ? (
                                      <div className="flex flex-col items-center">
                                        <input
                                          type="number"
                                          min={0}
                                          step="any"
                                          value={row.qty}
                                          onFocus={(e) => e.currentTarget.select()}
                                          onChange={(e) => {
                                            const val = Number(e.target.value);
                                            updateRow(row.tempId, {
                                              qty:
                                                Number.isFinite(val) && val >= 0
                                                  ? val
                                                  : 0,
                                            });
                                          }}
                                          aria-label={`Qty ${row.partName}`}
                                          className={`w-20 px-2 py-1.5 rounded-lg border text-center font-extrabold focus:outline-none focus:ring-2 ${
                                            row.qty > 0
                                              ? "border-emerald-500 bg-white text-emerald-800 focus:ring-emerald-600"
                                              : "border-amber-300 bg-amber-50/70 text-slate-600 focus:ring-amber-500"
                                          }`}
                                        />
                                        <span
                                          className={`mt-1 text-[10px] font-bold whitespace-nowrap ${
                                            row.qty > 0
                                              ? "text-emerald-700"
                                              : "text-slate-500"
                                          }`}
                                        >
                                          {row.qty > 0
                                            ? "Masuk PR"
                                            : "0 = Tdk masuk"}
                                        </span>
                                      </div>
                                    ) : (
                                      <input
                                        type="number"
                                        min={0.1}
                                        step="any"
                                        value={row.qty}
                                        onChange={(e) =>
                                          updateRow(row.tempId, {
                                            qty: Number(e.target.value) || 0,
                                          })
                                        }
                                        className="w-18 px-2 py-1.5 rounded-lg border border-slate-300 text-center font-bold"
                                      />
                                    )}
                                  </td>

                                  {/* UNIT */}
                                  <td className="p-2">
                                    {isMandatory ? (
                                      <div className="w-18 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-center text-slate-600">
                                        {row.unit}
                                      </div>
                                    ) : (
                                      <input
                                        type="text"
                                        list="pr-unit-list"
                                        value={row.unit}
                                        onChange={(e) =>
                                          updateRow(row.tempId, {
                                            unit: e.target.value,
                                          })
                                        }
                                        className="w-18 px-2 py-1.5 rounded-lg border border-slate-300 text-center"
                                      />
                                    )}
                                  </td>

                                  {/* HARGA SATUAN */}
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step="any"
                                      value={row.hargaSatuan}
                                      onFocus={(e) => e.currentTarget.select()}
                                      onChange={(e) =>
                                        updateRow(row.tempId, {
                                          hargaSatuan: e.target.value,
                                        })
                                      }
                                      aria-label={`Harga ${row.partName}`}
                                      placeholder="Kosong = TBD"
                                      className="w-32 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-right font-mono"
                                    />
                                  </td>

                                  {/* TOTAL */}
                                  <td className="p-2 text-right font-extrabold text-slate-900 whitespace-nowrap pt-3.5">
                                    {isMandatory && row.qty <= 0 ? (
                                      <span className="text-xs font-semibold text-slate-400">
                                        Tidak masuk PR
                                      </span>
                                    ) : (
                                      formatRupiah(rowTotal)
                                    )}
                                  </td>

                                  {/* NOTE & DATE OF USE */}
                                  <td className="p-2 space-y-1">
                                    <input
                                      type="text"
                                      value={row.catatanPr}
                                      onChange={(e) =>
                                        updateRow(row.tempId, {
                                          catatanPr: e.target.value,
                                        })
                                      }
                                      placeholder="Catatan PR (NOTE)..."
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                                    />
                                    <input
                                      type="date"
                                      value={row.tanggalPakai}
                                      onChange={(e) =>
                                        updateRow(row.tempId, {
                                          tanggalPakai: e.target.value,
                                        })
                                      }
                                      title="DATE OF USE (opsional)"
                                      className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-600"
                                    />
                                  </td>

                                  {/* PINDAH KELOMPOK */}
                                  <td className="p-2">
                                    {isMandatory ? (
                                      <div className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500">
                                        {row.kelompok}
                                      </div>
                                    ) : (
                                      <select
                                        value={row.kelompok}
                                        onChange={(e) =>
                                          updateRow(row.tempId, {
                                            kelompok: e.target.value,
                                          })
                                        }
                                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                                      >
                                        {allDisplayGroups
                                          .filter((g) => g !== MANDATORY_PR_GROUP)
                                          .map((g) => (
                                            <option key={g} value={g}>
                                              {g}
                                            </option>
                                          ))}
                                      </select>
                                    )}
                                  </td>

                                  {/* HAPUS */}
                                  <td className="p-2 text-center pt-3">
                                    {isMandatory ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold"
                                        title="Komponen wajib tidak dapat dihapus. Isi Qty = 0 jika tidak masuk PR."
                                      >
                                        <Lock className="w-3 h-3" /> Wajib
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => removeRow(row.tempId)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                        title="Hapus baris"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <datalist id="pr-unit-list">
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          {/* STEP 4: BAR RINGKASAN GRAND TOTAL & TOMBOL SIMPAN / EXPORT */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ringkasan Purchase Requisition
              </div>
              <div className="text-lg sm:text-2xl font-extrabold flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{activePrCount} Komponen Masuk PR</span>
                {excludedMandatoryCount > 0 && (
                  <span className="text-xs sm:text-sm font-semibold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg">
                    {excludedMandatoryCount} komponen wajib Qty 0 (tidak masuk PR)
                  </span>
                )}
                <span className="text-slate-500">•</span>
                <span className="text-amber-300">
                  Estimasi Total: {formatRupiah(grandTotal)}
                </span>
              </div>
              {activePrCount === 0 && (
                <div className="text-xs text-amber-300 font-semibold">
                  Pilih komponen dari katalog / tambah baris manual atau isi Qty &gt; 0 pada komponen wajib agar PR dapat disimpan/di-export.
                </div>
              )}
              {targetMode === "EXISTING_PROJECT" && (
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-300">
                  <span>Mode Simpan Proyek:</span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="prSaveMode"
                      checked={saveMode === "REPLACE"}
                      onChange={() => setSaveMode("REPLACE")}
                    />
                    Sinkronkan Daftar Ini (Pertahankan Status Pembelian)
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="prSaveMode"
                      checked={saveMode === "MERGE"}
                      onChange={() => setSaveMode("MERGE")}
                    />
                    Mode Revisi (Tandai Item Lama yg Dihapus)
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={busyAction !== null || activePrCount === 0}
                onClick={handleExportExcelOnly}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-sm font-extrabold cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                {busyAction === "export"
                  ? "Membuat Excel..."
                  : "Export Excel PR (Format Import)"}
              </button>

              <button
                type="button"
                disabled={busyAction !== null || activePrCount === 0}
                onClick={() => handleSaveToProject(false)}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {busyAction === "save" ? "Menyimpan..." : "Simpan ke Proyek"}
              </button>

              <button
                type="button"
                disabled={busyAction !== null || activePrCount === 0}
                onClick={() => handleSaveToProject(true)}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {busyAction === "save-export"
                  ? "Memproses..."
                  : "Simpan & Export Excel PR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: MASTER KATALOG KOMPONEN (107+ ITEM) ==================== */}
      {activeTab === "catalog" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Master Katalog Komponen Otomasi ({catalog.length} Komponen)
              </h2>
              <p className="text-sm text-slate-600">
                Daftar referensi komponen standar Anda. Bisa ditambah komponen
                baru atau diperbarui estimasi harganya kapan saja.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewCatalogModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-extrabold cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tambah Komponen ke Katalog
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogTableSearch}
                onChange={(e) => setCatalogTableSearch(e.target.value)}
                placeholder="Cari komponen di master katalog..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <select
              value={catalogTableCategory}
              onChange={(e) => setCatalogTableCategory(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold"
            >
              <option value="ALL">Semua Kategori ({catalog.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="p-3 text-center w-12">No</th>
                  <th className="p-3 text-left">Kategori</th>
                  <th className="p-3 text-left">Nama / Jenis Komponen</th>
                  <th className="p-3 text-left">Merek</th>
                  <th className="p-3 text-left">Tipe / Model</th>
                  <th className="p-3 text-left">Spesifikasi & Fungsi</th>
                  <th className="p-3 text-right">Estimasi Harga</th>
                  <th className="p-3 text-center w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCatalogMaster.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 text-center font-mono text-slate-500">
                      {item.noUrut || idx + 1}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-bold">
                        {item.kategori}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {item.nama}
                    </td>
                    <td className="p-3 font-semibold text-slate-800">
                      {item.merek}
                    </td>
                    <td className="p-3 font-mono font-bold text-blue-700">
                      {item.tipeModel}
                    </td>
                    <td className="p-3 text-xs text-slate-600 max-w-xs">
                      {item.spesifikasi && <div>{item.spesifikasi}</div>}
                      {item.fungsi && (
                        <div className="text-slate-400 mt-0.5">
                          Aplikasi: {item.fungsi}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                      {formatRupiah(item.estimasiHarga)}
                      <div className="text-[11px] font-normal text-slate-500">
                        /{item.defaultUnit}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            addCatalogItemToPr(item);
                            setActiveTab("builder");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                          title="Masukkan ke Daftar PR"
                        >
                          + PR
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditCatalogModal(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                          title="Edit Komponen Katalog"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCatalogItem(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                          title="Hapus dari Katalog"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Item Master Katalog */}
      {catalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white font-extrabold">
              {editingCatalogItem
                ? "Edit Komponen Katalog"
                : "Tambah Komponen Baru ke Katalog"}
            </div>
            <form
              onSubmit={handleSaveCatalogModal}
              className="p-5 space-y-3 text-sm"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Kategori Komponen *
                  </label>
                  <input
                    type="text"
                    required
                    list="catalog-categories-list"
                    value={catalogForm.kategori}
                    onChange={(e) =>
                      setCatalogForm({
                        ...catalogForm,
                        kategori: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                  <datalist id="catalog-categories-list">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Merek</label>
                  <input
                    type="text"
                    value={catalogForm.merek}
                    onChange={(e) =>
                      setCatalogForm({ ...catalogForm, merek: e.target.value })
                    }
                    placeholder="Mis. Mitsubishi / Omron / IDEC"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Tipe / Model *
                </label>
                <input
                  type="text"
                  required
                  value={catalogForm.tipeModel}
                  onChange={(e) =>
                    setCatalogForm({
                      ...catalogForm,
                      tipeModel: e.target.value,
                    })
                  }
                  placeholder="Mis. FX5U-32MR/ES"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Nama / Jenis Komponen *
                </label>
                <input
                  type="text"
                  required
                  value={catalogForm.nama}
                  onChange={(e) =>
                    setCatalogForm({ ...catalogForm, nama: e.target.value })
                  }
                  placeholder="Mis. Compact PLC CPU Unit"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Estimasi Harga Satuan (IDR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={catalogForm.estimasiHarga}
                    onChange={(e) =>
                      setCatalogForm({
                        ...catalogForm,
                        estimasiHarga: e.target.value,
                      })
                    }
                    placeholder="Mis. 5665000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Satuan Default (Unit)
                  </label>
                  <input
                    type="text"
                    list="pr-unit-list"
                    value={catalogForm.defaultUnit}
                    onChange={(e) =>
                      setCatalogForm({
                        ...catalogForm,
                        defaultUnit: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Spesifikasi Utama
                </label>
                <input
                  type="text"
                  value={catalogForm.spesifikasi}
                  onChange={(e) =>
                    setCatalogForm({
                      ...catalogForm,
                      spesifikasi: e.target.value,
                    })
                  }
                  placeholder="Mis. 16 In / 16 Out Relay, Ethernet"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Fungsi / Aplikasi
                </label>
                <input
                  type="text"
                  value={catalogForm.fungsi}
                  onChange={(e) =>
                    setCatalogForm({ ...catalogForm, fungsi: e.target.value })
                  }
                  placeholder="Mis. Otak kontrol panel mesin testing"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCatalogModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold cursor-pointer"
                >
                  Simpan Katalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
