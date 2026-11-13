/**
 * Utility Penyimpanan & Normalisasi Data Flowchart
 * Menyediakan schema versioning, normalisasi data backward-compatible,
 * validasi XML mxGraph Draw.io, dan cache IndexedDB untuk file gambar/blob.
 */

export interface FlowchartMetadata {
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  mimeType?: string;
}

export type FlowStepType = "START" | "STEP" | "DECISION" | "OK" | "NG" | "FINISH";

export interface FlowchartStepSummary {
  id: string;
  nomor: string;
  judul: string;
  deskripsi: string;
  tipe: FlowStepType;
}

export interface StoredFlowchartPayload {
  schemaVersion: 2;
  projectId?: string;
  primaryImageUrl?: string | null;
  imageUrls: string[];
  svgDataUrl?: string | null;
  xml?: string | null;
  steps?: FlowchartStepSummary[];
  metadata?: FlowchartMetadata;
  updatedAt: string;
}

/**
 * Normalisasi data flowchart dari berbagai versi / format warisan menjadi
 * schema standar berversi (schemaVersion: 2).
 */
export function normalizeFlowchartPayload(
  rawInput: string | null | undefined,
  fallbackProjectId?: string
): StoredFlowchartPayload | null {
  if (!rawInput || typeof rawInput !== "string") return null;
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Format Warisan 1: Berupa XML mentah Draw.io (<mxfile ...> atau <xml ...)
  if (trimmed.startsWith("<")) {
    if (
      trimmed.startsWith("<mxfile") ||
      trimmed.startsWith("<?xml") ||
      trimmed.startsWith("<xml") ||
      trimmed.includes("<mxGraphModel")
    ) {
      return {
        schemaVersion: 2,
        projectId: fallbackProjectId,
        primaryImageUrl: null,
        imageUrls: [],
        svgDataUrl: null,
        xml: trimmed,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // Format JSON (Skema Standar v2 atau payload tersimpan sebelumnya)
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object") return null;

    // Kumpulkan daftar imageUrls yang valid
    let urls: string[] = [];
    if (Array.isArray(parsed.imageUrls)) {
      urls = parsed.imageUrls.filter(
        (u: unknown): u is string => typeof u === "string" && u.trim().length > 0
      );
    } else if (typeof parsed.imageUrl === "string" && parsed.imageUrl.trim().length > 0) {
      urls = [parsed.imageUrl.trim()];
    }

    const primaryImg =
      (typeof parsed.primaryImageUrl === "string" && parsed.primaryImageUrl.trim()) ||
      urls[0] ||
      null;

    const xml = typeof parsed.xml === "string" ? parsed.xml : null;
    const svgDataUrl = typeof parsed.svgDataUrl === "string" ? parsed.svgDataUrl : null;
    const rawSteps = Array.isArray(parsed.steps) ? (parsed.steps as Record<string, unknown>[]) : undefined;
    const steps: FlowchartStepSummary[] | undefined = rawSteps?.map((s, idx) => ({
      id: String(s.id || `step-${idx + 1}`),
      nomor: String(s.nomor || idx + 1),
      judul: String(s.judul || "Langkah"),
      deskripsi: String(s.deskripsi || ""),
      tipe: (typeof s.tipe === "string" &&
      ["START", "STEP", "DECISION", "OK", "NG", "FINISH"].includes(s.tipe)
        ? s.tipe
        : "STEP") as FlowStepType,
    }));

    return {
      schemaVersion: 2,
      projectId: (typeof parsed.projectId === "string" && parsed.projectId) || fallbackProjectId,
      primaryImageUrl: primaryImg,
      imageUrls: urls,
      svgDataUrl: svgDataUrl,
      xml: xml,
      steps: steps,
      metadata: parsed.metadata && typeof parsed.metadata === "object" ? parsed.metadata : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch (err) {
    console.error("Gagal parse flowchart payload JSON:", err);
    return null;
  }
}

/**
 * Pembersihan dan encoding entitas XML aman.
 * Menjamin ampersand (&) yang belum di-encode secara otomatis diubah menjadi &amp;
 * tanpa merusak entitas sah yang sudah ada (&amp;, &lt;, &gt;, &quot;, &apos;, &#...).
 */
export function sanitizeXmlEntities(xml: string): string {
  if (!xml || typeof xml !== "string") return "";
  return xml.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
}

/**
 * Validasi sintaks XML Draw.io mxfile
 */
export function validateDrawioXml(xml: string): {
  isValid: boolean;
  error?: string;
  sanitizedXml?: string;
} {
  if (!xml || typeof xml !== "string") {
    return { isValid: false, error: "XML kosong atau tidak valid" };
  }
  const sanitized = sanitizeXmlEntities(xml.trim());
  if (
    !sanitized.includes("<mxfile") ||
    !sanitized.includes("<diagram") ||
    !sanitized.includes("<mxGraphModel")
  ) {
    return {
      isValid: false,
      error: "XML tidak memiliki struktur mxfile / mxGraphModel yang valid",
    };
  }

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(sanitized, "application/xml");
      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        return { isValid: false, error: parseError.textContent || "XML parse error" };
      }
    } catch (e) {
      return { isValid: false, error: e instanceof Error ? e.message : "Gagal parse XML" };
    }
  }

  return { isValid: true, sanitizedXml: sanitized };
}

/**
 * Validasi signature berkas PNG (Magic Bytes: 89 50 4E 47)
 */
export async function validatePngMagicBytes(file: File): Promise<boolean> {
  try {
    const slice = file.slice(0, 4);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return (
      bytes.length === 4 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  } catch {
    return false;
  }
}

/**
 * ================= IndexedDB Offline Cache Helper =================
 */
const DB_NAME = "TwintechFlowchartDB";
const DB_VERSION = 1;
const STORE_NAME = "flowchart_blobs";

function openFlowchartDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn("Gagal membuka IndexedDB Flowchart:", req.error);
        resolve(null);
      };
    } catch (err) {
      console.warn("IndexedDB tidak didukung atau diblokir:", err);
      resolve(null);
    }
  });
}

export async function saveFlowchartBlob(
  id: string,
  blob: Blob,
  metadata?: FlowchartMetadata
): Promise<void> {
  try {
    const db = await openFlowchartDb();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id,
        blob,
        metadata,
        updatedAt: new Date().toISOString(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => {
        if (req.error?.name === "QuotaExceededError") {
          console.error("IndexedDB kuota penyimpanan terlampaui.");
        }
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn("Gagal simpan Blob ke IndexedDB:", err);
  }
}

export async function getFlowchartBlob(
  id: string
): Promise<{ blob: Blob; metadata?: FlowchartMetadata } | null> {
  try {
    const db = await openFlowchartDb();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve({ blob: req.result.blob, metadata: req.result.metadata });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("Gagal membaca Blob dari IndexedDB:", err);
    return null;
  }
}
