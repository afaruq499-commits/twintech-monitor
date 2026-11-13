import ExcelJS from "exceljs";
import { cellText } from "@/lib/excel/cells";
import type { ExportLaneInput, ExportSubScope, ExportWorkItem } from "./schedule-exporter";

export interface ParsedReferenceSchedule {
  lanes: ExportLaneInput[];
  logoBase64: string | null;
}

/**
 * Baca struktur hierarkis Lane -> WorkItem -> SubScope -> TaskDetail beserta logo JPEG dari File 2.
 * Dipakai untuk seed data proyek MGS dan verifikasi unit test terhadap File 2 asli.
 */
export async function parseReferenceScheduleFile(
  filePath: string,
  defaultStartDates: Record<string, string> = {}
): Promise<ParsedReferenceSchedule> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  let logoBase64: string | null = null;
  const mediaList = (wb.model as unknown as {
    media?: { extension?: string; buffer?: Buffer }[];
  }).media;
  if (Array.isArray(mediaList) && mediaList.length > 0 && mediaList[0].buffer) {
    const ext = mediaList[0].extension === "png" ? "png" : "jpeg";
    logoBase64 = `data:image/${ext};base64,${Buffer.from(mediaList[0].buffer).toString("base64")}`;
  }

  const lanes: ExportLaneInput[] = [];

  wb.eachSheet((ws) => {
    const parts = ws.name.split("|").map((s) => s.trim());
    const client = parts.length > 1 ? parts[0] : "MGS";
    const laneNama = parts.length > 1 ? parts[1] : ws.name.trim();

    // Hitung jumlah hari dari baris 9 mulai kolom F (col 6)
    let jumlahHari = 0;
    for (let c = 6; c <= 60; c++) {
      const v = ws.getCell(9, c).value;
      if (typeof v === "number" && v > 0) {
        jumlahHari = Math.max(jumlahHari, v);
      } else {
        break;
      }
    }
    if (jumlahHari === 0) jumlahHari = 6;

    const subjudul = cellText(ws, 4, 5) ?? "(Timeline Onsite & Commissioning)";

    // Baris data dimulai dari baris 10 sampai kolom E kosong
    const workItemMap = new Map<string, ExportWorkItem>();
    const workItems: ExportWorkItem[] = [];
    let wiOrder = 0;

    for (let r = 10; r <= ws.rowCount; r++) {
      const detailTeks = cellText(ws, r, 5);
      const wiJudul = cellText(ws, r, 3);
      if (!detailTeks || !wiJudul) break;

      const noText = cellText(ws, r, 2) ?? String(wiOrder + 1);
      const wiKey = `${noText}||${wiJudul}`;
      let wi = workItemMap.get(wiKey);
      if (!wi) {
        wiOrder++;
        wi = {
          urutan: wiOrder,
          judul: wiJudul,
          subScopes: [],
          scheduleCells: [],
        };
        workItemMap.set(wiKey, wi);
        workItems.push(wi);
      }

      const ssJudul = cellText(ws, r, 4) ?? "-";
      let ss: ExportSubScope | undefined = wi.subScopes[wi.subScopes.length - 1];
      if (!ss || ss.judul !== ssJudul) {
        ss = {
          urutan: wi.subScopes.length + 1,
          judul: ssJudul,
          details: [],
        };
        wi.subScopes.push(ss);
      }

      // Pertahankan newline asli pada detail tugas
      const rawE = ws.getCell(r, 5).value;
      const preservedDetail =
        typeof rawE === "string" ? rawE.trimEnd() : detailTeks;

      ss.details.push({
        urutan: ss.details.length + 1,
        teks: preservedDetail,
      });
    }

    lanes.push({
      client,
      laneNama,
      subjudul,
      tanggalMulai: defaultStartDates[laneNama] ?? "2026-11-02",
      jumlahHari,
      workItems,
    });
  });

  return { lanes, logoBase64 };
}
