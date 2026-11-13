import { NextResponse } from "next/server";
import { getCatalogComponents } from "@/lib/catalog-queries";
import { getHistoricalMlSamples } from "@/lib/data-queries";
import { recommendComponentsWithMl } from "@/lib/ml-recommender";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const description =
      typeof body?.description === "string" ? body.description.trim() : "";

    if (!description) {
      return NextResponse.json(
        {
          error:
            "Masukkan deskripsi singkat komponen inti proyek terlebih dahulu (mis. 3 valve, 1 robot Yaskawa tipe a, dan 2 motor servo seri b).",
        },
        { status: 400 }
      );
    }

    const [catalog, historicalSamples] = await Promise.all([
      getCatalogComponents(),
      getHistoricalMlSamples(),
    ]);

    const result = recommendComponentsWithMl(
      description,
      catalog,
      historicalSamples
    );

    return NextResponse.json({ result });
  } catch (err) {
    console.error("POST /api/ml/recommend error:", err);
    return NextResponse.json(
      { error: "Gagal menjalankan analisis Machine Learning komponen." },
      { status: 500 }
    );
  }
}
