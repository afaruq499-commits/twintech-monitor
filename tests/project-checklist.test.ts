import { describe, expect, it } from "vitest";
import {
  ADMIN_MANUAL_CHECKLIST_KEYS,
  PROJECT_CHECKLIST_KEYS,
  computeChecklistProgress,
  deriveChecklistDetection,
  isAdminOnlyChecklistKey,
  parseFileChecklistJson,
} from "../src/lib/project-checklist";

describe("project-checklist", () => {
  it("mengidentifikasi berkas verifikasi manual khusus Admin dengan benar", () => {
    expect(ADMIN_MANUAL_CHECKLIST_KEYS).toEqual([
      "komponen_pr",
      "layout_panel_hmi",
      "layout_panel_utama",
    ]);

    expect(isAdminOnlyChecklistKey("komponen_pr")).toBe(true);
    expect(isAdminOnlyChecklistKey("layout_panel_hmi")).toBe(true);
    expect(isAdminOnlyChecklistKey("layout_panel_utama")).toBe(true);
    expect(isAdminOnlyChecklistKey("flowchart")).toBe(false);
    expect(isAdminOnlyChecklistKey("diagram_wiring")).toBe(false);
    expect(isAdminOnlyChecklistKey("pemprograman")).toBe(false);
    expect(isAdminOnlyChecklistKey("schedule_pengerjaan")).toBe(false);
    expect(isAdminOnlyChecklistKey("alamat_io")).toBe(false);
  });

  it("mengembalikan 0/8 (0%) jika proyek belum memiliki berkas maupun centang manual", () => {
    const detection = deriveChecklistDetection({
      componentsCount: 0,
      lanesCount: 0,
      scheduleCellsCount: 0,
    });
    const res = computeChecklistProgress({}, detection);
    expect(res.completedCount).toBe(0);
    expect(res.totalCount).toBe(8);
    expect(res.progressPct).toBe(0);
  });

  it("komponen PR dan layout panel/HMI tidak lagi otomatis tercentang meskipun data ada di sistem", () => {
    const detection = deriveChecklistDetection({
      prStatus: "PREPARED",
      componentsCount: 24,
      lanesCount: 0,
      scheduleCellsCount: 0,
      panelLayoutJson: JSON.stringify({
        main: { items: new Array(36).fill({ id: "m" }) },
        hmi: { items: new Array(6).fill({ id: "h" }) },
      }),
      flowSequenceJson: JSON.stringify({ nodes: [{ id: "1" }] }),
      plcAddressesJson: null,
      wiringDiagramPdfUrl: null,
      plcProgramFileUrl: null,
    });

    // Auto detection tetap mendeteksi adanya data di proyek
    expect(detection.componentsCount).toBe(24);
    expect(detection.hasPanelMain).toBe(true);
    expect(detection.panelMainCount).toBe(36);
    expect(detection.hasPanelHmi).toBe(true);
    expect(detection.panelHmiCount).toBe(6);
    expect(detection.hasFlowchart).toBe(true);

    const res = computeChecklistProgress({}, detection);

    // Namun autoByKey untuk berkas khusus admin harus false (manual checklist only)
    expect(res.autoByKey.komponen_pr).toBe(false);
    expect(res.autoByKey.layout_panel_hmi).toBe(false);
    expect(res.autoByKey.layout_panel_utama).toBe(false);

    // Berkas umum (flowchart) tetap auto-detected true
    expect(res.autoByKey.flowchart).toBe(true);
    expect(res.autoByKey.schedule_pengerjaan).toBe(false);
    expect(res.autoByKey.alamat_io).toBe(false);
    expect(res.autoByKey.diagram_wiring).toBe(false);
    expect(res.autoByKey.pemprograman).toBe(false);

    // Total selesai hanya 1 (flowchart saja) karena berkas admin belum diverifikasi manual
    expect(res.completedCount).toBe(1);
    expect(res.progressPct).toBe(13); // 1 / 8 = 12.5% -> 13%
  });

  it("berkas khusus admin selesai jika diverifikasi manual melalui checklistState", () => {
    const detection = deriveChecklistDetection({
      componentsCount: 5,
      lanesCount: 1,
      scheduleCellsCount: 0,
      flowSequenceJson: "{}",
    });
    const manualState = parseFileChecklistJson(
      JSON.stringify({
        komponen_pr: { checked: true, updatedAt: new Date().toISOString(), updatedBy: "Faruq (ADMIN)" },
        layout_panel_hmi: { checked: true },
        layout_panel_utama: { checked: true },
        alamat_io: { checked: true },
        diagram_wiring: { checked: true },
        pemprograman: { checked: false },
      })
    );
    const res = computeChecklistProgress(manualState, detection);
    // 5 manual checked (komponen_pr, layout_panel_hmi, layout_panel_utama, alamat_io, diagram_wiring) + 1 auto (flowchart) = 6
    expect(res.completedCount).toBe(6);
    expect(res.progressPct).toBe(75);
  });

  it("mendukung panelLayoutJson format array lama dan JSON rusak secara aman", () => {
    const legacy = deriveChecklistDetection({
      componentsCount: 0,
      lanesCount: 0,
      scheduleCellsCount: 0,
      panelLayoutJson: JSON.stringify([{ id: "p1" }, { id: "p2" }]),
    });
    expect(legacy.hasPanelMain).toBe(true);
    expect(legacy.panelMainCount).toBe(2);
    expect(legacy.hasPanelHmi).toBe(false);

    const broken = deriveChecklistDetection({
      componentsCount: 0,
      lanesCount: 0,
      scheduleCellsCount: 0,
      panelLayoutJson: "{not-json",
      plcAddressesJson: "{raw-text-non-array",
    });
    expect(broken.hasPanelMain).toBe(false);
    expect(broken.hasPlcAddresses).toBe(true);
    expect(parseFileChecklistJson("{broken")).toEqual({});
    expect(parseFileChecklistJson("[]")).toEqual({});
  });

  it("mencapai 8/8 (100%) saat semua 8 ceklis selesai", () => {
    const allChecked = Object.fromEntries(
      PROJECT_CHECKLIST_KEYS.map((k) => [k, { checked: true }])
    );
    const detection = deriveChecklistDetection({
      componentsCount: 0,
      lanesCount: 0,
      scheduleCellsCount: 0,
    });
    const res = computeChecklistProgress(allChecked, detection);
    expect(res.completedCount).toBe(8);
    expect(res.progressPct).toBe(100);
  });
});
