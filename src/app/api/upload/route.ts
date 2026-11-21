import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".dwg": "application/acad",
  ".dxf": "image/vnd.dxf",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".json": "application/json",
  ".kpr": "application/octet-stream",
  ".vfx": "application/octet-stream",
  ".gtx": "application/octet-stream",
  ".gtn": "application/octet-stream",
};

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

    // Lingkungan serverless (seperti Vercel) memiliki filesystem read-only & container ephemeral (/tmp tidak persisten antar request).
    // Untuk memastikan berkas teknik (AutoCAD DWG, PLC, HMI, PDF, gambar) tidak pernah 404 saat diunduh,
    // di serverless file berukuran <= 25MB selalu disimpan sebagai Data URL persisten di database.
    const isServerlessEnv = Boolean(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT
    );

    if (isServerlessEnv && buffer.length <= 25 * 1024 * 1024) {
      const mime = file.type || MIME_TYPES[ext] || "application/octet-stream";
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
        mimeType: file.type || MIME_TYPES[ext] || "application/octet-stream",
      });
    } catch (fsError: any) {
      // Fallback untuk platform dengan read-only filesystem jika deteksi serverless belum aktif
      const isReadOnlyFs =
        fsError?.code === "EROFS" ||
        fsError?.code === "EACCES" ||
        fsError?.message?.includes("read-only");

      if (buffer.length <= 25 * 1024 * 1024) {
        const mime = file.type || MIME_TYPES[ext] || "application/octet-stream";
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
            ? "Filesystem server bersifat read-only. File melebihi batas 25MB serverless."
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
