import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { fromIsoDateStr } from "../src/lib/date-utils";
import { parseReferenceScheduleFile } from "../src/lib/export/parse-schedule-reference";
import { parsePrWorkbook } from "../src/lib/pr-parser";
import { DEFAULT_PR_CATALOG } from "../src/lib/pr-catalog-default";
import type { WorkType } from "../src/lib/constants";

const prisma = new PrismaClient();

function inferWorkType(judul: string): WorkType {
  const u = judul.toUpperCase();
  if (u.includes("INSTALASI")) return "INSTALASI_SITE";
  if (u.includes("KOMUNIKASI") || u.includes("PROGRAM")) return "PROGRAMMING";
  if (u.includes("TRIAL") || u.includes("PENGECEKAN FUNGSI")) return "TESTING_FAT";
  return "COMMISSIONING";
}

async function main() {
  console.log("Memulai seed database Project Monitor (SQL Server)...");

  const file1Path = path.resolve(
    __dirname,
    "../docs/reference/PURCHASE REQUISITION - JIG INSERT COLLAR 23MJ2 (10-21-26).xlsx"
  );
  const file2Path = path.resolve(
    __dirname,
    "../docs/reference/Rencana Jadwal Kerja MGS.xlsx"
  );

  const parsedPr = await parsePrWorkbook(
    fs.readFileSync(file1Path),
    path.basename(file1Path)
  );
  const parsedMgs = await parseReferenceScheduleFile(file2Path, {
    Glasstech: "2026-11-02",
    LandGlass: "2026-11-09",
  });

  // Bersihkan data lama dengan urutan aman FK SQL Server
  await prisma.workItemComponent.deleteMany();
  await prisma.scheduleCell.deleteMany();
  await prisma.taskDetail.deleteMany();
  await prisma.subScope.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.lane.deleteMany();
  await prisma.component.deleteMany();
  await prisma.prImport.deleteMany();
  await prisma.project.deleteMany();
  await prisma.templateDetail.deleteMany();
  await prisma.templateSubScope.deleteMany();
  await prisma.workTemplate.deleteMany();
  await prisma.alertDismissal.deleteMany();

  // 1. Pengaturan default + logo asli dari File 2
  await prisma.setting.upsert({
    where: { id: "default" },
    update: {
      namaPerusahaan: "PT. Twintech Precision",
      alamatPerusahaan:
        "Multiguna 1, Jl. Mahoni 1 No. 9 Lippo Cikarang 17550, Indonesia",
      telpPerusahaan: "+62 (21) 89902228",
      faxPerusahaan: "+62 (21) 89902229",
      kapasitasPerHari: 1,
      jenisDikecualikan: JSON.stringify(["MEETING"]),
      logoBase64: parsedMgs.logoBase64,
    },
    create: {
      id: "default",
      namaPerusahaan: "PT. Twintech Precision",
      alamatPerusahaan:
        "Multiguna 1, Jl. Mahoni 1 No. 9 Lippo Cikarang 17550, Indonesia",
      telpPerusahaan: "+62 (21) 89902228",
      faxPerusahaan: "+62 (21) 89902229",
      kapasitasPerHari: 1,
      jenisDikecualikan: JSON.stringify(["MEETING"]),
      logoBase64: parsedMgs.logoBase64,
    },
  });

  // 2. Proyek 1: Jig Insert Collar dari File 1 (termasuk baris dobel & harga kotor)
  const jigProject = await prisma.project.create({
    data: {
      kode: "26 RKI 1012",
      nama:
        parsedPr.footer.partsName ??
        "JIG INSERT COLLAR 23MJ2 ( FULL ELEKTRIK )",
      client: parsedPr.footer.customer ?? "PT ROKI INDONESIA",
      deskripsi:
        "Pembuatan panel elektrik, pemrograman PLC Mitsubishi FX5U & HMI GS2107, serta instalasi sensor Keyence/Autonics untuk Jig Insert Collar 23MJ2.",
      tanggalMulai: fromIsoDateStr("2026-10-21"),
      deadline: fromIsoDateStr("2026-11-04"),
      prioritas: "TINGGI",
      status: "WIRING",
      prStatus: "PURCHASING",
      warna: "#2563eb",
      catatan:
        "Periksa ulang harga relay Omron & terminal blok FORT pada PR tanggal 21 Okt 2026. Laser sensor Keyence LR-Z250 masih menunggu konfirmasi pengiriman.",
    },
  });

  await prisma.prImport.create({
    data: {
      projectId: jigProject.id,
      namaFile: path.basename(file1Path),
      tanggalRevisi: fromIsoDateStr(parsedPr.revisionDate),
      mode: "INITIAL",
      headerJson: JSON.stringify(parsedPr.header),
      ringkasanJson: JSON.stringify(parsedPr.counts),
    },
  });

  // Variasi status pembelian realistis supaya progress bar & warning komponen bisa langsung dicoba
  const createdJigComponents: { id: string; partName: string }[] = [];
  for (let i = 0; i < parsedPr.rows.length; i++) {
    const r = parsedPr.rows[i];
    let statusPembelian = "SUDAH_DATANG";
    let estimasiTiba: Date | null = null;
    if (i === 2 || i === 16 || i === 20) {
      // Power Supply Autonics, HMI Mitsubishi, Laser Sensor Keyence masih dipesan
      statusPembelian = "SUDAH_DIPESAN";
      estimasiTiba = fromIsoDateStr("2026-11-03");
    } else if (i === 8 || i === 21) {
      // Noise filter TDK-Lambda & Photo sensor masih PR diajukan
      statusPembelian = "PR_DIAJUKAN";
      estimasiTiba = fromIsoDateStr("2026-11-04");
    } else if (i === 0 || i === 4 || i === 9) {
      statusPembelian = "TERPASANG";
    }

    const comp = await prisma.component.create({
      data: {
        projectId: jigProject.id,
        urutan: i + 1,
        kelompok: r.kelompok,
        noPr: r.noPr,
        partType: r.partType ?? "(Tanpa Tipe)",
        partName: r.partName ?? "(Perlu Diisi)",
        supplier: r.supplier,
        qty: r.qty ?? 1,
        unit: r.unit,
        catatanPr: r.catatanPr,
        tanggalPakai: fromIsoDateStr(r.tanggalPakai),
        hargaSatuan: r.hargaSatuan,
        hargaRaw: r.hargaRaw,
        total: r.total,
        statusPembelian,
        estimasiTiba,
        perluDicek: r.perluDicek,
        alasanDicek: r.alasan.length ? r.alasan.join("; ") : null,
        statusImport: "NORMAL",
      },
    });
    createdJigComponents.push({ id: comp.id, partName: comp.partName });
  }

  // Lane workshop untuk Jig Insert Collar (agar Hari Ini & Besok punya agenda aktif + usulan DELAY)
  const jigLane = await prisma.lane.create({
    data: {
      projectId: jigProject.id,
      urutan: 1,
      nama: "Workshop Panel & FAT",
      subjudul: "(Fabrication, Wiring & Factory Acceptance Test)",
      tanggalMulai: fromIsoDateStr("2026-10-28")!,
      jumlahHari: 5,
    },
  });

  const jigLayoutWi = await prisma.workItem.create({
    data: {
      laneId: jigLane.id,
      urutan: 1,
      jenis: "WIRING",
      judul: "Layout Mechanical & Drilling Box Panel",
      bolehParalel: false,
      subScopes: {
        create: [
          {
            urutan: 1,
            judul: "1. Persiapan Baseplate & Din Rail",
            details: {
              create: [
                {
                  urutan: 1,
                  teks: "a. Pemotongan kabel duct 30x30 dan Din Rail sesuai drawing layout.",
                },
                {
                  urutan: 2,
                  teks: "b. Punching lubang HMI GS2107, selector switch, dan push button pada pintu OP Panel.",
                },
              ],
            },
          },
        ],
      },
      scheduleCells: {
        create: [
          // Kemarin masih TARGET -> otomatis muncul sebagai Usulan DELAY!
          {
            tanggal: fromIsoDateStr("2026-10-28")!,
            status: "TARGET",
            catatan: "Menunggu konfirmasi ukuran lubang buzzer pintu OP Panel",
          },
        ],
      },
    },
  });
  void jigLayoutWi;

  await prisma.workItem.create({
    data: {
      laneId: jigLane.id,
      urutan: 2,
      jenis: "WIRING",
      judul: "Wiring Panel Utama & OP Panel Jig 23MJ2",
      bolehParalel: false,
      subScopes: {
        create: [
          {
            urutan: 1,
            judul: "1. Power Distribution & Control Wiring",
            details: {
              create: [
                {
                  urutan: 1,
                  teks: "a. Pemasangan MCB Schneider, Power Supply 24VDC, Noise Filter, dan Terminal Blok.",
                },
                {
                  urutan: 2,
                  teks: "b. Wiring I/O PLC FX5U-32MR/ES, Relay MY2N Omron, serta penomoran ferrule kabel.",
                },
              ],
            },
          },
        ],
      },
      scheduleCells: {
        create: [
          {
            tanggal: fromIsoDateStr("2026-10-29")!, // Hari ini
            status: "ON_PROGRESS",
            catatan: "Wiring jalur utama 220VAC & 24VDC sedang jalan",
          },
          {
            tanggal: fromIsoDateStr("2026-10-30")!, // Besok
            status: "TARGET",
            catatan: "Terminasi I/O PLC & kabel koneksi OP Panel",
          },
        ],
      },
    },
  });

  await prisma.workItem.create({
    data: {
      laneId: jigLane.id,
      urutan: 3,
      jenis: "PROGRAMMING",
      judul: "Programming Ladder PLC FX5U & Screen HMI",
      bolehParalel: false,
      subScopes: {
        create: [
          {
            urutan: 1,
            judul: "1. Sequence & Alarm Logic",
            details: {
              create: [
                {
                  urutan: 1,
                  teks: "a. Pembuatan program sequence clamping, deteksi sensor laser LR-Z250, dan interlock.",
                },
                {
                  urutan: 2,
                  teks: "b. Desain layar manual/auto, parameter jarak sensor, dan histori alarm di HMI GS2107.",
                },
              ],
            },
          },
        ],
      },
      scheduleCells: {
        create: [
          {
            tanggal: fromIsoDateStr("2026-10-31")!,
            status: "TARGET",
          },
        ],
      },
    },
  });

  // 3. Proyek 2: MGS dengan 2 Lane dari File 2 (Glasstech 6 hari, LandGlass 4 hari)
  const mgsProject = await prisma.project.create({
    data: {
      kode: "26 MGS 0804",
      nama: "Integrasi Conveyor Servo, Rotary Table & Robot Line Kaca",
      client: "MGS",
      deskripsi:
        "Onsite commissioning, alignment servo conveyor, rotary table, dan integrasi komunikasi PLC-Robot pada line Glasstech (6 hari) dan LandGlass (4 hari).",
      tanggalMulai: fromIsoDateStr("2026-11-02"),
      deadline: fromIsoDateStr("2026-11-14"),
      prioritas: "TINGGI",
      status: "COMMISSIONING",
      prStatus: "APPROVED",
      warna: "#059669",
      catatan:
        "Jadwal onsite disepakati dengan tim produksi MGS: Lane Glasstech minggu pertama Nov, Lane LandGlass minggu kedua Nov.",
    },
  });

  // Jadwal awal bebas konflik (1 pekerjaan utama per tanggal) untuk demonstrasi kalender, grid, & export
  const glasstechScheduleByOrder: Record<
    number,
    { tanggal: string; status: string }[]
  > = {
    1: [{ tanggal: "2026-11-02", status: "TARGET" }], // Day 1
    2: [{ tanggal: "2026-11-03", status: "TARGET" }], // Day 2
    3: [
      { tanggal: "2026-11-04", status: "TARGET" }, // Day 3
      { tanggal: "2026-11-05", status: "TARGET" }, // Day 4
    ],
    4: [
      { tanggal: "2026-11-06", status: "TARGET" }, // Day 5
      { tanggal: "2026-11-07", status: "TARGET" }, // Day 6
    ],
  };

  const landglassScheduleByOrder: Record<
    number,
    { tanggal: string; status: string }[]
  > = {
    1: [
      { tanggal: "2026-11-09", status: "TARGET" }, // Day 1
      { tanggal: "2026-11-10", status: "TARGET" }, // Day 2
    ],
    2: [
      { tanggal: "2026-11-11", status: "TARGET" }, // Day 3
      { tanggal: "2026-11-12", status: "TARGET" }, // Day 4
    ],
  };

  for (let lIdx = 0; lIdx < parsedMgs.lanes.length; lIdx++) {
    const refLane = parsedMgs.lanes[lIdx];
    const createdLane = await prisma.lane.create({
      data: {
        projectId: mgsProject.id,
        urutan: lIdx + 1,
        nama: refLane.laneNama,
        subjudul: refLane.subjudul ?? "(Timeline Onsite & Commissioning)",
        tanggalMulai: fromIsoDateStr(refLane.tanggalMulai)!,
        jumlahHari: refLane.jumlahHari,
      },
    });

    const schedMap =
      refLane.laneNama === "Glasstech"
        ? glasstechScheduleByOrder
        : landglassScheduleByOrder;

    for (const wi of refLane.workItems) {
      const cells = schedMap[wi.urutan] ?? [];
      await prisma.workItem.create({
        data: {
          laneId: createdLane.id,
          urutan: wi.urutan,
          jenis: inferWorkType(wi.judul),
          judul: wi.judul,
          bolehParalel: false,
          subScopes: {
            create: wi.subScopes.map((ss) => ({
              urutan: ss.urutan,
              judul: ss.judul,
              details: {
                create: ss.details.map((d) => ({
                  urutan: d.urutan,
                  teks: d.teks,
                })),
              },
            })),
          },
          scheduleCells: {
            create: cells.map((c) => ({
              tanggal: fromIsoDateStr(c.tanggal)!,
              status: c.status,
            })),
          },
        },
      });
    }
  }

  // 4. Template Pekerjaan Standar (siap dipakai ulang lintas proyek)
  await prisma.workTemplate.create({
    data: {
      nama: "Wiring Panel Utama & I/O Check",
      jenis: "WIRING",
      bolehParalel: false,
      deskripsi: "Template standar fabrikasi, wiring panel kontrol, dan cold/hot test.",
      subScopes: {
        create: [
          {
            urutan: 1,
            judul: "1. Mechanical Layout & Mounting",
            details: {
              create: [
                { urutan: 1, teks: "a. Pemasangan kabel duct, Din Rail, MCB, PLC, Power Supply, dan Terminal Blok." },
                { urutan: 2, teks: "b. Punching pintu panel untuk HMI, pilot lamp, push button, dan emergency stop." },
              ],
            },
          },
          {
            urutan: 2,
            judul: "2. Power & Control Wiring",
            details: {
              create: [
                { urutan: 1, teks: "a. Wiring jalur power utama (RST/220VAC), grounding PE, dan distribusi 24VDC." },
                { urutan: 2, teks: "b. Wiring input/output PLC, relay interface, dan pelabelan ferrule sesuai schematic." },
              ],
            },
          },
          {
            urutan: 3,
            judul: "3. Continuity & Power-On Check",
            details: {
              create: [
                { urutan: 1, teks: "a. Megger / continuity test antar fasa dan netral/ground sebelum power ON." },
                { urutan: 2, teks: "b. Pengukuran tegangan output PSU 24VDC dan uji fungsi indikator pintu panel." },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.workTemplate.create({
    data: {
      nama: "Setting Komunikasi PLC - HMI - Robot",
      jenis: "PROGRAMMING",
      bolehParalel: false,
      deskripsi: "Template integrasi jaringan Ethernet/Fieldbus dan uji safety interlock.",
      subScopes: {
        create: [
          {
            urutan: 1,
            judul: "1. Network & Parameter Setup",
            details: {
              create: [
                { urutan: 1, teks: "a. Konfigurasi IP address dan protokol komunikasi antara PLC, HMI, dan Robot." },
                { urutan: 2, teks: "b. Verifikasi ping & status koneksi modul komunikasi tanpa error." },
              ],
            },
          },
          {
            urutan: 2,
            judul: "2. Handshake & Safety Interlock",
            details: {
              create: [
                { urutan: 1, teks: "a. Mapping bit/register handshake (Ready, Busy, Complete, Fault)." },
                { urutan: 2, teks: "b. Simulasi Emergency Stop dan door safety interlock tanpa gerakan aktuator." },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.workTemplate.create({
    data: {
      nama: "Trial Run Bertahap & Handover Site",
      jenis: "COMMISSIONING",
      bolehParalel: false,
      deskripsi: "Template commissioning akhir di site client hingga serah terima operator.",
      subScopes: {
        create: [
          {
            urutan: 1,
            judul: "1. Dry Run & Low-Speed Trial",
            details: {
              create: [
                { urutan: 1, teks: "a. Dry run tanpa benda kerja pada kecepatan rendah (10-20%) untuk cek urutan gerak." },
                { urutan: 2, teks: "b. Trial cycle tunggal dengan benda kerja dan validasi sensor posisi." },
              ],
            },
          },
          {
            urutan: 2,
            judul: "2. Auto Cycle, Backup & Handover",
            details: {
              create: [
                { urutan: 1, teks: "a. Running auto cycle kontinu untuk verifikasi cycle time dan repeatability." },
                { urutan: 2, teks: "b. Backup program final PLC/HMI serta training singkat pengoperasian ke operator client." },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(
    `Seed selesai! Proyek "${jigProject.nama}" (${parsedPr.rows.length} komponen) & Proyek "${mgsProject.nama}" (2 lane: Glasstech 6 hari, LandGlass 4 hari) berhasil dibuat.`
  );

  const existingCatalogCount = await prisma.catalogComponent.count();
  if (existingCatalogCount === 0) {
    await prisma.catalogComponent.createMany({
      data: DEFAULT_PR_CATALOG.map((item) => ({
        noUrut: item.noUrut,
        kategori: item.kategori,
        nama: item.nama,
        merek: item.merek,
        tipeModel: item.tipeModel,
        spesifikasi: item.spesifikasi,
        estimasiHarga: item.estimasiHarga,
        defaultUnit: item.defaultUnit,
        fungsi: item.fungsi,
      })),
    });
    console.log(`Katalog komponen bawaan (${DEFAULT_PR_CATALOG.length} item) berhasil diisi.`);
  }
}

main()
  .catch((err) => {
    console.error("Seed gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
