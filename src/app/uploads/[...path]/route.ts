import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
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
};

export async function GET(
  req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await context.params;
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "Path tidak ditemukan" }, { status: 404 });
    }

    // Hindari directory traversal
    const safeSegments = pathSegments.map((s) => s.replace(/\.\./g, ""));
    const filePath = path.join(process.cwd(), "public", "uploads", ...safeSegments);

    // Cek apakah file ada
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        return NextResponse.json({ error: "Bukan berkas" }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
    }

    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const originalFilename = path.basename(filePath);
    // Jika nama berkas diawali timestamp angka_ misal 173000000_nama.ext, kita bisa bersihkan jika diinginkan,
    // namun kita gunakan encodeURIComponent untuk keselamatan header HTTP
    const cleanDownloadName = originalFilename.replace(/^\d+_/, "") || originalFilename;

    const url = new URL(req.url);
    const forceDownload = url.searchParams.get("download") === "1";

    const isInlineViewable =
      !forceDownload &&
      [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".pdf"].includes(ext);

    const disposition = isInlineViewable
      ? `inline; filename="${encodeURIComponent(cleanDownloadName)}"`
      : `attachment; filename="${encodeURIComponent(cleanDownloadName)}"`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": disposition,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Gagal menyajikan berkas:", error);
    return NextResponse.json(
      { error: "Gagal menyajikan berkas" },
      { status: 500 }
    );
  }
}
