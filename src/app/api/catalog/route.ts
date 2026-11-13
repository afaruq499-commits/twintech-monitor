import { NextResponse } from "next/server";
import { getCatalogComponents } from "@/lib/catalog-queries";
import { prisma } from "@/lib/db";
import { catalogComponentSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const items = await getCatalogComponents();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/catalog error:", err);
    return NextResponse.json(
      { error: "Gagal memuat katalog komponen." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = catalogComponentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Data komponen katalog tidak valid.",
        },
        { status: 400 }
      );
    }

    const d = parsed.data;
    let nextNo = d.noUrut;
    if (!nextNo || nextNo <= 0) {
      const agg = await prisma.catalogComponent.aggregate({
        _max: { noUrut: true },
      });
      nextNo = (agg._max.noUrut ?? 0) + 1;
    }

    const created = await prisma.catalogComponent.create({
      data: {
        noUrut: nextNo,
        kategori: d.kategori,
        nama: d.nama,
        merek: d.merek || "Bebas",
        tipeModel: d.tipeModel,
        spesifikasi: d.spesifikasi,
        estimasiHarga: d.estimasiHarga,
        defaultUnit: d.defaultUnit || "pcs",
        fungsi: d.fungsi,
      },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/catalog error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan komponen ke katalog." },
      { status: 500 }
    );
  }
}
