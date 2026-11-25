import { prisma } from "./db";
import { DEFAULT_PR_CATALOG } from "./pr-catalog-default";

export interface CatalogComponentDTO {
  id: string;
  noUrut: number;
  kategori: string;
  nama: string;
  merek: string;
  tipeModel: string;
  spesifikasi: string | null;
  estimasiHarga: number | null;
  defaultUnit: string;
  fungsi: string | null;
}

/**
 * Memastikan komponen katalog bawaan sudah terisi dan tersinkronisasi di database,
 * lalu mengembalikan seluruh daftar katalog komponen.
 */
export async function getCatalogComponents(): Promise<CatalogComponentDTO[]> {
  const existingRows = await prisma.catalogComponent.findMany({
    select: { id: true, nama: true, tipeModel: true, spesifikasi: true },
  });

  if (existingRows.length === 0) {
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
  } else {
    // Sinkronkan item baru dari DEFAULT_PR_CATALOG yang belum ada di database
    // Sertakan spesifikasi dalam kunci unik agar varian rating (mis. NXB-63 2P vs 3P) tetap tersinkron
    const makeKey = (nama: string, tipeModel: string, spesifikasi: string | null | undefined) =>
      `${nama.trim().toLowerCase()}||${tipeModel.trim().toLowerCase()}||${(spesifikasi ?? "").trim().toLowerCase()}`;

    const existingKeys = new Set(
      existingRows.map((r) => makeKey(r.nama, r.tipeModel, r.spesifikasi))
    );

    const missingItems = DEFAULT_PR_CATALOG.filter(
      (item) => !existingKeys.has(makeKey(item.nama, item.tipeModel, item.spesifikasi))
    );

    if (missingItems.length > 0) {
      await prisma.catalogComponent.createMany({
        data: missingItems.map((item) => ({
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
    }

    // Sinkronkan pembaruan data katalog jika ada revisi model atau harga dari DEFAULT_PR_CATALOG
    try {
      await prisma.catalogComponent.updateMany({
        where: {
          OR: [
            { tipeModel: "VCF1 / EZAROTE" },
            { tipeModel: { contains: "VCF1" } },
          ],
        },
        data: {
          merek: "Schneider",
          tipeModel: "EZAROTE",
          nama: "Main Switch Rotary Isolator (LOTO)",
          spesifikasi: "Extended Rotary Operating Handle EZC100 (LOTO Padlockable)",
          estimasiHarga: 850000,
          fungsi: "Saklar isolasi putar perawatan & proteksi mekanik panel (LOTO)",
        },
      });

      await prisma.catalogComponent.updateMany({
        where: {
          merek: { in: ["Bebas / KSS", "Bebas / FORT", "Bebas"] },
          tipeModel: { contains: "Wiring Duct" },
        },
        data: {
          merek: "-",
        },
      });
    } catch {
      // Ignored jika terjadi transient error
    }
  }

  const rows = await prisma.catalogComponent.findMany({
    orderBy: [{ noUrut: "asc" }, { kategori: "asc" }, { nama: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    noUrut: r.noUrut,
    kategori: r.kategori,
    nama: r.nama,
    merek: r.merek,
    tipeModel: r.tipeModel,
    spesifikasi: r.spesifikasi,
    estimasiHarga: r.estimasiHarga,
    defaultUnit: r.defaultUnit,
    fungsi: r.fungsi,
  }));
}
