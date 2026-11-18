"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Layers,
  Box,
  Save,
  Download,
  RotateCw,
  RotateCcw,
  Trash2,
  Plus,
  Minus,
  Maximize2,
  CheckCircle2,
  Sparkles,
  Info,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Cpu,
  Zap,
  ToggleRight,
  Boxes,
  Cable,
  Folder,
  Ruler,
  X,
  Monitor,
  Sliders,
  Volume2,
  CircleDot,
  FileCode2,
  Printer,
  Magnet,
} from "lucide-react";
import {
  calculateSmartMagneticSnap,
  centerItemOnPlate,
  centerItemUnderHmi,
  distributeSelectedItemsHorizontally,
  type MagneticGuide,
} from "@/lib/panel-magnetic-guide";
import {
  extractPanelFeatures,
  generatePanelLayoutDxf,
  generateOuterPanelDxf,
  downloadDxfFile,
  type DxfProjectMetadata,
} from "@/lib/export/panel-dxf-generator";
import { PanelDrawingSheetModal } from "./PanelDrawingSheetModal";
import { ProjectOuterPanel2DViewer } from "./ProjectOuterPanel2DViewer";
import {
  alignSelectedPanelItems,
  buildStandardPanelLayoutFromComponents,
  classifyHmiPrComponent,
  classifyPrComponent,
  createDefaultOuterPanelLayout,
  createStandardOpMountingLayout,
  createStandardSpmLayout,
  DUCT_PROFILES,
  inferComponentVisual,
  isHmiPanelComponent,
  isNameplateOrEnclosureShell,
  isSensorOrFieldComponent,
  moveSelectedPanelItems,
  parseDualPanelLayoutJson,
  serializeDualPanelLayoutPayload,
  toggleSelectionId,
  type ComponentCategory,
  type DualPanelLayoutData,
  type DuctProfile,
  type HmiSubPointCategoryKey,
  type OuterPanelLayoutData,
  type PanelAlignmentMode,
  type PanelComponentInput,
  type PanelElementType,
  type PanelEnclosure,
  type PanelLayoutData,
  type PanelLayoutItem,
  type PanelViewMode,
  type SubPointCategoryKey,
} from "@/lib/panel-layout-template";

export type {
  ComponentCategory,
  DualPanelLayoutData,
  DuctProfile,
  HmiSubPointCategoryKey,
  PanelComponentInput,
  PanelElementType,
  PanelEnclosure,
  PanelLayoutData,
  PanelLayoutItem,
  PanelViewMode,
  SubPointCategoryKey,
};

export {
  buildStandardPanelLayoutFromComponents,
  classifyHmiPrComponent,
  classifyPrComponent,
  createStandardOpMountingLayout,
  createStandardSpmLayout,
  DUCT_PROFILES,
  inferComponentVisual,
  isHmiPanelComponent,
  isNameplateOrEnclosureShell,
  isSensorOrFieldComponent,
};

type ComponentPR = PanelComponentInput;

interface ProjectControlPanelLayoutEditorProps {
  projectId: string;
  projectKode?: string | null;
  projectNama?: string | null;
  projectClient?: string | null;
  projectPic?: string | null;
  components: ComponentPR[];
  initialLayoutJson?: string | null;
  onSaveSuccess?: () => void;
}

interface CategoryMeta {
  key: SubPointCategoryKey;
  label: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
}

const CATEGORY_GROUPS: CategoryMeta[] = [
  {
    key: "PLC_CONTROL",
    label: "PLC, HMI & Modul Kontrol",
    icon: Cpu,
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-700",
  },
  {
    key: "POWER_PROTECTION",
    label: "Power Supply, MCB & Filter",
    icon: Zap,
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
  },
  {
    key: "RELAY_CONTACTOR",
    label: "Relay, Kontaktor & Saklar",
    icon: ToggleRight,
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
  },
  {
    key: "TERMINAL_WIRING",
    label: "Terminal Block & Distribusi Listrik",
    icon: Cable,
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
  },
  {
    key: "ACCESSORY_PANEL",
    label: "Aksesoris Panel & Mekanikal",
    icon: Boxes,
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-700",
  },
  {
    key: "OTHER",
    label: "Komponen Pendukung Lainnya",
    icon: Folder,
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-700",
  },
];

// Sub Point Group Kategori: Panel HMI & Operator

export const HMI_CATEGORY_GROUPS: {
  key: HmiSubPointCategoryKey;
  label: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
}[] = [
  {
    key: "HMI_TOUCH",
    label: "Layar Sentuh HMI & Display",
    icon: Monitor,
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-700",
  },
  {
    key: "EMG_BUTTON",
    label: "Emergency Stop & Push Button (Ø22mm)",
    icon: CircleDot,
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-700",
  },
  {
    key: "SWITCH_KEY",
    label: "Selector Switch & Saklar Kunci",
    icon: Sliders,
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
  },
  {
    key: "INDICATOR_ALARM",
    label: "Pilot Lamp LED & Buzzer Alarm",
    icon: Volume2,
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
  },
  {
    key: "PANEL_ENCLOSURE",
    label: "Box OP Panel & Enclosure Pintu",
    icon: Boxes,
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-700",
  },
  {
    key: "OTHER",
    label: "Komponen Pendukung Lainnya",
    icon: Folder,
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-700",
  },
];

// Katalog Aksesoris Panel HMI & Operator (Library Standar Industri)
export interface HmiAccessoryItem {
  id: string;
  name: string;
  category: ComponentCategory;
  specificModel: string;
  widthMm: number;
  heightMm: number;
  tagLabel: string;
  badge: string;
  description: string;
}

export const HMI_ACCESSORIES_CATALOG: {
  group: string;
  items: HmiAccessoryItem[];
}[] = [
  {
    group: "Layar Sentuh HMI Standar",
    items: [
      {
        id: "hmi-7-mitsubishi",
        name: "Mitsubishi GS2107-WTBD-N (7 Inch)",
        category: "HMI",
        specificModel: "HMI_7INCH",
        widthMm: 206,
        heightMm: 152,
        tagLabel: "GS2107 (7\")",
        badge: "Standar SPM",
        description: "Bezel 206×152mm, Lubang Cutout 191×137mm",
      },
      {
        id: "hmi-10-mitsubishi",
        name: "Mitsubishi GS2110-WTBD (10 Inch)",
        category: "HMI",
        specificModel: "HMI_10INCH",
        widthMm: 272,
        heightMm: 214,
        tagLabel: "GS2110 (10\")",
        badge: "Layar Lebar",
        description: "Bezel 272×214mm, Lubang Cutout 258×199mm",
      },
      {
        id: "hmi-7-omron",
        name: "Omron NB7W-TW00B (7 Inch)",
        category: "HMI",
        specificModel: "HMI_7INCH",
        widthMm: 202,
        heightMm: 148,
        tagLabel: "NB7W (7\")",
        badge: "Omron NB",
        description: "Bezel 202×148mm, Cutout 191×137mm",
      },
      {
        id: "hmi-4-compact",
        name: "HMI Kompak 4.3 Inch (Weinview / Kinco)",
        category: "HMI",
        specificModel: "HMI_4INCH",
        widthMm: 128,
        heightMm: 102,
        tagLabel: "HMI 4.3\"",
        badge: "Kompak",
        description: "Bezel 128×102mm, Cutout 119×93mm",
      },
    ],
  },
  {
    group: "Emergency Stop & Tombol Push Button (Ø22mm)",
    items: [
      {
        id: "estop-22-idec",
        name: "Emergency Stop PB EMG (IDEC / Fort Ø22mm)",
        category: "EMERGENCY_STOP",
        specificModel: "EMERGENCY_STOP_22MM",
        widthMm: 50,
        heightMm: 65,
        tagLabel: "E-STOP",
        badge: "Safety Kritis",
        description: "Mushroom Merah Ø40mm + Ring Kuning Ø60mm",
      },
      {
        id: "pb-start-green",
        name: "Push Button START Ø22mm (Hijau)",
        category: "PUSH_BUTTON",
        specificModel: "PB_START_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "START",
        badge: "Kontrol Utama",
        description: "Flush Green Actuator dengan Legend Plate",
      },
      {
        id: "pb-stop-red",
        name: "Push Button STOP Ø22mm (Merah)",
        category: "PUSH_BUTTON",
        specificModel: "PB_STOP_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "STOP",
        badge: "Kontrol",
        description: "Flush Red Actuator dengan Legend Plate",
      },
      {
        id: "pb-reset-blue",
        name: "Push Button RESET Ø22mm (Biru)",
        category: "PUSH_BUTTON",
        specificModel: "PB_RESET_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "RESET",
        badge: "Reset Alarm",
        description: "Blue Actuator untuk reset siklus / safety relay",
      },
      {
        id: "pb-reset-yellow",
        name: "Push Button RESET Ø22mm (Kuning)",
        category: "PUSH_BUTTON",
        specificModel: "PB_RESET_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "RESET",
        badge: "Reset Siklus",
        description: "Yellow Actuator untuk reset siklus",
      },
      {
        id: "pb-jog-black",
        name: "Push Button JOG / INCHING Ø22mm (Hitam)",
        category: "PUSH_BUTTON",
        specificModel: "PB_JOG_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "JOG",
        badge: "Manual Jog",
        description: "Black Actuator untuk inching manual silinder/servo",
      },
    ],
  },
  {
    group: "Selector Switch & Saklar Kunci (Ø22mm)",
    items: [
      {
        id: "sel-2pos",
        name: "Selector Switch 2-Posisi (MANUAL - AUTO)",
        category: "SELECTOR_SWITCH",
        specificModel: "SELECTOR_2POS_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "MAN / AUTO",
        badge: "Mode Operasi",
        description: "Saklar putar 90° Manual - Auto",
      },
      {
        id: "sel-3pos",
        name: "Selector Switch 3-Posisi (HAND - 0 - AUTO)",
        category: "SELECTOR_SWITCH",
        specificModel: "SELECTOR_3POS_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "HAND 0 AUTO",
        badge: "3 Posisi",
        description: "Saklar putar 45°-0°-45° Hand / Off / Auto",
      },
      {
        id: "key-switch-fuji",
        name: "Key Switch Pengaman (FUJI / IDEC Ø22mm)",
        category: "SELECTOR_SWITCH",
        specificModel: "KEY_SWITCH_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "KEY SW",
        badge: "Kunci Master",
        description: "Saklar dengan anak kunci fisik master pengaman",
      },
    ],
  },
  {
    group: "Standard Push Switch TBINA (PE-STD-003)",
    items: [
      {
        id: "tbina-emg-stop",
        name: "EMERGENCY STOP (Mushroom Lamp Lockable Red - PE-STD-003)",
        category: "EMERGENCY_STOP",
        specificModel: "EMERGENCY_STOP_22MM",
        widthMm: 50,
        heightMm: 62,
        tagLabel: "E-STOP",
        badge: "Red Lockable",
        description: "Emergency Stop jamur berilluminasi dengan pengunci (IDEC) standar TBINA PE-STD-003",
      },
      {
        id: "tbina-power-sel",
        name: "POWER (Selector Switch OFF/ON Black - PE-STD-003)",
        category: "SELECTOR_SWITCH",
        specificModel: "SELECTOR_2POS_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "POWER",
        badge: "Black 2-Pos",
        description: "Selector Switch POWER OFF / ON hitam Ø22mm standar TBINA PE-STD-003",
      },
      {
        id: "tbina-master-on",
        name: "MASTER (Button with Lamp Green - PE-STD-003)",
        category: "PUSH_BUTTON",
        specificModel: "PB_START_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "MASTER ON",
        badge: "Green Lamp",
        description: "Tombol MASTER ON berilluminasi hijau standar TBINA PE-STD-003",
      },
      {
        id: "tbina-manual-auto",
        name: "MANUAL / AUTO (Key Switch Black - PE-STD-003)",
        category: "SELECTOR_SWITCH",
        specificModel: "KEY_SWITCH_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "MNL/AUTO",
        badge: "Black Key",
        description: "Key Switch OPERATE MNL / AUTO hitam Ø22mm standar TBINA PE-STD-003",
      },
      {
        id: "tbina-key-reset",
        name: "KEY RESET (Key Switch Black - PE-STD-003)",
        category: "SELECTOR_SWITCH",
        specificModel: "KEY_SWITCH_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "KEY RESET",
        badge: "Black Key",
        description: "Key Switch KEY RESET hitam Ø22mm standar TBINA PE-STD-003",
      },
      {
        id: "tbina-fault-reset",
        name: "FAULT RESET (Button Yellow - PE-STD-003)",
        category: "PUSH_BUTTON",
        specificModel: "PB_RESET_YELLOW_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "FAULT RST",
        badge: "Yellow",
        description: "Tombol FAULT RESET kuning Ø22mm standar TBINA PE-STD-003",
      },
      {
        id: "tbina-home-return",
        name: "HOME RETURN (Button with Lamp Green - PE-STD-003)",
        category: "PUSH_BUTTON",
        specificModel: "PB_START_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "HOME RTN",
        badge: "Green Lamp",
        description: "Tombol HOME RETURN berilluminasi hijau Ø22mm standar TBINA PE-STD-003",
      },
      {
        id: "tbina-adv-ret",
        name: "ADVANCE/RETURN (Selector Push Button Switch Black - PE-STD-003)",
        category: "SELECTOR_SWITCH",
        specificModel: "SELECTOR_2POS_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "ADV/RET",
        badge: "Black Sel PB",
        description: "Selector Push Button Switch ADV / RET hitam Ø22mm standar TBINA PE-STD-003",
      },
      {
        id: "tbina-lamp-check",
        name: "LAMP CHECK (Button with Lamp Yellow - PE-STD-003)",
        category: "PUSH_BUTTON",
        specificModel: "PB_YELLOW_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "LAMP CHK",
        badge: "Yellow Lamp",
        description: "Tombol LAMP CHECK berilluminasi kuning Ø22mm standar TBINA PE-STD-003",
      },
      {
        id: "tbina-manual-assist",
        name: "MANUAL ASSIST (Button Black - PE-STD-003)",
        category: "PUSH_BUTTON",
        specificModel: "PB_BLACK_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "MNL ASST",
        badge: "Black",
        description: "Tombol MANUAL ASSIST hitam Ø22mm standar TBINA PE-STD-003",
      },
    ],
  },
  {
    group: "Pilot Lamp LED & Buzzer Alarm (Ø22mm)",
    items: [
      {
        id: "lamp-red",
        name: "Pilot Lamp LED Merah Ø22mm (FAULT / ALARM)",
        category: "PILOT_LAMP",
        specificModel: "PILOT_LAMP_RED",
        widthMm: 35,
        heightMm: 50,
        tagLabel: "ALARM",
        badge: "Indikator",
        description: "Lensa Fresnel Merah 24VDC / 220VAC",
      },
      {
        id: "lamp-green",
        name: "Pilot Lamp LED Hijau Ø22mm (RUNNING)",
        category: "PILOT_LAMP",
        specificModel: "PILOT_LAMP_GREEN",
        widthMm: 35,
        heightMm: 50,
        tagLabel: "RUN",
        badge: "Indikator",
        description: "Lensa Fresnel Hijau 24VDC",
      },
      {
        id: "lamp-yellow",
        name: "Pilot Lamp LED Kuning Ø22mm (READY / STANDBY)",
        category: "PILOT_LAMP",
        specificModel: "PILOT_LAMP_YELLOW",
        widthMm: 35,
        heightMm: 50,
        tagLabel: "READY",
        badge: "Indikator",
        description: "Lensa Fresnel Kuning 24VDC",
      },
      {
        id: "lamp-blue",
        name: "Pilot Lamp LED Biru Ø22mm (POWER 24V)",
        category: "PILOT_LAMP",
        specificModel: "PILOT_LAMP_BLUE",
        widthMm: 35,
        heightMm: 50,
        tagLabel: "24V OK",
        badge: "Indikator",
        description: "Lensa Fresnel Biru status DC Power",
      },
      {
        id: "lamp-white",
        name: "Pilot Lamp LED Putih Ø22mm (MAIN POWER RST)",
        category: "PILOT_LAMP",
        specificModel: "PILOT_LAMP_WHITE",
        widthMm: 35,
        heightMm: 50,
        tagLabel: "POWER AC",
        badge: "Indikator",
        description: "Lensa Fresnel Putih 220VAC",
      },
      {
        id: "buzzer-22",
        name: "Electronic Buzzer 90dB (FORT Ø22mm)",
        category: "BUZZER",
        specificModel: "BUZZER_22MM",
        widthMm: 40,
        heightMm: 55,
        tagLabel: "BUZZER",
        badge: "Alarm Suara",
        description: "Sirine buzzer kontinyu / pulsa 24VDC 90dB",
      },
    ],
  },
  {
    group: "Meter Digital & Port Pemrograman Panel",
    items: [
      {
        id: "port-usb",
        name: "Port USB Panel Mount Pass-Through (Tutup Karet)",
        category: "ACCESSORY",
        specificModel: "PORT_USB_LAN",
        widthMm: 36,
        heightMm: 40,
        tagLabel: "USB PORT",
        badge: "Interface",
        description: "Download PLC / HMI tanpa membuka pintu panel",
      },
      {
        id: "port-lan",
        name: "Port RJ45 Ethernet Pass-Through (Tutup Karet)",
        category: "ACCESSORY",
        specificModel: "PORT_USB_LAN",
        widthMm: 36,
        heightMm: 40,
        tagLabel: "LAN RJ45",
        badge: "Interface",
        description: "Koneksi LAN Switch / PC Industrial",
      },
      {
        id: "temp-controller",
        name: "Temperature Controller (Autonics TC4S 48×48mm)",
        category: "METER_DISPLAY",
        specificModel: "DIGITAL_METER_48",
        widthMm: 48,
        heightMm: 48,
        tagLabel: "TEMP 48",
        badge: "Sensor Suhu",
        description: "Display 7-Segment Digital PID Controller",
      },
      {
        id: "counter-timer",
        name: "Digital Counter / Timer (Omron H7CX 48×48mm)",
        category: "METER_DISPLAY",
        specificModel: "DIGITAL_METER_48",
        widthMm: 48,
        heightMm: 48,
        tagLabel: "COUNTER",
        badge: "Penghitung",
        description: "Digital Counter 6-Digit Preset Counter",
      },
    ],
  },
];

/**
 * Input angka dimensi yang menunda pembaruan state & clamp min/max
 * hingga pengguna menekan Enter, sehingga proses ketik/hapus tidak terpotong.
 */
function DeferredNumberInput({
  value,
  onCommit,
  min = 1,
  max,
  className = "",
  title,
}: {
  value: number;
  onCommit: (val: number) => void;
  min?: number;
  max?: number;
  className?: string;
  title?: string;
}) {
  const [draft, setDraft] = useState<string>(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const isDirty = draft !== String(value);

  const commitDraft = (blurTarget?: HTMLInputElement) => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(String(value));
      blurTarget?.blur();
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      blurTarget?.blur();
      return;
    }
    let clamped = Math.round(parsed);
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);

    setDraft(String(clamped));
    onCommit(clamped);
    blurTarget?.blur();
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        if (/^\d*$/.test(raw)) {
          setDraft(raw);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitDraft(e.currentTarget);
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        setDraft(String(value));
      }}
      title={
        isDirty
          ? "Tekan Enter untuk menerapkan nilai"
          : title || "Ketik angka lalu tekan Enter"
      }
      className={`${className} ${
        isDirty ? "!border-amber-500 !bg-amber-50/60 ring-1 ring-amber-400" : ""
      }`}
    />
  );
}

export function ProjectControlPanelLayoutEditor({
  projectId,
  projectKode,
  projectNama,
  projectClient,
  projectPic,
  components,
  initialLayoutJson,
  onSaveSuccess,
}: ProjectControlPanelLayoutEditorProps) {
  // Mode Panel Aktif: Panel Utama (600x800), Panel Luar Box 2D, Pintu OP/HMI (430x440), atau Mounting OP (350x300)
  const [activePanelMode, setActivePanelMode] = useState<PanelViewMode>("MAIN");
  const [cadDrawingModalOpen, setCadDrawingModalOpen] = useState(false);

  // State Terpisah untuk Layout
  const [initialSnapshot] = useState<DualPanelLayoutData>(() =>
    parseDualPanelLayoutJson(initialLayoutJson, components)
  );
  const [mainLayoutData, setMainLayoutData] = useState<PanelLayoutData>(initialSnapshot.main);
  const [hmiLayoutData, setHmiLayoutData] = useState<PanelLayoutData>(initialSnapshot.hmi);
  const [opMountingLayoutData, setOpMountingLayoutData] = useState<PanelLayoutData>(
    initialSnapshot.opMounting
  );
  const [outerPanelData, setOuterPanelData] = useState<OuterPanelLayoutData>(
    () =>
      initialSnapshot.outerPanel ||
      createDefaultOuterPanelLayout(
        components,
        initialSnapshot.main.enclosure.widthMm,
        initialSnapshot.main.enclosure.heightMm
      )
  );
  const [isAutoGenerated, setIsAutoGenerated] = useState<boolean>(
    initialSnapshot.autoGenerated ?? true
  );
  const hasLocalDirtyRef = useRef(false);

  // Sinkronisasi otomatis apabila daftar komponen PR atau layout server diperbarui
  // dan user belum memodifikasi tata letak secara manual di sesi ini
  useEffect(() => {
    if (hasLocalDirtyRef.current) return;
    const synced = parseDualPanelLayoutJson(initialLayoutJson, components);
    setMainLayoutData(synced.main);
    setHmiLayoutData(synced.hmi);
    setOpMountingLayoutData(synced.opMounting);
    if (synced.outerPanel) {
      setOuterPanelData(synced.outerPanel);
    }
    setIsAutoGenerated(synced.autoGenerated ?? true);
  }, [initialLayoutJson, components]);

  // Getter & Setter Dinamis sesuai Panel Aktif
  const layoutData =
    activePanelMode === "MAIN"
      ? mainLayoutData
      : activePanelMode === "HMI"
        ? hmiLayoutData
        : activePanelMode === "OP_MOUNTING"
          ? opMountingLayoutData
          : mainLayoutData;
  const setLayoutData = useCallback(
    (action: React.SetStateAction<PanelLayoutData>) => {
      hasLocalDirtyRef.current = true;
      setIsAutoGenerated(false);
      if (activePanelMode === "MAIN") {
        setMainLayoutData(action);
      } else if (activePanelMode === "HMI") {
        setHmiLayoutData(action);
      } else if (activePanelMode === "OP_MOUNTING") {
        setOpMountingLayoutData(action);
      }
    },
    [activePanelMode]
  );

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const selectedItemId = selectedItemIds.length === 1 ? selectedItemIds[0] : null;
  const hasSelection = selectedItemIds.length > 0;
  const clearSelection = useCallback(() => setSelectedItemIds([]), []);
  const selectSingleItem = useCallback((id: string) => setSelectedItemIds([id]), []);
  const [mainZoom, setMainZoom] = useState<number>(0.85);
  const [hmiZoom, setHmiZoom] = useState<number>(1.35);
  const [opZoom, setOpZoom] = useState<number>(1.65);

  const zoom =
    activePanelMode === "MAIN"
      ? mainZoom
      : activePanelMode === "HMI"
        ? hmiZoom
        : activePanelMode === "OP_MOUNTING"
          ? opZoom
          : 1;
  const setZoom = useCallback(
    (updater: number | ((prev: number) => number)) => {
      if (activePanelMode === "MAIN") {
        setMainZoom((prev) => (typeof updater === "function" ? updater(prev) : updater));
      } else if (activePanelMode === "HMI") {
        setHmiZoom((prev) => (typeof updater === "function" ? updater(prev) : updater));
      } else if (activePanelMode === "OP_MOUNTING") {
        setOpMountingLayoutData((prev) => prev);
        setOpZoom((prev) => (typeof updater === "function" ? updater(prev) : updater));
      }
    },
    [activePanelMode]
  );
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"PR" | "ACCESSORY">("PR");
  const [searchPR, setSearchPR] = useState("");

  // Accordion State untuk Sub Point Kategori (Semua default terbuka)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    PLC_CONTROL: true,
    POWER_PROTECTION: true,
    RELAY_CONTACTOR: true,
    TERMINAL_WIRING: true,
    ACCESSORY_PANEL: true,
    HMI_TOUCH: true,
    EMG_BUTTON: true,
    SWITCH_KEY: true,
    INDICATOR_ALARM: true,
    PANEL_ENCLOSURE: true,
    OTHER: true,
  });

  // Pengaturan Kabel Duct & DIN Rail Custom
  const [selectedDuctProfile, setSelectedDuctProfile] = useState<string>("45x65");
  const [ductOrientation, setDuctOrientation] = useState<"HORIZONTAL" | "VERTICAL">("HORIZONTAL");
  const [customDuctLength, setCustomDuctLength] = useState<number>(layoutData.enclosure.widthMm - 140);
  const [customDinRailLength, setCustomDinRailLength] = useState<number>(layoutData.enclosure.widthMm - 160);
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [smartSnapEnabled, setSmartSnapEnabled] = useState<boolean>(true);
  const [activeGuides, setActiveGuides] = useState<MagneticGuide[]>([]);

  const toggleCategory = (catKey: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  // Dragging & Resizing States
  const canvasRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Fungsi Pas Layar (Auto Fit to Screen): Menghitung zoom ideal agar plat panel memenuhi canvas
  const handleFitToScreen = useCallback(
    (targetWidthMm?: number, targetHeightMm?: number) => {
      const container = containerRef.current;
      const w = targetWidthMm ?? layoutData.enclosure.widthMm;
      const h = targetHeightMm ?? layoutData.enclosure.heightMm;
      if (!container || !w || !h) return;

      const rect = container.getBoundingClientRect();
      // Berikan margin padding yang cukup agar plat tidak menempel di tepi canvas
      const rightPadding = hasSelection ? 336 : 0;
      const availW = Math.max(200, rect.width - 64 - rightPadding);
      const availH = Math.max(200, rect.height - 64);

      const scaleW = availW / w;
      const scaleH = availH / h;
      const bestScale = Math.min(scaleW, scaleH);

      // Batasi antara 30% (0.3) dan 350% (3.5)
      const clamped = Math.max(0.3, Math.min(3.5, Number(bestScale.toFixed(2))));
      setZoom(clamped);
    },
    [layoutData.enclosure.widthMm, layoutData.enclosure.heightMm, hasSelection, setZoom]
  );

  // Zoom dengan Ctrl + Mouse Wheel di area canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoom((z) => Math.max(0.3, Math.min(3.5, Number((z + delta).toFixed(2)))));
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [setZoom]);

  // Dragging item (mendukung 1 item maupun multi-item terpilih)
  const dragMovedRef = useRef(false);
  const [draggingItem, setDraggingItem] = useState<{
    anchorId: string;
    offsetX: number;
    offsetY: number;
    dragIds: string[];
    initialPositions: Record<string, { xMm: number; yMm: number }>;
    narrowOnMouseUpId: string | null;
  } | null>(null);

  // Resizing element (Enclosure plate / Cable Duct / DIN Rail)
  const [resizing, setResizing] = useState<{
    target: "ENCLOSURE" | "ITEM";
    id?: string;
    handle: "RIGHT" | "BOTTOM" | "CORNER" | "LEFT" | "TOP";
    startX: number;
    startY: number;
    initW: number;
    initH: number;
    initX: number;
    initY: number;
  } | null>(null);

  // Hitung jumlah item PR yang sudah ditaruh di panel
  const placedCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of layoutData.items) {
      if (it.componentId) {
        map[it.componentId] = (map[it.componentId] || 0) + 1;
      }
    }
    return map;
  }, [layoutData.items]);

  // Kelompokkan Komponen PR ke dalam Sub Point Kategori Sesuai Mode Aktif
  // Panel Utama & Mounting OP: menampilkan komponen elektrikal panel, mengecualikan sensor lapangan & komponen pintu HMI
  // Panel HMI / OP Door: menampilkan hanya komponen operator (HMI, PB, E-Stop, Key Switch, Pilot Lamp, Buzzer, Tower Lamp)
  // Sensor, nameplate & shell enclosure box dikecualikan agar list tetap bersih
  const groupedPR = useMemo(() => {
    const q = searchPR.trim().toLowerCase();
    const map: Record<string, ComponentPR[]> = {};

    const groups = activePanelMode === "HMI" ? HMI_CATEGORY_GROUPS : CATEGORY_GROUPS;
    for (const g of groups) {
      map[g.key] = [];
    }

    for (const comp of components) {
      if (comp.statusImport === "HILANG_DI_REVISI") continue;

      if (
        q &&
        !comp.partName.toLowerCase().includes(q) &&
        !comp.partType.toLowerCase().includes(q) &&
        !comp.kelompok.toLowerCase().includes(q)
      ) {
        continue;
      }

      // Filter universal: sensor, nameplate & box enclosure kosong tidak tampil di panel komponen
      if (
        isSensorOrFieldComponent(comp.partType, comp.partName, comp.kelompok) ||
        isNameplateOrEnclosureShell(comp.partType, comp.partName, comp.kelompok)
      ) {
        continue;
      }

      if (activePanelMode !== "HMI") {
        // Panel Utama & Mounting OP: komponen pintu HMI/Operator dikecualikan (ada di Panel HMI / OP Door)
        if (isHmiPanelComponent(comp.partType, comp.partName, comp.kelompok)) {
          continue;
        }
        const catKey = classifyPrComponent(comp.partType, comp.partName, comp.kelompok);
        if (!map[catKey]) map[catKey] = [];
        map[catKey].push(comp);
      } else {
        // Panel HMI / Pintu OP: hanya komponen operator panel yang relevan
        const catKey = classifyHmiPrComponent(comp.partType, comp.partName, comp.kelompok);
        if (catKey !== "OTHER") {
          if (!map[catKey]) map[catKey] = [];
          map[catKey].push(comp);
        }
      }
    }

    return map;
  }, [components, searchPR, activePanelMode]);

  // Jumlah komponen PR yang relevan untuk panel aktif saat ini (tanpa sensor/consumables)
  const eligiblePRCount = useMemo(() => {
    return Object.entries(groupedPR)
      .filter(([key]) => key !== "OTHER")
      .reduce((sum, [, arr]) => sum + arr.length, 0);
  }, [groupedPR]);

  // Hitung Area Fill Ratio (% Kepadatan Panel)
  const fillStats = useMemo(() => {
    const totalAreaMm2 = layoutData.enclosure.widthMm * layoutData.enclosure.heightMm;
    let componentAreaMm2 = 0;
    let ductAreaMm2 = 0;

    for (const it of layoutData.items) {
      const area = it.widthMm * it.heightMm;
      if (it.type === "COMPONENT") {
        componentAreaMm2 += area;
      } else if (it.type === "DUCT_HORIZONTAL" || it.type === "DUCT_VERTICAL") {
        ductAreaMm2 += area;
      }
    }

    const occupiedPercent = Math.min(
      100,
      Math.round(((componentAreaMm2 + ductAreaMm2) / totalAreaMm2) * 100)
    );

    return {
      totalAreaMm2,
      occupiedPercent,
      componentCount: layoutData.items.filter((i) => i.type === "COMPONENT").length,
    };
  }, [layoutData]);

  // Tambah Komponen dari PR ke Panel (bebas digeser kapan saja)
  const handleAddComponentFromPR = (comp: ComponentPR) => {
    const visual = inferComponentVisual(comp.partType, comp.partName);

    if (activePanelMode === "HMI") {
      let posX = Math.round((layoutData.enclosure.widthMm - visual.widthMm) / 2);
      let posY = Math.round((layoutData.enclosure.heightMm - visual.heightMm) / 2);

      if (visual.category === "HMI") {
        posX = Math.round((layoutData.enclosure.widthMm - visual.widthMm) / 2);
        posY = 22;
      } else if (visual.category === "EMERGENCY_STOP") {
        posX = layoutData.enclosure.widthMm - visual.widthMm - 20;
        posY = 25;
      } else {
        const bottomItems = layoutData.items.filter((i) => i.category !== "HMI");
        posX = Math.min(
          layoutData.enclosure.widthMm - visual.widthMm - 15,
          25 + bottomItems.length * (visual.widthMm + 15)
        );
        posY = Math.max(25, layoutData.enclosure.heightMm - visual.heightMm - 25);
      }

      const newItem: PanelLayoutItem = {
        id: `pr-comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: "COMPONENT",
        componentId: comp.id,
        name: comp.partType,
        partType: comp.partType,
        partName: comp.partName,
        category: visual.category,
        specificModel: visual.specificModel,
        xMm: Math.max(10, Math.min(layoutData.enclosure.widthMm - visual.widthMm - 10, posX)),
        yMm: Math.max(10, Math.min(layoutData.enclosure.heightMm - visual.heightMm - 10, posY)),
        widthMm: visual.widthMm,
        heightMm: visual.heightMm,
        tagLabel: visual.defaultTag,
      };

      setLayoutData((prev) => ({
        ...prev,
        items: [...prev.items, newItem],
      }));
      selectSingleItem(newItem.id);
      return;
    }

    if (activePanelMode === "OP_MOUNTING") {
      const dinRails = layoutData.items.filter((i) => i.type === "DIN_RAIL");
      const vRail = dinRails.find((i) => i.heightMm > i.widthMm) || dinRails[0];
      const isHorizTerm = visual.category === "TERMINAL" && vRail && vRail.heightMm > vRail.widthMm;
      const itemW = isHorizTerm ? Math.max(visual.widthMm, visual.heightMm) : visual.widthMm;
      const itemH = isHorizTerm ? Math.min(visual.widthMm, visual.heightMm) : visual.heightMm;

      const posX = vRail
        ? Math.round(vRail.xMm - (itemW - vRail.widthMm) / 2)
        : Math.round((layoutData.enclosure.widthMm - itemW) / 2);
      const existingOnRail = layoutData.items.filter((i) => i.type === "COMPONENT");
      const posY = Math.min(
        layoutData.enclosure.heightMm - itemH - 42,
        (vRail?.yMm ?? 48) + 12 + existingOnRail.length * (itemH + 6)
      );

      const newItem: PanelLayoutItem = {
        id: `op-comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: "COMPONENT",
        componentId: comp.id,
        name: comp.partName,
        partType: comp.partType,
        partName: comp.partName,
        category: visual.category,
        specificModel: visual.specificModel,
        xMm: Math.max(36, Math.round(posX)),
        yMm: Math.max(36, Math.round(posY)),
        widthMm: itemW,
        heightMm: itemH,
        tagLabel: visual.defaultTag,
      };

      setLayoutData((prev) => ({
        ...prev,
        items: [...prev.items, newItem],
      }));
      selectSingleItem(newItem.id);
      return;
    }

    // Mode MAIN: Cari DIN Rail terdekat yang sesuai zona standar FR-EG-EP-006 (diurutkan atas -> bawah)
    const dinRails = [...layoutData.items]
      .filter((i) => i.type === "DIN_RAIL")
      .sort((a, b) => a.yMm - b.yMm);
    let targetRail = dinRails[1] || dinRails[0];
    if (
      visual.category === "MCB" ||
      visual.category === "MCCB" ||
      visual.category === "MAIN_SWITCH" ||
      visual.category === "POWER_SUPPLY" ||
      visual.specificModel === "NOISE_FILTER_3P"
    ) {
      targetRail = dinRails[0] || dinRails[1];
    } else if (
      visual.category === "TERMINAL" &&
      visual.specificModel !== "TERMINAL_2STEP"
    ) {
      targetRail = dinRails[3] || dinRails[2] || dinRails[1] || dinRails[0];
    } else if (
      visual.category === "RELAY" ||
      visual.category === "SAFETY_RELAY" ||
      visual.category === "CONTACTOR" ||
      visual.category === "TERMINAL" ||
      visual.category === "SOCKET_OUTLET"
    ) {
      targetRail = dinRails[2] || dinRails[1] || dinRails[0];
    }

    const railStartX = targetRail ? targetRail.xMm + 12 : 60;
    const railEndX = targetRail
      ? targetRail.xMm + targetRail.widthMm - visual.widthMm - 6
      : layoutData.enclosure.widthMm - visual.widthMm - 45;
    const posY = targetRail
      ? targetRail.yMm - (visual.heightMm - targetRail.heightMm) / 2
      : 200;

    // Cari posisi X bebas tabrakan sepanjang baris rel target
    const rowBandItems = layoutData.items
      .filter(
        (it) =>
          it.type === "COMPONENT" &&
          it.yMm < posY + visual.heightMm + 8 &&
          it.yMm + it.heightMm > posY - 8
      )
      .sort((a, b) => a.xMm - b.xMm);

    let posX = railStartX;
    for (const existing of rowBandItems) {
      if (posX + visual.widthMm + 4 <= existing.xMm) {
        break;
      }
      if (posX < existing.xMm + existing.widthMm + 6) {
        posX = existing.xMm + existing.widthMm + 6;
      }
    }
    if (railEndX >= railStartX) {
      posX = Math.min(posX, railEndX);
    }

    const newItem: PanelLayoutItem = {
      id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: "COMPONENT",
      componentId: comp.id,
      name: comp.partName,
      partType: comp.partType,
      partName: comp.partName,
      category: visual.category,
      specificModel: visual.specificModel,
      xMm: Math.round(posX),
      yMm: Math.round(posY),
      widthMm: visual.widthMm,
      heightMm: visual.heightMm,
      tagLabel: visual.defaultTag,
    };

    setLayoutData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    selectSingleItem(newItem.id);
  };

  // Tambah Aksesoris HMI Standar
  const handleAddHmiAccessory = (acc: HmiAccessoryItem) => {
    let posX = Math.round((layoutData.enclosure.widthMm - acc.widthMm) / 2);
    let posY = Math.round((layoutData.enclosure.heightMm - acc.heightMm) / 2);

    if (acc.category === "HMI") {
      posX = Math.round((layoutData.enclosure.widthMm - acc.widthMm) / 2);
      posY = 22;
    } else if (acc.category === "EMERGENCY_STOP") {
      posX = layoutData.enclosure.widthMm - acc.widthMm - 20;
      posY = 25;
    } else {
      const bottomItems = layoutData.items.filter((i) => i.category !== "HMI");
      posX = Math.min(
        layoutData.enclosure.widthMm - acc.widthMm - 15,
        25 + bottomItems.length * (acc.widthMm + 15)
      );
      posY = Math.max(25, layoutData.enclosure.heightMm - acc.heightMm - 25);
    }

    const newItem: PanelLayoutItem = {
      id: `hmi-acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: "COMPONENT",
      name: acc.name,
      category: acc.category,
      specificModel: acc.specificModel,
      widthMm: acc.widthMm,
      heightMm: acc.heightMm,
      tagLabel: acc.tagLabel,
      xMm: Math.max(10, Math.min(layoutData.enclosure.widthMm - acc.widthMm - 10, posX)),
      yMm: Math.max(10, Math.min(layoutData.enclosure.heightMm - acc.heightMm - 10, posY)),
    };

    setLayoutData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    selectSingleItem(newItem.id);
  };

  // Hapus Komponen PR dari Panel (Cabut 1 instance yang terpasang)
  const handleRemoveComponentFromPR = (componentId: string) => {
    let removedId: string | null = null;
    setLayoutData((prev) => {
      const items = [...prev.items];
      const lastIndex = items.findLastIndex((it) => it.componentId === componentId);
      if (lastIndex !== -1) {
        removedId = items[lastIndex].id;
        items.splice(lastIndex, 1);
      }
      return { ...prev, items };
    });
    if (removedId) {
      const idToRemove = removedId;
      setSelectedItemIds((prev) => prev.filter((id) => id !== idToRemove));
    } else {
      clearSelection();
    }
  };

  // Update atribut item yang sedang dipilih (Panjang, Profil, Posisi, Tag)
  const handleUpdateSelectedItem = useCallback(
    (updates: Partial<PanelLayoutItem>) => {
      if (!selectedItemId) return;
      setLayoutData((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.id === selectedItemId ? { ...it, ...updates } : it)),
      }));
    },
    [selectedItemId]
  );

  // Tambah Kabel Duct dengan Profil & Panjang Custom
  const handleAddCustomDuct = () => {
    const profile =
      DUCT_PROFILES.find((p) => p.code === selectedDuctProfile) ||
      DUCT_PROFILES.find((p) => p.code === "45x65") ||
      DUCT_PROFILES[0];
    const isH = ductOrientation === "HORIZONTAL";
    const lengthMm = Math.max(20, Math.min(2500, Number(customDuctLength) || 400));
    const widthMm = isH ? lengthMm : profile.widthMm;
    const heightMm = isH ? profile.widthMm : lengthMm;

    const newItem: PanelLayoutItem = {
      id: `duct-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: isH ? "DUCT_HORIZONTAL" : "DUCT_VERTICAL",
      name: `Kabel Duct ${profile.name} (${isH ? "Horizontal" : "Vertikal"})`,
      category: "ACCESSORY",
      profileSize: profile.code,
      xMm: Math.round((layoutData.enclosure.widthMm - widthMm) / 2),
      yMm: Math.round((layoutData.enclosure.heightMm - heightMm) / 2),
      widthMm,
      heightMm,
      tagLabel: `DUCT ${profile.code}`,
    };

    setLayoutData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    selectSingleItem(newItem.id);
  };

  // Tambah DIN Rail TS35 dengan Panjang Custom
  const handleAddCustomDinRail = () => {
    const lengthMm = Math.max(30, Math.min(2500, Number(customDinRailLength) || 440));
    const newItem: PanelLayoutItem = {
      id: `rail-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: "DIN_RAIL",
      name: "DIN Rail TS35",
      category: "ACCESSORY",
      xMm: Math.round((layoutData.enclosure.widthMm - lengthMm) / 2),
      yMm: Math.round(layoutData.enclosure.heightMm / 2 - 35 / 2),
      widthMm: lengthMm,
      heightMm: 35,
      tagLabel: "TS35 RAIL",
    };

    setLayoutData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    selectSingleItem(newItem.id);
  };

  // Tambah Aksesoris Manual (Duct / DIN Rail / Terminal)
  const handleAddAccessory = (type: PanelElementType, name: string, w: number, h: number) => {
    const newItem: PanelLayoutItem = {
      id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      name,
      category: "ACCESSORY",
      xMm: Math.round(layoutData.enclosure.widthMm / 2 - w / 2),
      yMm: Math.round(layoutData.enclosure.heightMm / 2 - h / 2),
      widthMm: w,
      heightMm: h,
      tagLabel: name,
    };

    setLayoutData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    selectSingleItem(newItem.id);
  };

  // Auto-Layout PR sesuai Standar Template FR-EG-EP-006 (Semua komponen tetap bebas digeser)
  const handleResetToStandard = () => {
    if (
      !confirm(
        "Susun ulang seluruh panel (Panel Utama & Pintu OP/HMI) otomatis dari daftar PR sesuai standar FR-EG-EP-006 (kabel duct & dimensi plat menyesuaikan agar cukup)?"
      )
    ) {
      return;
    }
    const generated = buildStandardPanelLayoutFromComponents(components);
    hasLocalDirtyRef.current = true;
    setMainLayoutData(generated.main);
    setHmiLayoutData(generated.hmi);
    setOpMountingLayoutData(generated.opMounting);
    setIsAutoGenerated(true);
    clearSelection();

    const activeTarget =
      activePanelMode === "HMI" ? generated.hmi : generated.main;
    setTimeout(
      () =>
        handleFitToScreen(
          activeTarget.enclosure.widthMm,
          activeTarget.enclosure.heightMm
        ),
      50
    );
  };

  // Hapus Item Berdasarkan ID Langsung (Bisa dari Canvas maupun Toolbar)
  const handleDeleteItem = useCallback(
    (itemId: string) => {
      setLayoutData((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== itemId),
      }));
      setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
    },
    [setLayoutData]
  );

  // Hapus Semua Item Terpilih
  const handleDeleteSelected = useCallback(() => {
    if (selectedItemIds.length === 0) return;
    const deleteSet = new Set(selectedItemIds);
    setLayoutData((prev) => ({
      ...prev,
      items: prev.items.filter((i) => !deleteSet.has(i.id)),
    }));
    setSelectedItemIds([]);
  }, [selectedItemIds, setLayoutData]);

  // Rotasi Semua Item Terpilih (90 derajat)
  const handleRotateSelected = () => {
    if (selectedItemIds.length === 0) return;
    const rotateSet = new Set(selectedItemIds);
    setLayoutData((prev) => ({
      ...prev,
      items: prev.items.map((i) => {
        if (!rotateSet.has(i.id)) return i;
        return {
          ...i,
          widthMm: i.heightMm,
          heightMm: i.widthMm,
          rotation: (((i.rotation || 0) + 90) % 360) as 0 | 90 | 180 | 270,
        };
      }),
    }));
  };

  // Geser Serentak Semua Item Terpilih (mm)
  const handleNudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (selectedItemIds.length === 0) return;
      setLayoutData((prev) => {
        const initialPositions: Record<string, { xMm: number; yMm: number }> = {};
        for (const item of prev.items) {
          if (selectedItemIds.includes(item.id)) {
            initialPositions[item.id] = { xMm: item.xMm, yMm: item.yMm };
          }
        }
        return {
          ...prev,
          items: moveSelectedPanelItems(
            prev.items,
            selectedItemIds,
            initialPositions,
            dx,
            dy,
            prev.enclosure
          ),
        };
      });
    },
    [selectedItemIds, setLayoutData]
  );

  // Sejajarkan Item Terpilih (Saat Multi-Select >= 2 item)
  const handleAlignSelected = useCallback(
    (alignment: PanelAlignmentMode) => {
      if (selectedItemIds.length < 2) return;
      setLayoutData((prev) => ({
        ...prev,
        items: alignSelectedPanelItems(
          prev.items,
          selectedItemIds,
          alignment,
          prev.enclosure
        ),
      }));
    },
    [selectedItemIds, setLayoutData]
  );

  // 1-Klik menempatkan 1 item di tengah plat (Center X / Y / Both)
  const handleCenterSingleItem = useCallback(
    (axis: "X" | "Y" | "BOTH") => {
      if (selectedItemIds.length !== 1) return;
      const targetId = selectedItemIds[0];
      setLayoutData((prev) => ({
        ...prev,
        items: centerItemOnPlate(prev.items, targetId, axis, prev.enclosure),
      }));
    },
    [selectedItemIds, setLayoutData]
  );

  // 1-Klik meluruskan tombol tepat di bawah garis tengah HMI
  const handleCenterUnderHmi = useCallback(() => {
    if (selectedItemIds.length !== 1) return;
    const targetId = selectedItemIds[0];
    setLayoutData((prev) => ({
      ...prev,
      items: centerItemUnderHmi(prev.items, targetId, prev.enclosure),
    }));
  }, [selectedItemIds, setLayoutData]);

  // 1-Klik bagi rata jarak spasi horizontal (Equal Horizontal Distribution) & ratakan baris
  const handleDistributeHorizontal = useCallback(() => {
    if (selectedItemIds.length < 2) return;
    setLayoutData((prev) => ({
      ...prev,
      items: distributeSelectedItemsHorizontally(
        prev.items,
        selectedItemIds,
        prev.enclosure,
        true
      ),
    }));
  }, [selectedItemIds, setLayoutData]);

  // Simpan Semua Layout (Panel Dalam, Panel Luar, HMI, & Mounting OP) ke Proyek
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccessMsg(false);
    try {
      const payloadJson = serializeDualPanelLayoutPayload({
        main: mainLayoutData,
        hmi: hmiLayoutData,
        opMounting: opMountingLayoutData,
        outerPanel: outerPanelData,
        autoGenerated: isAutoGenerated,
        templateCode: "FR-EG-EP-006",
        lastSaved: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });

      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panelLayoutJson: payloadJson,
        }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan layout panel");
      hasLocalDirtyRef.current = false;
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3500);
      onSaveSuccess?.();
    } catch (err) {
      alert("Terjadi kesalahan saat menyimpan layout panel.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Unduh Gambar 2D Layout (SVG ke PNG)
  const handleExportPng = () => {
    if (activePanelMode === "OUTER") {
      const outerSvg = document.querySelector("#outer-panel-2d-canvas") as SVGSVGElement | null;
      if (outerSvg) {
        try {
          const serializer = new XMLSerializer();
          let source = serializer.serializeToString(outerSvg);
          if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
          }
          const img = new Image();
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const scale = 2;
            const ow = outerPanelData.enclosure.widthMm;
            const oh = outerPanelData.enclosure.heightMm;
            const od = outerPanelData.enclosure.depthMm;
            const totalSvgW = 140 + ow + 160 + od + 140;
            const totalSvgH = 130 + oh + 170;
            canvas.width = totalSvgW * scale;
            canvas.height = totalSvgH * scale;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const pngUrl = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = `Layout_Panel_Luar_Box_${ow}x${oh}x${od}mm.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          };
          return;
        } catch (e) {
          console.error("Gagal export PNG outer:", e);
        }
      }
    }

    if (!canvasRef.current) return;
    try {
      const isHmi = activePanelMode === "HMI";
      const svgEl = canvasRef.current;
      const svgString = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 2;
        canvas.width = layoutData.enclosure.widthMm * scale;
        canvas.height = layoutData.enclosure.heightMm * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = isHmi ? "#1e293b" : "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = isHmi
            ? `Layout_OP_Door_HMI_${layoutData.enclosure.widthMm}x${layoutData.enclosure.heightMm}mm.png`
            : `Layout_Panel_Utama_${layoutData.enclosure.widthMm}x${layoutData.enclosure.heightMm}mm.png`;
          a.click();
        }
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (err) {
      console.error("Gagal export PNG:", err);
      alert("Gagal mengunduh gambar layout.");
    }
  };

  // Export File DXF CAD 2D (AutoCAD R12/2000)
  const handleExportDxf = () => {
    try {
      const today = new Date();
      const d = String(today.getDate()).padStart(2, "0");
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const y = today.getFullYear();

      const meta: DxfProjectMetadata = {
        kode: projectKode || "26-TBD-0513",
        nama: projectNama || "PROJECT AUTOMATION",
        client: projectClient || "PT. TWINTECH PRECISION",
        pic: projectPic || "DEDI",
        drawnBy: projectPic || "DEDI",
        checkedBy: "IVAN",
        approvedBy: "IVAN",
        partName:
          activePanelMode === "OUTER"
            ? "BOX ENCLOSURE 2D (PANEL LUAR)"
            : activePanelMode === "HMI"
              ? "DUMMY OP PANEL"
              : "PANEL MOUNTING PLATE",
        material:
          activePanelMode === "OUTER"
            ? "SPCC t=1.5mm / Powder Coating RAL 7035"
            : "SPCC t=2.0mm",
        dateStr: `${d}/${m}/${y}`,
      };

      const cleanKode = (projectKode || "PANEL").replace(/[^a-zA-Z0-9_-]/g, "_");

      if (activePanelMode === "OUTER") {
        const dxf = generateOuterPanelDxf(outerPanelData, meta);
        const filename = `${cleanKode}_BOX_LUAR_CAD.dxf`;
        downloadDxfFile(filename, dxf);
        return;
      }

      const modeKey =
        activePanelMode === "HMI"
          ? "HMI"
          : activePanelMode === "OP_MOUNTING"
            ? "OP_MOUNTING"
            : "MAIN";

      const feats = extractPanelFeatures(
        layoutData.enclosure.widthMm,
        layoutData.enclosure.heightMm,
        layoutData.items,
        modeKey
      );

      const dxf = generatePanelLayoutDxf(feats, meta, modeKey);
      const filename = `${cleanKode}_${modeKey === "HMI" ? "OP_PANEL" : "MAIN_PANEL"}_CAD.dxf`;
      downloadDxfFile(filename, dxf);
    } catch (err) {
      console.error("Gagal export DXF:", err);
      alert("Gagal mengunduh file DXF CAD.");
    }
  };

  // Mouse Handlers untuk Drag, Multi-Select (Ctrl + Klik Kiri), & Resize
  const handleMouseDownItem = (e: React.MouseEvent, it: PanelLayoutItem) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    // Ctrl + Klik Kiri (atau Cmd di Mac) melakukan toggle multi-select item
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setSelectedItemIds((prev) => toggleSelectionId(prev, it.id, true));
      return;
    }

    const alreadySelectedInGroup =
      selectedItemIds.length > 1 && selectedItemIds.includes(it.id);
    const activeDragIds = alreadySelectedInGroup ? selectedItemIds : [it.id];

    if (!alreadySelectedInGroup) {
      setSelectedItemIds([it.id]);
    }

    const svg = canvasRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;

    const initialPositions: Record<string, { xMm: number; yMm: number }> = {};
    for (const item of layoutData.items) {
      if (activeDragIds.includes(item.id)) {
        initialPositions[item.id] = { xMm: item.xMm, yMm: item.yMm };
      }
    }

    dragMovedRef.current = false;
    setDraggingItem({
      anchorId: it.id,
      offsetX: mouseX - it.xMm,
      offsetY: mouseY - it.yMm,
      dragIds: activeDragIds,
      initialPositions,
      narrowOnMouseUpId: alreadySelectedInGroup ? it.id : null,
    });
  };

  const handleStartResize = (
    e: React.MouseEvent,
    target: "ENCLOSURE" | "ITEM",
    handle: "RIGHT" | "BOTTOM" | "CORNER" | "LEFT" | "TOP",
    itemId?: string
  ) => {
    e.stopPropagation();
    const it = itemId ? layoutData.items.find((i) => i.id === itemId) : null;

    setResizing({
      target,
      id: itemId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initW: it ? it.widthMm : layoutData.enclosure.widthMm,
      initH: it ? it.heightMm : layoutData.enclosure.heightMm,
      initX: it ? it.xMm : 0,
      initY: it ? it.yMm : 0,
    });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // 1. Sedang Drag Item (1 item atau multi-item sekaligus)
      if (draggingItem) {
        const svg = canvasRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const currentX = (e.clientX - rect.left) / zoom;
        const currentY = (e.clientY - rect.top) / zoom;

        let nextX = Math.round(currentX - draggingItem.offsetX);
        let nextY = Math.round(currentY - draggingItem.offsetY);

        // Smart Snapping ke DIN Rail terdekat jika menyeret 1 komponen
        const dragged = layoutData.items.find((i) => i.id === draggingItem.anchorId);
        if (draggingItem.dragIds.length === 1 && dragged && dragged.type === "COMPONENT") {
          const dinRails = layoutData.items.filter((i) => i.type === "DIN_RAIL");
          for (const rail of dinRails) {
            if (rail.heightMm > rail.widthMm) {
              // DIN Rail Vertikal (misal Mounting OP Plate)
              const targetX = rail.xMm - (dragged.widthMm - rail.widthMm) / 2;
              if (
                Math.abs(nextX - targetX) < 25 &&
                nextY >= rail.yMm - 20 &&
                nextY <= rail.yMm + rail.heightMm - 10
              ) {
                nextX = Math.round(targetX);
                break;
              }
            } else {
              const targetY = rail.yMm - (dragged.heightMm - rail.heightMm) / 2;
              if (
                Math.abs(nextY - targetY) < 25 &&
                nextX >= rail.xMm - 20 &&
                nextX <= rail.xMm + rail.widthMm - 10
              ) {
                nextY = Math.round(targetY);
                break;
              }
            }
          }
        }

        // Smart Magnetic Guide & Center Snapping (Plat Center, HMI Center, Row Symmetry & Pitch)
        if (dragged) {
          const snapRes = calculateSmartMagneticSnap({
            rawX: nextX,
            rawY: nextY,
            draggedItem: dragged,
            allItems: layoutData.items,
            dragIds: draggingItem.dragIds,
            enclosure: layoutData.enclosure,
            enabled: smartSnapEnabled,
          });
          nextX = snapRes.snappedX;
          nextY = snapRes.snappedY;
          setActiveGuides(snapRes.guides);
        } else {
          setActiveGuides([]);
        }

        const anchorInit = draggingItem.initialPositions[draggingItem.anchorId];
        const dx = anchorInit ? nextX - anchorInit.xMm : 0;
        const dy = anchorInit ? nextY - anchorInit.yMm : 0;
        if (dx !== 0 || dy !== 0) {
          dragMovedRef.current = true;
        }

        setLayoutData((prev) => ({
          ...prev,
          items: moveSelectedPanelItems(
            prev.items,
            draggingItem.dragIds,
            draggingItem.initialPositions,
            dx,
            dy,
            prev.enclosure
          ),
        }));
      }

      // 2. Sedang Resize Item atau Enclosure
      if (resizing) {
        const deltaX = (e.clientX - resizing.startX) / zoom;
        const deltaY = (e.clientY - resizing.startY) / zoom;

        if (resizing.target === "ENCLOSURE") {
          let newW = resizing.initW;
          let newH = resizing.initH;

          if (resizing.handle === "RIGHT" || resizing.handle === "CORNER") {
            newW = Math.max(300, Math.min(1600, Math.round(resizing.initW + deltaX)));
          }
          if (resizing.handle === "BOTTOM" || resizing.handle === "CORNER") {
            newH = Math.max(300, Math.min(2200, Math.round(resizing.initH + deltaY)));
          }

          setLayoutData((prev) => ({
            ...prev,
            enclosure: {
              ...prev.enclosure,
              widthMm: newW,
              heightMm: newH,
            },
          }));
        } else if (resizing.target === "ITEM" && resizing.id) {
          const id = resizing.id;
          setLayoutData((prev) => ({
            ...prev,
            items: prev.items.map((i) => {
              if (i.id !== id) return i;
              let w = i.widthMm;
              let h = i.heightMm;
              let x = i.xMm;
              let y = i.yMm;

              if (resizing.handle === "RIGHT") {
                w = Math.max(20, Math.round(resizing.initW + deltaX));
              } else if (resizing.handle === "BOTTOM") {
                h = Math.max(20, Math.round(resizing.initH + deltaY));
              } else if (resizing.handle === "LEFT") {
                const newW = Math.max(20, Math.round(resizing.initW - deltaX));
                x = resizing.initX + (resizing.initW - newW);
                w = newW;
              } else if (resizing.handle === "TOP") {
                const newH = Math.max(20, Math.round(resizing.initH - deltaY));
                y = resizing.initY + (resizing.initH - newH);
                h = newH;
              }
              return { ...i, widthMm: w, heightMm: h, xMm: x, yMm: y };
            }),
          }));
        }
      }
    },
    [draggingItem, resizing, zoom, layoutData.items, layoutData.enclosure, setLayoutData, smartSnapEnabled]
  );

  const handleMouseUp = () => {
    setActiveGuides([]);
    if (draggingItem?.narrowOnMouseUpId && !dragMovedRef.current) {
      setSelectedItemIds([draggingItem.narrowOnMouseUpId]);
    }
    dragMovedRef.current = false;
    setDraggingItem(null);
    setResizing(null);
  };

  // Shortcut keyboard: Delete (hapus), Esc (batal pilih), Panah (geser item terpilih)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedItemIds.length === 0) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
      } else if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        handleNudgeSelected(dx, dy);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemIds, handleDeleteSelected, clearSelection, handleNudgeSelected]);

  const selectedItemSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const selectedItems = useMemo(
    () => layoutData.items.filter((i) => selectedItemSet.has(i.id)),
    [layoutData.items, selectedItemSet]
  );
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : undefined;
  const selectedGroupBounds = useMemo(() => {
    if (selectedItems.length < 2) return null;
    const minX = Math.min(...selectedItems.map((i) => i.xMm));
    const minY = Math.min(...selectedItems.map((i) => i.yMm));
    const maxX = Math.max(...selectedItems.map((i) => i.xMm + i.widthMm));
    const maxY = Math.max(...selectedItems.map((i) => i.yMm + i.heightMm));
    return {
      xMm: minX,
      yMm: minY,
      widthMm: maxX - minX,
      heightMm: maxY - minY,
    };
  }, [selectedItems]);

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 1. Header Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl ${
                activePanelMode === "MAIN"
                  ? "bg-blue-600"
                  : activePanelMode === "OUTER"
                    ? "bg-indigo-700"
                    : "bg-violet-600"
              } text-white flex items-center justify-center shadow-sm`}
            >
              {activePanelMode === "OUTER" ? (
                <Box className="w-5 h-5" />
              ) : activePanelMode === "HMI" ? (
                <Monitor className="w-5 h-5" />
              ) : (
                <Layers className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex flex-wrap items-center gap-2">
                {activePanelMode === "MAIN"
                  ? "Layout 2D Panel Kontrol Utama (Panel Dalam)"
                  : activePanelMode === "OUTER"
                    ? "Layout 2D Box Enclosure (Panel Luar)"
                    : "Layout 2D Pintu Panel OP / HMI"}
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    activePanelMode === "MAIN"
                      ? "bg-blue-100 text-blue-700"
                      : activePanelMode === "OUTER"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-violet-100 text-violet-700"
                  }`}
                >
                  {activePanelMode === "MAIN"
                    ? `Mounting Plate ${mainLayoutData.enclosure.widthMm}×${mainLayoutData.enclosure.heightMm}`
                    : activePanelMode === "OUTER"
                      ? `Box ${outerPanelData.enclosure.widthMm}×${outerPanelData.enclosure.heightMm}×${outerPanelData.enclosure.depthMm}`
                      : `OP Door ${hmiLayoutData.enclosure.widthMm}×${hmiLayoutData.enclosure.heightMm}`}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isAutoGenerated
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                  title={
                    isAutoGenerated
                      ? "Disusun otomatis dari daftar komponen PR sesuai standar FR-EG-EP-006 (bebas digeser kapan saja)"
                      : "Tata letak telah disesuaikan manual — tersimpan aman dari sinkronisasi PR otomatis"
                  }
                >
                  {isAutoGenerated ? "Auto PR • FR-EG-EP-006" : "Tata Letak Kustom"}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {activePanelMode === "MAIN"
                  ? "Standar FR-EG-EP-006 Panel Utama: MCCB, Noise Filter, Power Supply, MCB, PLC iQ-R/FX5U, Hub Switch, Relay & Terminal."
                  : activePanelMode === "OUTER"
                    ? "Standar 2D Box Enclosure: Tampak Depan (Lock Door & LOTO Switch) & Tampak Samping (Cooling Fan Louvre & Kedalaman Box)."
                    : "Standar FR-EG-EP-006 Pintu OP: Touchscreen HMI, E-Stop, Matriks Tombol 2×5, Pilot Lamp, Key Switch, Tower Lamp & Fan."}
              </p>
            </div>
          </div>

          {/* Mode Switcher: Panel Dalam vs Panel Luar (Box 2D) vs Pintu OP/HMI */}
          <div className="flex flex-wrap items-center p-1 bg-slate-200/80 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => {
                setActivePanelMode("MAIN");
                clearSelection();
                setTimeout(() => {
                  handleFitToScreen(mainLayoutData.enclosure.widthMm, mainLayoutData.enclosure.heightMm);
                }, 40);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                activePanelMode === "MAIN"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Panel Dalam</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-700">
                {mainLayoutData.items.filter((i) => i.type === "COMPONENT").length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePanelMode("OUTER");
                clearSelection();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                activePanelMode === "OUTER"
                  ? "bg-indigo-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Panel Luar (Box 2D)</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activePanelMode === "OUTER"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-300 text-slate-700"
                }`}
              >
                2D Depan &amp; Samping
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePanelMode("HMI");
                clearSelection();
                setTimeout(() => {
                  handleFitToScreen(hmiLayoutData.enclosure.widthMm, hmiLayoutData.enclosure.heightMm);
                }, 40);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                activePanelMode === "HMI"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Pintu OP / HMI</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activePanelMode === "HMI" ? "bg-violet-500 text-white" : "bg-slate-300 text-slate-700"
                }`}
              >
                {hmiLayoutData.items.filter((i) => i.type === "COMPONENT").length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-white rounded-xl border border-slate-300 p-1 shadow-xs gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(2))))}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
              title="Perkecil Canvas (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold px-1.5 text-slate-700 min-w-[46px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.5, Number((z + 0.1).toFixed(2))))}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
              title="Perbesar Canvas (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {/* Tombol Pas Layar (Fit to Screen) */}
            <button
              type="button"
              onClick={() => handleFitToScreen()}
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer transition border border-slate-200"
              title="Sesuaikan ukuran tampilan dengan layar (Fit to Screen)"
            >
              <Maximize2 className="w-3 h-3 text-blue-600" />
              <span>Pas Layar</span>
            </button>

            {/* Quick Zoom Presets */}
            <div className="hidden sm:flex items-center gap-0.5 border-l border-slate-200 pl-1">
              {(activePanelMode === "MAIN" ? [0.75, 1.0, 1.25] : [1.0, 1.5, 2.0]).map((zVal) => (
                <button
                  key={zVal}
                  type="button"
                  onClick={() => setZoom(zVal)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                    Math.abs(zoom - zVal) < 0.05
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {Math.round(zVal * 100)}%
                </button>
              ))}
            </div>
          </div>

          {/* Auto-Layout PR (FR-EG-EP-006) */}
          <button
            type="button"
            onClick={handleResetToStandard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold transition cursor-pointer shadow-xs"
            title="Susun ulang otomatis semua komponen PR mengikuti template standar FR-EG-EP-006 (tetap bebas digeser manual)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Auto-Layout PR</span>
          </button>

          {/* Export CAD 2D (.DXF AutoCAD) */}
          <button
            type="button"
            onClick={handleExportDxf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition cursor-pointer shadow-xs"
            title="Download file CAD DXF 2D skala 1:1 untuk AutoCAD atau Mesin Laser Cutting"
          >
            <FileCode2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export DXF (AutoCAD)</span>
          </button>

          {/* Cetak / Preview Gambar Kerja (DWG / PDF) */}
          <button
            type="button"
            onClick={() => setCadDrawingModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-300 hover:bg-blue-100 text-blue-800 text-xs font-bold transition cursor-pointer shadow-xs"
            title="Buka gambar kerja teknik resmi Twintech Precision (Kop gambar, toleransi & dimensi) untuk dicetak / PDF"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            <span>Gambar Kerja (PDF)</span>
          </button>

          {/* Unduh Gambar 2D (PNG) */}
          <button
            type="button"
            onClick={handleExportPng}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
            title="Unduh gambar layout 2D resolusi tinggi (PNG)"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Unduh PNG</span>
          </button>

          {/* Simpan Layout */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-md"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccessMsg ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saving ? "Menyimpan..." : saveSuccessMsg ? "Tersimpan!" : "Simpan Layout"}</span>
          </button>
        </div>
      </div>

      {/* TAMPILAN PANEL LUAR (BOX 2D ENCLOSURE) vs PANEL DALAM / OP / HMI */}
      {activePanelMode === "OUTER" ? (
        <div className="p-3">
          <ProjectOuterPanel2DViewer
            outerPanel={outerPanelData}
            onChange={(next) => {
              hasLocalDirtyRef.current = true;
              setIsAutoGenerated(false);
              setOuterPanelData(next);
            }}
            components={components}
            mainWidthMm={mainLayoutData.enclosure.widthMm}
            mainHeightMm={mainLayoutData.enclosure.heightMm}
            projectKode={projectKode}
            projectNama={projectNama}
            projectClient={projectClient}
            projectPic={projectPic}
            onRequestPdf={() => setCadDrawingModalOpen(true)}
          />
        </div>
      ) : (
        <>
          {/* 2. Sub-Toolbar: Dimensi Plat & Status Keterisian */}
      <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Ukuran Plat Dasar:</span>
            <DeferredNumberInput
              value={layoutData.enclosure.widthMm}
              min={150}
              max={3000}
              onCommit={(val) =>
                setLayoutData((prev) => ({
                  ...prev,
                  enclosure: { ...prev.enclosure, widthMm: val },
                }))
              }
              title="Ketik lebar plat (mm) lalu tekan Enter"
              className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-300"
            />
            <span className="text-slate-400">×</span>
            <DeferredNumberInput
              value={layoutData.enclosure.heightMm}
              min={150}
              max={3000}
              onCommit={(val) =>
                setLayoutData((prev) => ({
                  ...prev,
                  enclosure: { ...prev.enclosure, heightMm: val },
                }))
              }
              title="Ketik tinggi plat (mm) lalu tekan Enter"
              className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-300"
            />
            <span className="text-slate-500 font-normal">mm</span>
          </div>

          {/* Quick Enclosure Size Presets */}
          <div className="hidden sm:flex items-center gap-1 text-[11px]">
            <span className="text-slate-400">Preset:</span>
            {(activePanelMode === "MAIN"
              ? [
                  [400, 500],
                  [500, 600],
                  [600, 800],
                  [700, 900],
                  [800, 1000],
                ]
              : activePanelMode === "HMI"
                ? [
                    [300, 250],
                    [430, 440],
                    [500, 400],
                    [600, 400],
                  ]
                : [
                    [300, 250],
                    [350, 300],
                    [400, 350],
                    [450, 400],
                  ]
            ).map(([pw, ph]) => (
              <button
                key={`${pw}x${ph}`}
                type="button"
                onClick={() => {
                  setLayoutData((prev) => ({
                    ...prev,
                    enclosure: { ...prev.enclosure, widthMm: pw, heightMm: ph },
                  }));
                  setTimeout(() => handleFitToScreen(pw, ph), 40);
                }}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  layoutData.enclosure.widthMm === pw && layoutData.enclosure.heightMm === ph
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                {pw}×{ph}
              </button>
            ))}
          </div>

          {/* Toggle Mistar mm (Ruler CAD 1:1) */}
          <button
            type="button"
            onClick={() => setShowRuler((s) => !s)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
              showRuler
                ? "bg-blue-50 text-blue-700 border-blue-200 shadow-xs"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
            title="Tampilkan / Sembunyikan Mistar Milimeter (Membuktikan skala 1:1 presisi)"
          >
            <Ruler className="w-3.5 h-3.5 text-blue-600" />
            <span>Mistar mm: {showRuler ? "Aktif" : "Mati"}</span>
          </button>

          {/* Toggle Magnet & Garis Bantu Simetris (Smart Guide) */}
          <button
            type="button"
            onClick={() => setSmartSnapEnabled((s) => !s)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
              smartSnapEnabled
                ? "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-300 shadow-xs"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
            title="Garis Magnet & Smart Alignment (Snap Otomatis ke Tengah Plat, Tengah Layar HMI, & Sejajar Baris Tombol)"
          >
            <Magnet className={`w-3.5 h-3.5 ${smartSnapEnabled ? "text-fuchsia-600" : "text-slate-400"}`} />
            <span>Magnet: {smartSnapEnabled ? "Aktif" : "Mati"}</span>
          </button>

          {/* Badge Verifikasi Skala 1:1 */}
          <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Skala Presisi: <strong>1 Unit = 1 mm Fisik (1:1 Eksak)</strong></span>
          </div>
        </div>

        {/* Status Keterisian (Fill Ratio) */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Komponen Terpasang:</span>
            <span className="font-extrabold text-blue-600">{fillStats.componentCount} item</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Kepadatan Panel:</span>
            <div className="w-20 bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  fillStats.occupiedPercent > 75
                    ? "bg-rose-500"
                    : fillStats.occupiedPercent > 40
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, fillStats.occupiedPercent)}%` }}
              />
            </div>
            <span
              className={`font-bold ${
                fillStats.occupiedPercent > 75
                  ? "text-rose-600 font-extrabold"
                  : "text-slate-700"
              }`}
            >
              {fillStats.occupiedPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Workspace TERKUNCI (Fixed Height Container + Internal Scroll) */}
      <div className="flex flex-col lg:flex-row h-[760px] max-h-[85vh] overflow-hidden relative">
        {/* Sidebar Kiri: Sub Point Kategori Komponen PR (Tinggi Tetap + Scroll Internal) */}
        <div className="w-full lg:w-92 border-r border-slate-200 bg-slate-50 flex flex-col h-full overflow-hidden shrink-0">
          {/* Tab Switcher */}
          <div className="p-2 border-b border-slate-200 flex items-center gap-1 bg-white shrink-0">
            <button
              type="button"
              onClick={() => setSidebarTab("PR")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
                sidebarTab === "PR"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Komponen PR ({eligiblePRCount})
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("ACCESSORY")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
                sidebarTab === "ACCESSORY"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {activePanelMode === "MAIN" ? "Aksesoris Panel" : "Aksesoris HMI"}
            </button>
          </div>

          {/* TAB 1: Sub Point Komponen PR Proyek (Dengan Scrollbar Vertikal Internal) */}
          {sidebarTab === "PR" && (
            <div className="flex-1 flex flex-col p-2.5 overflow-hidden min-h-0">
              <input
                type="text"
                placeholder="Cari nama part / type..."
                value={searchPR}
                onChange={(e) => setSearchPR(e.target.value)}
                className="w-full px-2.5 py-1.5 mb-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 outline-none shrink-0"
              />

              {/* Informasi pemisahan komponen */}
              {activePanelMode === "MAIN" && (
                <div className="mb-2 px-2.5 py-2 bg-blue-50 border border-blue-200 rounded-xl text-[10px] text-blue-800 leading-relaxed shrink-0">
                  <span className="font-extrabold block mb-0.5">📦 Panel Kontrol Utama</span>
                  Menampilkan komponen DIN Rail elektrikal. <span className="font-bold">Komponen HMI/Operator</span> ada di tab Panel HMI. <span className="font-bold">Fan, sensor &amp; komponen lapangan</span> tidak dimasukkan ke layout plat dasar panel.
                </div>
              )}
              {activePanelMode === "HMI" && (
                <div className="mb-2 px-2.5 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-[10px] text-indigo-800 leading-relaxed shrink-0">
                  <span className="font-extrabold block mb-0.5">🖥️ Panel HMI / Box Operator</span>
                  Hanya komponen pintu/OP panel: HMI, Push Button, E-Stop, Key Switch, Pilot Lamp, Buzzer. Komponen panel utama & sensor dikecualikan.
                </div>
              )}

              {/* Area Sub Point Accordion (Scrollbar Internal Tanpa Merusak Layout) */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 pb-2">
                {(activePanelMode === "HMI" ? HMI_CATEGORY_GROUPS : CATEGORY_GROUPS)
                  .filter((cat) => cat.key !== "OTHER") // Sembunyikan grup "Lainnya" karena berisi sensor/non-relevan
                  .map((cat) => {
                  const itemsInCat = groupedPR[cat.key] || [];
                  if (itemsInCat.length === 0) return null;

                  const isExpanded = !!expandedCategories[cat.key];
                  const Icon = cat.icon;

                  const totalPlacedInCat = itemsInCat.reduce(
                    (sum, c) => sum + (placedCountMap[c.id] || 0),
                    0
                  );
                  const totalQtyInCat = itemsInCat.reduce((sum, c) => sum + c.qty, 0);

                  return (
                    <div
                      key={cat.key}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs"
                    >
                      {/* Sub Point Header (Klik untuk buka/tutup) */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.key)}
                        className="w-full px-3 py-2 flex items-center justify-between gap-2 bg-slate-50/90 hover:bg-slate-100 border-b border-slate-100 transition cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )}
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${cat.badgeBg}`}
                          >
                            <Icon className={`w-3.5 h-3.5 ${cat.badgeText}`} />
                          </div>
                          <span className="font-extrabold text-xs text-slate-800 truncate">
                            {cat.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                              totalPlacedInCat >= totalQtyInCat
                                ? "bg-emerald-100 text-emerald-700"
                                : totalPlacedInCat > 0
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {totalPlacedInCat}/{totalQtyInCat}
                          </span>
                        </div>
                      </button>

                      {/* Sub Point Items List (Compact & Ringkas) */}
                      {isExpanded && (
                        <div className="divide-y divide-slate-100">
                          {itemsInCat.map((comp) => {
                            const placed = placedCountMap[comp.id] || 0;
                            const isFullyPlaced = placed >= comp.qty;
                            const visual = inferComponentVisual(comp.partType, comp.partName);

                            return (
                              <div
                                key={comp.id}
                                className={`px-3 py-1.5 flex items-center justify-between gap-2 transition hover:bg-slate-50 ${
                                  isFullyPlaced ? "bg-slate-50/50" : ""
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        isFullyPlaced
                                          ? "bg-emerald-500"
                                          : placed > 0
                                            ? "bg-blue-500"
                                            : "bg-slate-300"
                                      }`}
                                    />
                                    <span
                                      className="font-bold text-xs text-slate-900 truncate"
                                      title={comp.partName}
                                    >
                                      {comp.partName}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono truncate pl-3">
                                    {comp.partType}{" "}
                                    <span className="text-blue-600 font-bold">
                                      [{visual.widthMm}×{visual.heightMm}mm]
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Badge Terpasang */}
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[28px] text-center ${
                                      isFullyPlaced
                                        ? "bg-emerald-100 text-emerald-800 font-extrabold"
                                        : placed > 0
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {placed}/{comp.qty}
                                  </span>

                                  {/* Tombol Hapus Part dari Panel (Jika sudah dimasukkan) */}
                                  {placed > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveComponentFromPR(comp.id)}
                                      className="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer border border-rose-200"
                                      title="Keluarkan / Hapus 1 unit part ini dari panel"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Tombol Pasang Part ke Panel */}
                                  <button
                                    type="button"
                                    onClick={() => handleAddComponentFromPR(comp)}
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition cursor-pointer ${
                                      isFullyPlaced
                                        ? "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                                    }`}
                                    title="Tambahkan part ini ke dalam panel"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Aksesoris Panel (Kabel Duct & DIN Rail Configurator untuk Main, atau Aksesoris HMI) */}
          {sidebarTab === "ACCESSORY" && (
            <div className="p-3 space-y-4 overflow-y-auto flex-1 text-xs">
              {activePanelMode === "HMI" ? (
                /* KATALOG AKSESORIS HMI & OPERATOR CONSOLE */
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 p-2.5 rounded-xl">
                    <div className="font-extrabold text-indigo-900 text-xs flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                      Komponen &amp; Aksesoris HMI / Box OP
                    </div>
                    <div className="text-[10px] text-indigo-700 mt-0.5 leading-tight">
                      Standar industri cutout Ø22mm, layar touchscreen GOT, E-Stop safety, dan push button kontrol.
                    </div>
                  </div>

                  {HMI_ACCESSORIES_CATALOG.map((group) => (
                    <div key={group.group} className="space-y-1.5">
                      <div className="text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                        <span>{group.group}</span>
                        <span className="text-[9.5px] text-slate-400 font-normal">
                          {group.items.length} item
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {group.items.map((acc) => (
                          <div
                            key={acc.id}
                            className="p-2.5 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl transition shadow-2xs space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-slate-800 text-[11px] leading-tight truncate">
                                  {acc.name}
                                </div>
                                <div className="text-[9.5px] text-slate-500 mt-0.5">
                                  {acc.description}
                                </div>
                              </div>
                              <span
                                className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                  acc.category === "EMERGENCY_STOP"
                                    ? "bg-rose-100 text-rose-700"
                                    : acc.category === "HMI"
                                      ? "bg-indigo-100 text-indigo-700"
                                      : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {acc.badge}
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="text-[10px] font-mono font-bold text-indigo-700">
                                {acc.widthMm} × {acc.heightMm} mm
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddHmiAccessory(acc)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Pasang ke HMI</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* KATALOG AKSESORIS PANEL UTAMA (KABEL DUCT & DIN RAIL) */
                <>
                  {/* SECTION 1: WIRING KABEL DUCT BUILDER */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                        <Cable className="w-3.5 h-3.5 text-blue-600" />
                        Wiring Duct (Kabel Duct PVC)
                      </span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">
                        Ukuran Bebas
                      </span>
                    </div>

                    {/* A. Pilihan Profil Ukuran Penampang Duct */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-700">
                          1. Pilih Ukuran Profil Duct:
                        </label>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {selectedDuctProfile}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {DUCT_PROFILES.map((prof) => (
                          <button
                            key={prof.code}
                            type="button"
                            onClick={() => setSelectedDuctProfile(prof.code)}
                            className={`p-2 rounded-lg border text-left cursor-pointer transition ${
                              selectedDuctProfile === prof.code
                                ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-xs"
                                : "bg-slate-50/80 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 text-xs">{prof.name}</span>
                              <span
                                className={`text-[8.5px] font-bold px-1 py-0.2 rounded ${
                                  prof.code === "45x65" || prof.code === "32x32"
                                    ? "bg-amber-100 text-amber-800"
                                    : "text-slate-500"
                                }`}
                              >
                                {prof.badge}
                              </span>
                            </div>
                            <div className="text-[9.5px] text-slate-500 leading-tight truncate mt-0.5">
                              {prof.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* B. Orientasi Duct (Horizontal / Vertikal) */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">
                          2. Arah Orientasi:
                        </label>
                        <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setDuctOrientation("HORIZONTAL");
                              setCustomDuctLength(layoutData.enclosure.widthMm - 140);
                            }}
                            className={`px-2.5 py-1 rounded text-center text-[10px] font-bold cursor-pointer transition ${
                              ductOrientation === "HORIZONTAL"
                                ? "bg-white text-blue-700 shadow-xs font-extrabold"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            Horizontal (↔)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDuctOrientation("VERTICAL");
                              setCustomDuctLength(layoutData.enclosure.heightMm - 140);
                            }}
                            className={`px-2.5 py-1 rounded text-center text-[10px] font-bold cursor-pointer transition ${
                              ductOrientation === "VERTICAL"
                                ? "bg-white text-blue-700 shadow-xs font-extrabold"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            Vertikal (↕)
                          </button>
                        </div>
                      </div>

                      {/* C. Setting Panjang Kabel Duct Manual (mm) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-700">
                            3. Setting Panjang Duct (mm):
                          </label>
                          <span className="text-[10px] text-blue-600 font-bold">
                            Panjang: {customDuctLength} mm
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <DeferredNumberInput
                            min={20}
                            max={2500}
                            value={customDuctLength}
                            onCommit={(val) => setCustomDuctLength(val)}
                            className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-900 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                          <span className="text-slate-500 font-medium">mm</span>

                          <button
                            type="button"
                            onClick={() =>
                              setCustomDuctLength(
                                ductOrientation === "HORIZONTAL"
                                  ? layoutData.enclosure.widthMm - 140
                                  : layoutData.enclosure.heightMm - 140
                              )
                            }
                            className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer text-center"
                            title="Sesuaikan panjang penuh sesuai ukuran plat panel"
                          >
                            Penuh Panel
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomDuctLength((l) => Math.max(30, l - 50))}
                            className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                            title="Kurang 50mm"
                          >
                            -50
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomDuctLength((l) => l + 50)}
                            className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                            title="Tambah 50mm"
                          >
                            +50
                          </button>
                        </div>
                      </div>

                      {/* Tombol Eksekusi Tambah Kabel Duct */}
                      <button
                        type="button"
                        onClick={handleAddCustomDuct}
                        className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          + Pasang Duct ({selectedDuctProfile} • L: {customDuctLength} mm)
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION 2: DIN RAIL TS35 */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                        <Maximize2 className="w-3.5 h-3.5 text-amber-600" />
                        DIN Rail 35mm (TS35 Standar)
                      </span>
                      <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">
                        Rel Mounting
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-700">Panjang Rel:</label>
                      <DeferredNumberInput
                        min={30}
                        max={2500}
                        value={customDinRailLength}
                        onCommit={(val) => setCustomDinRailLength(val)}
                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-900 text-xs"
                      />
                      <span className="text-slate-500">mm</span>
                      <button
                        type="button"
                        onClick={() => setCustomDinRailLength(layoutData.enclosure.widthMm - 160)}
                        className="flex-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer text-center"
                      >
                        Penuh ({layoutData.enclosure.widthMm - 160} mm)
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCustomDinRail}
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Pasang DIN Rail ({customDinRailLength} mm)</span>
                    </button>
                  </div>

                  {/* SECTION 3: AKSESORIS LAINNYA */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Terminal Strip &amp; Aksesoris
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddAccessory("COMPONENT", "Terminal Block 10P", 70, 45)}
                        className="p-2 bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-left cursor-pointer shadow-xs transition"
                      >
                        <div className="font-bold text-slate-800 truncate">Terminal 10P</div>
                        <div className="text-[10px] text-slate-400">70 × 45 mm (TBD-10A)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAccessory("COMPONENT", "Stop Kontak Uticon", 45, 75)}
                        className="p-2 bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-left cursor-pointer shadow-xs transition"
                      >
                        <div className="font-bold text-slate-800 truncate">Stop Kontak DIN Rail</div>
                        <div className="text-[10px] text-slate-400">45 × 75 mm (Uticon)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAccessory("COMPONENT", "Grounding Busbar Cu", 200, 15)}
                        className="p-2 bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-left cursor-pointer shadow-xs transition"
                      >
                        <div className="font-bold text-slate-800 truncate">Ground Busbar</div>
                        <div className="text-[10px] text-slate-400">200 × 15 mm</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAccessory("COMPONENT", "Cooling Fan 120", 120, 120)}
                        className="p-2 bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-left cursor-pointer shadow-xs transition"
                      >
                        <div className="font-bold text-slate-800 truncate">Cooling Fan 120mm</div>
                        <div className="text-[10px] text-slate-400">120 × 120 mm</div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Area Canvas Utama (Tinggi Tetap + Interactive SVG) */}
        <div
          ref={containerRef}
          className={`flex-1 bg-slate-900 p-6 overflow-auto flex items-center justify-center relative select-none h-full transition-all duration-200 ${
            hasSelection ? "lg:pr-84" : ""
          }`}
          onClick={(e) => {
            if (e.target === containerRef.current && !e.ctrlKey && !e.metaKey) {
              clearSelection();
            }
          }}
        >
          {/* Petunjuk Penggunaan Cepat */}
          <div className="absolute top-3 left-3 z-10 bg-slate-800/90 text-slate-300 text-[11px] px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2 backdrop-blur-xs shadow-md">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>
              Klik part untuk ubah posisi/hapus • <strong>Ctrl + Klik Kiri</strong> untuk pilih beberapa item • <strong>Ctrl + Scroll Mouse</strong> untuk zoom
            </span>
          </div>

          {/* SVG Canvas Gambar 2D Panel */}
          <div
            style={{
              width: layoutData.enclosure.widthMm * zoom,
              height: layoutData.enclosure.heightMm * zoom,
              position: "relative",
            }}
            className="transition-transform duration-75 shadow-2xl shrink-0"
          >
            <svg
              ref={canvasRef}
              viewBox={`0 0 ${layoutData.enclosure.widthMm} ${layoutData.enclosure.heightMm}`}
              className="w-full h-full block rounded-lg overflow-visible"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Pattern Grid Millimeter (Garis bantu 20mm & 100mm) */}
                <pattern id="grid-20" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                </pattern>
                <pattern id="grid-100" width="100" height="100" patternUnits="userSpaceOnUse">
                  <rect width="100" height="100" fill="url(#grid-20)" />
                  <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                </pattern>

                {/* Pattern Lubang Finger Slot Kabel Duct */}
                <pattern
                  id="duct-slots-h"
                  width="12"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <rect x="1" y="2" width="4" height="36" rx="2" fill="#334155" />
                </pattern>
                <pattern
                  id="duct-slots-v"
                  width="40"
                  height="12"
                  patternUnits="userSpaceOnUse"
                >
                  <rect x="2" y="1" width="36" height="4" rx="2" fill="#334155" />
                </pattern>

                {/* Pattern Lubang Rel DIN 35mm Horizontal */}
                <pattern
                  id="din-rail-slots"
                  width="30"
                  height="35"
                  patternUnits="userSpaceOnUse"
                >
                  <rect
                    x="8"
                    y="13"
                    width="14"
                    height="9"
                    rx="4.5"
                    fill="#64748b"
                    opacity="0.8"
                  />
                </pattern>

                {/* Pattern Lubang Rel DIN 35mm Vertikal (Mounting OP Panel) */}
                <pattern
                  id="din-rail-slots-v"
                  width="35"
                  height="30"
                  patternUnits="userSpaceOnUse"
                >
                  <rect
                    x="13"
                    y="8"
                    width="9"
                    height="14"
                    rx="4.5"
                    fill="#64748b"
                    opacity="0.8"
                  />
                </pattern>
              </defs>

              {/* 1. Plat Dasar Panel (Mounting Plate Enclosure / Box Operator HMI / OP Mounting) */}
              {activePanelMode === "HMI" ? (
                /* Box Operator / Front Door HMI Panel (430 × 440 mm standar FR-EG-EP-006) */
                <g
                  id="hmi-door-enclosure"
                  onClick={(e) => {
                    if (!e.ctrlKey && !e.metaKey) clearSelection();
                  }}
                >
                  {/* Bevel Rim Luar Box Panel */}
                  <rect
                    x="0"
                    y="0"
                    width={layoutData.enclosure.widthMm}
                    height={layoutData.enclosure.heightMm}
                    fill="#334155"
                    stroke="#1e293b"
                    strokeWidth="3"
                    rx="10"
                  />
                  {/* Permukaan Pintu Powder Coated Industrial (RAL 7035 / Dark Slate) */}
                  <rect
                    x="8"
                    y="8"
                    width={layoutData.enclosure.widthMm - 16}
                    height={layoutData.enclosure.heightMm - 16}
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth="2"
                    rx="6"
                  />
                  {/* Grid Millimeter tipis untuk panduan tata letak */}
                  <rect
                    x="8"
                    y="8"
                    width={layoutData.enclosure.widthMm - 16}
                    height={layoutData.enclosure.heightMm - 16}
                    fill="url(#grid-100)"
                    opacity="0.15"
                  />
                  {/* Inner Chamfer Bevel Pintu */}
                  <rect
                    x="16"
                    y="16"
                    width={layoutData.enclosure.widthMm - 32}
                    height={layoutData.enclosure.heightMm - 32}
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    rx="4"
                  />

                  {/* Baut Allen Segienam di 4 Sudut Pintu Box */}
                  {[
                    [16, 16],
                    [layoutData.enclosure.widthMm - 16, 16],
                    [16, layoutData.enclosure.heightMm - 16],
                    [layoutData.enclosure.widthMm - 16, layoutData.enclosure.heightMm - 16],
                  ].map(([cx, cy], idx) => (
                    <g key={`bolt-${idx}`}>
                      <circle cx={cx} cy={cy} r="6" fill="#475569" stroke="#0f172a" strokeWidth="1.2" />
                      <circle cx={cx} cy={cy} r="3" fill="#0f172a" />
                      <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke="#64748b" strokeWidth="0.8" />
                    </g>
                  ))}

                  {/* Kunci Cam Lock Pintu (Quarter-Turn Latch di sisi kanan / tengah samping) */}
                  <g transform={`translate(${layoutData.enclosure.widthMm - 14}, ${layoutData.enclosure.heightMm / 2})`}>
                    <circle cx="0" cy="0" r="7" fill="#64748b" stroke="#0f172a" strokeWidth="1.5" />
                    <circle cx="0" cy="0" r="3.5" fill="#334155" />
                    <rect x="-1" y="-5" width="2" height="10" fill="#0f172a" rx="1" />
                  </g>

                  {/* Header Title Box Operator */}
                  <text
                    x={layoutData.enclosure.widthMm / 2}
                    y="24"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="extrabold"
                    fill="#94a3b8"
                    letterSpacing="1"
                  >
                    PT. TWINTECH — OP / HMI PANEL DOOR {layoutData.enclosure.widthMm} ×{" "}
                    {layoutData.enclosure.heightMm} MM
                  </text>
                </g>
              ) : (
                /* Mounting Plate Internal (Main Panel 600×800 atau OP Mounting Plate 350×300) */
                <>
                  <rect
                    x="0"
                    y="0"
                    width={layoutData.enclosure.widthMm}
                    height={layoutData.enclosure.heightMm}
                    fill={activePanelMode === "OP_MOUNTING" ? "#f1f5f9" : "#f8fafc"}
                    stroke="#64748b"
                    strokeWidth="2"
                    rx="6"
                  />
                  <rect
                    x="0"
                    y="0"
                    width={layoutData.enclosure.widthMm}
                    height={layoutData.enclosure.heightMm}
                    fill="url(#grid-100)"
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey) clearSelection();
                    }}
                  />

                  {/* Baut Sudut Plat Mounting Panel (4 Corner Screws) */}
                  <circle cx="15" cy="15" r="5" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
                  <circle
                    cx={layoutData.enclosure.widthMm - 15}
                    cy="15"
                    r="5"
                    fill="#94a3b8"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="15"
                    cy={layoutData.enclosure.heightMm - 15}
                    r="5"
                    fill="#94a3b8"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={layoutData.enclosure.widthMm - 15}
                    cy={layoutData.enclosure.heightMm - 15}
                    r="5"
                    fill="#94a3b8"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />

                  {/* Label Ukuran Plat Panel di Header Dalam */}
                  <text
                    x={layoutData.enclosure.widthMm / 2}
                    y="22"
                    textAnchor="middle"
                    fontSize={activePanelMode === "OP_MOUNTING" ? "8.5" : "10.5"}
                    fontWeight="bold"
                    fill="#64748b"
                  >
                    {activePanelMode === "OP_MOUNTING"
                      ? `MOUNTING OP PANEL ${layoutData.enclosure.widthMm} × ${layoutData.enclosure.heightMm} MM (FR-EG-EP-006)`
                      : `PT. TWINTECH — MOUNTING PLATE ${layoutData.enclosure.widthMm} × ${layoutData.enclosure.heightMm} MM (SKALA 1:1)`}
                  </text>
                </>
              )}

              {/* Tampilkan Mistar Ukuran Milimeter (X & Y Axis CAD Rulers) */}
              {showRuler && (
                <g id="panel-rulers" opacity="0.95" pointerEvents="none">
                  {/* Mistar Atas (Sumbu X: 0 .. widthMm) */}
                  <rect
                    x="0"
                    y="0"
                    width={layoutData.enclosure.widthMm}
                    height="14"
                    fill="#f1f5f9"
                    stroke="#94a3b8"
                    strokeWidth="0.8"
                  />
                  {Array.from({
                    length: Math.floor(layoutData.enclosure.widthMm / 10) + 1,
                  }).map((_, idx) => {
                    const x = idx * 10;
                    const is100 = x % 100 === 0;
                    const is50 = x % 50 === 0 && !is100;
                    const tickH = is100 ? 13 : is50 ? 8 : 4;
                    return (
                      <g key={`rx-${x}`}>
                        <line
                          x1={x}
                          y1={14 - tickH}
                          x2={x}
                          y2="14"
                          stroke={is100 ? "#0f172a" : is50 ? "#475569" : "#94a3b8"}
                          strokeWidth={is100 ? 1.2 : is50 ? 0.8 : 0.5}
                        />
                        {is100 && (
                          <text
                            x={x + 2}
                            y="9"
                            fontSize="6.5"
                            fill="#1e293b"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {x}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Mistar Kiri (Sumbu Y: 0 .. heightMm) */}
                  <rect
                    x="0"
                    y="0"
                    width="14"
                    height={layoutData.enclosure.heightMm}
                    fill="#f1f5f9"
                    stroke="#94a3b8"
                    strokeWidth="0.8"
                  />
                  {Array.from({
                    length: Math.floor(layoutData.enclosure.heightMm / 10) + 1,
                  }).map((_, idx) => {
                    const y = idx * 10;
                    const is100 = y % 100 === 0;
                    const is50 = y % 50 === 0 && !is100;
                    const tickW = is100 ? 13 : is50 ? 8 : 4;
                    return (
                      <g key={`ry-${y}`}>
                        <line
                          x1={14 - tickW}
                          y1={y}
                          x2="14"
                          y2={y}
                          stroke={is100 ? "#0f172a" : is50 ? "#475569" : "#94a3b8"}
                          strokeWidth={is100 ? 1.2 : is50 ? 0.8 : 0.5}
                        />
                        {is100 && (
                          <text
                            x="2"
                            y={y + 7.5}
                            fontSize="6"
                            fill="#1e293b"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {y}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Kotak Sudut 0,0 mm */}
                  <rect x="0" y="0" width="14" height="14" fill="#2563eb" />
                  <text
                    x="7"
                    y="10"
                    textAnchor="middle"
                    fontSize="6.5"
                    fill="#ffffff"
                    fontWeight="extrabold"
                  >
                    mm
                  </text>

                  {/* Highlight Indikator Posisi Item Terpilih pada Mistar */}
                  {selectedItem && (
                    <>
                      <rect
                        x={selectedItem.xMm}
                        y="0"
                        width={selectedItem.widthMm}
                        height="14"
                        fill="#3b82f6"
                        fillOpacity="0.35"
                        stroke="#2563eb"
                        strokeWidth="1"
                      />
                      <rect
                        x="0"
                        y={selectedItem.yMm}
                        width="14"
                        height={selectedItem.heightMm}
                        fill="#3b82f6"
                        fillOpacity="0.35"
                        stroke="#2563eb"
                        strokeWidth="1"
                      />
                    </>
                  )}
                </g>
              )}

              {/* 2. Render Elemen Panel (Kabel Duct & DIN Rail) */}
              {layoutData.items
                .filter((i) => i.type !== "COMPONENT")
                .map((it) => {
                  const isSelected = selectedItemSet.has(it.id);
                  const isSingleSelected = selectedItemIds.length === 1 && isSelected;

                  if (it.type === "DUCT_HORIZONTAL") {
                    return (
                      <g
                        key={it.id}
                        transform={`translate(${it.xMm}, ${it.yMm})`}
                        onMouseDown={(e) => handleMouseDownItem(e, it)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-move"
                      >
                        <rect
                          x="0"
                          y="0"
                          width={it.widthMm}
                          height={it.heightMm}
                          fill="#475569"
                          stroke={isSelected ? "#3b82f6" : "#1e293b"}
                          strokeWidth={isSelected ? 2 : 1}
                          rx="2"
                        />
                        <rect
                          x="0"
                          y="0"
                          width={it.widthMm}
                          height={it.heightMm}
                          fill="url(#duct-slots-h)"
                        />
                        <text
                          x={it.widthMm / 2}
                          y={it.heightMm / 2 + 3}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#cbd5e1"
                          fontWeight="bold"
                        >
                          {it.tagLabel || "DUCT"}
                        </text>

                        {/* Tombol Hapus Cepat (X) saat dipilih */}
                        {isSingleSelected && (
                          <g
                            transform={`translate(${it.widthMm - 12}, -8)`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(it.id);
                            }}
                            className="cursor-pointer"
                          >
                            <circle cx="8" cy="8" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                            <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                          </g>
                        )}

                        {/* Resize Handles (Tarik Panjang Kiri / Kanan) */}
                        {isSingleSelected && (
                          <>
                            <circle
                              cx="0"
                              cy={it.heightMm / 2}
                              r="6"
                              fill="#3b82f6"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="cursor-ew-resize"
                              onMouseDown={(e) => handleStartResize(e, "ITEM", "LEFT", it.id)}
                            />
                            <circle
                              cx={it.widthMm}
                              cy={it.heightMm / 2}
                              r="6"
                              fill="#3b82f6"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="cursor-ew-resize"
                              onMouseDown={(e) => handleStartResize(e, "ITEM", "RIGHT", it.id)}
                            />
                          </>
                        )}
                      </g>
                    );
                  }

                  if (it.type === "DUCT_VERTICAL") {
                    return (
                      <g
                        key={it.id}
                        transform={`translate(${it.xMm}, ${it.yMm})`}
                        onMouseDown={(e) => handleMouseDownItem(e, it)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-move"
                      >
                        <rect
                          x="0"
                          y="0"
                          width={it.widthMm}
                          height={it.heightMm}
                          fill="#475569"
                          stroke={isSelected ? "#3b82f6" : "#1e293b"}
                          strokeWidth={isSelected ? 2 : 1}
                          rx="2"
                        />
                        <rect
                          x="0"
                          y="0"
                          width={it.widthMm}
                          height={it.heightMm}
                          fill="url(#duct-slots-v)"
                        />

                        {isSingleSelected && (
                          <g
                            transform={`translate(${it.widthMm - 6}, -8)`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(it.id);
                            }}
                            className="cursor-pointer"
                          >
                            <circle cx="8" cy="8" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                            <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                          </g>
                        )}

                        {isSingleSelected && (
                          <>
                            <circle
                              cx={it.widthMm / 2}
                              cy="0"
                              r="6"
                              fill="#3b82f6"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="cursor-ns-resize"
                              onMouseDown={(e) => handleStartResize(e, "ITEM", "TOP", it.id)}
                            />
                            <circle
                              cx={it.widthMm / 2}
                              cy={it.heightMm}
                              r="6"
                              fill="#3b82f6"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="cursor-ns-resize"
                              onMouseDown={(e) => handleStartResize(e, "ITEM", "BOTTOM", it.id)}
                            />
                          </>
                        )}
                      </g>
                    );
                  }

                  if (it.type === "DIN_RAIL") {
                    const isVerticalRail = it.heightMm > it.widthMm;
                    return (
                      <g
                        key={it.id}
                        transform={`translate(${it.xMm}, ${it.yMm})`}
                        onMouseDown={(e) => handleMouseDownItem(e, it)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-move"
                      >
                        <rect
                          x="0"
                          y="0"
                          width={it.widthMm}
                          height={it.heightMm}
                          fill="#cbd5e1"
                          stroke={isSelected ? "#3b82f6" : "#94a3b8"}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                        {isVerticalRail ? (
                          <>
                            <line x1="6" y1="0" x2="6" y2={it.heightMm} stroke="#94a3b8" strokeWidth="1" />
                            <line
                              x1={it.widthMm - 6}
                              y1="0"
                              x2={it.widthMm - 6}
                              y2={it.heightMm}
                              stroke="#94a3b8"
                              strokeWidth="1"
                            />
                            <rect
                              x="0"
                              y="0"
                              width={it.widthMm}
                              height={it.heightMm}
                              fill="url(#din-rail-slots-v)"
                            />
                          </>
                        ) : (
                          <>
                            <line x1="0" y1="6" x2={it.widthMm} y2="6" stroke="#94a3b8" strokeWidth="1" />
                            <line
                              x1="0"
                              y1={it.heightMm - 6}
                              x2={it.widthMm}
                              y2={it.heightMm - 6}
                              stroke="#94a3b8"
                              strokeWidth="1"
                            />
                            <rect
                              x="0"
                              y="0"
                              width={it.widthMm}
                              height={it.heightMm}
                              fill="url(#din-rail-slots)"
                            />
                          </>
                        )}

                        {isSingleSelected && (
                          <g
                            transform={`translate(${it.widthMm - 10}, -8)`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(it.id);
                            }}
                            className="cursor-pointer"
                          >
                            <circle cx="8" cy="8" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                            <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                          </g>
                        )}

                        {isSingleSelected &&
                          (isVerticalRail ? (
                            <>
                              <circle
                                cx={it.widthMm / 2}
                                cy="0"
                                r="6"
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth="1.5"
                                className="cursor-ns-resize"
                                onMouseDown={(e) => handleStartResize(e, "ITEM", "TOP", it.id)}
                              />
                              <circle
                                cx={it.widthMm / 2}
                                cy={it.heightMm}
                                r="6"
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth="1.5"
                                className="cursor-ns-resize"
                                onMouseDown={(e) => handleStartResize(e, "ITEM", "BOTTOM", it.id)}
                              />
                            </>
                          ) : (
                            <>
                              <circle
                                cx="0"
                                cy={it.heightMm / 2}
                                r="6"
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth="1.5"
                                className="cursor-ew-resize"
                                onMouseDown={(e) => handleStartResize(e, "ITEM", "LEFT", it.id)}
                              />
                              <circle
                                cx={it.widthMm}
                                cy={it.heightMm / 2}
                                r="6"
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth="1.5"
                                className="cursor-ew-resize"
                                onMouseDown={(e) => handleStartResize(e, "ITEM", "RIGHT", it.id)}
                              />
                            </>
                          ))}
                      </g>
                    );
                  }

                  return null;
                })}

              {/* 3. Render Komponen Listrik 2D Standar FR-EG-EP-006 (z-order: Base Rack & Socket di lapisan belakang) */}
              {layoutData.items
                .filter((i) => i.type === "COMPONENT")
                .sort((a, b) => {
                  const backModels = new Set([
                    "PLC_BASE_RACK",
                    "RELAY_SOCKET_SLIM",
                    "RELAY_SOCKET_STD",
                    "GROUND_BUSBAR",
                  ]);
                  const aBack = a.specificModel && backModels.has(a.specificModel) ? 0 : 1;
                  const bBack = b.specificModel && backModels.has(b.specificModel) ? 0 : 1;
                  return aBack - bBack;
                })
                .map((it) => {
                  const isSelected = selectedItemSet.has(it.id);
                  const isSingleSelected = selectedItemIds.length === 1 && isSelected;
                  const isRoundDoorItem = [
                    "EMERGENCY_STOP",
                    "PUSH_BUTTON",
                    "SELECTOR_SWITCH",
                    "PILOT_LAMP",
                    "BUZZER",
                    "MAIN_SWITCH",
                  ].includes(it.category);

                  return (
                    <g
                      key={it.id}
                      transform={`translate(${it.xMm}, ${it.yMm})`}
                      onMouseDown={(e) => handleMouseDownItem(e, it)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-move group"
                    >
                      {/* Base Box Komponen (Untuk komponen rectangular mounting plate / HMI / Tower) */}
                      {!isRoundDoorItem && (
                        <rect
                          x="0"
                          y="0"
                          width={it.widthMm}
                          height={it.heightMm}
                          fill={
                            it.specificModel === "PLC_BASE_RACK"
                              ? "#334155"
                              : it.specificModel === "SERVO_DRIVE_E_DFAS"
                                ? "#0f172a"
                                : it.category === "PLC"
                                  ? it.specificModel?.startsWith("PLC_")
                                    ? "#1e293b"
                                    : "#ffffff"
                                : it.category === "POWER_SUPPLY" || it.category === "HUB_SWITCH"
                                  ? "#1e293b"
                                  : it.category === "MCCB"
                                    ? "#f8fafc"
                                    : it.category === "MCB" || it.category === "CONTACTOR"
                                      ? "#ffffff"
                                      : it.category === "RELAY"
                                        ? "#1e293b"
                                        : it.category === "SAFETY_RELAY"
                                          ? "#facc15"
                                          : it.category === "NOISE_FILTER" || it.category === "FAN"
                                            ? "#e2e8f0"
                                            : it.category === "HMI"
                                              ? "#0f172a"
                                              : it.category === "TOWER_LAMP"
                                                ? "#1e293b"
                                                : "#ffffff"
                          }
                          stroke={
                            isSelected
                              ? "#2563eb"
                              : it.category === "PLC"
                                ? "#3b82f6"
                                : it.category === "POWER_SUPPLY" || it.category === "HUB_SWITCH"
                                  ? "#0f172a"
                                  : it.category === "MCB" || it.category === "MCCB"
                                    ? "#64748b"
                                    : it.category === "SAFETY_RELAY"
                                      ? "#ca8a04"
                                      : it.category === "HMI"
                                        ? "#334155"
                                        : "#475569"
                          }
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          rx={it.category === "HMI" ? 5 : 3}
                          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"
                        />
                      )}

                      {/* Detail Visual: PLC (Mitsubishi MELSEC iQ-R Modular / FX5U) */}
                      {it.category === "PLC" &&
                        (it.specificModel === "PLC_BASE_RACK" ? (
                          <>
                            <rect x="3" y="4" width={it.widthMm - 6} height="8" fill="#1e293b" rx="1" />
                            <rect x="3" y={it.heightMm - 12} width={it.widthMm - 6} height="8" fill="#1e293b" rx="1" />
                            {[0.18, 0.34, 0.5, 0.66, 0.82].map((ratio, rIdx) => (
                              <line
                                key={rIdx}
                                x1={it.widthMm * ratio}
                                y1="14"
                                x2={it.widthMm * ratio}
                                y2={it.heightMm - 14}
                                stroke="#64748b"
                                strokeWidth="1"
                                strokeDasharray="3,2"
                              />
                            ))}
                            <text
                              x={it.widthMm / 2}
                              y={it.heightMm - 5.5}
                              textAnchor="middle"
                              fontSize="6"
                              fill="#94a3b8"
                              fontWeight="bold"
                            >
                              {it.tagLabel || "R35B BASE RACK"}
                            </text>
                          </>
                        ) : it.specificModel === "SERVO_DRIVE_E_DFAS" ? (
                          <>
                            {/* Top heatsink / louver vents */}
                            <rect x="3" y="3" width={it.widthMm - 6} height="13" fill="#1e293b" rx="1" />
                            {[5.5, 8.5, 11.5].map((vy) => (
                              <line
                                key={vy}
                                x1="6"
                                y1={vy}
                                x2={it.widthMm - 6}
                                y2={vy}
                                stroke="#475569"
                                strokeWidth="1.2"
                              />
                            ))}
                            {/* Brand & Model header */}
                            <rect x="3" y="18" width={it.widthMm - 6} height="12" fill="#facc15" rx="1" />
                            <text
                              x={it.widthMm / 2}
                              y="23.5"
                              textAnchor="middle"
                              fontSize="4.3"
                              fill="#0f172a"
                              fontWeight="bold"
                            >
                              MISUMI
                            </text>
                            <text
                              x={it.widthMm / 2}
                              y="28.5"
                              textAnchor="middle"
                              fontSize="4.1"
                              fill="#0f172a"
                              fontWeight="bold"
                            >
                              E-DFAS04P
                            </text>
                            {/* Digital 7-seg operator panel */}
                            <rect x="5" y="33" width={it.widthMm - 10} height="16" fill="#020617" stroke="#334155" strokeWidth="0.8" rx="1" />
                            <text
                              x={it.widthMm / 2}
                              y="44"
                              textAnchor="middle"
                              fontSize="7"
                              fill="#22c55e"
                              fontWeight="bold"
                              fontFamily="monospace"
                            >
                              r 000
                            </text>
                            {/* Operator keypad keys */}
                            {[6, 13.5, 21, 28.5].map((kx) => (
                              <rect key={kx} x={kx} y="52" width="5.5" height="5.5" fill="#475569" rx="0.8" />
                            ))}
                            {/* PWR / ALM LEDs */}
                            <circle cx="11" cy="63" r="1.8" fill="#22c55e" />
                            <text x="15" y="64.5" fontSize="3.6" fill="#94a3b8" fontWeight="bold">
                              PWR
                            </text>
                            <circle cx="26" cy="63" r="1.8" fill="#64748b" />
                            <text x="30" y="64.5" fontSize="3.6" fill="#94a3b8" fontWeight="bold">
                              ALM
                            </text>
                            {/* CN1 / RS485 Bus connector */}
                            <rect x="6" y="70" width={it.widthMm - 12} height="36" fill="#1e293b" stroke="#475569" strokeWidth="1" rx="1.5" />
                            <rect x="11" y="74" width={it.widthMm - 22} height="22" fill="#0f172a" stroke="#64748b" strokeWidth="0.8" rx="1" />
                            <text x={it.widthMm / 2} y="103" textAnchor="middle" fontSize="4.2" fill="#cbd5e1" fontWeight="bold">
                              CN1 / RS485
                            </text>
                            {/* CN2 Encoder port */}
                            <rect x="9" y="111" width={it.widthMm - 18} height="20" fill="#1e293b" stroke="#475569" strokeWidth="1" rx="1" />
                            <text x={it.widthMm / 2} y="123" textAnchor="middle" fontSize="4.2" fill="#cbd5e1" fontWeight="bold">
                              CN2 ENC
                            </text>
                            {/* Rating tag */}
                            <text x={it.widthMm / 2} y="138" textAnchor="middle" fontSize="4" fill="#38bdf8" fontWeight="bold">
                              1PH 220V 400W
                            </text>
                            {/* Power terminal block (L1 L2 U V W) */}
                            <rect x="4" y="143" width={it.widthMm - 8} height="26" fill="#1e293b" stroke="#475569" strokeWidth="1" rx="1.5" />
                            {[8, 14, 20, 26, 32].map((tx) => (
                              <circle key={tx} cx={tx} cy="153" r="2" fill="#94a3b8" stroke="#334155" strokeWidth="0.6" />
                            ))}
                            <text x={it.widthMm / 2} y="165" textAnchor="middle" fontSize="3.8" fill="#cbd5e1" fontWeight="bold">
                              L1 L2 U V W
                            </text>
                          </>
                        ) : it.specificModel?.startsWith("PLC_") ? (
                          <>
                            <rect x="2" y="2" width={it.widthMm - 4} height="14" fill="#1d4ed8" rx="1" />
                            <text x={it.widthMm / 2} y="11" textAnchor="middle" fontSize="5.5" fill="#eff6ff" fontWeight="extrabold">
                              iQ-R
                            </text>
                            <circle cx={it.widthMm / 2 - 4} cy="22" r="1.8" fill="#22c55e" />
                            <circle cx={it.widthMm / 2 + 4} cy="22" r="1.8" fill={it.specificModel === "PLC_CPU_MODULE" ? "#38bdf8" : "#94a3b8"} />
                            <rect x="4" y="28" width={it.widthMm - 8} height={Math.max(16, it.heightMm - 52)} fill="#0f172a" rx="1" />
                            <text
                              x={it.widthMm / 2}
                              y={it.heightMm / 2 + 4}
                              textAnchor="middle"
                              fontSize={it.widthMm < 32 ? "5" : "6.5"}
                              fill="#f8fafc"
                              fontWeight="extrabold"
                            >
                              {it.tagLabel || "iQ-R"}
                            </text>
                            <rect x="2" y={it.heightMm - 16} width={it.widthMm - 4} height="13" fill="#334155" rx="1" />
                          </>
                        ) : (
                          <>
                            {/* Terminal Input X Cover Atas */}
                            <rect x="2" y="2" width={it.widthMm - 4} height="12" fill="#1e3a8a" rx="1" />
                            <text x={it.widthMm / 2} y="10.5" textAnchor="middle" fontSize="7.5" fill="#93c5fd" fontWeight="bold">
                              INPUT X0-X17
                            </text>

                            {/* LED Status Bar & Switch Run/Stop */}
                            <g transform="translate(6, 17)">
                              <circle cx="3" cy="4" r="2" fill="#22c55e" />
                              <circle cx="9" cy="4" r="2" fill="#22c55e" />
                              <circle cx="15" cy="4" r="2" fill="#ef4444" />
                              <circle cx="21" cy="4" r="2" fill="#eab308" />
                              <text x="26" y="6" fontSize="6.5" fill="#64748b" fontWeight="bold">
                                PWR RUN ERR BAT
                              </text>
                            </g>

                            <text x={it.widthMm / 2} y="44" textAnchor="middle" fontSize="10.5" fill="#0f172a" fontWeight="extrabold">
                              {it.name.length > 20 ? it.name.substring(0, 18) + "..." : it.name}
                            </text>
                            <text x={it.widthMm / 2} y="55" textAnchor="middle" fontSize="8" fill="#2563eb" fontWeight="bold">
                              {it.tagLabel || "FX5U CPU"}
                            </text>

                            {/* RJ45 Ethernet Port */}
                            <rect x={it.widthMm - 22} y={it.heightMm - 26} width="16" height="10" fill="#334155" rx="1" />
                            <text x={it.widthMm - 14} y={it.heightMm - 19} textAnchor="middle" fontSize="5.5" fill="#94a3b8">
                              LAN
                            </text>

                            {/* Terminal Output Y Cover Bawah */}
                            <rect x="2" y={it.heightMm - 14} width={it.widthMm - 4} height="12" fill="#1e3a8a" rx="1" />
                            <text x={it.widthMm / 2} y={it.heightMm - 5.5} textAnchor="middle" fontSize="7.5" fill="#93c5fd" fontWeight="bold">
                              OUTPUT Y0-Y17
                            </text>
                          </>
                        ))}

                      {/* Detail Visual: MCCB 3-POLE (EZC100B3040 / Main Breaker) */}
                      {it.category === "MCCB" && (
                        <>
                          <rect x="4" y="3" width={it.widthMm - 8} height="12" fill="#cbd5e1" rx="1" />
                          <circle cx={it.widthMm * 0.25} cy="9" r="3" fill="#475569" />
                          <circle cx={it.widthMm * 0.5} cy="9" r="3" fill="#475569" />
                          <circle cx={it.widthMm * 0.75} cy="9" r="3" fill="#475569" />
                          <rect x="8" y="24" width={it.widthMm - 16} height={it.heightMm - 52} fill="#e2e8f0" rx="2" stroke="#94a3b8" strokeWidth="1" />
                          <rect x={it.widthMm / 2 - 11} y={it.heightMm / 2 - 14} width="22" height="24" fill="#0f172a" rx="2" />
                          <rect x={it.widthMm / 2 - 7} y={it.heightMm / 2 - 10} width="14" height="8" fill="#16a34a" rx="1" />
                          <circle cx={it.widthMm - 14} cy={it.heightMm / 2 - 14} r="2.5" fill="#ef4444" />
                          <text x={it.widthMm / 2} y={it.heightMm - 19} textAnchor="middle" fontSize="7.5" fill="#0f172a" fontWeight="extrabold">
                            {it.tagLabel || "MCCB"}
                          </text>
                          <rect x="4" y={it.heightMm - 15} width={it.widthMm - 8} height="12" fill="#cbd5e1" rx="1" />
                        </>
                      )}

                      {/* Detail Visual: MAIN SWITCH ROTARY DISCONNECT */}
                      {it.category === "MAIN_SWITCH" && (
                        <>
                          <rect x="2" y="2" width={it.widthMm - 4} height={it.heightMm - 4} fill="#facc15" stroke="#a16207" strokeWidth="1.5" rx="4" />
                          <circle cx={it.widthMm / 2} cy={it.heightMm / 2 - 3} r={Math.min(it.widthMm, it.heightMm) * 0.34} fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.5" />
                          <rect
                            x={it.widthMm / 2 - 4}
                            y={it.heightMm / 2 - 18}
                            width="8"
                            height="30"
                            fill="#991b1b"
                            stroke="#ffffff"
                            strokeWidth="1"
                            rx="2"
                            transform={`rotate(-35, ${it.widthMm / 2}, ${it.heightMm / 2 - 3})`}
                          />
                          <rect x="6" y={it.heightMm - 13} width={it.widthMm - 12} height="10" fill="#0f172a" rx="1.5" />
                          <text x={it.widthMm / 2} y={it.heightMm - 5.5} textAnchor="middle" fontSize="5.5" fill="#ffffff" fontWeight="bold">
                            {it.tagLabel || "MAIN SW"}
                          </text>
                        </>
                      )}

                      {/* Detail Visual: INDUSTRIAL ETHERNET HUB SWITCH (NS-205 5-Port) */}
                      {it.category === "HUB_SWITCH" && (
                        <>
                          <rect x="2" y="3" width={it.widthMm - 4} height="10" fill="#0f172a" rx="1" />
                          <text x={it.widthMm / 2} y="10" textAnchor="middle" fontSize="5.5" fill="#22c55e" fontWeight="bold">
                            {it.tagLabel || "NS-205"}
                          </text>
                          {[0, 1, 2, 3, 4].map((portIdx) => (
                            <rect
                              key={portIdx}
                              x={it.widthMm / 2 - 7}
                              y={18 + portIdx * 13}
                              width="14"
                              height="10"
                              fill="#020617"
                              stroke="#64748b"
                              strokeWidth="0.8"
                              rx="1"
                            />
                          ))}
                          <circle cx={it.widthMm / 2 + 11} cy="23" r="1.5" fill="#22c55e" />
                          <circle cx={it.widthMm / 2 + 11} cy="36" r="1.5" fill="#38bdf8" />
                        </>
                      )}

                      {/* Detail Visual: KONTAKTOR & THERMAL OVERLOAD */}
                      {it.category === "CONTACTOR" && (
                        <>
                          <rect x="2" y="2" width={it.widthMm - 4} height="12" fill="#334155" rx="1" />
                          <text x={it.widthMm / 2} y="10" textAnchor="middle" fontSize="6" fill="#f8fafc" fontWeight="bold">
                            L1 L2 L3
                          </text>
                          <rect x="6" y="20" width={it.widthMm - 12} height={Math.max(18, it.heightMm - 42)} fill="#1e293b" rx="2" />
                          <text x={it.widthMm / 2} y={it.heightMm / 2 + 3} textAnchor="middle" fontSize="7.5" fill="#ffffff" fontWeight="extrabold">
                            {it.tagLabel || "LC1D"}
                          </text>
                          <rect x="2" y={it.heightMm - 14} width={it.widthMm - 4} height="12" fill="#334155" rx="1" />
                          <text x={it.widthMm / 2} y={it.heightMm - 6} textAnchor="middle" fontSize="6" fill="#f8fafc" fontWeight="bold">
                            T1 T2 T3
                          </text>
                        </>
                      )}

                      {/* Detail Visual: POWER SUPPLY (Sesuai Datasheet Gambar 2: Omron S8VK-G / Autonics SPB) */}
                      {it.category === "POWER_SUPPLY" && (
                        <>
                          {/* Terminal Atas (Output DC) */}
                          <rect x="2" y="2" width={it.widthMm - 4} height="14" fill="#334155" rx="1" />
                          <line x1="6" y1="9" x2={it.widthMm - 6} y2="9" stroke="#64748b" strokeWidth="1" strokeDasharray="3,3" />
                          <text x={it.widthMm / 2} y="11" textAnchor="middle" fontSize="6.5" fill="#38bdf8" fontFamily="monospace" fontWeight="bold">
                            -V +V
                          </text>

                          {/* LED Indikator DC OK (Hijau) & Potensio V.ADJ */}
                          <circle cx={it.widthMm / 2 - 5} cy="26" r="2.5" fill="#22c55e" />
                          <text x={it.widthMm / 2 + 3} y="28.5" fontSize="6.5" fill="#4ade80" fontWeight="bold">
                            DC OK
                          </text>

                          {/* Label Nama & Tipe */}
                          <text x={it.widthMm / 2} y="48" textAnchor="middle" fontSize="8" fill="#ffffff" fontWeight="extrabold">
                            {it.tagLabel || "24VDC"}
                          </text>
                          <text x={it.widthMm / 2} y="58" textAnchor="middle" fontSize="6.5" fill="#94a3b8">
                            POWER
                          </text>

                          {/* Ventilasi Kisi-kisi Tengah */}
                          <rect x="4" y={it.heightMm / 2} width={it.widthMm - 8} height="16" fill="#0f172a" rx="1" />
                          <line x1="6" y1={it.heightMm / 2 + 4} x2={it.widthMm - 6} y2={it.heightMm / 2 + 4} stroke="#334155" strokeWidth="1" />
                          <line x1="6" y1={it.heightMm / 2 + 8} x2={it.widthMm - 6} y2={it.heightMm / 2 + 8} stroke="#334155" strokeWidth="1" />
                          <line x1="6" y1={it.heightMm / 2 + 12} x2={it.widthMm - 6} y2={it.heightMm / 2 + 12} stroke="#334155" strokeWidth="1" />

                          {/* Terminal Input Bawah (AC L N PE) */}
                          <rect x="2" y={it.heightMm - 16} width={it.widthMm - 4} height="14" fill="#334155" rx="1" />
                          <text x={it.widthMm / 2} y={it.heightMm - 6.5} textAnchor="middle" fontSize="6.5" fill="#f8fafc" fontFamily="monospace" fontWeight="bold">
                            L N PE
                          </text>
                        </>
                      )}

                      {/* Detail Visual: MCB (Schneider / Chint) */}
                      {it.category === "MCB" && (
                        <>
                          <rect x="2" y="3" width={it.widthMm - 4} height="9" fill="#e2e8f0" rx="1" />
                          {/* Saklar Toggle Tuas Oranye */}
                          <rect x={it.widthMm / 2 - 4} y="26" width="8" height="18" fill="#0f172a" rx="2" />
                          <rect x={it.widthMm / 2 - 3} y="27" width="6" height="7" fill="#ea580c" rx="1" />
                          {/* VisiTrip Window Merah */}
                          <rect x={it.widthMm / 2 - 3} y="48" width="6" height="4" fill="#ef4444" rx="0.5" />
                          <text x={it.widthMm / 2} y="64" textAnchor="middle" fontSize="7.5" fill="#0f172a" fontWeight="extrabold">
                            {it.tagLabel || "MCB"}
                          </text>
                          <rect x="2" y={it.heightMm - 12} width={it.widthMm - 4} height="9" fill="#e2e8f0" rx="1" />
                        </>
                      )}

                      {/* Detail Visual: RELAY OMRON MY2N / G2R / MY4N + SOCKET DIN RAIL */}
                      {it.category === "RELAY" && (
                        <>
                          {/* Bodi Transparan Relay */}
                          <rect
                            x="2"
                            y="6"
                            width={Math.max(10, it.widthMm - 4)}
                            height={Math.max(20, it.heightMm - 20)}
                            fill="#38bdf8"
                            fillOpacity="0.25"
                            stroke="#0284c7"
                            strokeWidth="1"
                            rx="2"
                          />
                          {/* Gulungan Kawat Tembaga (Copper Coil) */}
                          <rect
                            x={it.widthMm / 2 - (it.widthMm < 20 ? 3.5 : 5)}
                            y="16"
                            width={it.widthMm < 20 ? 7 : 10}
                            height={it.widthMm < 20 ? 12 : 15}
                            fill="#d97706"
                            rx="1"
                          />
                          {/* LED Indikator Merah */}
                          <circle
                            cx={it.widthMm / 2}
                            cy={it.widthMm < 20 ? 34 : 38}
                            r={it.widthMm < 20 ? 2 : 2.5}
                            fill="#ef4444"
                          />
                          {/* Base Socket Din Rail Hitam */}
                          <rect
                            x="1.5"
                            y={it.heightMm - 14}
                            width={Math.max(12, it.widthMm - 3)}
                            height="12"
                            fill="#0f172a"
                            rx="1"
                          />
                          <text
                            x={it.widthMm / 2}
                            y={it.heightMm - 5}
                            textAnchor="middle"
                            fontSize={it.widthMm < 20 ? "5.5" : "7"}
                            fill="#ffffff"
                            fontWeight="bold"
                          >
                            {it.tagLabel || (it.widthMm < 20 ? "G2R" : "MY2N")}
                          </text>
                        </>
                      )}

                      {/* Detail Visual: SAFETY RELAY (Omron G9SA Kuning Safety) */}
                      {it.category === "SAFETY_RELAY" && (
                        <>
                          <rect x="2" y="2" width={it.widthMm - 4} height="12" fill="#713f12" rx="1" />
                          <text x={it.widthMm / 2} y="10" textAnchor="middle" fontSize="6.5" fill="#fef08a" fontWeight="bold">
                            T11-T12 T21-T22
                          </text>
                          <circle cx="8" cy="22" r="2" fill="#22c55e" />
                          <circle cx="16" cy="22" r="2" fill="#22c55e" />
                          <circle cx="24" cy="22" r="2" fill="#22c55e" />
                          <text x={it.widthMm / 2} y="45" textAnchor="middle" fontSize="9" fill="#0f172a" fontWeight="extrabold">
                            G9SA
                          </text>
                          <text x={it.widthMm / 2} y="56" textAnchor="middle" fontSize="6.5" fill="#854d0e" fontWeight="bold">
                            SAFETY UNIT
                          </text>
                          <rect x="2" y={it.heightMm - 14} width={it.widthMm - 4} height="12" fill="#713f12" rx="1" />
                        </>
                      )}

                      {/* Detail Visual: NOISE FILTER (TDK-Lambda RSEN) */}
                      {it.category === "NOISE_FILTER" && (
                        <>
                          <rect x="4" y="4" width={it.widthMm - 8} height="12" fill="#64748b" rx="1" />
                          <text x={it.widthMm / 2} y="12" textAnchor="middle" fontSize="6.5" fill="#f8fafc" fontWeight="bold">
                            LINE (IN)
                          </text>
                          <text x={it.widthMm / 2} y={it.heightMm / 2 - 2} textAnchor="middle" fontSize="8" fill="#0f172a" fontWeight="extrabold">
                            {it.tagLabel || "TDK NOISE"}
                          </text>
                          <text x={it.widthMm / 2} y={it.heightMm / 2 + 8} textAnchor="middle" fontSize="6.5" fill="#475569">
                            {it.specificModel === "NOISE_FILTER_3P" ? "3P FILTER 20A" : "FILTER 6A"}
                          </text>
                          <rect x="4" y={it.heightMm - 16} width={it.widthMm - 8} height="12" fill="#64748b" rx="1" />
                          <text x={it.widthMm / 2} y={it.heightMm - 8} textAnchor="middle" fontSize="6.5" fill="#f8fafc" fontWeight="bold">
                            LOAD (OUT)
                          </text>
                        </>
                      )}

                      {/* Detail Visual: STOP KONTAK UTICON */}
                      {it.category === "SOCKET_OUTLET" && (
                        <>
                          <circle cx={it.widthMm / 2} cy={it.heightMm / 2} r="16" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
                          <circle cx={it.widthMm / 2 - 6} cy={it.heightMm / 2} r="2.5" fill="#1e293b" />
                          <circle cx={it.widthMm / 2 + 6} cy={it.heightMm / 2} r="2.5" fill="#1e293b" />
                          <rect x={it.widthMm / 2 - 2} y={it.heightMm / 2 - 16} width="4" height="4" fill="#eab308" />
                          <rect x={it.widthMm / 2 - 2} y={it.heightMm / 2 + 12} width="4" height="4" fill="#eab308" />
                          <text x={it.widthMm / 2} y={it.heightMm - 6} textAnchor="middle" fontSize="6.5" fill="#64748b" fontWeight="bold">
                            UTICON
                          </text>
                        </>
                      )}

                      {/* Detail Visual: TERMINAL BLOCK (PTW / PTU / TBD - Horizontal maupun Vertikal) */}
                      {it.category === "TERMINAL" &&
                        (it.widthMm > it.heightMm ? (
                          <>
                            <rect x="2" y="2" width={it.widthMm - 4} height={it.heightMm - 4} fill="#475569" rx="1" />
                            <line x1="8" y1="2" x2="8" y2={it.heightMm - 2} stroke="#334155" strokeWidth="1" />
                            <line x1={it.widthMm / 2} y1="2" x2={it.widthMm / 2} y2={it.heightMm - 2} stroke="#334155" strokeWidth="1" />
                            <line x1={it.widthMm - 8} y1="2" x2={it.widthMm - 8} y2={it.heightMm - 2} stroke="#334155" strokeWidth="1" />
                            <text
                              x={it.widthMm / 2}
                              y={it.heightMm / 2 + 2.5}
                              textAnchor="middle"
                              fontSize={it.heightMm <= 18 ? "5.5" : "7.5"}
                              fill="#f8fafc"
                              fontWeight="bold"
                            >
                              {it.tagLabel || "TB"}
                            </text>
                          </>
                        ) : (
                          <>
                            <rect x="1.5" y="1.5" width={it.widthMm - 3} height={it.heightMm - 3} fill="#475569" rx="1" />
                            <line x1="1.5" y1="9" x2={it.widthMm - 1.5} y2="9" stroke="#334155" strokeWidth="1" />
                            <line x1="1.5" y1={it.heightMm - 9} x2={it.widthMm - 1.5} y2={it.heightMm - 9} stroke="#334155" strokeWidth="1" />
                            <circle cx={it.widthMm / 2} cy="5.5" r="1.8" fill="#cbd5e1" />
                            <circle cx={it.widthMm / 2} cy={it.heightMm - 5.5} r="1.8" fill="#cbd5e1" />
                            <text
                              x={it.widthMm / 2}
                              y={it.heightMm / 2 + 2}
                              textAnchor="middle"
                              fontSize="5"
                              fill="#f8fafc"
                              fontWeight="bold"
                            >
                              {it.tagLabel || "TB"}
                            </text>
                          </>
                        ))}

                      {/* Detail Visual: HMI TOUCHSCREEN (Mitsubishi GS2107 / GS2110 / GOT) */}
                      {it.category === "HMI" && (
                        <>
                          {/* Bezel Luar Layar Touchscreen */}
                          <rect
                            x="0"
                            y="0"
                            width={it.widthMm}
                            height={it.heightMm}
                            fill="#0f172a"
                            stroke={isSelected ? "#3b82f6" : "#475569"}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                            rx="5"
                          />
                          {/* Logo GOT / Touch */}
                          <text x="8" y="9" fontSize="5.5" fill="#94a3b8" fontWeight="bold">
                            MITSUBISHI GOT
                          </text>
                          <circle cx={it.widthMm - 8} cy="7" r="1.5" fill="#22c55e" />

                          {/* Kaca Layar LCD Aktif */}
                          <rect
                            x="6"
                            y="13"
                            width={it.widthMm - 12}
                            height={it.heightMm - 19}
                            fill="#020617"
                            stroke="#1e293b"
                            strokeWidth="1"
                            rx="2"
                          />

                          {/* Top Bar SPM GUI di LCD */}
                          <rect
                            x="7"
                            y="14"
                            width={it.widthMm - 14}
                            height="11"
                            fill="#1e3a8a"
                            rx="1"
                          />
                          <text
                            x="11"
                            y="22"
                            fontSize="5.5"
                            fill="#bfdbfe"
                            fontWeight="bold"
                          >
                            TWINTECH SPM AUTO SYSTEM
                          </text>
                          <rect
                            x={Math.max(12, it.widthMm - 45)}
                            y="16"
                            width="34"
                            height="7"
                            fill="#15803d"
                            rx="2"
                          />
                          <text
                            x={Math.max(12, it.widthMm - 28)}
                            y="21"
                            textAnchor="middle"
                            fontSize="4.5"
                            fill="#ffffff"
                            fontWeight="bold"
                          >
                            READY / AUTO
                          </text>

                          {/* Konten Monitor Mesin SPM di Tengah Layar */}
                          <g transform="translate(10, 29)">
                            <text x="0" y="8" fontSize="6.5" fill="#38bdf8" fontWeight="bold">
                              CYCLE: 00482 PCS
                            </text>
                            <text x="0" y="17" fontSize="5" fill="#94a3b8">
                              STATUS: ORIGIN POS OK
                            </text>
                            <rect x="0" y="21" width={Math.max(20, it.widthMm - 32)} height="3" fill="#1e293b" rx="1.5" />
                            <rect x="0" y="21" width={Math.max(10, (it.widthMm - 32) * 0.7)} height="3" fill="#2563eb" rx="1.5" />
                          </g>

                          {/* Soft Virtual Touch Buttons di Bagian Bawah Layar */}
                          <g transform={`translate(10, ${Math.max(30, it.heightMm - 20)})`}>
                            {["F1 AUTO", "F2 MAN", "F3 ALM", "F4 SET"].map((btn, idx) => (
                              <g key={btn} transform={`translate(${idx * ((it.widthMm - 24) / 4)}, 0)`}>
                                <rect
                                  x="0"
                                  y="0"
                                  width={Math.max(10, (it.widthMm - 30) / 4)}
                                  height="10"
                                  fill="#1e293b"
                                  stroke="#334155"
                                  strokeWidth="0.8"
                                  rx="2"
                                />
                                <text
                                  x={Math.max(10, (it.widthMm - 30) / 4) / 2}
                                  y="7"
                                  textAnchor="middle"
                                  fontSize="4"
                                  fill="#cbd5e1"
                                  fontWeight="bold"
                                >
                                  {btn}
                                </text>
                              </g>
                            ))}
                          </g>
                        </>
                      )}

                      {/* Detail Visual: EMERGENCY STOP (IDEC / FUJI Ø22mm / Ø60mm Ring) */}
                      {it.category === "EMERGENCY_STOP" && (
                        <>
                          {/* Yellow Legend Ring Kuning Cerah Standar Industri */}
                          <circle
                            cx={it.widthMm / 2}
                            cy={it.heightMm / 2}
                            r={Math.min(it.widthMm, it.heightMm) / 2 - 1}
                            fill="#facc15"
                            stroke="#ca8a04"
                            strokeWidth="2"
                          />
                          {/* Tulisan Melingkar / Header EMERGENCY STOP */}
                          <text
                            x={it.widthMm / 2}
                            y={it.heightMm / 2 - 17}
                            textAnchor="middle"
                            fontSize="5.5"
                            fill="#854d0e"
                            fontWeight="extrabold"
                            letterSpacing="0.5"
                          >
                            EMERGENCY
                          </text>
                          <text
                            x={it.widthMm / 2}
                            y={it.heightMm / 2 + 21}
                            textAnchor="middle"
                            fontSize="5.5"
                            fill="#854d0e"
                            fontWeight="extrabold"
                            letterSpacing="0.5"
                          >
                            STOP
                          </text>

                          {/* Tombol Jamur Merah (Red Mushroom Head Ø40mm) */}
                          <circle
                            cx={it.widthMm / 2}
                            cy={it.heightMm / 2}
                            r={Math.max(8, Math.min(it.widthMm, it.heightMm) / 2 - 10)}
                            fill="#dc2626"
                            stroke="#991b1b"
                            strokeWidth="2.5"
                          />
                          <circle
                            cx={it.widthMm / 2}
                            cy={it.heightMm / 2}
                            r={Math.max(5, Math.min(it.widthMm, it.heightMm) / 2 - 14)}
                            fill="#ef4444"
                          />

                          {/* Twist-to-Release Arrow Icon di Tengah Mushroom */}
                          <circle
                            cx={it.widthMm / 2}
                            cy={it.heightMm / 2}
                            r="5"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                            strokeDasharray="4,2"
                          />
                          <text
                            x={it.widthMm / 2}
                            y={it.heightMm / 2 + 1.5}
                            textAnchor="middle"
                            fontSize="4.5"
                            fill="#ffffff"
                            fontWeight="bold"
                          >
                            ↻
                          </text>
                        </>
                      )}

                      {/* Detail Visual: PUSH BUTTON (FR-EG-EP-006 Warna Lengkap Ø22mm) */}
                      {it.category === "PUSH_BUTTON" && (() => {
                        const nameLower = (it.name + " " + (it.tagLabel || "")).toLowerCase();
                        const modelUpper = (it.specificModel || "").toUpperCase();
                        const isWhite =
                          modelUpper.includes("WHITE") ||
                          nameLower.includes("white") ||
                          nameLower.includes("putih") ||
                          nameLower.includes("origin");
                        const isOrange =
                          modelUpper.includes("ORANGE") ||
                          nameLower.includes("orange") ||
                          nameLower.includes("oranye") ||
                          nameLower.includes("jingga");
                        const isBlack =
                          modelUpper.includes("BLACK") ||
                          nameLower.includes("black") ||
                          nameLower.includes("hitam");
                        const isYellow =
                          modelUpper.includes("YELLOW") ||
                          modelUpper.includes("JOG") ||
                          nameLower.includes("yellow") ||
                          nameLower.includes("kuning");
                        const isBlue =
                          !isWhite &&
                          !isOrange &&
                          !isBlack &&
                          !isYellow &&
                          (modelUpper.includes("BLUE") ||
                            modelUpper.includes("RESET") ||
                            nameLower.includes("blue") ||
                            nameLower.includes("biru") ||
                            nameLower.includes("reset"));
                        const isStart =
                          !isWhite &&
                          !isOrange &&
                          !isBlue &&
                          !isBlack &&
                          !isYellow &&
                          (modelUpper.includes("GREEN") ||
                            modelUpper.includes("START") ||
                            nameLower.includes("start") ||
                            nameLower.includes("on") ||
                            nameLower.includes("hijau") ||
                            nameLower.includes("green"));
                        const isStop =
                          !isWhite &&
                          !isOrange &&
                          !isBlue &&
                          !isBlack &&
                          !isYellow &&
                          !isStart &&
                          (modelUpper.includes("RED") ||
                            modelUpper.includes("STOP") ||
                            nameLower.includes("stop") ||
                            nameLower.includes("off") ||
                            nameLower.includes("merah") ||
                            nameLower.includes("red"));
                        const isReset = nameLower.includes("reset");

                        const btnColor = isWhite
                          ? "#e2e8f0"
                          : isOrange
                            ? "#ea580c"
                            : isBlue
                              ? "#2563eb"
                              : isBlack
                                ? "#1e293b"
                                : isYellow
                                  ? "#eab308"
                                  : isStart
                                    ? "#16a34a"
                                    : isStop
                                      ? "#dc2626"
                                      : "#334155";
                        const innerGlow = isWhite
                          ? "#ffffff"
                          : isOrange
                            ? "#fb923c"
                            : isBlue
                              ? "#3b82f6"
                              : isBlack
                                ? "#334155"
                                : isYellow
                                  ? "#facc15"
                                  : isStart
                                    ? "#22c55e"
                                    : isStop
                                      ? "#ef4444"
                                      : "#475569";

                        return (
                          <>
                            {/* Legend Nameplate Plate Hitam di Bawah Tombol */}
                            <rect
                              x="3"
                              y={it.heightMm - 16}
                              width={it.widthMm - 6}
                              height="14"
                              fill="#0f172a"
                              stroke="#475569"
                              strokeWidth="1"
                              rx="2"
                            />
                            <text
                              x={it.widthMm / 2}
                              y={it.heightMm - 6}
                              textAnchor="middle"
                              fontSize="6"
                              fill="#ffffff"
                              fontWeight="extrabold"
                            >
                              {it.tagLabel || (isStart ? "START" : isStop ? "STOP" : isReset ? "RESET" : "PB")}
                            </text>

                            {/* Bezel Ring Chrome Ø22mm Luar */}
                            <circle
                              cx={it.widthMm / 2}
                              cy={18}
                              r="15"
                              fill="#e2e8f0"
                              stroke="#64748b"
                              strokeWidth="2"
                            />
                            <circle
                              cx={it.widthMm / 2}
                              cy={18}
                              r="12"
                              fill="#94a3b8"
                            />

                            {/* Tombol Bundar Flush Actuator */}
                            <circle
                              cx={it.widthMm / 2}
                              cy={18}
                              r="10"
                              fill={btnColor}
                              stroke="#0f172a"
                              strokeWidth="1"
                            />
                            <circle
                              cx={it.widthMm / 2}
                              cy={18}
                              r="7"
                              fill={innerGlow}
                            />

                            {/* Simbol Ikon Tengah */}
                            {isStart && (
                              <polygon
                                points={`${it.widthMm / 2 - 2},14 ${it.widthMm / 2 - 2},22 ${it.widthMm / 2 + 3},18`}
                                fill="#ffffff"
                              />
                            )}
                            {isStop && (
                              <rect
                                x={it.widthMm / 2 - 3}
                                y="15"
                                width="6"
                                height="6"
                                fill="#ffffff"
                                rx="0.5"
                              />
                            )}
                            {isReset && (
                              <text
                                x={it.widthMm / 2}
                                y="20.5"
                                textAnchor="middle"
                                fontSize="7"
                                fill="#ffffff"
                                fontWeight="bold"
                              >
                                ↻
                              </text>
                            )}
                          </>
                        );
                      })()}

                      {/* Detail Visual: SELECTOR SWITCH & KEY SWITCH (FUJI / IDEC Ø22mm) */}
                      {it.category === "SELECTOR_SWITCH" && (() => {
                        const isKey = it.specificModel?.includes("KEY") || it.name.toLowerCase().includes("key");

                        return (
                          <>
                            {/* Plat Nama Label Posisi */}
                            <rect
                              x="3"
                              y={it.heightMm - 16}
                              width={it.widthMm - 6}
                              height="14"
                              fill="#0f172a"
                              stroke="#475569"
                              strokeWidth="1"
                              rx="2"
                            />
                            <text
                              x={it.widthMm / 2}
                              y={it.heightMm - 6}
                              textAnchor="middle"
                              fontSize="6"
                              fill="#ffffff"
                              fontWeight="extrabold"
                            >
                              {it.tagLabel || (isKey ? "KEY SW" : "MAN / AUTO")}
                            </text>

                            {/* Bezel Ring Logam Ø22mm */}
                            <circle
                              cx={it.widthMm / 2}
                              cy={18}
                              r="15"
                              fill="#cbd5e1"
                              stroke="#475569"
                              strokeWidth="2"
                            />

                            {isKey ? (
                              /* Key Switch Silinder Kunci Kuningan + Slot & Anak Kunci */
                              <>
                                <circle cx={it.widthMm / 2} cy={18} r="10" fill="#f59e0b" stroke="#78350f" strokeWidth="1.2" />
                                <rect x={it.widthMm / 2 - 1.5} y="12" width="3" height="12" fill="#1e293b" rx="1" />
                                {/* Anak Kunci Menggantung */}
                                <g transform={`translate(${it.widthMm / 2}, 18)`}>
                                  <rect x="-1" y="0" width="2" height="10" fill="#94a3b8" />
                                  <circle cx="0" cy="12" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
                                  <circle cx="0" cy="12" r="1.5" fill="#1e293b" />
                                </g>
                              </>
                            ) : (
                              /* Selector Switch Rotary Lever Tuas Hitam */
                              <>
                                <circle cx={it.widthMm / 2} cy={18} r="11" fill="#1e293b" />
                                {/* Tanda Penunjuk Posisi Sudut */}
                                <circle cx={it.widthMm / 2 - 9} cy={12} r="1" fill="#94a3b8" />
                                <circle cx={it.widthMm / 2 + 9} cy={12} r="1" fill="#94a3b8" />
                                {/* Tuas Putar Hitam Tebal */}
                                <rect
                                  x={it.widthMm / 2 - 3.5}
                                  y="8"
                                  width="7"
                                  height="20"
                                  fill="#0f172a"
                                  stroke="#334155"
                                  strokeWidth="1"
                                  rx="2"
                                  transform={`rotate(-25, ${it.widthMm / 2}, 18)`}
                                />
                                <line
                                  x1={it.widthMm / 2}
                                  y1="10"
                                  x2={it.widthMm / 2}
                                  y2="17"
                                  stroke="#ffffff"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  transform={`rotate(-25, ${it.widthMm / 2}, 18)`}
                                />
                              </>
                            )}
                          </>
                        );
                      })()}

                      {/* Detail Visual: PILOT LAMP (LED Ø22mm) */}
                      {it.category === "PILOT_LAMP" && (() => {
                        const nameLower = (it.name + " " + (it.tagLabel || "")).toLowerCase();
                        const modelUpper = (it.specificModel || "").toUpperCase();
                        const isWhite =
                          modelUpper.includes("WHITE") ||
                          nameLower.includes("white") ||
                          nameLower.includes("putih") ||
                          nameLower.includes("pwr") ||
                          nameLower.includes("power");
                        const isRed =
                          !isWhite &&
                          (modelUpper.includes("RED") ||
                            nameLower.includes("red") ||
                            nameLower.includes("merah") ||
                            nameLower.includes("fault") ||
                            nameLower.includes("alarm"));
                        const isYellow =
                          !isWhite &&
                          !isRed &&
                          (modelUpper.includes("YELLOW") ||
                            nameLower.includes("yellow") ||
                            nameLower.includes("kuning") ||
                            nameLower.includes("standby"));
                        const isBlue =
                          !isWhite &&
                          !isRed &&
                          !isYellow &&
                          (modelUpper.includes("BLUE") ||
                            nameLower.includes("blue") ||
                            nameLower.includes("biru"));
                        const lampColor = isWhite
                          ? "#f1f5f9"
                          : isRed
                            ? "#ef4444"
                            : isYellow
                              ? "#eab308"
                              : isBlue
                                ? "#38bdf8"
                                : "#22c55e";
                        const glowFilter = isWhite
                          ? "#ffffff"
                          : isRed
                            ? "#f87171"
                            : isYellow
                              ? "#fde047"
                              : isBlue
                                ? "#7dd3fc"
                                : "#4ade80";

                        return (
                          <>
                            {/* Plat Nama Bawah */}
                            <rect
                              x="3"
                              y={it.heightMm - 16}
                              width={it.widthMm - 6}
                              height="14"
                              fill="#0f172a"
                              stroke="#475569"
                              strokeWidth="1"
                              rx="2"
                            />
                            <text
                              x={it.widthMm / 2}
                              y={it.heightMm - 6}
                              textAnchor="middle"
                              fontSize="6.5"
                              fill="#ffffff"
                              fontWeight="extrabold"
                            >
                              {it.tagLabel || (isRed ? "ALARM" : isYellow ? "STBY" : "RUN")}
                            </text>

                            {/* Bezel Ring Logam Chrome Ø22mm */}
                            <circle
                              cx={it.widthMm / 2}
                              cy={18}
                              r="15"
                              fill="#cbd5e1"
                              stroke="#64748b"
                              strokeWidth="2"
                            />
                            {/* Lensa Fresnel Kubah Bersinar */}
                            <circle
                              cx={it.widthMm / 2}
                              cy={18}
                              r="11"
                              fill={lampColor}
                              stroke="#ffffff"
                              strokeWidth="0.8"
                            />
                            <circle
                              cx={it.widthMm / 2}
                              cy={18}
                              r="7"
                              fill={glowFilter}
                              opacity="0.85"
                            />
                            {/* Garis Diamond Facet Fresnel */}
                            <line x1={it.widthMm / 2 - 8} y1="18" x2={it.widthMm / 2 + 8} y2="18" stroke="#ffffff" strokeWidth="0.6" opacity="0.7" />
                            <line x1={it.widthMm / 2} y1="10" x2={it.widthMm / 2} y2="26" stroke="#ffffff" strokeWidth="0.6" opacity="0.7" />
                          </>
                        );
                      })()}

                      {/* Detail Visual: BUZZER ALARM (FORT / OMRON Ø22mm) */}
                      {it.category === "BUZZER" && (
                        <>
                          {/* Plat Nama Bawah */}
                          <rect
                            x="3"
                            y={it.heightMm - 16}
                            width={it.widthMm - 6}
                            height="14"
                            fill="#0f172a"
                            stroke="#475569"
                            strokeWidth="1"
                            rx="2"
                          />
                          <text
                            x={it.widthMm / 2}
                            y={it.heightMm - 6}
                            textAnchor="middle"
                            fontSize="6.5"
                            fill="#ffffff"
                            fontWeight="extrabold"
                          >
                            {it.tagLabel || "BUZZER"}
                          </text>

                          {/* Bodi Silinder Hitam Akustik Ø22mm */}
                          <circle
                            cx={it.widthMm / 2}
                            cy={18}
                            r="15"
                            fill="#0f172a"
                            stroke="#334155"
                            strokeWidth="2"
                          />
                          {/* Grill Lubang Suara Konsentris */}
                          <circle cx={it.widthMm / 2} cy={18} r="11" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="3,2" />
                          <circle cx={it.widthMm / 2} cy={18} r="7" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="2,2" />
                          <circle cx={it.widthMm / 2} cy={18} r="3" fill="#ef4444" />
                          {/* Teks 90dB */}
                          <text x={it.widthMm / 2} y="19.5" textAnchor="middle" fontSize="4.5" fill="#f8fafc" fontWeight="bold">
                            90dB
                          </text>
                        </>
                      )}

                      {/* Detail Visual: METER & TEMPERATURE CONTROLLER 48x48 */}
                      {it.category === "METER_DISPLAY" && (
                        <>
                          <rect x="0" y="0" width={it.widthMm} height={it.heightMm} fill="#1e293b" rx="2" stroke="#475569" strokeWidth="1.5" />
                          {/* Display 7-segment PV Merah */}
                          <rect x="4" y="4" width={it.widthMm - 8} height="14" fill="#020617" rx="1" />
                          <text x={it.widthMm - 7} y="14" textAnchor="end" fontSize="9" fill="#ef4444" fontFamily="monospace" fontWeight="bold">
                            120.5
                          </text>
                          {/* Display 7-segment SV Hijau */}
                          <rect x="4" y="20" width={it.widthMm - 8} height="12" fill="#020617" rx="1" />
                          <text x={it.widthMm - 7} y="29" textAnchor="end" fontSize="8" fill="#22c55e" fontFamily="monospace" fontWeight="bold">
                            120.0
                          </text>
                          {/* Tombol Membran Bawah */}
                          <g transform={`translate(4, ${it.heightMm - 12})`}>
                            <rect x="0" y="0" width="8" height="8" fill="#334155" rx="1" />
                            <text x="4" y="6" textAnchor="middle" fontSize="4.5" fill="#f8fafc">MD</text>
                            <rect x="10" y="0" width="8" height="8" fill="#334155" rx="1" />
                            <text x="14" y="6" textAnchor="middle" fontSize="4.5" fill="#f8fafc">▲</text>
                            <rect x="20" y="0" width="8" height="8" fill="#334155" rx="1" />
                            <text x="24" y="6" textAnchor="middle" fontSize="4.5" fill="#f8fafc">▼</text>
                          </g>
                        </>
                      )}

                      {/* Detail Visual: TOWER LAMP 3 STACK LED (PTE-APZ-302 / LR6) */}
                      {it.category === "TOWER_LAMP" && (
                        <>
                          <rect x="4" y="4" width={it.widthMm - 8} height={Math.max(8, (it.heightMm - 20) * 0.25)} fill="#ef4444" stroke="#991b1b" strokeWidth="0.8" rx="1.5" />
                          <rect x="4" y={6 + Math.max(8, (it.heightMm - 20) * 0.25)} width={it.widthMm - 8} height={Math.max(8, (it.heightMm - 20) * 0.25)} fill="#eab308" stroke="#854d0e" strokeWidth="0.8" rx="1.5" />
                          <rect x="4" y={8 + Math.max(8, (it.heightMm - 20) * 0.25) * 2} width={it.widthMm - 8} height={Math.max(8, (it.heightMm - 20) * 0.25)} fill="#22c55e" stroke="#166534" strokeWidth="0.8" rx="1.5" />
                          <rect x="3" y={it.heightMm - 13} width={it.widthMm - 6} height="11" fill="#0f172a" rx="1.5" />
                          <text x={it.widthMm / 2} y={it.heightMm - 5.5} textAnchor="middle" fontSize="5.5" fill="#ffffff" fontWeight="bold">
                            {it.tagLabel || "TOWER"}
                          </text>
                        </>
                      )}

                      {/* Detail Visual: COOLING / EXHAUST FAN + FILTER GRILLE */}
                      {it.category === "FAN" && (
                        <>
                          <rect x="2" y="2" width={it.widthMm - 4} height={it.heightMm - 4} fill="#cbd5e1" stroke="#64748b" strokeWidth="1" rx="2" />
                          <circle cx={it.widthMm / 2} cy={it.heightMm / 2} r={Math.min(it.widthMm, it.heightMm) * 0.36} fill="#334155" stroke="#475569" strokeWidth="1.5" />
                          {[0, 45, 90, 135].map((deg) => (
                            <rect
                              key={deg}
                              x={it.widthMm / 2 - 2.5}
                              y={it.heightMm / 2 - Math.min(it.widthMm, it.heightMm) * 0.3}
                              width="5"
                              height={Math.min(it.widthMm, it.heightMm) * 0.6}
                              fill="#94a3b8"
                              opacity="0.7"
                              rx="2"
                              transform={`rotate(${deg}, ${it.widthMm / 2}, ${it.heightMm / 2})`}
                            />
                          ))}
                          <circle cx={it.widthMm / 2} cy={it.heightMm / 2} r="7" fill="#0f172a" />
                          <text x={it.widthMm / 2} y={it.heightMm - 6} textAnchor="middle" fontSize="6.5" fill="#0f172a" fontWeight="extrabold">
                            {it.tagLabel || "FAN"}
                          </text>
                        </>
                      )}

                      {/* Detail Visual: AKSESORIS (DIN Stopper End Clamp / Ground Busbar) */}
                      {it.category === "ACCESSORY" && (
                        <>
                          <rect
                            x="1"
                            y="1"
                            width={Math.max(4, it.widthMm - 2)}
                            height={Math.max(4, it.heightMm - 2)}
                            fill={it.specificModel === "DIN_STOPPER" ? "#64748b" : "#d97706"}
                            stroke="#334155"
                            strokeWidth="1"
                            rx="1"
                          />
                          {it.widthMm >= 20 && (
                            <text
                              x={it.widthMm / 2}
                              y={it.heightMm / 2 + 2.5}
                              textAnchor="middle"
                              fontSize="5.5"
                              fill="#ffffff"
                              fontWeight="bold"
                            >
                              {it.tagLabel || "ACC"}
                            </text>
                          )}
                        </>
                      )}

                      {/* Default Fallback untuk kategori lainnya */}
                      {![
                        "PLC",
                        "POWER_SUPPLY",
                        "MCB",
                        "MCCB",
                        "MAIN_SWITCH",
                        "HUB_SWITCH",
                        "CONTACTOR",
                        "RELAY",
                        "SAFETY_RELAY",
                        "NOISE_FILTER",
                        "SOCKET_OUTLET",
                        "TERMINAL",
                        "HMI",
                        "EMERGENCY_STOP",
                        "PUSH_BUTTON",
                        "SELECTOR_SWITCH",
                        "PILOT_LAMP",
                        "BUZZER",
                        "METER_DISPLAY",
                        "TOWER_LAMP",
                        "FAN",
                        "ACCESSORY",
                      ].includes(it.category) && (
                        <text x={it.widthMm / 2} y={it.heightMm / 2 + 3} textAnchor="middle" fontSize="8.5" fill="#1e293b" fontWeight="bold">
                          {it.tagLabel || (it.name.length > 12 ? it.name.substring(0, 10) + ".." : it.name)}
                        </text>
                      )}

                      {/* Bingkai sorot biru saat terpilih (khusus tombol bulat / saat multi-select) */}
                      {isSelected && (isRoundDoorItem || selectedItems.length > 1) && (
                        <rect
                          x="-2.5"
                          y="-2.5"
                          width={it.widthMm + 5}
                          height={it.heightMm + 5}
                          fill="rgba(59, 130, 246, 0.1)"
                          stroke="#2563eb"
                          strokeWidth="1.8"
                          strokeDasharray="3,2"
                          rx={isRoundDoorItem ? 6 : 4}
                          pointerEvents="none"
                        />
                      )}

                      {/* Tombol Hapus Cepat (X) Langsung di Pojok Kanan Atas saat 1 item dipilih */}
                      {isSingleSelected && (
                        <g
                          transform={`translate(${it.widthMm - 10}, -8)`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(it.id);
                          }}
                          className="cursor-pointer"
                        >
                          <circle cx="8" cy="8" r="7.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                          <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                          <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                        </g>
                      )}
                    </g>
                  );
                })}

              {/* 4A. Bounding Box Multi-Select saat memilih >= 2 item (Ctrl + Klik Kiri) */}
              {selectedGroupBounds && (
                <g id="multi-select-bounding-box" pointerEvents="none">
                  <rect
                    x={selectedGroupBounds.xMm - 4}
                    y={selectedGroupBounds.yMm - 4}
                    width={selectedGroupBounds.widthMm + 8}
                    height={selectedGroupBounds.heightMm + 8}
                    fill="rgba(37, 99, 235, 0.04)"
                    stroke="#2563eb"
                    strokeWidth="1.5"
                    strokeDasharray="5,3"
                    rx="4"
                  />
                  <rect
                    x={selectedGroupBounds.xMm - 4}
                    y={selectedGroupBounds.yMm - 20}
                    width="82"
                    height="14"
                    fill="#2563eb"
                    rx="3"
                  />
                  <text
                    x={selectedGroupBounds.xMm + 37}
                    y={selectedGroupBounds.yMm - 10.5}
                    textAnchor="middle"
                    fontSize="7"
                    fill="#ffffff"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {selectedItems.length} item ({selectedGroupBounds.widthMm}×{selectedGroupBounds.heightMm})
                  </text>
                </g>
              )}

              {/* 4. Garis Ukur CAD (Dimension Callouts) untuk Item yang Sedang Dipilih */}
              {selectedItem && (
                <g id="cad-dimension-callouts" pointerEvents="none">
                  {/* Garis Ukur Lebar (Width mm) */}
                  <g transform={`translate(${selectedItem.xMm}, ${selectedItem.yMm})`}>
                    <line
                      x1="0"
                      y1="-8"
                      x2={selectedItem.widthMm}
                      y2="-8"
                      stroke="#2563eb"
                      strokeWidth="1.2"
                      strokeDasharray="2,2"
                    />
                    <line x1="0" y1="-12" x2="0" y2="-4" stroke="#2563eb" strokeWidth="1.5" />
                    <line
                      x1={selectedItem.widthMm}
                      y1="-12"
                      x2={selectedItem.widthMm}
                      y2="-4"
                      stroke="#2563eb"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={selectedItem.widthMm / 2 - 24}
                      y="-19"
                      width="48"
                      height="13"
                      fill="#2563eb"
                      rx="3"
                    />
                    <text
                      x={selectedItem.widthMm / 2}
                      y="-10"
                      textAnchor="middle"
                      fontSize="7"
                      fill="#ffffff"
                      fontWeight="extrabold"
                      fontFamily="monospace"
                    >
                      {selectedItem.widthMm} mm
                    </text>
                  </g>

                  {/* Garis Ukur Tinggi (Height mm) */}
                  <g transform={`translate(${selectedItem.xMm}, ${selectedItem.yMm})`}>
                    <line
                      x1="-8"
                      y1="0"
                      x2="-8"
                      y2={selectedItem.heightMm}
                      stroke="#2563eb"
                      strokeWidth="1.2"
                      strokeDasharray="2,2"
                    />
                    <line x1="-12" y1="0" x2="-4" y2="0" stroke="#2563eb" strokeWidth="1.5" />
                    <line
                      x1="-12"
                      y1={selectedItem.heightMm}
                      x2="-4"
                      y2={selectedItem.heightMm}
                      stroke="#2563eb"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="-38"
                      y={selectedItem.heightMm / 2 - 6.5}
                      width="30"
                      height="13"
                      fill="#2563eb"
                      rx="3"
                    />
                    <text
                      x="-23"
                      y={selectedItem.heightMm / 2 + 2.5}
                      textAnchor="middle"
                      fontSize="7"
                      fill="#ffffff"
                      fontWeight="extrabold"
                      fontFamily="monospace"
                    >
                      {selectedItem.heightMm} mm
                    </text>
                  </g>
                </g>
              )}

              {/* 4.5. Garis Magnet & Smart Alignment Guides Overlay (Center Plat, Center HMI, Sejajar Tombol & Spasi) */}
              {activeGuides.length > 0 && (
                <g id="magnetic-guides-overlay" pointerEvents="none">
                  {activeGuides.map((guide) => {
                    const badgeWidth = guide.label.length * 5.4 + 14;
                    const badgeHeight = 14;

                    if (guide.type === "HORIZONTAL") {
                      const labelX = Math.min(
                        layoutData.enclosure.widthMm - badgeWidth - 8,
                        Math.max(8, (guide.startMm + guide.endMm) / 2 - badgeWidth / 2)
                      );
                      const labelY = Math.max(2, guide.positionMm - badgeHeight - 2);

                      return (
                        <g key={guide.id} className="animate-in fade-in duration-75">
                          {/* Garis Pijar Luar (Glow Aura) */}
                          <line
                            x1={guide.startMm}
                            y1={guide.positionMm}
                            x2={guide.endMm}
                            y2={guide.positionMm}
                            stroke={guide.color}
                            strokeWidth="4"
                            strokeOpacity="0.3"
                          />
                          {/* Garis Magnet Presisi */}
                          <line
                            x1={guide.startMm}
                            y1={guide.positionMm}
                            x2={guide.endMm}
                            y2={guide.positionMm}
                            stroke={guide.color}
                            strokeWidth="1.5"
                            strokeDasharray={guide.isPlateCenter ? "8,4" : "5,3"}
                          />
                          {/* Titik Jangkar Ujung */}
                          <circle
                            cx={guide.startMm}
                            cy={guide.positionMm}
                            r="2.5"
                            fill="#ffffff"
                            stroke={guide.color}
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={guide.endMm}
                            cy={guide.positionMm}
                            r="2.5"
                            fill="#ffffff"
                            stroke={guide.color}
                            strokeWidth="1.5"
                          />

                          {/* Floating Badge Label Magnet */}
                          <g transform={`translate(${labelX}, ${labelY})`}>
                            <rect
                              x="0"
                              y="0"
                              width={badgeWidth}
                              height={badgeHeight}
                              rx="4"
                              fill={guide.color}
                              stroke="#ffffff"
                              strokeWidth="0.8"
                              className="shadow-sm"
                            />
                            <text
                              x={badgeWidth / 2}
                              y="10"
                              textAnchor="middle"
                              fontSize="7.5"
                              fontWeight="800"
                              fill="#ffffff"
                              fontFamily="sans-serif"
                            >
                              {guide.label}
                            </text>
                          </g>
                        </g>
                      );
                    } else {
                      // VERTICAL GUIDE
                      const labelX = Math.min(
                        layoutData.enclosure.widthMm - badgeWidth - 6,
                        guide.positionMm + 4
                      );
                      const labelY = Math.min(
                        layoutData.enclosure.heightMm - badgeHeight - 6,
                        Math.max(6, (guide.startMm + guide.endMm) / 2 - badgeHeight / 2)
                      );

                      return (
                        <g key={guide.id} className="animate-in fade-in duration-75">
                          {/* Garis Pijar Luar (Glow Aura) */}
                          <line
                            x1={guide.positionMm}
                            y1={guide.startMm}
                            x2={guide.positionMm}
                            y2={guide.endMm}
                            stroke={guide.color}
                            strokeWidth="4"
                            strokeOpacity="0.3"
                          />
                          {/* Garis Magnet Presisi */}
                          <line
                            x1={guide.positionMm}
                            y1={guide.startMm}
                            x2={guide.positionMm}
                            y2={guide.endMm}
                            stroke={guide.color}
                            strokeWidth="1.5"
                            strokeDasharray={guide.isPlateCenter ? "8,4" : "5,3"}
                          />
                          {/* Titik Jangkar Ujung */}
                          <circle
                            cx={guide.positionMm}
                            cy={guide.startMm}
                            r="2.5"
                            fill="#ffffff"
                            stroke={guide.color}
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={guide.positionMm}
                            cy={guide.endMm}
                            r="2.5"
                            fill="#ffffff"
                            stroke={guide.color}
                            strokeWidth="1.5"
                          />

                          {/* Spacing Indicator (Jika snap ke jarak spasi simetris) */}
                          {guide.spacingIndicator && (
                            <g>
                              <line
                                x1={guide.spacingIndicator.x1}
                                y1={guide.spacingIndicator.y}
                                x2={guide.spacingIndicator.x2}
                                y2={guide.spacingIndicator.y}
                                stroke="#10b981"
                                strokeWidth="1.5"
                              />
                              <line
                                x1={guide.spacingIndicator.x1}
                                y1={guide.spacingIndicator.y - 4}
                                x2={guide.spacingIndicator.x1}
                                y2={guide.spacingIndicator.y + 4}
                                stroke="#10b981"
                                strokeWidth="1.5"
                              />
                              <line
                                x1={guide.spacingIndicator.x2}
                                y1={guide.spacingIndicator.y - 4}
                                x2={guide.spacingIndicator.x2}
                                y2={guide.spacingIndicator.y + 4}
                                stroke="#10b981"
                                strokeWidth="1.5"
                              />
                            </g>
                          )}

                          {/* Floating Badge Label Magnet */}
                          <g transform={`translate(${labelX}, ${labelY})`}>
                            <rect
                              x="0"
                              y="0"
                              width={badgeWidth}
                              height={badgeHeight}
                              rx="4"
                              fill={guide.color}
                              stroke="#ffffff"
                              strokeWidth="0.8"
                              className="shadow-sm"
                            />
                            <text
                              x={badgeWidth / 2}
                              y="10"
                              textAnchor="middle"
                              fontSize="7.5"
                              fontWeight="800"
                              fill="#ffffff"
                              fontFamily="sans-serif"
                            >
                              {guide.label}
                            </text>
                          </g>
                        </g>
                      );
                    }
                  })}
                </g>
              )}

              {/* 5. Handle Tarik Ukuran Plat Panel (Corner Resize) */}
              <g
                transform={`translate(${layoutData.enclosure.widthMm}, ${layoutData.enclosure.heightMm})`}
                className="cursor-nwse-resize"
                onMouseDown={(e) => handleStartResize(e, "ENCLOSURE", "CORNER")}
              >
                <circle cx="0" cy="0" r="8" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                <path d="M -4 0 L 0 0 L 0 -4 M -2 2 L 2 -2" stroke="#ffffff" strokeWidth="1.5" />
              </g>
            </svg>
          </div>
        </div>

        {/* Panel Multi-Select Inspector saat memilih >= 2 item (Ctrl + Klik Kiri) */}
        {selectedItems.length > 1 && (
          <div
            className="absolute top-3 right-3 bottom-3 w-80 max-w-[calc(100%-1.5rem)] bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-blue-200 p-3 z-30 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Multi-Select */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  <span className="font-extrabold text-xs text-slate-900 truncate">
                    {selectedItems.length} Item Terpilih
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  Seret item mana saja untuk geser bersamaan
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleRotateSelected}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition shadow-2xs"
                  title="Putar semua item terpilih 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition shadow-2xs"
                  title="Hapus semua item terpilih (Delete)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer transition shadow-2xs"
                  title="Batal Pilihan (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-2.5 pr-0.5 text-xs">
              {/* Sejajarkan (Align) */}
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-1.5">
                <div className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                  Sejajarkan Item (Align)
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      ["LEFT", "Rata Kiri"],
                      ["CENTER_X", "Tengah H"],
                      ["RIGHT", "Rata Kanan"],
                      ["TOP", "Rata Atas"],
                      ["CENTER_Y", "Tengah V"],
                      ["BOTTOM", "Rata Bawah"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleAlignSelected(mode)}
                      className="px-1.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer transition"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleDistributeHorizontal}
                  className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-extrabold cursor-pointer transition flex items-center justify-center gap-1.5 mt-1 shadow-2xs"
                  title="Bagi rata jarak spasi horizontal antar tombol dan luruskan sumbu Y agar baris tombol simetris rapi"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>Bagi Rata Spasi &amp; Luruskan Baris</span>
                </button>
              </div>

              {/* Geser Serentak (Nudge) */}
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    Geser Serentak (mm)
                  </span>
                  <span className="text-[10px] text-slate-400">Panah / Shift+Panah</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => handleNudgeSelected(-10, 0)}
                    className="py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                  >
                    ← 10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNudgeSelected(0, -10)}
                    className="py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                  >
                    ↑ 10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNudgeSelected(0, 10)}
                    className="py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                  >
                    ↓ 10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNudgeSelected(10, 0)}
                    className="py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                  >
                    10 →
                  </button>
                </div>
              </div>

              {/* Daftar Item Terpilih */}
              <div className="space-y-1">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Daftar Item ({selectedItems.length})
                </div>
                <div className="space-y-1">
                  {selectedItems.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-1.5 p-1.5 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition"
                    >
                      <button
                        type="button"
                        onClick={() => selectSingleItem(it.id)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                        title="Klik untuk edit item ini saja"
                      >
                        <div className="font-bold text-[11px] text-slate-800 truncate">
                          {it.tagLabel || it.name}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono truncate">
                          {it.widthMm}×{it.heightMm} mm • ({it.xMm}, {it.yMm})
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedItemIds((prev) => prev.filter((id) => id !== it.id))}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer shrink-0"
                        title="Keluarkan dari pilihan"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel Deskripsi Inspector Part di Kanan dalam Ruang Hitam */}
        {selectedItem && (
          <div
            className="absolute top-3 right-3 bottom-3 w-80 max-w-[calc(100%-1.5rem)] bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-slate-200/90 p-3 z-30 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Inspector */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  <span className="font-extrabold text-xs text-slate-900 truncate" title={selectedItem.name}>
                    {selectedItem.name}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">
                  Tipe: {selectedItem.type} • Tag: {selectedItem.tagLabel || "-"}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleRotateSelected}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition shadow-2xs"
                  title="Putar 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition shadow-2xs"
                  title="Hapus part ini dari panel (Delete)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer transition shadow-2xs"
                  title="Tutup Pilihan (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto space-y-3 pt-2.5 pr-0.5">
              {/* INSPECTOR KHUSUS: KABEL DUCT HORIZONTAL */}
              {selectedItem.type === "DUCT_HORIZONTAL" && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-slate-700">Profil Tebal:</label>
                    <select
                      value={
                        DUCT_PROFILES.find((p) => p.widthMm === selectedItem.heightMm)?.code ||
                        "45x65"
                      }
                      onChange={(e) => {
                        const prof = DUCT_PROFILES.find((p) => p.code === e.target.value);
                        if (prof) {
                          handleUpdateSelectedItem({
                            heightMm: prof.widthMm,
                            profileSize: prof.code,
                            tagLabel: `DUCT ${prof.code}`,
                          });
                        }
                      }}
                      className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    >
                      {DUCT_PROFILES.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name} ({p.badge})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Panjang Duct (mm):
                      </label>
                      <span className="text-[11px] font-extrabold text-blue-600">
                        {selectedItem.widthMm} mm
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <DeferredNumberInput
                        min={20}
                        max={2500}
                        value={selectedItem.widthMm}
                        onCommit={(val) =>
                          handleUpdateSelectedItem({
                            widthMm: val,
                          })
                        }
                        className="w-18 px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-900 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            widthMm: Math.max(20, selectedItem.widthMm - 50),
                          })
                        }
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        -50
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            widthMm: Math.max(20, selectedItem.widthMm - 10),
                          })
                        }
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            widthMm: selectedItem.widthMm + 10,
                          })
                        }
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            widthMm: selectedItem.widthMm + 50,
                          })
                        }
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        +50
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            widthMm: layoutData.enclosure.widthMm - 140,
                            xMm: 70,
                          })
                        }
                        className="px-1.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Penuh
                      </button>
                    </div>
                  </div>

                  {/* Alignment Cepat */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                    <span className="font-bold text-slate-500">Posisi Y: {selectedItem.yMm} mm</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateSelectedItem({ xMm: 30 })}
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700 cursor-pointer"
                      >
                        Rata Kiri
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            xMm: Math.round(
                              (layoutData.enclosure.widthMm - selectedItem.widthMm) / 2
                            ),
                          })
                        }
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700 cursor-pointer"
                      >
                        Tengah
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            xMm: layoutData.enclosure.widthMm - 30 - selectedItem.widthMm,
                          })
                        }
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700 cursor-pointer"
                      >
                        Rata Kanan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* INSPECTOR KHUSUS: KABEL DUCT VERTIKAL */}
              {selectedItem.type === "DUCT_VERTICAL" && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-slate-700">Profil Lebar:</label>
                    <select
                      value={
                        DUCT_PROFILES.find((p) => p.widthMm === selectedItem.widthMm)?.code ||
                        "45x65"
                      }
                      onChange={(e) => {
                        const prof = DUCT_PROFILES.find((p) => p.code === e.target.value);
                        if (prof) {
                          handleUpdateSelectedItem({
                            widthMm: prof.widthMm,
                            profileSize: prof.code,
                            tagLabel: `DUCT ${prof.code}`,
                          });
                        }
                      }}
                      className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    >
                      {DUCT_PROFILES.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name} ({p.badge})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Panjang / Tinggi Duct (mm):
                      </label>
                      <span className="text-[11px] font-extrabold text-blue-600">
                        {selectedItem.heightMm} mm
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <DeferredNumberInput
                        min={20}
                        max={2500}
                        value={selectedItem.heightMm}
                        onCommit={(val) =>
                          handleUpdateSelectedItem({
                            heightMm: val,
                          })
                        }
                        className="w-18 px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-900 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            heightMm: Math.max(20, selectedItem.heightMm - 50),
                          })
                        }
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        -50
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            heightMm: Math.max(20, selectedItem.heightMm - 10),
                          })
                        }
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            heightMm: selectedItem.heightMm + 10,
                          })
                        }
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            heightMm: selectedItem.heightMm + 50,
                          })
                        }
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        +50
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            heightMm: layoutData.enclosure.heightMm - 140,
                            yMm: 70,
                          })
                        }
                        className="px-1.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Penuh
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                    <span className="font-bold text-slate-500">Posisi X: {selectedItem.xMm} mm</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateSelectedItem({ yMm: 30 })}
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700 cursor-pointer"
                      >
                        Rata Atas
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            yMm: Math.round(
                              (layoutData.enclosure.heightMm - selectedItem.heightMm) / 2
                            ),
                          })
                        }
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700 cursor-pointer"
                      >
                        Tengah
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem({
                            yMm: layoutData.enclosure.heightMm - 30 - selectedItem.heightMm,
                          })
                        }
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700 cursor-pointer"
                      >
                        Rata Bawah
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* INSPECTOR KHUSUS: DIN RAIL TS35 (Horizontal & Vertikal) */}
              {selectedItem.type === "DIN_RAIL" && (() => {
                const isVerticalRail = selectedItem.heightMm > selectedItem.widthMm;
                const railLength = isVerticalRail ? selectedItem.heightMm : selectedItem.widthMm;
                const enclosureSpan = isVerticalRail
                  ? layoutData.enclosure.heightMm
                  : layoutData.enclosure.widthMm;
                const applyLength = (val: number) =>
                  handleUpdateSelectedItem(isVerticalRail ? { heightMm: val } : { widthMm: val });

                return (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {isVerticalRail ? "Panjang Rel Vertikal (mm):" : "Panjang Rel (mm):"}
                      </label>
                      <span className="text-[11px] font-extrabold text-blue-600">
                        {railLength} mm
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <DeferredNumberInput
                        min={30}
                        max={2500}
                        value={railLength}
                        onCommit={applyLength}
                        className="w-18 px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-900 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => applyLength(Math.max(30, railLength - 50))}
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        -50
                      </button>
                      <button
                        type="button"
                        onClick={() => applyLength(railLength + 50)}
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        +50
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem(
                            isVerticalRail
                              ? { heightMm: Math.max(80, enclosureSpan - 96), yMm: 48 }
                              : { widthMm: Math.max(80, enclosureSpan - 160), xMm: 80 }
                          )
                        }
                        className="px-1.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Penuh
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedItem(
                            isVerticalRail
                              ? { yMm: Math.round((enclosureSpan - railLength) / 2) }
                              : { xMm: Math.round((enclosureSpan - railLength) / 2) }
                          )
                        }
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Tengah
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* INSPECTOR KHUSUS: COMPONENT PR */}
              {selectedItem.type === "COMPONENT" && (() => {
                const compPR = components.find((c) => c.id === selectedItem.componentId);
                const resolvedPartType = compPR?.partType || selectedItem.partType || "";
                const resolvedPartName = compPR?.partName || selectedItem.partName || selectedItem.name;
                const standardVisual = inferComponentVisual(resolvedPartType, resolvedPartName);
                const isOutOfSync =
                  selectedItem.widthMm !== standardVisual.widthMm ||
                  selectedItem.heightMm !== standardVisual.heightMm ||
                  selectedItem.category !== standardVisual.category ||
                  selectedItem.tagLabel !== standardVisual.defaultTag;

                return (
                  <div className="space-y-2.5 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Standar Datasheet 2D:</span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          {standardVisual.widthMm} × {standardVisual.heightMm} mm ({standardVisual.defaultTag})
                        </span>
                      </div>
                      {isOutOfSync && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateSelectedItem({
                              widthMm: standardVisual.widthMm,
                              heightMm: standardVisual.heightMm,
                              category: standardVisual.category,
                              tagLabel: standardVisual.defaultTag,
                              specificModel: standardVisual.specificModel,
                            })
                          }
                          className="w-full py-1.5 px-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg font-bold text-[10px] cursor-pointer transition shadow-xs flex items-center justify-center gap-1.5"
                          title="Terapkan ukuran dan kategori sesuai standar datasheet resmi"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset ke Datasheet Resmi ({standardVisual.widthMm}×{standardVisual.heightMm} mm)</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Lebar (W) mm:
                        </label>
                        <DeferredNumberInput
                          min={5}
                          max={1000}
                          value={selectedItem.widthMm}
                          onCommit={(val) =>
                            handleUpdateSelectedItem({
                              widthMm: val,
                            })
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-center font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Tinggi (H) mm:
                        </label>
                        <DeferredNumberInput
                          min={5}
                          max={1000}
                          value={selectedItem.heightMm}
                          onCommit={(val) =>
                            handleUpdateSelectedItem({
                              heightMm: val,
                            })
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-center font-bold text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Label Tag:
                      </label>
                      <input
                        type="text"
                        value={selectedItem.tagLabel || ""}
                        onChange={(e) => handleUpdateSelectedItem({ tagLabel: e.target.value })}
                        placeholder="Tag label..."
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-slate-800 text-xs"
                      />
                    </div>

                    {/* Presisi & Simetris (Center) */}
                    <div className="bg-fuchsia-50/70 p-2.5 rounded-xl border border-fuchsia-200 space-y-1.5 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-fuchsia-900 uppercase tracking-wider flex items-center gap-1">
                          <Magnet className="w-3 h-3 text-fuchsia-600" />
                          Presisi &amp; Simetris (Center)
                        </span>
                        <span className="text-[9px] text-fuchsia-600 font-semibold">1-Klik Magnet</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCenterSingleItem("X")}
                          className="px-2 py-1.5 bg-white hover:bg-fuchsia-100 hover:text-fuchsia-800 border border-fuchsia-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer transition shadow-2xs text-center"
                          title="Tempatkan tepat di tengah plat secara horizontal (Center X)"
                        >
                          Pusat Plat (X)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCenterSingleItem("Y")}
                          className="px-2 py-1.5 bg-white hover:bg-fuchsia-100 hover:text-fuchsia-800 border border-fuchsia-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer transition shadow-2xs text-center"
                          title="Tempatkan tepat di tengah plat secara vertikal (Center Y)"
                        >
                          Pusat Plat (Y)
                        </button>
                        {layoutData.items.some((i) => i.category === "HMI" && i.id !== selectedItem.id) && (
                          <button
                            type="button"
                            onClick={handleCenterUnderHmi}
                            className="col-span-2 px-2 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-[10px] font-bold text-blue-700 cursor-pointer transition shadow-2xs flex items-center justify-center gap-1.5"
                            title="Luruskan tombol tepat di tengah garis vertikal layar HMI"
                          >
                            <Monitor className="w-3.5 h-3.5 text-blue-600" />
                            <span>Luruskan Tepat Bawah HMI</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* Modal Gambar Kerja Resmi Standar Twintech Precision (DWG / PDF) */}
      <PanelDrawingSheetModal
        isOpen={cadDrawingModalOpen}
        onClose={() => setCadDrawingModalOpen(false)}
        mode={
          activePanelMode === "OUTER"
            ? "OUTER"
            : activePanelMode === "HMI"
              ? "HMI"
              : "MAIN"
        }
        plateWidth={
          activePanelMode === "OUTER"
            ? outerPanelData.enclosure.widthMm
            : layoutData.enclosure.widthMm
        }
        plateHeight={
          activePanelMode === "OUTER"
            ? outerPanelData.enclosure.heightMm
            : layoutData.enclosure.heightMm
        }
        items={layoutData.items}
        outerPanel={outerPanelData}
        project={{
          kode: projectKode || "26-TBD-0513",
          nama: projectNama || "PROJECT AUTOMATION",
          client: projectClient,
          pic: projectPic,
        }}
      />
    </div>
  );
}
