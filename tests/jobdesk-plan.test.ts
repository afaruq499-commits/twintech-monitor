import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { exportJobdeskPlanToExcelBuffer } from "@/lib/export/jobdesk-exporter";
import {
  autoDistributeUnassignedJobdesks,
  createDefaultJobdeskPlanData,
  DEFAULT_SUB_JOBDESK_NOTE,
  expandWorkingDateRange,
  extractAvailableProjectJobdesks,
  formatDayShortLabel,
  generateConsecutiveDayColumns,
  isWeekendIso,
  jobdeskPlanDataSchema,
  packPicScheduleTracks,
  stepWorkingDaysIso,
  syncScheduleProyekToJobdeskPlan,
  type ProjectJobdeskSourceInput,
} from "@/lib/jobdesk-plan";

describe("jobdesk-plan helpers, range-days, weekend skip, Schedule Proyek sync & Excel export", () => {
  it("skips Saturday & Sunday by default unless Urgent weekend dates are provided", () => {
    // 2026-11-26 = Kamis, 27 = Jumat, 28 = Sabtu (libur), 29 = Minggu (libur), 30 = Senin
    const cols = generateConsecutiveDayColumns("2026-11-26", 5, true);
    expect(cols.map((c) => c.dateIso)).toEqual([
      "2026-11-26",
      "2026-11-27",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
    for (const col of cols) {
      expect(isWeekendIso(col.dateIso)).toBe(false);
      expect(col.label.toLowerCase()).not.toContain("week");
    }

    // Jika ada pekerjaan Urgent di hari Sabtu (2026-11-28), tanggal tsb ikut ditampilkan
    const colsWithUrgent = generateConsecutiveDayColumns(
      "2026-11-26",
      4,
      true,
      ["2026-11-28"]
    );
    expect(colsWithUrgent.some((c) => c.dateIso === "2026-11-28")).toBe(true);
    expect(formatDayShortLabel("2026-11-28")).toContain("28 Nov");
  });

  it("steps and expands multi-day working ranges skipping Saturday & Sunday unless urgent", () => {
    // Dari Kamis 26 Nov, +2 hari kerja = Senin 30 Nov (lompati Sab 28 & Min 29)
    const endWorking = stepWorkingDaysIso("2026-11-26", 2, false);
    expect(endWorking).toBe("2026-11-30");

    const workingDates = expandWorkingDateRange("2026-11-26", "2026-11-30", false);
    expect(workingDates).toEqual(["2026-11-26", "2026-11-27", "2026-11-30"]);

    // Untuk pekerjaan Urgent, Sabtu & Minggu ikut terhitung
    const urgentDates = expandWorkingDateRange("2026-11-26", "2026-11-30", true);
    expect(urgentDates).toHaveLength(5);
  });

  it("automatically syncs Apip assigned on 27 Nov in Schedule Proyek into Pembagian Jobdesk", () => {
    const plan = createDefaultJobdeskPlanData("2026-11-26", 5, true);

    const projects: ProjectJobdeskSourceInput[] = [
      {
        id: "proj-tbu",
        kode: "26-TBU-1105",
        nama: "Conveyor Checker",
        client: "PT TBU",
        status: "WIRING",
        prioritas: "SEDANG",
        deadline: "2026-12-05",
        urutanManual: 1,
        pic: null,
        components: [],
        lanes: [
          {
            id: "lane-tbu",
            nama: "Main",
            pic: null,
            workItems: [
              {
                id: "wi-apip-27",
                jenis: "PROGRAMMING",
                judul: "HMI",
                pic: "Apip",
                scheduleCells: [
                  { tanggal: "2026-11-27", status: "TARGET" },
                ],
              },
              {
                id: "wi-faruq-range",
                jenis: "WIRING",
                judul: "Wiring Panel",
                pic: "Faruq",
                scheduleCells: [
                  { tanggal: "2026-11-26", status: "ON_PROGRESS" },
                  { tanggal: "2026-11-27", status: "ON_PROGRESS" },
                  { tanggal: "2026-11-30", status: "TARGET" },
                ],
              },
            ],
          },
        ],
      },
    ];

    const synced = syncScheduleProyekToJobdeskPlan(plan, projects);

    // Apip otomatis punya pekerjaan HMI 26-TBU-1105 di tanggal 2026-11-27
    const apipEntries = synced.cells["Apip"]?.["day-2026-11-27"] ?? [];
    expect(apipEntries).toHaveLength(1);
    expect(apipEntries[0].title).toContain("HMI");
    expect(apipEntries[0].title).toContain("26-TBU-1105");
    expect(apipEntries[0].syncedFromSchedule).toBe(true);
    expect(apipEntries[0].startDateIso).toBe("2026-11-27");
    expect(apipEntries[0].endDateIso).toBe("2026-11-27");

    // Faruq otomatis punya 1 bar multi-hari melintasi 26 Nov -> 30 Nov (lompati Sab/Min)
    const faruqPacked = packPicScheduleTracks(synced.cells["Faruq"], synced.days);
    expect(faruqPacked.tracks).toHaveLength(1);
    expect(faruqPacked.tracks[0][0].colSpan).toBe(3); // Kam 26, Jum 27, Sen 30
    expect(faruqPacked.tracks[0][0].workingDaysCount).toBe(3);
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
        wiringDiagramPdfUrl: "https://example.com/wiring.pdf",
        wiringDiagramPdfName: "wiring.pdf",
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
                scheduleCells: [{ tanggal: "2026-11-26", status: "DONE" }],
              },
              {
                id: "wi-todo",
                jenis: "PROGRAMMING",
                judul: "Program PLC",
                pic: "Faruq",
                scheduleCells: [{ tanggal: "2026-11-27", status: "ON_PROGRESS" }],
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

    expect(available.some((a) => a.projectId === "p-selesai")).toBe(false);
    expect(available.some((a) => a.sourceKey === "wi:wi-done")).toBe(false);
    const plcWi = available.find((a) => a.sourceKey === "wi:wi-todo");
    expect(plcWi?.category).toBe("PROGRAM");
    expect(plcWi?.isWiringDelayed).toBe(true);
  });

  it("auto-distributes unassigned jobdesks to working days only and delayed HMI to subJobdesks", () => {
    const plan = createDefaultJobdeskPlanData("2026-11-26", 3, true);
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
    expect(jobdeskPlanDataSchema.safeParse(distributed).success).toBe(true);
  });

  it("exports an Excel (.xlsx) buffer merging multi-day jobdesk ranges horizontally", async () => {
    const plan = createDefaultJobdeskPlanData("2026-11-26", 3, true);
    plan.cells["Faruq"] = {
      [plan.days[0].id]: [
        {
          id: "c1",
          title: "Program TBI-1023 dan TBI-1018",
          category: "PROGRAM",
          startDateIso: "2026-11-26",
          endDateIso: "2026-11-27", // 2 hari kerja berurutan -> merge B2:C2
        },
      ],
    };
    plan.cells["Apip"] = {
      [plan.days[1].id]: [
        {
          id: "c2",
          title: "HMI TBU-1105",
          category: "HMI",
          startDateIso: "2026-11-27",
          endDateIso: "2026-11-27",
        },
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
    expect(ws!.getRow(2).getCell(1).value).toBe("Faruq");
    expect(ws!.getRow(2).getCell(2).value).toBe("Program TBI-1023 dan TBI-1018");
    expect(ws!.getRow(2).getCell(2).isMerged).toBe(true);
    expect(ws!.getRow(2).getCell(3).isMerged).toBe(true);
    expect(ws!.getRow(3).getCell(3).value).toBe("HMI TBU-1105");
    expect(ws!.getRow(6).getCell(2).value).toBe("sub jobdesk");
    expect(ws!.getRow(7).getCell(2).value).toBe("1. HMI TBU-1105");
    expect(ws!.getRow(8).getCell(2).value).toBe("2. HMI MTM-1015");
    expect(ws!.getRow(10).getCell(2).value).toBe(DEFAULT_SUB_JOBDESK_NOTE);
  });
});
