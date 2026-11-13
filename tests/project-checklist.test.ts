import { describe, expect, it } from "vitest";
import {
  PROJECT_CHECKLIST_KEYS,
  computeChecklistProgress,
  deriveChecklistDetection,
  parseFileChecklistJson,
} from "../src/lib/project-checklist";

describe("project-checklist", () => {
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

  it("menghitung progress 4/8 (50%) sesuai deteksi otomatis 4 berkas terisi", () => {
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
    const res = computeChecklistProgress({}, detection);

    expect(res.autoByKey.komponen_pr).toBe(true);
    expect(res.autoByKey.layout_panel_hmi).toBe(true);
    expect(res.autoByKey.layout_panel_utama).toBe(true);
    expect(res.autoByKey.flowchart).toBe(true);
    expect(res.autoByKey.schedule_pengerjaan).toBe(false);
    expect(res.autoByKey.alamat_io).toBe(false);
    expect(res.autoByKey.diagram_wiring).toBe(false);
    expect(res.autoByKey.pemprograman).toBe(false);
    expect(res.completedCount).toBe(4);
    expect(res.progressPct).toBe(50);
  });

  it("menggabungkan centang manual tanpa menghitung ganda item yang sudah auto-detected", () => {
    const detection = deriveChecklistDetection({
      componentsCount: 5,
      lanesCount: 1,
      scheduleCellsCount: 0,
      flowSequenceJson: "{}",
    });
    const manualState = parseFileChecklistJson(
      JSON.stringify({
        komponen_pr: { checked: true }, // sudah autoDetected -> tidak double count
        alamat_io: { checked: true }, // manual baru -> +1
        diagram_wiring: { checked: true }, // manual baru -> +1
        pemprograman: { checked: false },
      })
    );
    const res = computeChecklistProgress(manualState, detection);
    expect(res.completedCount).toBe(4);
    expect(res.progressPct).toBe(50);
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
