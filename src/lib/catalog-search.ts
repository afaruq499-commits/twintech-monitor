import {
  formatCatalogItemForPr,
  type CatalogItemFields,
} from "@/lib/pr-catalog-default";

export interface SearchableCatalogItem extends CatalogItemFields {
  id?: string;
  noUrut?: number;
  fungsi?: string | null;
}

export interface CatalogSearchOptions {
  limit?: number;
  preferField?: "partType" | "partName";
}

export interface CatalogSearchResult<T> {
  matches: T[];
  totalMatches: number;
  tokens: string[];
}

const AUTOMATION_ALIASES: Array<[needle: string, aliases: string]> = [
  ["push button", "pb tombol"],
  ["emergency stop", "estop e-stop emg"],
  ["power supply", "psu smps"],
  ["pilot lamp", "pl lampu indikator"],
  ["selector switch", "ss selektor"],
  ["terminal block", "tb"],
  ["circuit breaker", "mcb mccb breaker"],
  ["proximity", "prox"],
  ["photoelectric", "photosensor photo sensor"],
  ["solenoid valve", "selenoid valve katup"],
];

export function tokenizeSearchQuery(rawQuery: string): string[] {
  return rawQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function buildSearchAliases(baseText: string): string {
  const extra: string[] = [];
  for (const [needle, alias] of AUTOMATION_ALIASES) {
    if (baseText.includes(needle)) {
      extra.push(alias);
    }
  }
  return extra.join(" ");
}

function splitWords(text: string): string[] {
  return text.split(/[\s\-_/(),.:;+]+/).filter(Boolean);
}

/**
 * Mencari dan mengurutkan item katalog berdasarkan kata kunci pencarian (mendukung multi-kata,
 * pencocokan awalan/prefix, singkatan otomasi umum seperti "PB", "PSU", "ESTOP", dan prioritas kolom).
 */
export function searchCatalogComponents<T extends SearchableCatalogItem>(
  catalog: T[],
  rawQuery: string,
  options: CatalogSearchOptions = {}
): CatalogSearchResult<T> {
  const limit = options.limit ?? 15;
  const preferField = options.preferField ?? "partType";
  const q = rawQuery.trim().toLowerCase();
  const tokens = tokenizeSearchQuery(rawQuery);

  if (tokens.length === 0) {
    return {
      matches: catalog.slice(0, limit),
      totalMatches: catalog.length,
      tokens: [],
    };
  }

  const scored: Array<{ item: T; score: number; order: number }> = [];

  for (let idx = 0; idx < catalog.length; idx += 1) {
    const item = catalog[idx];
    const pr = formatCatalogItemForPr(item);

    const partTypeLower = pr.partType.toLowerCase();
    const partNameLower = pr.partName.toLowerCase();
    const brandLower = item.merek.trim().toLowerCase();
    const modelLower = item.tipeModel.trim().toLowerCase();
    const catLower = item.kategori.trim().toLowerCase();
    const specLower = (item.spesifikasi ?? "").trim().toLowerCase();
    const funcLower = (item.fungsi ?? "").trim().toLowerCase();

    const primaryText = `${partTypeLower} ${partNameLower} ${brandLower} ${modelLower} ${catLower}`;
    const aliases = buildSearchAliases(`${primaryText} ${specLower} ${funcLower}`);
    const haystack = `${primaryText} ${specLower} ${funcLower} ${aliases}`;

    // Semua token kata kunci wajib cocok di gabungan atribut komponen
    const allMatch = tokens.every((tok) => haystack.includes(tok));
    if (!allMatch) continue;

    const primaryWords = splitWords(primaryText);
    const aliasWords = splitWords(aliases);
    let score = 0;

    // Bonus awalan (prefix) pada kolom utama vs tipe model vs kategori
    if (preferField === "partType") {
      if (
        partTypeLower.startsWith(q) ||
        brandLower.startsWith(q) ||
        (q.length >= 2 && modelLower.startsWith(q))
      ) {
        score += 200;
      } else if (partNameLower.startsWith(q)) {
        score += 185;
      } else if (modelLower.startsWith(q)) {
        score += 170;
      } else if (catLower.startsWith(q)) {
        score += 50;
      }
    } else {
      if (partNameLower.startsWith(q)) {
        score += 200;
      } else if (
        partTypeLower.startsWith(q) ||
        brandLower.startsWith(q) ||
        (q.length >= 2 && modelLower.startsWith(q))
      ) {
        score += 185;
      } else if (modelLower.startsWith(q)) {
        score += 170;
      } else if (catLower.startsWith(q)) {
        score += 50;
      }
    }

    if (partTypeLower.includes(q) || partNameLower.includes(q)) {
      score += 45;
    }

    // Skor per token kata kunci
    for (const tok of tokens) {
      if (tok.length >= 2 && primaryWords.includes(tok)) {
        score += 90;
      } else if (tok.length >= 2 && aliasWords.includes(tok)) {
        score += 70;
      } else if (primaryWords.some((w) => w.startsWith(tok))) {
        score += 60;
      } else if (partTypeLower.includes(tok) || partNameLower.includes(tok)) {
        score += 35;
      } else if (catLower.includes(tok) || specLower.includes(tok)) {
        score += 20;
      } else {
        score += 10;
      }
    }

    scored.push({
      item,
      score,
      order: item.noUrut ?? idx + 1,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.order - b.order;
  });

  return {
    matches: scored.slice(0, limit).map((s) => s.item),
    totalMatches: scored.length,
    tokens,
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Memecah teks menjadi segmen biasa dan segmen yang cocok dengan kata kunci pencarian
 * agar dapat diberi highlight visual pada daftar pilihan dropdown.
 */
export function splitHighlightSegments(
  text: string,
  tokens: string[]
): HighlightSegment[] {
  if (!text) return [];
  const cleanTokens = Array.from(
    new Set(tokens.map((t) => t.trim().toLowerCase()).filter(Boolean))
  ).sort((a, b) => b.length - a.length);

  if (cleanTokens.length === 0) {
    return [{ text, highlighted: false }];
  }

  const pattern = cleanTokens.map(escapeRegExp).join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);
  const tokenSet = new Set(cleanTokens);

  const segments: HighlightSegment[] = [];
  for (const part of parts) {
    if (!part) continue;
    segments.push({
      text: part,
      highlighted: tokenSet.has(part.toLowerCase()),
    });
  }
  return segments;
}
