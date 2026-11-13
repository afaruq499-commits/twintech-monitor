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
    select: { id: true, nama: true, tipeModel: true },
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
    const existingKeys = new Set(
      existingRows.map(
        (r) => `${r.nama.trim().toLowerCase()}||${r.tipeModel.trim().toLowerCase()}`
      )
    );

    const missingItems = DEFAULT_PR_CATALOG.filter(
      (item) =>
        !existingKeys.has(
          `${item.nama.trim().toLowerCase()}||${item.tipeModel.trim().toLowerCase()}`
        )
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
