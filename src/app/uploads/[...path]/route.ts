import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import os from "os";
import { prisma } from "@/lib/db";

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
    let filePath = path.join(process.cwd(), "public", "uploads", ...safeSegments);

    // Cek apakah file ada di public/uploads
    let fileExists = false;
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        fileExists = true;
      }
    } catch {
      fileExists = false;
    }

    // Jika tidak ditemukan di public/uploads (lingkungan serverless), cek di os.tmpdir()/uploads/...
    if (!fileExists) {
      const tmpPath = path.join(os.tmpdir(), "uploads", ...safeSegments);
      try {
        const fileStat = await stat(tmpPath);
        if (fileStat.isFile()) {
          filePath = tmpPath;
          fileExists = true;
        }
      } catch {
        fileExists = false;
      }
    }

    // Fallback serverless: Jika berkas tidak ada di filesystem fisik, cari di database (Supabase)
    if (!fileExists) {
      try {
        const fileName = safeSegments[safeSegments.length - 1];
        const cleanName = fileName.replace(/^\d+_/, "");

        const project = await prisma.project.findFirst({
          where: {
            OR: [
              { wiringDiagramPdfUrl: { contains: fileName } },
              { wiringDiagramPdfUrl: { contains: cleanName } },
              { wiringDiagramPdfName: cleanName },
              { plcProgramFileUrl: { contains: fileName } },
              { plcProgramFileName: cleanName },
              { hmiProgramFileUrl: { contains: fileName } },
              { hmiProgramFileName: cleanName },
            ],
          },
          select: {
            wiringDiagramPdfUrl: true,
            wiringDiagramPdfName: true,
            plcProgramFileUrl: true,
            plcProgramFileName: true,
            hmiProgramFileUrl: true,
            hmiProgramFileName: true,
          },
        });

        if (project) {
          const candidateUrls = [
            project.wiringDiagramPdfUrl,
            project.plcProgramFileUrl,
            project.hmiProgramFileUrl,
          ].filter(Boolean) as string[];

          for (const rawUrl of candidateUrls) {
            if (rawUrl.startsWith("data:")) {
              const matches = rawUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                const dataBuffer = Buffer.from(base64Data, "base64");
                const cleanDownloadName = cleanName || "berkas_download";

                return new Response(dataBuffer, {
                  status: 200,
                  headers: {
                    "Content-Type": mimeType,
                    "Content-Length": dataBuffer.length.toString(),
                    "Content-Disposition": `attachment; filename="${encodeURIComponent(cleanDownloadName)}"`,
                    "Cache-Control": "public, max-age=31536000, immutable",
                  },
                });
              }
            }
          }
        }
      } catch (dbErr) {
        console.error("Gagal mencari berkas di database:", dbErr);
      }
    }

    if (!fileExists) {
      return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
    }

    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const originalFilename = path.basename(filePath);
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
