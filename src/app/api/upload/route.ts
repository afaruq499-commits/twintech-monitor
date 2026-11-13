import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "projects";

    if (!file) {
      return NextResponse.json(
        { error: "Tidak ada file yang diunggah" },
        { status: 400 }
      );
    }

    // Validasi ukuran (maksimum 150MB untuk berkas CAD DWG & project software PLC)
    const MAX_SIZE = 150 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file terlalu besar (maksimal 150MB)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Bersihkan nama file dari karakter berbahaya
    const originalName = file.name || "upload";
    const ext = path.extname(originalName).toLowerCase();
    const baseName = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .slice(0, 60);

    const uniqueName = `${Date.now()}_${baseName}${ext}`;

    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads", category);
      await mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, uniqueName);
      await writeFile(filePath, buffer);

      const publicUrl = `/uploads/${category}/${uniqueName}`;

      return NextResponse.json({
        success: true,
        url: publicUrl,
        fileName: originalName,
        fileSize: file.size,
        mimeType: file.type,
      });
    } catch (fsError: any) {
      // Fallback untuk platform serverless dengan read-only filesystem (seperti Vercel)
      const isReadOnlyFs =
        fsError?.code === "EROFS" ||
        fsError?.code === "EACCES" ||
        fsError?.message?.includes("read-only");

      if (isReadOnlyFs && buffer.length <= 8 * 1024 * 1024) {
        // Simpan sebagai Data URL jika ukuran berkas wajar (<= 8MB)
        const mime = file.type || "application/octet-stream";
        const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
        return NextResponse.json({
          success: true,
          url: dataUrl,
          fileName: originalName,
          fileSize: file.size,
          mimeType: mime,
          isDataUrl: true,
        });
      }

      console.error("Gagal menulis berkas ke filesystem:", fsError);
      return NextResponse.json(
        {
          error: isReadOnlyFs
            ? "Filesystem server bersifat read-only. File melebihi batas 8MB serverless."
            : "Gagal menyimpan berkas ke media penyimpanan.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Gagal memproses unggahan file:", error);
    return NextResponse.json(
      {
        error: "Terjadi kesalahan saat memproses file unggahan.",
      },
      { status: 500 }
    );
  }
}
