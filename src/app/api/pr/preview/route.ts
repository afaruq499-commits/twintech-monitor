import { NextResponse } from "next/server";
import { detectDuplicates, parsePrWorkbook } from "@/lib/pr-parser";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "File Excel PR (.xlsx) belum dipilih." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = await parsePrWorkbook(arrayBuffer, file.name);
    const duplicates = detectDuplicates(parsed.rows);

    return NextResponse.json({
      filename: file.name,
      parsed,
      duplicates,
    });
  } catch (err) {
    console.error("POST /api/pr/preview error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Gagal membaca file Excel: ${err.message}`
            : "Gagal membaca file Excel PR.",
      },
      { status: 400 }
    );
  }
}
