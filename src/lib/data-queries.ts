import { prisma } from "@/lib/db";
import {
  ARRIVED_PURCHASE_STATUSES,
  COMPONENT_DEPENDENT_WORK_TYPES,
  type ComponentImportStatus,
  type PrStatus,
  type ProjectPriority,
  type ProjectStatus,
  type PurchaseStatus,
  type ScheduleCellStatus,
  type WorkType,
} from "@/lib/constants";
import { addDaysIso, todayIsoLocal, toIsoDateStr } from "@/lib/date-utils";
import {
  findProposedDelays,
  type ConflictSettings,
  type ScheduledWorkEntry,
} from "@/lib/schedule";
import { rankProjectPriorities } from "@/lib/priority/score";
import {
  computeChecklistProgress,
  deriveChecklistDetection,
  parseFileChecklistJson,
} from "@/lib/project-checklist";

export interface AppSettingsDTO extends ConflictSettings {
  namaPerusahaan: string;
  alamatPerusahaan: string;
  telpPerusahaan: string;
  faxPerusahaan: string;
  logoBase64: string | null;
}

export async function getAppSettings(): Promise<AppSettingsDTO> {
  let row = await prisma.setting.findUnique({ where: { id: "default" } });
  if (!row) {
    row = await prisma.setting.create({
      data: {
        id: "default",
        kapasitasPerHari: 1,
        jenisDikecualikan: JSON.stringify(["MEETING"]),
        namaPerusahaan: "PT. Twintech Precision",
        alamatPerusahaan:
          "Multiguna 1, Jl. Mahoni 1 No. 9 Lippo Cikarang 17550, Indonesia",
        telpPerusahaan: "+62 (21) 89902228",
        faxPerusahaan: "+62 (21) 89902229",
      },
    });
  }

  let jenisDikecualikan: WorkType[] = ["MEETING"];
  try {
    const parsed = JSON.parse(row.jenisDikecualikan);
    if (Array.isArray(parsed)) jenisDikecualikan = parsed as WorkType[];
  } catch {
    jenisDikecualikan = ["MEETING"];
  }

  return {
    kapasitasPerHari: row.kapasitasPerHari,
    jenisDikecualikan,
    namaPerusahaan: row.namaPerusahaan,
    alamatPerusahaan: row.alamatPerusahaan,
    telpPerusahaan: row.telpPerusahaan,
    faxPerusahaan: row.faxPerusahaan,
    logoBase64: row.logoBase64,
  };
}

export async function getAllScheduledEntries(): Promise<ScheduledWorkEntry[]> {
  const cells = await prisma.scheduleCell.findMany({
    include: {
      workItem: {
        include: {
          lane: {
            include: {
              project: true,
            },
          },
        },
      },
    },
    orderBy: { tanggal: "asc" },
  });

  return cells.map((c) => ({
    cellId: c.id,
    workItemId: c.workItemId,
    judul: c.workItem.judul,
    jenis: c.workItem.jenis as WorkType,
    bolehParalel: c.workItem.bolehParalel,
    projectBolehParalel: c.workItem.lane.project.bolehParalel,
    projectId: c.workItem.lane.projectId,
    projectNama: c.workItem.lane.project.nama,
    laneId: c.workItem.laneId,
    laneNama: c.workItem.lane.nama,
    tanggal: toIsoDateStr(c.tanggal)!,
    status: c.status as ScheduleCellStatus,
  }));
}

export async function getProjectsOverview() {
  const projects = await prisma.project.findMany({
    include: {
      components: {
        select: {
          id: true,
          statusPembelian: true,
          statusImport: true,
          perluDicek: true,
        },
      },
      lanes: {
        include: {
          workItems: {
            include: {
              scheduleCells: {
                select: { id: true, tanggal: true, status: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return projects.map((p) => {
    const activeComps = p.components.filter(
      (c) => c.statusImport !== "HILANG_DI_REVISI"
    );
    const totalComponents = activeComps.length;
    const arrivedComponents = activeComps.filter((c) =>
      ARRIVED_PURCHASE_STATUSES.includes(c.statusPembelian as PurchaseStatus)
    ).length;
    const checkCount = activeComps.filter((c) => c.perluDicek).length;

    const scheduledCellsCount = p.lanes.reduce(
      (sum, l) =>
        sum + l.workItems.reduce((ws, w) => ws + w.scheduleCells.length, 0),
      0
    );

    const checklistProgress = computeChecklistProgress(
      parseFileChecklistJson(p.fileChecklistJson),
      deriveChecklistDetection({
        prStatus: p.prStatus,
        componentsCount: totalComponents,
        lanesCount: p.lanes.length,
        scheduleCellsCount: scheduledCellsCount,
        plcAddressesJson: p.plcAddressesJson,
        panelLayoutJson: p.panelLayoutJson,
        flowSequenceJson: p.flowSequenceJson,
        wiringDiagramPdfUrl: p.wiringDiagramPdfUrl,
        wiringDiagramPdfName: p.wiringDiagramPdfName,
        plcProgramFileUrl: p.plcProgramFileUrl,
        plcProgramFileName: p.plcProgramFileName,
        hmiProgramFileUrl: p.hmiProgramFileUrl,
        hmiProgramFileName: p.hmiProgramFileName,
      })
    );

    return {
      id: p.id,
      kode: p.kode,
      nama: p.nama,
      client: p.client,
      komponenInti: p.komponenInti,
      deskripsi: p.deskripsi,
      tanggalMulai: toIsoDateStr(p.tanggalMulai),
      deadline: toIsoDateStr(p.deadline),
      prioritas: p.prioritas as ProjectPriority,
      tipeProyek: p.tipeProyek ?? "AUTOMATION_KECIL",
      status: p.status as ProjectStatus,
      prStatus: p.prStatus as PrStatus,
      catatan: p.catatan,
      warna: p.warna,
      pic: p.pic,
      bolehParalel: p.bolehParalel,
      urutanManual: p.urutanManual,
      gambarUrl: p.gambarUrl,
      flowSequenceJson: p.flowSequenceJson,
      wiringDiagramPdfUrl: p.wiringDiagramPdfUrl,
      wiringDiagramPdfName: p.wiringDiagramPdfName,
      totalComponents,
      arrivedComponents,
      checkCount,
      progressPct: checklistProgress.progressPct,
      checklistCompletedCount: checklistProgress.completedCount,
      checklistTotalCount: checklistProgress.totalCount,
      lanesCount: p.lanes.length,
      scheduledCellsCount,
      lanes: p.lanes.map((l) => ({
        id: l.id,
        nama: l.nama,
        tanggalMulai: toIsoDateStr(l.tanggalMulai)!,
        jumlahHari: l.jumlahHari,
      })),
    };
  });
}

export async function getProjectDetail(projectId: string) {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      components: {
        orderBy: [{ urutan: "asc" }, { createdAt: "asc" }],
      },
      prImports: {
        orderBy: { createdAt: "desc" },
      },
      lanes: {
        orderBy: [{ urutan: "asc" }, { createdAt: "asc" }],
        include: {
          workItems: {
            orderBy: { urutan: "asc" },
            include: {
              subScopes: {
                orderBy: { urutan: "asc" },
                include: {
                  details: { orderBy: { urutan: "asc" } },
                },
              },
              scheduleCells: {
                orderBy: { tanggal: "asc" },
              },
              components: true,
            },
          },
        },
      },
    },
  });

  if (!p) return null;

  return {
    id: p.id,
    kode: p.kode,
    nama: p.nama,
    client: p.client,
    komponenInti: p.komponenInti,
    deskripsi: p.deskripsi,
    tanggalMulai: toIsoDateStr(p.tanggalMulai),
    deadline: toIsoDateStr(p.deadline),
    prioritas: p.prioritas as ProjectPriority,
    tipeProyek: p.tipeProyek ?? "AUTOMATION_KECIL",
    status: p.status as ProjectStatus,
    prStatus: p.prStatus as PrStatus,
    catatan: p.catatan,
    warna: p.warna,
    pic: p.pic,
    bolehParalel: p.bolehParalel,
    urutanManual: p.urutanManual,
    plcAddressesJson: p.plcAddressesJson,
    gambarUrl: p.gambarUrl,
    flowSequenceJson: p.flowSequenceJson,
    wiringDiagramPdfUrl: p.wiringDiagramPdfUrl,
    wiringDiagramPdfName: p.wiringDiagramPdfName,
    plcProgramFileUrl: p.plcProgramFileUrl,
    plcProgramFileName: p.plcProgramFileName,
    plcProgramFileSize: p.plcProgramFileSize,
    hmiProgramFileUrl: p.hmiProgramFileUrl,
    hmiProgramFileName: p.hmiProgramFileName,
    hmiProgramFileSize: p.hmiProgramFileSize,
    panelLayoutJson: p.panelLayoutJson,
    fileChecklistJson: p.fileChecklistJson,
    components: p.components.map((c) => ({
      id: c.id,
      projectId: c.projectId,
      urutan: c.urutan,
      kelompok: c.kelompok,
      noPr: c.noPr,
      partType: c.partType,
      partName: c.partName,
      supplier: c.supplier,
      qty: c.qty,
      unit: c.unit,
      catatanPr: c.catatanPr,
      tanggalPakai: toIsoDateStr(c.tanggalPakai),
      hargaSatuan: c.hargaSatuan,
      hargaRaw: c.hargaRaw,
      total: c.total,
      statusPembelian: c.statusPembelian as PurchaseStatus,
      estimasiTiba: toIsoDateStr(c.estimasiTiba),
      perluDicek: c.perluDicek,
      alasanDicek: c.alasanDicek,
      statusImport: c.statusImport as ComponentImportStatus,
      catatan: c.catatan,
    })),
    prImports: p.prImports.map((imp) => ({
      id: imp.id,
      namaFile: imp.namaFile,
      tanggalRevisi: toIsoDateStr(imp.tanggalRevisi),
      mode: imp.mode,
      createdAt: imp.createdAt.toISOString(),
    })),
    lanes: p.lanes.map((l) => ({
      id: l.id,
      projectId: l.projectId,
      urutan: l.urutan,
      nama: l.nama,
      subjudul: l.subjudul,
      tanggalMulai: toIsoDateStr(l.tanggalMulai)!,
      jumlahHari: l.jumlahHari,
      deadline: toIsoDateStr(l.deadline),
      pic: l.pic,
      workItems: l.workItems.map((wi) => ({
        id: wi.id,
        laneId: wi.laneId,
        urutan: wi.urutan,
        jenis: wi.jenis as WorkType,
        judul: wi.judul,
        bolehParalel: wi.bolehParalel,
        pic: wi.pic,
        deadline: toIsoDateStr(wi.deadline),
        componentIds: wi.components.map((wc) => wc.componentId),
        subScopes: wi.subScopes.map((ss) => ({
          id: ss.id,
          urutan: ss.urutan,
          judul: ss.judul,
          details: ss.details.map((d) => ({
            id: d.id,
            urutan: d.urutan,
            teks: d.teks,
          })),
        })),
        scheduleCells: wi.scheduleCells.map((sc) => ({
          id: sc.id,
          workItemId: sc.workItemId,
          tanggal: toIsoDateStr(sc.tanggal)!,
          status: sc.status as ScheduleCellStatus,
          warnaCustom: sc.warnaCustom,
          catatan: sc.catatan,
          delayDikonfirmasi: sc.delayDikonfirmasi,
        })),
      })),
    })),
  };
}

export interface DashboardAlertItem {
  key: string;
  severity: "DANGER" | "WARNING" | "INFO";
  category: "DELAY" | "DEADLINE" | "KOMPONEN" | "PR_CHECK";
  title: string;
  description: string;
  href: string;
  cellId?: string;
}

export async function getDashboardSummary() {
  const todayIso = todayIsoLocal();
  const tomorrowIso = addDaysIso(todayIso, 1);
  const next7Iso = addDaysIso(todayIso, 6);

  const [projects, allCells, dismissals] = await Promise.all([
    prisma.project.findMany({
      include: {
        components: true,
        lanes: {
          include: {
            workItems: {
              include: {
                scheduleCells: true,
              },
            },
          },
        },
      },
    }),
    prisma.scheduleCell.findMany({
      include: {
        subScope: true,
        taskDetail: true,
        workItem: {
          include: {
            lane: {
              include: {
                project: true,
              },
            },
          },
        },
      },
      orderBy: { tanggal: "asc" },
    }),
    prisma.alertDismissal.findMany(),
  ]);

  const dismissedKeys = new Set(dismissals.map((d) => d.alertKey));

  const activeProjects = projects.filter((p) => p.status !== "SELESAI");
  let missingComponentsCount = 0;
  let needsCheckCount = 0;
  let totalComponents = 0;
  let arrivedComponents = 0;
  let orderedComponents = 0;
  let notYetPrComponents = 0;

  for (const p of activeProjects) {
    for (const c of p.components) {
      if (c.statusImport === "HILANG_DI_REVISI") continue;
      totalComponents++;
      if (ARRIVED_PURCHASE_STATUSES.includes(c.statusPembelian as PurchaseStatus)) {
        arrivedComponents++;
      } else {
        missingComponentsCount++;
        if (c.statusPembelian === "BELUM_PR") {
          notYetPrComponents++;
        } else {
          orderedComponents++;
        }
      }
      if (c.perluDicek) {
        needsCheckCount++;
      }
    }
  }

  const readinessPct =
    totalComponents === 0
      ? 0
      : Math.round((arrivedComponents / totalComponents) * 100);

  const ranked = rankProjectPriorities(
    projects.map((p) => ({
      id: p.id,
      kode: p.kode,
      nama: p.nama,
      client: p.client,
      status: p.status as ProjectStatus,
      prioritas: p.prioritas as ProjectPriority,
      deadline: toIsoDateStr(p.deadline),
      urutanManual: p.urutanManual,
      warna: p.warna,
      scheduledCellsCount: p.lanes.reduce(
        (s, l) => s + l.workItems.reduce((ws, w) => ws + w.scheduleCells.length, 0),
        0
      ),
      components: p.components.map((c) => ({
        statusPembelian: c.statusPembelian as PurchaseStatus,
        statusImport: c.statusImport as ComponentImportStatus,
      })),
    })),
    todayIso
  );

  const atRiskProjects = ranked.filter((r) => r.isDeadlineRisk);

  const normalizedCells = allCells.map((c) => ({
    id: c.id,
    workItemId: c.workItemId,
    workItemJudul: c.workItem.judul,
    workItemPic: c.workItem.pic ?? c.workItem.lane.pic ?? c.workItem.lane.project.pic,
    workItemUrutan: c.workItem.urutan,
    subScopeId: c.subScopeId,
    subScopeJudul: c.subScope?.judul ?? null,
    subScopeUrutan: c.subScope?.urutan ?? null,
    taskDetailId: c.taskDetailId,
    taskDetailTeks: c.taskDetail?.teks ?? null,
    taskDetailUrutan: c.taskDetail?.urutan ?? null,
    jenis: c.workItem.jenis as WorkType,
    bolehParalel: c.workItem.bolehParalel || c.workItem.lane.project.bolehParalel,
    laneId: c.workItem.laneId,
    laneNama: c.workItem.lane.nama,
    projectId: c.workItem.lane.projectId,
    projectNama: c.workItem.lane.project.nama,
    projectClient: c.workItem.lane.project.client,
    projectWarna: c.workItem.lane.project.warna,
    tanggal: toIsoDateStr(c.tanggal)!,
    status: c.status as ScheduleCellStatus,
    warnaCustom: c.warnaCustom,
    catatan: c.catatan,
    delayDikonfirmasi: c.delayDikonfirmasi,
  }));

  function groupCellsBySubScope(cells: typeof normalizedCells) {
    const map = new Map<
      string,
      {
        id: string;
        workItemId: string;
        workItemJudul: string;
        workItemPic?: string | null;
        workItemUrutan?: number | null;
        subScopeId?: string | null;
        subScopeJudul?: string | null;
        subScopeUrutan?: number | null;
        jenis: WorkType;
        bolehParalel: boolean;
        laneId: string;
        laneNama: string;
        projectId: string;
        projectNama: string;
        projectClient: string;
        projectWarna: string;
        tanggal: string;
        statuses: ScheduleCellStatus[];
        warnaCustom?: string | null;
        catatan: string | null;
        pointsCount: number;
      }
    >();

    for (const c of cells) {
      // Grouping per tanggal, per workItemId, dan per subScope (point 1., 2., 3.)
      const ssKey = c.subScopeId || "no_subscope";
      const key = `${c.tanggal}___${c.workItemId}___${ssKey}`;

      if (!map.has(key)) {
        map.set(key, {
          id: c.id,
          workItemId: c.workItemId,
          workItemJudul: c.workItemJudul,
          workItemPic: c.workItemPic,
          workItemUrutan: c.workItemUrutan,
          subScopeId: c.subScopeId,
          subScopeJudul: c.subScopeJudul,
          subScopeUrutan: c.subScopeUrutan,
          jenis: c.jenis,
          bolehParalel: c.bolehParalel,
          laneId: c.laneId,
          laneNama: c.laneNama,
          projectId: c.projectId,
          projectNama: c.projectNama,
          projectClient: c.projectClient,
          projectWarna: c.projectWarna,
          tanggal: c.tanggal,
          statuses: [c.status],
          warnaCustom: c.warnaCustom,
          catatan: c.catatan,
          pointsCount: 1,
        });
      } else {
        const item = map.get(key)!;
        item.statuses.push(c.status);
        item.pointsCount += 1;
        if (!item.catatan && c.catatan) {
          item.catatan = c.catatan;
        }
        if (!item.warnaCustom && c.warnaCustom) {
          item.warnaCustom = c.warnaCustom;
        }
      }
    }

    return Array.from(map.values())
      .map((item) => {
        // Prioritas status: DELAY > ON_PROGRESS > DONE > TARGET
        let status: ScheduleCellStatus = "TARGET";
        if (item.statuses.includes("DELAY")) status = "DELAY";
        else if (item.statuses.includes("ON_PROGRESS")) status = "ON_PROGRESS";
        else if (item.statuses.length > 0 && item.statuses.every((s) => s === "DONE"))
          status = "DONE";
        else if (item.statuses.includes("TARGET")) status = "TARGET";
        else status = item.statuses[0] || "TARGET";

        return {
          id: item.id,
          workItemId: item.workItemId,
          workItemJudul: item.workItemJudul,
          workItemPic: item.workItemPic,
          workItemUrutan: item.workItemUrutan,
          subScopeId: item.subScopeId,
          subScopeJudul: item.subScopeJudul,
          subScopeUrutan: item.subScopeUrutan,
          jenis: item.jenis,
          bolehParalel: item.bolehParalel,
          laneId: item.laneId,
          laneNama: item.laneNama,
          projectId: item.projectId,
          projectNama: item.projectNama,
          projectClient: item.projectClient,
          projectWarna: item.projectWarna,
          tanggal: item.tanggal,
          status,
          warnaCustom: item.warnaCustom,
          catatan: item.catatan,
          pointsCount: item.pointsCount,
        };
      })
      .sort((a, b) => {
        if ((a.workItemUrutan ?? 0) !== (b.workItemUrutan ?? 0)) {
          return (a.workItemUrutan ?? 0) - (b.workItemUrutan ?? 0);
        }
        if ((a.subScopeUrutan ?? 0) !== (b.subScopeUrutan ?? 0)) {
          return (a.subScopeUrutan ?? 0) - (b.subScopeUrutan ?? 0);
        }
        return a.id.localeCompare(b.id);
      });
  }

  const todayTasks = groupCellsBySubScope(
    normalizedCells.filter((c) => c.tanggal === todayIso)
  );
  const tomorrowTasks = groupCellsBySubScope(
    normalizedCells.filter((c) => c.tanggal === tomorrowIso)
  );
  const next7DaysTasks = normalizedCells.filter(
    (c) => c.tanggal >= todayIso && c.tanggal <= next7Iso
  );

  const proposedDelays = findProposedDelays(normalizedCells, todayIso);

  // Kumpulkan daftar alert yang belum diselesaikan
  const alerts: DashboardAlertItem[] = [];

  for (const pd of proposedDelays) {
    const key = `delay:${pd.id}`;
    if (dismissedKeys.has(key)) continue;
    alerts.push({
      key,
      severity: "DANGER",
      category: "DELAY",
      title: `Usulan Status DELAY: ${pd.workItemJudul}`,
      description: `Proyek ${pd.projectNama} (${pd.laneNama}) pada ${pd.tanggal} masih berstatus ${pd.status}. Konfirmasi ubah ke DELAY?`,
      href: `/jadwal/lane/${pd.laneId}`,
      cellId: pd.id,
    });
  }

  for (const risk of atRiskProjects) {
    const key = `deadline:${risk.project.id}:${risk.project.deadline}`;
    if (dismissedKeys.has(key)) continue;
    alerts.push({
      key,
      severity: "DANGER",
      category: "DEADLINE",
      title: `Risiko Deadline < 7 Hari: ${risk.project.nama}`,
      description: `${risk.reasons[0]}. ${risk.riskReasons.join("; ")}.`,
      href: `/proyek/${risk.project.id}`,
    });
  }

  for (const p of activeProjects) {
    const unarrived = p.components.filter(
      (c) =>
        c.statusImport !== "HILANG_DI_REVISI" &&
        !ARRIVED_PURCHASE_STATUSES.includes(c.statusPembelian as PurchaseStatus)
    );
    if (unarrived.length > 0) {
      const upcomingDependentCells = normalizedCells.filter(
        (c) =>
          c.projectId === p.id &&
          c.tanggal >= todayIso &&
          COMPONENT_DEPENDENT_WORK_TYPES.includes(c.jenis) &&
          c.status !== "DONE"
      );
      if (upcomingDependentCells.length > 0) {
        const key = `comp-warn:${p.id}:${unarrived.length}`;
        if (!dismissedKeys.has(key)) {
          alerts.push({
            key,
            severity: "WARNING",
            category: "KOMPONEN",
            title: `Jadwal Wiring/Instalasi Dengan Komponen Belum Lengkap: ${p.nama}`,
            description: `Ada ${upcomingDependentCells.length} jadwal wiring/instalasi aktif sementara ${unarrived.length} komponen belum datang.`,
            href: `/proyek/${p.id}?tab=komponen`,
          });
        }
      }
    }

    const checks = p.components.filter(
      (c) => c.statusImport !== "HILANG_DI_REVISI" && c.perluDicek
    );
    if (checks.length > 0) {
      const key = `pr-check:${p.id}:${checks.length}`;
      if (!dismissedKeys.has(key)) {
        alerts.push({
          key,
          severity: "INFO",
          category: "PR_CHECK",
          title: `${checks.length} Baris PR Perlu Dicek: ${p.nama}`,
          description: `Terdapat harga ekspresi tidak baku atau data komponen belum lengkap dari hasil import PR.`,
          href: `/proyek/${p.id}?tab=komponen&filter=check`,
        });
      }
    }
  }

  const SHORT_DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const dailyScheduleStats = Array.from({ length: 7 }, (_, offset) => {
    const dateIso = addDaysIso(todayIso, offset);
    const [y, m, d] = dateIso.split("-").map(Number);
    const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const dayTasks = groupCellsBySubScope(
      normalizedCells.filter((c) => c.tanggal === dateIso)
    );
    let doneCount = 0;
    let delayCount = 0;
    let activeCount = 0;
    for (const t of dayTasks) {
      if (t.status === "DONE") doneCount++;
      else if (t.status === "DELAY") delayCount++;
      else activeCount++;
    }
    return {
      date: dateIso,
      shortDay: SHORT_DAYS_ID[utcDay] ?? "",
      dayNum: String(d),
      doneCount,
      activeCount,
      delayCount,
      totalCount: dayTasks.length,
    };
  });

  return {
    todayIso,
    tomorrowIso,
    cards: {
      activeProjectsCount: activeProjects.length,
      missingComponentsCount,
      next7DaysCount: next7DaysTasks.length,
      atRiskProjectsCount: atRiskProjects.length,
      needsCheckCount,
    },
    readinessStats: {
      totalComponents,
      arrivedComponents,
      orderedComponents,
      notYetPrComponents,
      readinessPct,
    },
    dailyScheduleStats,
    todayTasks,
    tomorrowTasks,
    next7DaysTasks,
    alerts,
    topPriorities: ranked.slice(0, 5),
  };
}

export async function getHistoricalMlSamples() {
  const projects = await prisma.project.findMany({
    include: {
      components: {
        where: { statusImport: { not: "HILANG_DI_REVISI" } },
        select: {
          partType: true,
          partName: true,
          qty: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return projects
    .filter(
      (p) =>
        Boolean((p.komponenInti ?? p.deskripsi ?? "").trim()) &&
        p.components.length >= 2
    )
    .map((p) => ({
      projectId: p.id,
      projectName: p.nama,
      coreDescription: (p.komponenInti || p.deskripsi || "").trim(),
      components: p.components.map((c) => ({
        partType: c.partType,
        partName: c.partName,
        qty: c.qty,
      })),
    }));
}
