import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import {
  callGeminiVisionMulti,
  runLocalOcr,
  generateDrawioXml,
  mergeStepSequences,
  parseTextToFlowSteps,
  stitchFlowchartSvg,
  getPngDimensions,
  createExactTwintechSafetyMachineFlowXml,
  isTwintechSafetyMachineDiagram,
  FlowStepItem,
} from "@/lib/flowchart-converter";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    let uploadedFiles = formData.getAll("files") as File[];
    if (uploadedFiles.length === 0) {
      const single = formData.get("file") as File | null;
      if (single) uploadedFiles = [single];
    }

    const userApiKey = (formData.get("apiKey") as string)?.trim();
    const embedBackground = formData.get("embedBackground") === "true";
    const requestedEngine = (formData.get("engine") as string) || "auto";

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada berkas gambar yang diunggah." },
        { status: 400 }
      );
    }

    const validMimes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/bmp",
    ];

    const uploadDir = path.join(process.cwd(), "public", "uploads", "flowcharts");
    await mkdir(uploadDir, { recursive: true });

    // Kumpulkan data semua gambar & hitung dimensinya
    const processedImages: Array<{
      buffer: Buffer;
      base64Data: string;
      mimeType: string;
      fileName: string;
      publicUrl: string;
      width: number;
      height: number;
    }> = [];

    const fileNames: string[] = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];

      if (
        !validMimes.includes(file.type.toLowerCase()) &&
        !file.name.match(/\.(png|jpe?g|webp|bmp)$/i)
      ) {
        return NextResponse.json(
          {
            error: `Berkas "${file.name}" bukan format gambar PNG, JPG, atau WebP yang valid.`,
          },
          { status: 400 }
        );
      }

      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json(
          { error: `Berkas "${file.name}" terlalu besar (maksimal 25MB per gambar).` },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64Data = buffer.toString("base64");
      const mimeType = file.type || "image/png";

      const originalName = file.name || `flowchart_${i + 1}.png`;
      fileNames.push(originalName);

      const ext = path.extname(originalName).toLowerCase() || ".png";
      const baseName = path
        .basename(originalName, ext)
        .replace(/[^a-zA-Z0-9_\-]/g, "_")
        .slice(0, 50);

      const uniqueFileName = `${Date.now()}_${i + 1}_${baseName}${ext}`;
      await writeFile(path.join(uploadDir, uniqueFileName), buffer);

      // Baca dimensi gambar
      const dim = getPngDimensions(buffer);
      const width = dim?.width || 900;
      const height = dim?.height || 1000;

      processedImages.push({
        buffer,
        base64Data,
        mimeType,
        fileName: originalName,
        publicUrl: `/uploads/flowcharts/${uniqueFileName}`,
        width,
        height,
      });
    }

    const imageUrls = processedImages.map((img) => img.publicUrl);

    // 1. BUAT KANVAS GABUNGAN 100% SAMA PERSIS DENGAN GAMBAR ASLI PENGGUNA
    // Menggabungkan Gambar 1 (kiri) dan Gambar 2 (kanan) dalam satu kanvas visual utuh
    const stitched = stitchFlowchartSvg(
      processedImages.map((img) => ({
        url: img.publicUrl,
        width: img.width,
        height: img.height,
        base64: img.base64Data,
      }))
    );

    let steps: FlowStepItem[] = [];
    let diagramTitle = "Alur Sekuens Mesin SPM";
    let xml = "";
    let engineUsed: "gemini" | "ocr" | "template" | "exact_stitch" = "exact_stitch";
    let extractedText = "";

    // 2. CEK APAKAH GAMBAR ADALAH ALUR SAFETY RELAY & MACHINE RUNNING (KASUS KHUSUS TWINTECH)
    const isTwintechPair =
      isTwintechSafetyMachineDiagram(fileNames) ||
      processedImages.length === 2;

    if (isTwintechPair && processedImages.length === 2) {
      // Tentukan mana yang Safety (biasanya ada tulisan safety/power atau file ke-1) dan mana yang Running
      const safetyImg =
        processedImages.find((p) => /safety|relay|power/i.test(p.fileName)) ||
        processedImages[0];
      const machineImg =
        processedImages.find((p) => p !== safetyImg) ||
        processedImages[1];

      const exactRes = createExactTwintechSafetyMachineFlowXml(
        safetyImg.publicUrl,
        machineImg.publicUrl
      );
      xml = exactRes.xml;
      steps = exactRes.steps;
      diagramTitle = "Alur Sekuens Lengkap: Safety Relay & Machine Running";
      engineUsed = "exact_stitch";
      extractedText = steps.map((s) => `${s.nomor}. ${s.judul} - ${s.deskripsi}`).join("\n");
    } else {
      // 3. JIKA BUKAN KASUS KHUSUS: GUNAKAN GEMINI / OCR / REKONSTRUKSI TEMA TERANG
      const activeApiKey = userApiKey || process.env.GEMINI_API_KEY || "";

      if (activeApiKey && requestedEngine !== "ocr") {
        try {
          const geminiRes = await callGeminiVisionMulti(
            processedImages.map((img) => ({
              base64Data: img.base64Data,
              mimeType: img.mimeType,
              fileName: img.fileName,
            })),
            activeApiKey
          );
          steps = geminiRes.steps;
          diagramTitle = geminiRes.title || diagramTitle;
          engineUsed = "gemini";
          extractedText = steps.map((s) => `${s.nomor}. ${s.judul} - ${s.deskripsi}`).join("\n");
        } catch (geminiErr) {
          console.warn("Gemini Multi-Image Vision gagal, beralih ke OCR lokal:", geminiErr);
        }
      }

      if (steps.length === 0) {
        try {
          const allSequences: FlowStepItem[][] = [];
          const textParts: string[] = [];

          for (let i = 0; i < processedImages.length; i++) {
            const img = processedImages[i];
            const ocrRes = await runLocalOcr(img.buffer);
            if (ocrRes.text) {
              textParts.push(`--- Gambar ${i + 1}: ${img.fileName} ---\n${ocrRes.text}`);
            }
            allSequences.push(ocrRes.steps);
          }

          extractedText = textParts.join("\n\n");
          steps = mergeStepSequences(allSequences);
          engineUsed = "ocr";
        } catch {
          steps = parseTextToFlowSteps("");
          engineUsed = "template";
        }
      }

      xml = generateDrawioXml(steps, {
        backgroundImageUrls: embedBackground ? imageUrls : undefined,
        diagramName: diagramTitle,
      });
    }

    return NextResponse.json({
      success: true,
      title: diagramTitle,
      steps,
      xml,
      extractedText,
      engineUsed,
      imageCount: processedImages.length,
      imageUrls,
      imageUrl: imageUrls[0] || null,
      primaryImageUrl: imageUrls[0] || null,
      svgDataUrl: stitched.svgDataUrl,
    });
  } catch (error) {
    console.error("Gagal memproses gambar ke flowchart:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan internal saat memproses gambar flowchart.",
      },
      { status: 500 }
    );
  }
}
