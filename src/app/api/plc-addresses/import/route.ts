import { NextResponse } from "next/server";
import { parsePlcAddressWorkbook } from "@/lib/export/plc-address-importer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string" || typeof (file as File).arrayBuffer !== "function") {
      return NextResponse.json(
        { error: "Berkas Excel (.xlsx / .xls) pengelamatan I/O tidak ditemukan." },
        { status: 400 }
      );
    }

    const uploadedFile = file as File;
    const filename = uploadedFile.name || "tabel_io.xlsx";

    if (!/\.(xlsx|xls)$/i.test(filename)) {
      return NextResponse.json(
        { error: "Format berkas tidak didukung. Mohon unggah berkas Excel berekstensi .xlsx atau .xls." },
        { status: 400 }
      );
    }

    const arrayBuffer = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parsePlcAddressWorkbook(buffer, filename);

    if (parsed.entries.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ditemukan baris alamat I/O yang valid dalam berkas Excel. Pastikan terdapat kolom ALAMAT PLC, SIMBOL, TIPE, dsb.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      result: parsed,
    });
  } catch (error) {
    console.error("Gagal membaca berkas Excel I/O:", error);
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan saat memproses berkas Excel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
