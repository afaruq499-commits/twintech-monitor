"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Cpu,
  Download,
  Edit3,
  FileSpreadsheet,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  generatePlcAddressesFromComponents,
  type ComponentInputForPlc,
  type PlcAddressEntry,
  type PlcAddressKind,
  type PlcAddressingSystem,
} from "@/lib/plc-address-allocator";
import type { ParsedPlcAddressResult } from "@/lib/export/plc-address-importer";

interface PlcAddressTablePanelProps {
  projectId: string;
  projectNama: string;
  components: ComponentInputForPlc[];
  initialSystem?: PlcAddressingSystem;
  cpuModel?: string;
  initialPlcAddressesJson?: string | null;
}

const KIND_BADGE_CLASSES: Record<
  PlcAddressKind,
  { bg: string; text: string; label: string }
> = {
  DI: { bg: "bg-blue-100 border-blue-200", text: "text-blue-800", label: "DI (Input)" },
  DO: { bg: "bg-emerald-100 border-emerald-200", text: "text-emerald-800", label: "DO (Output)" },
  AI: { bg: "bg-purple-100 border-purple-200", text: "text-purple-800", label: "AI (Analog In)" },
  AO: { bg: "bg-indigo-100 border-indigo-200", text: "text-indigo-800", label: "AO (Analog Out)" },
  M: { bg: "bg-amber-100 border-amber-200", text: "text-amber-800", label: "M (Relay Bit)" },
  D: { bg: "bg-slate-100 border-slate-200", text: "text-slate-800", label: "D (Register)" },
};

export function PlcAddressTablePanel({
  projectId,
  projectNama,
  components,
  initialSystem = "MITSUBISHI_FX5U_OCTAL",
  cpuModel = "FX5U-80MT",
  initialPlcAddressesJson,
}: PlcAddressTablePanelProps) {
  const [system, setSystem] = useState<PlcAddressingSystem>(initialSystem);
  const [activeKindFilter, setActiveKindFilter] = useState<PlcAddressKind | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Default hasil kalkulasi alokasi dari komponen PR
  const defaultAllocation = useMemo(() => {
    return generatePlcAddressesFromComponents(components, {
      system,
      cpuModel,
      includeStandardPanelSignals: true,
    });
  }, [components, system, cpuModel]);

  // Daftar alokasi alamat yang dapat diedit secara bebas
  const [entries, setEntries] = useState<PlcAddressEntry[]>(() => {
    if (initialPlcAddressesJson) {
      try {
        const parsed = JSON.parse(initialPlcAddressesJson);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return defaultAllocation.entries;
  });

  // Status simpan ke database
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Modal Edit Baris
  const [editingEntry, setEditingEntry] = useState<PlcAddressEntry | null>(null);

  // Modal Tambah Baris Manual
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [manualKind, setManualKind] = useState<PlcAddressKind>("DI");
  const [manualAddress, setManualAddress] = useState("");
  const [manualSymbol, setManualSymbol] = useState("");
  const [manualWireNo, setManualWireNo] = useState("");
  const [manualDataType, setManualDataType] = useState<PlcAddressEntry["dataType"]>("BOOL");
  const [manualDesc, setManualDesc] = useState("");
  const [manualRole, setManualRole] = useState("Alamat Manual");

  // State Import Excel I/O
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ParsedPlcAddressResult | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Ringkasan utilisasi alamat dihitung secara dinamis dari entries saat ini
  const summary = useMemo(() => {
    let totalDi = 0;
    let totalDo = 0;
    let totalAi = 0;
    let totalAo = 0;
    let totalM = 0;
    let totalD = 0;

    for (const item of entries) {
      if (item.kind === "DI") totalDi++;
      else if (item.kind === "DO") totalDo++;
      else if (item.kind === "AI") totalAi++;
      else if (item.kind === "AO") totalAo++;
      else if (item.kind === "M") totalM++;
      else if (item.kind === "D") totalD++;
    }

    const is80 = cpuModel.includes("80");
    const cpuBuiltInDiCapacity = is80 ? 40 : 16;
    const cpuBuiltInDoCapacity = is80 ? 40 : 16;

    return {
      totalDi,
      totalDo,
      totalAi,
      totalAo,
      totalM,
      totalD,
      cpuBuiltInDiCapacity,
      cpuBuiltInDoCapacity,
      expansionDiRequired: Math.max(0, totalDi - cpuBuiltInDiCapacity),
      expansionDoRequired: Math.max(0, totalDo - cpuBuiltInDoCapacity),
    };
  }, [entries, cpuModel]);

  // Accordion per kategori sinyal PLC (default tertutup saat awal)
  const [openKinds, setOpenKinds] = useState<Set<PlcAddressKind>>(() => new Set());
  const toggleKind = (k: PlcAddressKind) => {
    setOpenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const SECTIONS: { kind: PlcAddressKind; title: string; subtitle: string }[] = [
    { kind: "DI", title: "Digital Input (DI / X)", subtitle: "Sensor, Push Button, Selector Switch" },
    { kind: "DO", title: "Digital Output (DO / Y)", subtitle: "Solenoid Valve, Relay Coil, Tower Lamp, Buzzer" },
    { kind: "AI", title: "Analog Input (AI)", subtitle: "Sensor Analog, Laser, Load Cell, Presisi" },
    { kind: "AO", title: "Analog Output (AO)", subtitle: "Speed Reference Inverter, Proportional Valve" },
    { kind: "M", title: "Internal Relay (M)", subtitle: "Bit Memori Internal, Tombol Layar HMI, Interlock" },
    { kind: "D", title: "Data Register (D)", subtitle: "Data Numerik, Setting Posisi, Recipe, Counter" },
  ];

  // Filter & Search
  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      if (activeKindFilter !== "ALL" && item.kind !== activeKindFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          item.address.toLowerCase().includes(q) ||
          item.symbol.toLowerCase().includes(q) ||
          item.wireNo.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.sourceComponent?.partType ?? "").toLowerCase().includes(q) ||
          (item.sourceComponent?.partName ?? "").toLowerCase().includes(q) ||
          (item.moduleRole ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [entries, activeKindFilter, search]);

  function copySymbol(entry: PlcAddressEntry) {
    navigator.clipboard.writeText(entry.symbol);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Buka Modal Edit Baris
  function handleOpenEdit(entry: PlcAddressEntry) {
    setEditingEntry({ ...entry });
  }

  // Simpan hasil edit modal
  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEntry) return;

    setEntries((prev) =>
      prev.map((item) => (item.id === editingEntry.id ? editingEntry : item))
    );
    setEditingEntry(null);
    setHasChanges(true);
  }

  // Hapus baris alamat (bisa auto maupun custom)
  function handleDeleteEntry(entry: PlcAddressEntry) {
    if (
      !window.confirm(
        `Hapus alamat "${entry.address}" (${entry.symbol}) dari tabel pengelamatan?`
      )
    ) {
      return;
    }
    setEntries((prev) => prev.filter((item) => item.id !== entry.id));
    setHasChanges(true);
  }

  // Simpan perubahan tabel alamat ke database proyek
  async function handleSaveAddresses() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plcAddressesJson: JSON.stringify(entries),
        }),
      });
      if (res.ok) {
        setSavedMessage(true);
        setHasChanges(false);
        setTimeout(() => setSavedMessage(false), 2500);
      }
    } catch (err) {
      console.error("Save PLC addresses error:", err);
    } finally {
      setIsSaving(false);
    }
  }

  // Reset kembali ke generate otomatis dari PR
  async function handleResetToAuto() {
    if (
      !window.confirm(
        "Kembalikan seluruh daftar alamat I/O ke hasil alokasi otomatis dari komponen PR? Seluruh penyesuaian manual akan direset."
      )
    ) {
      return;
    }

    const fresh = generatePlcAddressesFromComponents(components, {
      system,
      cpuModel,
      includeStandardPanelSignals: true,
    });

    setEntries(fresh.entries);
    setHasChanges(false);

    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plcAddressesJson: null }),
      });
    } catch {
      // ignore
    }
  }

  // Tambah Alamat Manual
  function handleAddManualEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!manualAddress.trim() || !manualSymbol.trim()) return;

    const newEntry: PlcAddressEntry = {
      id: `manual-${Date.now()}`,
      kind: manualKind,
      address: manualAddress.trim().toUpperCase(),
      numericIndex: 9999,
      symbol: manualSymbol.trim().toUpperCase().replace(/\s+/g, "_"),
      wireNo: manualWireNo.trim() || "-",
      description: manualDesc.trim() || "Alamat kustom teknisi",
      dataType: manualDataType,
      sourceComponent: null,
      moduleRole: manualRole.trim() || "Alamat Manual",
      isCustom: true,
    };

    setEntries((prev) => [...prev, newEntry]);
    setHasChanges(true);
    setManualAddress("");
    setManualSymbol("");
    setManualWireNo("");
    setManualDesc("");
    setAddModalOpen(false);
  }

  // Unggah & Parsing Berkas Excel I/O PLC
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/plc-addresses/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses berkas Excel");
      }
      setImportPreview(data.result);
      setImportModalOpen(true);
    } catch (err) {
      console.error("Import PLC Excel error:", err);
      alert(err instanceof Error ? err.message : "Gagal membaca berkas Excel I/O.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Terapkan hasil import ke tabel I/O (Ganti Semua / Gabungkan)
  function handleApplyImport() {
    if (!importPreview) return;

    if (importMode === "replace") {
      setEntries(importPreview.entries);
    } else {
      // Gabungkan (Merge): update yang sama, tambahkan yang baru
      const merged = [...entries];
      for (const newEntry of importPreview.entries) {
        const key = `${newEntry.kind}:${newEntry.address}`;
        const existingIdx = merged.findIndex((e) => `${e.kind}:${e.address}` === key);
        if (existingIdx !== -1) {
          merged[existingIdx] = {
            ...merged[existingIdx],
            symbol: newEntry.symbol,
            wireNo: newEntry.wireNo !== "-" ? newEntry.wireNo : merged[existingIdx].wireNo,
            description: newEntry.description,
            dataType: newEntry.dataType,
            moduleRole: newEntry.moduleRole,
            sourceComponent: newEntry.sourceComponent || merged[existingIdx].sourceComponent,
            isCustom: true,
          };
        } else {
          merged.push(newEntry);
        }
      }
      setEntries(merged);
    }

    if (importPreview.detectedMetadata?.system) {
      setSystem(importPreview.detectedMetadata.system);
    }

    setHasChanges(true);
    setImportModalOpen(false);
    setImportSuccessMessage(
      `Berhasil memuat ${importPreview.entries.length} baris alamat I/O dari Excel (${
        importMode === "replace" ? "Ganti Semua" : "Gabungkan"
      }). Klik 'Simpan Perubahan' untuk menyimpan permanen ke database!`
    );
    setTimeout(() => setImportSuccessMessage(null), 6000);
  }

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold mb-1">
              <Cpu className="w-3.5 h-3.5" />
              PENGELAMATAN I/O & REGISTER PLC
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Tabel Alamat I/O (Input, Output, AI, AO) & Register PLC
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dipetakan dari komponen PR ({components.length} komponen) untuk proyek{" "}
              <strong>{projectNama}</strong>. Anda dapat mengedit alamat, simbol, dan keterangan kapan saja.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Pilihan Format Pengelamatan */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-slate-50">
              <Settings2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Format:</span>
              <select
                value={system}
                onChange={(e) =>
                  setSystem(e.target.value as PlcAddressingSystem)
                }
                className="bg-transparent font-extrabold text-blue-700 cursor-pointer"
              >
                <option value="KEYENCE_KV8000">
                  Keyence KV-8000 (R / MR / DM)
                </option>
                <option value="PANASONIC_FPWIN_PRO">
                  Panasonic FPWIN Pro 7 (X/Y Hex, R, DT)
                </option>
                <option value="FATEK_UPPERLOGIC">
                  Fatek UpperLogic (X/Y Desimal, M, R)
                </option>
                <option value="MITSUBISHI_FX5U_OCTAL">
                  Mitsubishi FX5U (Oktal X/Y)
                </option>
                <option value="STANDARD_DECIMAL">Standar Desimal</option>
              </select>
            </div>

            {/* Tombol Simpan Perubahan Alamat */}
            <button
              type="button"
              onClick={handleSaveAddresses}
              disabled={isSaving}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer ${
                hasChanges
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 animate-pulse"
                  : "bg-emerald-700 hover:bg-emerald-800 text-white"
              }`}
              title="Simpan penyesuaian alamat I/O ke database proyek"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>

            {/* Tombol Reset ke Otomatis PR */}
            <button
              type="button"
              onClick={handleResetToAuto}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
              title="Kembalikan semua alamat ke hasil alokasi PR otomatis"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Otomatis
            </button>

            {/* Tombol Tambah Alamat Manual */}
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Alamat
            </button>

            {/* Tombol Import Excel I/O */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 border border-teal-300 text-teal-800 hover:bg-teal-100 text-xs font-extrabold shadow-xs transition cursor-pointer"
              title="Import data tabel pengelamatan dari file Excel (.xlsx / .xls)"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
                  Membaca Excel...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-teal-700" />
                  Import Excel I/O
                </>
              )}
            </button>

            {/* Tombol Export Excel */}
            <a
              href={`/api/export/plc-addresses?projectId=${projectId}&system=${system}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold shadow-xs"
              title="Export tabel lengkap ke format Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </a>
          </div>
        </div>

        {/* Notifikasi feedback simpan */}
        {savedMessage && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Perubahan alamat I/O PLC berhasil disimpan ke database proyek!</span>
          </div>
        )}

        {/* Notifikasi feedback import excel */}
        {importSuccessMessage && (
          <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-300 text-teal-900 text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-teal-700 shrink-0" />
              <span>{importSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setImportSuccessMessage(null)}
              className="text-teal-700 hover:text-teal-900 font-extrabold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Statistik Utilisasi Alamat */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-500">
              DIGITAL INPUT (DI)
            </div>
            <div className="text-lg font-black text-slate-900">
              {summary.totalDi} Titik
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              CPU: {summary.cpuBuiltInDiCapacity}
              {summary.expansionDiRequired > 0 &&
                ` (+${summary.expansionDiRequired})`}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-500">
              DIGITAL OUTPUT (DO)
            </div>
            <div className="text-lg font-black text-slate-900">
              {summary.totalDo} Titik
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              CPU: {summary.cpuBuiltInDoCapacity}
              {summary.expansionDoRequired > 0 &&
                ` (+${summary.expansionDoRequired})`}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-500">
              ANALOG INPUT (AI)
            </div>
            <div className="text-lg font-black text-slate-900">
              {summary.totalAi} Channel
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Sensor Analog
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-500">
              ANALOG OUTPUT (AO)
            </div>
            <div className="text-lg font-black text-slate-900">
              {summary.totalAo} Channel
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Speed Ref Inverter
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-500">
              INTERNAL RELAY (M)
            </div>
            <div className="text-lg font-black text-slate-900">
              {summary.totalM} Bit
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Bit HMI & Interlock
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-500">
              DATA REGISTER (D)
            </div>
            <div className="text-lg font-black text-slate-900">
              {summary.totalD} Word
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Posisi & Parameter
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        {/* Pills Kategori Alamat */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveKindFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeKindFilter === "ALL"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveKindFilter("DI")}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeKindFilter === "DI"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Input DI ({summary.totalDi})
          </button>
          <button
            type="button"
            onClick={() => setActiveKindFilter("DO")}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeKindFilter === "DO"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Output DO ({summary.totalDo})
          </button>
          <button
            type="button"
            onClick={() => setActiveKindFilter("AI")}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeKindFilter === "AI"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Analog In ({summary.totalAi})
          </button>
          <button
            type="button"
            onClick={() => setActiveKindFilter("AO")}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeKindFilter === "AO"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Analog Out ({summary.totalAo})
          </button>
          <button
            type="button"
            onClick={() => setActiveKindFilter("M")}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeKindFilter === "M"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Relay M ({summary.totalM})
          </button>
          <button
            type="button"
            onClick={() => setActiveKindFilter("D")}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeKindFilter === "D"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Register D ({summary.totalD})
          </button>
        </div>

        {/* Search input + Toggle Semua Accordion */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (openKinds.size === SECTIONS.length) {
                setOpenKinds(new Set());
              } else {
                setOpenKinds(new Set(SECTIONS.map((s) => s.kind)));
              }
            }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer transition shadow-2xs whitespace-nowrap"
            title="Buka atau tutup seluruh accordion kategori alamat PLC"
          >
            {openKinds.size === SECTIONS.length ? "Tutup Semua" : "Buka Semua"}
          </button>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari alamat, tag name, deskripsi..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Accordion Tabel Alamat PLC per Kategori */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-slate-500 font-bold shadow-2xs">
          Tidak ada alamat yang sesuai dengan pencarian atau filter.
        </div>
      ) : (
        <div className="space-y-3">
          {(activeKindFilter === "ALL"
            ? SECTIONS
            : SECTIONS.filter((s) => s.kind === activeKindFilter)
          ).map((sec) => {
            const secItems = filteredEntries.filter((item) => item.kind === sec.kind);
            if (search.trim().length > 0 && secItems.length === 0) return null;
            const isOpen =
              openKinds.has(sec.kind) ||
              search.trim().length > 0 ||
              activeKindFilter === sec.kind;

            return (
              <div
                key={sec.kind}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs"
              >
                {/* Header Accordion */}
                <div
                  onClick={() => toggleKind(sec.kind)}
                  className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-xs bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-200">
                      {sec.kind}
                    </span>
                    <h3 className="font-bold text-sm text-white">{sec.title}</h3>
                    <span className="text-xs text-slate-400 font-semibold">
                      ({secItems.length} item)
                    </span>
                    <span className="text-[11px] text-slate-500 hidden md:inline">
                      • {sec.subtitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                      {isOpen ? "Tutup" : "Buka"}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Body Accordion (Tabel 5 Kolom Sederhana) */}
                {isOpen && (
                  <div className="overflow-x-auto">
                    {secItems.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs italic">
                        Belum ada alamat untuk {sec.title}.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                            <th className="p-3 w-12 text-center">NO</th>
                            <th className="p-3 w-32">ALAMAT PLC</th>
                            <th className="p-3 w-64">TAG NAME</th>
                            <th className="p-3">DESKRIPSI</th>
                            <th className="p-3 w-20 text-center">AKSI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {secItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition">
                              <td className="p-3 text-center text-slate-400 font-bold text-[11px]">
                                {idx + 1}
                              </td>

                              <td className="p-3">
                                <span className="font-mono font-black text-sm text-slate-900">
                                  {item.address}
                                </span>
                              </td>

                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <code className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                    {item.symbol}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() => copySymbol(item)}
                                    title="Salin tag name"
                                    className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded"
                                  >
                                    {copiedId === item.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              <td className="p-3">
                                <span className="text-slate-700 leading-relaxed">
                                  {item.description}
                                </span>
                              </td>

                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(item)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition"
                                    title="Edit"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(item)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition"
                                    title="Hapus"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Edit Baris Alamat I/O */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <h3 className="font-extrabold text-base text-slate-900">
                  Edit Alamat I/O & Register PLC
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Jenis / Kategori:
                  </label>
                  <select
                    value={editingEntry.kind}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        kind: e.target.value as PlcAddressKind,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    <option value="DI">DI (Digital Input / X)</option>
                    <option value="DO">DO (Digital Output / Y)</option>
                    <option value="AI">AI (Analog Input)</option>
                    <option value="AO">AO (Analog Output)</option>
                    <option value="M">M (Internal Relay Bit)</option>
                    <option value="D">D (Data Register Word)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Alamat PLC:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEntry.address}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        address: e.target.value.trim().toUpperCase(),
                      })
                    }
                    placeholder="Mis. X0 / X20 / Y10 / D100"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-black text-blue-700 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Simbol / Tag Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEntry.symbol}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        symbol: e.target.value.trim().toUpperCase().replace(/\s+/g, "_"),
                      })
                    }
                    placeholder="Mis. PB_START / SENSOR_1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    No. Kabel / Wire Ferrule:
                  </label>
                  <input
                    type="text"
                    value={editingEntry.wireNo}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        wireNo: e.target.value.trim() || "-",
                      })
                    }
                    placeholder="Mis. W001 / S1 / V-SOL1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tipe Data:
                  </label>
                  <select
                    value={editingEntry.dataType}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        dataType: e.target.value as PlcAddressEntry["dataType"],
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold bg-white"
                  >
                    <option value="BOOL">BOOL (1-bit)</option>
                    <option value="WORD_16">WORD_16 (16-bit)</option>
                    <option value="DWORD_32">DWORD_32 (32-bit)</option>
                    <option value="ANALOG_INPUT">ANALOG_INPUT</option>
                    <option value="ANALOG_OUTPUT">ANALOG_OUTPUT</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Modul / Rol:
                  </label>
                  <input
                    type="text"
                    value={editingEntry.moduleRole || ""}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        moduleRole: e.target.value.trim() || null,
                      })
                    }
                    placeholder="Mis. Panel Operator / Sensor Part"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Deskripsi / Fungsi Perangkat:
                </label>
                <textarea
                  rows={3}
                  value={editingEntry.description}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      description: e.target.value,
                    })
                  }
                  placeholder="Keterangan fungsi sinyal, tombol, atau aktuator..."
                  className="w-full p-3 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteEntry(editingEntry);
                    setEditingEntry(null);
                  }}
                  className="text-rose-600 hover:text-rose-800 font-bold hover:underline"
                >
                  Hapus Baris Ini
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingEntry(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold cursor-pointer"
                  >
                    Simpan Perubahan Baris
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Alamat Manual */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">
                Tambah Baris Pengelamatan PLC
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddManualEntry} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Jenis Alamat:
                  </label>
                  <select
                    value={manualKind}
                    onChange={(e) => {
                      const k = e.target.value as PlcAddressKind;
                      setManualKind(k);
                      if (k === "D") setManualDataType("WORD_16");
                      else if (k === "AI") setManualDataType("ANALOG_INPUT");
                      else if (k === "AO") setManualDataType("ANALOG_OUTPUT");
                      else setManualDataType("BOOL");
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    <option value="DI">Digital Input (DI / X)</option>
                    <option value="DO">Digital Output (DO / Y)</option>
                    <option value="AI">Analog Input (AI)</option>
                    <option value="AO">Analog Output (AO)</option>
                    <option value="M">Internal Bit (M)</option>
                    <option value="D">Data Register (D)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Alamat PLC:
                  </label>
                  <input
                    type="text"
                    required
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder="Mis. X27 / Y15 / D250"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-blue-700 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Simbol / Tag Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={manualSymbol}
                    onChange={(e) => setManualSymbol(e.target.value)}
                    placeholder="Mis. SENSOR_BARU_FEED"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    No. Kabel / Wire Ferrule:
                  </label>
                  <input
                    type="text"
                    value={manualWireNo}
                    onChange={(e) => setManualWireNo(e.target.value)}
                    placeholder="Mis. W205 / S-AUX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Modul / Rol:
                </label>
                <input
                  type="text"
                  value={manualRole}
                  onChange={(e) => setManualRole(e.target.value)}
                  placeholder="Mis. Panel Operator / Sensor Part"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Deskripsi / Fungsi Perangkat:
                </label>
                <textarea
                  rows={2}
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="Penjelasan fungsi sinyal atau aktuator..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold cursor-pointer"
                >
                  Tambahkan ke Tabel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRATINJAU & KONFIRMASI IMPORT EXCEL I/O */}
      {importModalOpen && importPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8 max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                    Pratinjau & Konfirmasi Import Excel I/O PLC
                  </h3>
                  <p className="text-xs text-slate-500">
                    Berkas: <strong className="text-slate-800">{importPreview.filename || "tabel_io.xlsx"}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {/* Metadata Info Box */}
              {(importPreview.detectedMetadata?.projectName ||
                importPreview.detectedMetadata?.client ||
                importPreview.detectedMetadata?.system) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                    <span>Header Berkas Terdeteksi:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-slate-600">
                    {importPreview.detectedMetadata?.projectName && (
                      <div>
                        <span className="text-slate-400">Proyek: </span>
                        <strong>{importPreview.detectedMetadata.projectName}</strong>
                      </div>
                    )}
                    {importPreview.detectedMetadata?.client && (
                      <div>
                        <span className="text-slate-400">Client: </span>
                        <strong>{importPreview.detectedMetadata.client}</strong>
                      </div>
                    )}
                    {importPreview.detectedMetadata?.system && (
                      <div>
                        <span className="text-slate-400">Format: </span>
                        <strong>{importPreview.detectedMetadata.system}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Statistik Item Terbaca */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Statistik Alamat I/O yang Ditemukan ({importPreview.summary.total} Baris):
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold">TOTAL</div>
                    <div className="font-extrabold text-slate-900 text-sm">
                      {importPreview.summary.total}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="text-[10px] text-blue-700 font-bold">DI (Input)</div>
                    <div className="font-extrabold text-blue-900 text-sm">
                      {importPreview.summary.totalDi}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] text-emerald-700 font-bold">DO (Output)</div>
                    <div className="font-extrabold text-emerald-900 text-sm">
                      {importPreview.summary.totalDo}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-purple-50 border border-purple-200">
                    <div className="text-[10px] text-purple-700 font-bold">AI (Analog In)</div>
                    <div className="font-extrabold text-purple-900 text-sm">
                      {importPreview.summary.totalAi}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200">
                    <div className="text-[10px] text-indigo-700 font-bold">AO (Analog Out)</div>
                    <div className="font-extrabold text-indigo-900 text-sm">
                      {importPreview.summary.totalAo}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="text-[10px] text-amber-700 font-bold">M (Bit Relay)</div>
                    <div className="font-extrabold text-amber-900 text-sm">
                      {importPreview.summary.totalM}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-100 border border-slate-300">
                    <div className="text-[10px] text-slate-600 font-bold">D (Register)</div>
                    <div className="font-extrabold text-slate-900 text-sm">
                      {importPreview.summary.totalD}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mode Penggabungan */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <label className="text-xs font-extrabold text-slate-800 block">
                  Metode Penerapan ke Tabel Proyek:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      importMode === "replace"
                        ? "bg-teal-50 border-teal-400 text-teal-950 ring-2 ring-teal-200"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === "replace"}
                      onChange={() => setImportMode("replace")}
                      className="mt-0.5 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <div className="text-xs font-extrabold">Ganti Semua Alamat (Replace)</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Menimpa seluruh daftar alamat saat ini dengan data persis seperti di berkas Excel ({importPreview.entries.length} baris).
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      importMode === "merge"
                        ? "bg-teal-50 border-teal-400 text-teal-950 ring-2 ring-teal-200"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === "merge"}
                      onChange={() => setImportMode("merge")}
                      className="mt-0.5 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <div className="text-xs font-extrabold">Gabungkan (Merge & Update)</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Memperbarui simbol & deskripsi untuk alamat yang sudah ada, serta menambahkan alamat baru yang belum terdaftar.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Tabel Pratinjau (Contoh 8 Baris Pertama) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Contoh Baris Data yang Akan Dimasukkan:
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Menampilkan {Math.min(importPreview.entries.length, 8)} dari {importPreview.entries.length} baris
                  </span>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold">
                      <tr>
                        <th className="py-2 px-2.5 w-10 text-center">NO</th>
                        <th className="py-2 px-2.5 w-16 text-center">TIPE</th>
                        <th className="py-2 px-2.5 w-24">ALAMAT</th>
                        <th className="py-2 px-2.5">SIMBOL</th>
                        <th className="py-2 px-2.5 w-24">WIRE NO</th>
                        <th className="py-2 px-2.5">DESKRIPSI & FUNGSI</th>
                        <th className="py-2 px-2.5">MODUL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importPreview.entries.slice(0, 8).map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2.5 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                KIND_BADGE_CLASSES[item.kind].bg
                              } ${KIND_BADGE_CLASSES[item.kind].text}`}
                            >
                              {item.kind}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-blue-700">
                            {item.address}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900">
                            {item.symbol}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono text-slate-600">
                            {item.wireNo}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-700 truncate max-w-xs">
                            {item.description}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-500 truncate max-w-[120px]">
                            {item.moduleRole || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyImport}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold shadow-xs transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Terapkan ke Tabel I/O ({importPreview.entries.length} Alamat)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
