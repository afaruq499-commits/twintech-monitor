import fs from "fs";
import { PrismaClient } from "@prisma/client";
import {
  buildStandardPanelLayoutFromComponents,
  serializeDualPanelLayoutPayload,
} from "../src/lib/panel-layout-template";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("Memulai pemulihan proyek 26-TBI-1023 dan perbaikan MGS...");

  // 1. Bersihkan gambarUrl dari MGS (karena foto WhatsApp 11-06 adalah milik 26-TBI-1023)
  const mgs = await prisma.project.findFirst({
    where: { kode: "26 MGS 0804" },
  });
  if (mgs) {
    await prisma.project.update({
      where: { id: mgs.id },
      data: { gambarUrl: null },
    });
    console.log("Gambar pada proyek 26 MGS 0804 berhasil dinetralkan (tidak lagi tertukar).");
  }

  // 2. Baca data project tree dari step 2392
  const step2392Path =
    "C:/Users/akiyo/.gemini/antigravity/brain/e228d3ee-6f55-4190-8e92-b443a47a06b3/.system_generated/steps/2392/output.txt";
  const step2392Content = fs.readFileSync(step2392Path, "utf-8");
  const pJson = JSON.parse(step2392Content.slice(step2392Content.indexOf("{")));

  // 3. Baca 36 komponen dari step 4846
  const step4846Path =
    "C:/Users/akiyo/.gemini/antigravity/brain/e228d3ee-6f55-4190-8e92-b443a47a06b3/.system_generated/steps/4846/output.txt";
  const step4846Content = fs.readFileSync(step4846Path, "utf-8");
  const compsRaw = JSON.parse(
    step4846Content.slice(
      step4846Content.indexOf("["),
      step4846Content.lastIndexOf("]") + 1
    )
  );

  // Harga update dari catalog
  const priceUpdates: Record<number, number> = {
    11: 22000,
    12: 28000,
    13: 65000,
    24: 3059000,
    32: 22000,
    34: 28000,
  };

  // Cek apakah proyek 26-TBI-1023 sudah ada atau belum
  let project = await prisma.project.findFirst({
    where: { kode: "26-TBI-1023" },
  });

  if (project) {
    // Hapus child data lama agar bersih
    await prisma.component.deleteMany({ where: { projectId: project.id } });
    await prisma.lane.deleteMany({ where: { projectId: project.id } });
    project = await prisma.project.update({
      where: { id: project.id },
      data: {
        nama: pJson.nama || "FUNCTION TESTER",
        client: pJson.client || "PT TOYOTA BOSHOKU INDONESIA",
        deadline: pJson.deadline ? new Date(pJson.deadline) : null,
        prioritas: pJson.prioritas || "TINGGI",
        status: pJson.status || "MENUNGGU_KOMPONEN",
        prStatus: pJson.prStatus || "PREPARED",
        warna: pJson.warna || "#2563eb",
        gambarUrl:
          "/uploads/project-images/1794147888656_WhatsApp_Image_2026-11-06_at_11_03_39.jpeg",
      },
    });
  } else {
    project = await prisma.project.create({
      data: {
        kode: "26-TBI-1023",
        nama: pJson.nama || "FUNCTION TESTER",
        client: pJson.client || "PT TOYOTA BOSHOKU INDONESIA",
        deadline: pJson.deadline ? new Date(pJson.deadline) : null,
        prioritas: pJson.prioritas || "TINGGI",
        status: pJson.status || "MENUNGGU_KOMPONEN",
        prStatus: pJson.prStatus || "PREPARED",
        warna: pJson.warna || "#2563eb",
        gambarUrl:
          "/uploads/project-images/1794147888656_WhatsApp_Image_2026-11-06_at_11_03_39.jpeg",
      },
    });
  }

  console.log(`Proyek 26-TBI-1023 siap dengan ID: ${project.id}`);

  // 4. Masukkan 36 Komponen PR
  for (const c of compsRaw) {
    const hargaSatuan = priceUpdates[c.urutan] || c.hargaSatuanInPR || null;
    const total = hargaSatuan ? c.qty * hargaSatuan : null;
    await prisma.component.create({
      data: {
        projectId: project.id,
        urutan: c.urutan,
        kelompok: c.kelompok || "Panel Utama",
        partName: c.partName,
        partType: c.partType,
        supplier: c.supplier || "Flexindomas",
        qty: c.qty,
        unit: c.unit || "pcs",
        hargaSatuan: hargaSatuan,
        hargaRaw: hargaSatuan ? hargaSatuan.toLocaleString("id-ID") : null,
        total: total,
      },
    });
  }
  console.log(`Berhasil menambahkan 36 komponen PR untuk 26-TBI-1023.`);

  // 5. Masukkan Lane, WorkItems, SubScopes, dan Details
  if (pJson.lanes && pJson.lanes.length > 0) {
    for (const laneData of pJson.lanes) {
      const createdLane = await prisma.lane.create({
        data: {
          projectId: project.id,
          urutan: laneData.urutan || 1,
          nama: laneData.nama || "Function Tester",
          subjudul:
            laneData.subjudul ||
            "(Timeline Pembuatan & Commissioning - Elektrikal & Program)",
          tanggalMulai: laneData.tanggalMulai
            ? new Date(laneData.tanggalMulai)
            : new Date("2026-10-30"),
          jumlahHari: laneData.jumlahHari || 25,
          pic: laneData.pic || "Faruq",
        },
      });

      if (laneData.workItems && laneData.workItems.length > 0) {
        for (const wi of laneData.workItems) {
          const createdWi = await prisma.workItem.create({
            data: {
              laneId: createdLane.id,
              urutan: wi.urutan,
              jenis: wi.jenis || "COMMISSIONING",
              judul: wi.judul,
              bolehParalel: Boolean(wi.bolehParalel),
              pic: wi.pic || "Faruq",
            },
          });

          if (wi.subScopes && wi.subScopes.length > 0) {
            for (const ss of wi.subScopes) {
              const createdSs = await prisma.subScope.create({
                data: {
                  workItemId: createdWi.id,
                  urutan: ss.urutan,
                  judul: ss.judul,
                },
              });

              if (ss.details && ss.details.length > 0) {
                for (const dt of ss.details) {
                  await prisma.taskDetail.create({
                    data: {
                      subScopeId: createdSs.id,
                      urutan: dt.urutan,
                      teks: dt.teks,
                    },
                  });
                }
              }
            }
          }
        }
      }
    }
    console.log("Berhasil menyusun 1 Lane dan 9 Work Items jadwal untuk 26-TBI-1023.");
  }

  // 6. Generate Panel Layout Otomatis untuk 26-TBI-1023 dari 36 komponen
  const componentsList = await prisma.component.findMany({
    where: { projectId: project.id },
  });
  const autoLayout = buildStandardPanelLayoutFromComponents(componentsList);
  const panelLayoutPayload = serializeDualPanelLayoutPayload({
    ...autoLayout,
    autoGenerated: true,
    templateCode: "FR-EG-EP-006",
    lastSaved: new Date().toISOString(),
  });

  const fileChecklist = {
    komponen_pr: { checked: true, updatedAt: new Date().toISOString() },
    schedule_pengerjaan: { checked: true, updatedAt: new Date().toISOString() },
    alamat_io: { checked: false },
    layout_panel_hmi: { checked: true, updatedAt: new Date().toISOString() },
    layout_panel_utama: { checked: true, updatedAt: new Date().toISOString() },
    flowchart: { checked: false },
    diagram_wiring: { checked: false },
    pemprograman: { checked: false },
  };

  await prisma.project.update({
    where: { id: project.id },
    data: {
      panelLayoutJson: panelLayoutPayload,
      fileChecklistJson: JSON.stringify(fileChecklist),
    },
  });

  console.log("=== PEMULIHAN SELESAI DENGAN SUKSES! ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
