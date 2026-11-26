import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { exportJobdeskPlanToExcelBuffer } from "@/lib/export/jobdesk-exporter";
import {
  autoDistributeUnassignedJobdesks,
  createDefaultJobdeskPlanData,
  DEFAULT_SUB_JOBDESK_NOTE,
  extractAvailableProjectJobdesks,
  formatDayShortLabel,
  generateConsecutiveDayColumns,
  jobdeskPlanDataSchema,
  type ProjectJobdeskSourceInput,
} from "@/lib/jobdesk-plan";

describe("jobdesk-plan helpers & Excel export", () => {
  it("generates Day (tgl) columns only and never outputs Week headers", () => {
    const cols = generateConsecutiveDayColumns("2026-11-26", 5, false);
    expect(cols).toHaveLength(5);
    expect(cols[0]).toEqual({
      id: "day-2026-11-26",
      dateIso: "2026-11-26",
      label: formatDayShortLabel("2026-11-26"),
    });
    expect(cols[0].label).toContain("26 Nov");
    for (const col of cols) {
      expect(col.label.toLowerCase()).not.toContain("week");
    }
  });

  it("extracts unfinished jobdesks from active queued projects only and marks delayed wiring", () => {
    const projects: ProjectJobdeskSourceInput[] = [
      {
        id: "p-active-1",
        kode: "TBU-1105",
        nama: "Conveyor Checker",
        client: "PT TBU",
        status: "MENUNGGU_KOMPONEN",
        prioritas: "TINGGI",
        deadline: "2026-12-01",
        urutanManual: 1,
        pic: "Faruq",
        prStatus: "APPROVED",
        plcAddressesJson: null,
        panelLayoutJson: null,
        flowSequenceJson: null,
        wiringDiagramPdfUrl: "https://example.com/wiring.pdf",
        wiringDiagramPdfName: "wiring.pdf",
        plcProgramFileUrl: null,
        plcProgramFileName: null,
        hmiProgramFileUrl: null,
        hmiProgramFileName: null,
        fileChecklistJson: null,
        components: [
          { statusPembelian: "SUDAH_DATANG", statusImport: "NORMAL" },
          { statusPembelian: "SUDAH_DIPESAN", statusImport: "NORMAL" },
        ],
        lanes: [
          {
            id: "lane-1",
            nama: "Main",
            pic: "Apip",
            workItems: [
              {
                id: "wi-done",
                jenis: "WIRING",
                judul: "Wiring Awal",
                pic: "Apip",
                scheduleCells: [{ status: "DONE" }],
              },
              {
                id: "wi-todo",
                jenis: "PROGRAMMING",
                judul: "Program PLC",
                pic: "Faruq",
                scheduleCells: [{ status: "ON_PROGRESS" }],
              },
            ],
          },
        ],
      },
      {
        id: "p-selesai",
        kode: "OLD-001",
        nama: "Proyek Lama Selesai",
        client: "PT Lama",
        status: "SELESAI",
        prioritas: "RENDAH",
        deadline: "2026-11-01",
        urutanManual: null,
        components: [],
        lanes: [],
      },
    ];

    const available = extractAvailableProjectJobdesks(projects, "2026-11-26");

    // Proyek SELESAI tidak boleh muncul
    expect(available.some((a) => a.projectId === "p-selesai")).toBe(false);
    // WorkItem yang semua cell-nya DONE tidak boleh muncul
    expect(available.some((a) => a.sourceKey === "wi:wi-done")).toBe(false);
    // WorkItem yang belum DONE muncul
    const plcWi = available.find((a) => a.sourceKey === "wi:wi-todo");
    expect(plcWi).toBeDefined();
    expect(plcWi?.category).toBe("PROGRAM");
    expect(plcWi?.isWiringDelayed).toBe(true);
    // Diagram wiring sudah ada URL PDF -> tidak muncul lagi di antrian belum selesai
    expect(
      available.some((a) => a.sourceKey === "chk:p-active-1:diagram_wiring")
    ).toBe(false);
    // HMI belum selesai -> muncul di antrian
    expect(
      available.some((a) => a.sourceKey === "chk:p-active-1:hmi")
    ).toBe(true);
  });

  it("auto-distributes unassigned jobdesks and places delayed HMI items in subJobdesks", () => {
    const plan = createDefaultJobdeskPlanData("2026-11-26", 3);
    const available = extractAvailableProjectJobdesks(
      [
        {
          id: "p1",
          kode: "MTM-1015",
          nama: "Auto Tester",
          client: "PT MTM",
          status: "MENUNGGU_KOMPONEN",
          prioritas: "TINGGI",
          deadline: "2026-11-30",
          urutanManual: 1,
          components: [{ statusPembelian: "BELUM_PR", statusImport: "NORMAL" }],
          lanes: [],
        },
      ],
      "2026-11-26"
    );

    const distributed = autoDistributeUnassignedJobdesks(plan, available, {
      putDelayedHmiToSub: true,
    });

    expect(
      distributed.subJobdesks.some((s) => s.title.includes("HMI MTM-1015"))
    ).toBe(true);
    const matrixCount = Object.values(distributed.cells).reduce(
      (sum, row) =>
        sum + Object.values(row).reduce((rSum, list) => rSum + list.length, 0),
      0
    );
    expect(matrixCount).toBeGreaterThan(0);
    expect(jobdeskPlanDataSchema.safeParse(distributed).success).toBe(true);
  });

  it("exports an Excel (.xlsx) buffer matching reference layout with Day headers and sub jobdesk", async () => {
    const plan = createDefaultJobdeskPlanData("2026-11-26", 3);
    plan.cells["Faruq"] = {
      [plan.days[0].id]: [
        {
          id: "c1",
          title: "Program TBI-1023 dan TBI-1018",
          category: "PROGRAM",
        },
      ],
    };
    plan.cells["Apip"] = {
      [plan.days[0].id]: [
        { id: "c2", title: "HMI TBU-1105", category: "HMI" },
      ],
    };
    plan.subJobdesks = [
      { id: "s1", title: "HMI TBU-1105", category: "HMI" },
      { id: "s2", title: "HMI MTM-1015", category: "HMI" },
    ];

    const buf = await exportJobdeskPlanToExcelBuffer(plan);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);

    const ws = wb.getWorksheet("Pembagian Jobdesk");
    expect(ws).toBeDefined();
    expect(ws!.getRow(1).getCell(2).value).toBe(plan.days[0].label);
    expect(String(ws!.getRow(1).getCell(2).value).toLowerCase()).not.toContain(
      "week"
    );
    expect(ws!.getRow(2).getCell(1).value).toBe("Faruq");
    expect(ws!.getRow(2).getCell(2).value).toBe("Program TBI-1023 dan TBI-1018");
    expect(ws!.getRow(6).getCell(2).value).toBe("sub jobdesk");
    expect(ws!.getRow(7).getCell(2).value).toBe("1. HMI TBU-1105");
    expect(ws!.getRow(8).getCell(2).value).toBe("2. HMI MTM-1015");
    expect(ws!.getRow(10).getCell(2).value).toBe(DEFAULT_SUB_JOBDESK_NOTE);
  });
});
