import { describe, expect, it } from "vitest";
import {
  checkComponentReadinessWarning,
  checkScheduleConflict,
  findProposedDelays,
  type ScheduledWorkEntry,
} from "@/lib/schedule";
import { rankProjectPriorities } from "@/lib/priority/score";
import { createFullScheduleSchema } from "@/lib/validation/schemas";

describe("Deteksi Konflik Jadwal & Peringatan Komponen", () => {
  const existingEntries: ScheduledWorkEntry[] = [
    {
      cellId: "cell-1",
      workItemId: "wi-wiring-p1",
      judul: "Wiring Proyek 1",
      jenis: "WIRING",
      bolehParalel: false,
      projectId: "p1",
      projectNama: "Proyek 1",
      laneId: "l1",
      laneNama: "Panel Utama",
      tanggal: "2026-11-02", // Senin 2 Nov
      status: "TARGET",
    },
    {
      cellId: "cell-2",
      workItemId: "wi-comm-p2",
      judul: "Commissioning MGS",
      jenis: "COMMISSIONING",
      bolehParalel: false,
      projectId: "p2",
      projectNama: "MGS",
      laneId: "l2",
      laneNama: "Glasstech",
      tanggal: "2026-11-03", // Selasa 3 Nov
      status: "TARGET",
    },
  ];

  it("memblokir penambahan pekerjaan utama di tanggal yang sudah terisi dan memberi 3 saran tanggal kosong terdekat", () => {
    const res = checkScheduleConflict({
      targetDateIso: "2026-11-02",
      candidate: {
        workItemId: "wi-wiring-p3",
        judul: "Wiring Panel Jig",
        jenis: "WIRING",
        bolehParalel: false,
        projectId: "p3",
        projectNama: "Jig Insert Collar",
      },
      allEntries: existingEntries,
    });

    expect(res.blocked).toBe(true);
    expect(res.message).toContain("Tanggal Senin 2 Nov tabrakan dengan:");
    expect(res.message).toContain("1. Wiring Proyek 1 (Proyek 1)");
    expect(res.suggestions).toHaveLength(3);
    // 2026-11-03 sudah terisi Commissioning MGS, jadi tidak boleh disarankan!
    const suggestedDates = res.suggestions.map((s) => s.tanggal);
    expect(suggestedDates).not.toContain("2026-11-02");
    expect(suggestedDates).not.toContain("2026-11-03");
    expect(suggestedDates).toEqual(["2026-11-01", "2026-11-04", "2026-10-31"]);
  });

  it("mengizinkan MEETING dan pekerjaan bertanda bolehParalel di tanggal yang sudah penuh", () => {
    const meetingRes = checkScheduleConflict({
      targetDateIso: "2026-11-02",
      candidate: {
        workItemId: "wi-meet",
        judul: "Meeting Kickoff Client",
        jenis: "MEETING",
        bolehParalel: false,
        projectId: "p3",
        projectNama: "Jig Insert Collar",
      },
      allEntries: existingEntries,
    });
    expect(meetingRes.blocked).toBe(false);
    expect(meetingRes.exempt).toBe(true);

    const paralelRes = checkScheduleConflict({
      targetDateIso: "2026-11-02",
      candidate: {
        workItemId: "wi-par",
        judul: "Monitoring Burn-in Test",
        jenis: "TESTING_FAT",
        bolehParalel: true,
        projectId: "p3",
        projectNama: "Jig Insert Collar",
      },
      allEntries: existingEntries,
    });
    expect(paralelRes.blocked).toBe(false);
    expect(paralelRes.exempt).toBe(true);
  });

  it("mengizinkan beberapa proyek dikerjakan di hari yang sama saat fitur Proyek Paralel (projectBolehParalel) aktif", () => {
    // 1. Proyek kandidat berstatus Proyek Paralel -> bebas masuk di tanggal yang sudah terisi proyek lain
    const candidateParallelProject = checkScheduleConflict({
      targetDateIso: "2026-11-02",
      candidate: {
        workItemId: "wi-wiring-par-proj",
        judul: "Wiring Panel Paralel",
        jenis: "WIRING",
        bolehParalel: false,
        projectBolehParalel: true,
        projectId: "p-par",
        projectNama: "Proyek Paralel Baru",
      },
      allEntries: existingEntries,
    });
    expect(candidateParallelProject.blocked).toBe(false);
    expect(candidateParallelProject.exempt).toBe(true);

    // 2. Proyek yang sudah terjadwal berstatus Proyek Paralel -> tidak memblokir proyek normal lain di hari yang sama
    const entriesWithParallelProject: ScheduledWorkEntry[] = [
      {
        cellId: "cell-par-1",
        workItemId: "wi-p-par",
        judul: "Programming HMI Proyek Paralel",
        jenis: "PROGRAMMING",
        bolehParalel: false,
        projectBolehParalel: true,
        projectId: "p-par",
        projectNama: "Proyek Paralel A",
        laneId: "l-par",
        laneNama: "Main Line",
        tanggal: "2026-11-10",
        status: "TARGET",
      },
    ];
    const secondProjectSameDay = checkScheduleConflict({
      targetDateIso: "2026-11-10",
      candidate: {
        workItemId: "wi-p-normal",
        judul: "Wiring Panel Proyek B",
        jenis: "WIRING",
        bolehParalel: false,
        projectBolehParalel: false,
        projectId: "p-normal",
        projectNama: "Proyek Normal B",
      },
      allEntries: entriesWithParallelProject,
    });
    expect(secondProjectSameDay.blocked).toBe(false);
  });

  it("memvalidasi drag-and-drop secara konsisten: blokir ke tanggal penuh, izinkan ke tanggal kosong, dan tidak bentrok dengan diri sendiri", () => {
    // Drag wi-wiring-p1 dari 2026-11-02 ke 2026-11-03 (terisi Commissioning MGS) -> BLOKIR
    const dragBlocked = checkScheduleConflict({
      targetDateIso: "2026-11-03",
      moveFromDateIso: "2026-11-02",
      candidate: {
        workItemId: "wi-wiring-p1",
        judul: "Wiring Proyek 1",
        jenis: "WIRING",
        bolehParalel: false,
        projectId: "p1",
        projectNama: "Proyek 1",
      },
      allEntries: existingEntries,
    });
    expect(dragBlocked.blocked).toBe(true);
    // Karena 2026-11-02 sedang dikosongkan oleh drag ini, 2026-11-02 boleh muncul sebagai tanggal tersedia
    expect(dragBlocked.suggestions.map((s) => s.tanggal)).toContain("2026-11-04");

    // Update status wi-wiring-p1 pada tanggal yang sama (2026-11-02) -> TIDAK BENTROK dengan diri sendiri
    const sameCellUpdate = checkScheduleConflict({
      targetDateIso: "2026-11-02",
      candidate: {
        workItemId: "wi-wiring-p1",
        judul: "Wiring Proyek 1",
        jenis: "WIRING",
        bolehParalel: false,
        projectId: "p1",
        projectNama: "Proyek 1",
      },
      allEntries: existingEntries,
    });
    expect(sameCellUpdate.blocked).toBe(false);
  });

  it("mengeluarkan WARNING (bukan blokir) saat menjadwalkan Wiring pada proyek dengan komponen belum datang", () => {
    const warn = checkComponentReadinessWarning({
      jenis: "WIRING",
      projectComponents: [
        {
          id: "c1",
          kelompok: "Panel Utama",
          partType: "PLC_FX5U-32MR/ES",
          partName: "PLC",
          qty: 1,
          unit: "pcs",
          statusPembelian: "SUDAH_DATANG",
          estimasiTiba: null,
        },
        {
          id: "c2",
          kelompok: "Panel Utama",
          partType: "Autonics SPB-120-24",
          partName: "POWER SUPLAY",
          qty: 1,
          unit: "pcs",
          statusPembelian: "SUDAH_DIPESAN",
          estimasiTiba: "2026-11-05",
        },
      ],
    });

    expect(warn.hasWarning).toBe(true);
    expect(warn.missingComponents).toHaveLength(1);
    expect(warn.missingComponents[0].partType).toBe("Autonics SPB-120-24");
    expect(warn.message).toContain("ETA 5 Nov 2026");
  });

  it("mengusulkan status DELAY otomatis untuk sel jadwal masa lalu yang masih TARGET/ON_PROGRESS", () => {
    const proposed = findProposedDelays(
      [
        {
          id: "sc1",
          workItemId: "w1",
          workItemJudul: "Setting Rotary",
          laneId: "l1",
          laneNama: "Glasstech",
          projectId: "p1",
          projectNama: "MGS",
          tanggal: "2026-10-27",
          status: "TARGET",
          delayDikonfirmasi: false,
        },
        {
          id: "sc2",
          workItemId: "w2",
          workItemJudul: "Trial Robot",
          laneId: "l1",
          laneNama: "Glasstech",
          projectId: "p1",
          projectNama: "MGS",
          tanggal: "2026-10-27",
          status: "DONE",
          delayDikonfirmasi: false,
        },
      ],
      "2026-10-29"
    );
    expect(proposed).toHaveLength(1);
    expect(proposed[0].id).toBe("sc1");
  });
});

describe("Perhitungan Prioritas Pengerjaan", () => {
  it("mengurutkan proyek otomatis berdasarkan deadline terdekat, prioritas, dan kesiapan komponen + mendukung manual override", () => {
    const today = "2026-10-29";
    const ranked = rankProjectPriorities(
      [
        {
          id: "p-far",
          kode: "26 RKI 1099",
          nama: "Proyek Bulan Depan",
          client: "Client C",
          status: "PLANNING",
          prioritas: "RENDAH",
          deadline: "2026-11-30",
          urutanManual: null,
          scheduledCellsCount: 0,
          components: [{ statusPembelian: "BELUM_PR" }],
        },
        {
          id: "p-ready",
          kode: "26 MGS 001",
          nama: "Proyek Siap & Mendesak",
          client: "MGS",
          status: "COMMISSIONING",
          prioritas: "TINGGI",
          deadline: "2026-11-03", // 5 hari lagi
          urutanManual: null,
          scheduledCellsCount: 4,
          components: [
            { statusPembelian: "SUDAH_DATANG" },
            { statusPembelian: "TERPASANG" },
          ],
        },
        {
          id: "p-unready",
          kode: "26 RKI 1012",
          nama: "Proyek Mendesak Tapi Komponen Kosong",
          client: "PT ROKI",
          status: "MENUNGGU_KOMPONEN",
          prioritas: "TINGGI",
          deadline: "2026-11-03", // Sama-sama 5 hari lagi
          urutanManual: null,
          scheduledCellsCount: 0,
          components: [
            { statusPembelian: "BELUM_PR" },
            { statusPembelian: "SUDAH_DIPESAN" },
          ],
        },
      ],
      today
    );

    // Komponen lengkap naik ke peringkat 1 dibanding proyek dengan deadline & prioritas sama!
    expect(ranked[0].project.id).toBe("p-ready");
    expect(ranked[0].reasonSummary).toContain("Deadline 5 hari lagi");
    expect(ranked[0].reasonSummary).toContain("komponen 100% lengkap");
    expect(ranked[0].isDeadlineRisk).toBe(false);

    expect(ranked[1].project.id).toBe("p-unready");
    expect(ranked[1].isDeadlineRisk).toBe(true); // Deadline < 7 hari, belum ada jadwal & komponen 0%

    expect(ranked[2].project.id).toBe("p-far");

    // Uji manual override: naikkan p-far ke urutan #1
    const overridden = rankProjectPriorities(
      ranked.map((r) => ({
        ...r.project,
        urutanManual: r.project.id === "p-far" ? 1 : null,
      })),
      today
    );
    expect(overridden[0].project.id).toBe("p-far");
    expect(overridden[0].isManualOverride).toBe(true);
  });
});

describe("Validasi Schema Pembuatan Schedule Proyek (createFullScheduleSchema)", () => {
  it("mengizinkan tanggalMulai dikosongkan dan hanya mencatat deadline", () => {
    const payload = {
      projectMode: "EXISTING",
      existingProjectId: "proj-123",
      judulPengerjaan: "Wiring Panel & Trial",
      deadline: "2026-12-15",
      picUtama: "Apip",
      proyekParalel: true,
      pekerjaanList: [
        {
          judul: "Perakitan Panel",
          jenis: "WIRING",
          subPekerjaan: [
            {
              judul: "1. Mounting & Wiring",
              details: ["a. Pasang MCB", "b. Wiring relay"],
            },
          ],
        },
      ],
    };

    const parsed = createFullScheduleSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tanggalMulai).toBeNull();
      expect(parsed.data.deadline).toBe("2026-12-15");
      expect(parsed.data.pekerjaanList[0].jadwalMulai).toBeNull();
      expect(parsed.data.pekerjaanList[0].jadwalSelesai).toBeNull();
    }
  });

  it("menolak jika nama pekerjaan atau subpekerjaan kosong", () => {
    const invalidPayload = {
      projectMode: "EXISTING",
      existingProjectId: "proj-123",
      judulPengerjaan: "Wiring Panel",
      pekerjaanList: [],
    };

    const parsed = createFullScheduleSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });
});
