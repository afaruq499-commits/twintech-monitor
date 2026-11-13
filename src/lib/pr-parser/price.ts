/**
 * Parser harga dari kolom HARGA Purchase Requisition.
 * Toleran terhadap data kotor: angka, teks format Indonesia (titik = ribuan),
 * ekspresi "harga x pengali" ("16.800.00 x 3", "3.250 x 12").
 * Tidak pernah melempar error; baris ambigu ditandai needsCheck.
 */
export interface PriceResult {
  /** harga satuan per unit PR (sesuai kolom Unit) */
  unit: number | null;
  /** total = unit x qty */
  total: number | null;
  needsCheck: boolean;
  reason?: string;
  raw: string | null;
}

/** Ubah teks angka gaya Indonesia menjadi number. Mengembalikan flag "ambigu". */
export function parseIdNumber(text: string): { value: number | null; ambiguous: boolean; reason?: string } {
  const s = text.trim().replace(/^rp\.?\s*/i, "").replace(/\s+/g, "");
  if (!s) return { value: null, ambiguous: false };
  if (!/^[\d.,]+$/.test(s)) return { value: null, ambiguous: true, reason: "Format tidak dikenali" };

  // Pola koma sebagai desimal: 16.800,00
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) {
    return { value: Number(s.replace(/\./g, "").replace(",", ".")), ambiguous: false };
  }
  // Pola ribuan baku: 1.089.000 / 206.888
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return { value: Number(s.replace(/\./g, "")), ambiguous: false };
  }
  // Murni digit
  if (/^\d+$/.test(s)) return { value: Number(s), ambiguous: false };

  // Salah ketik: ribuan + ".00" di akhir, mis. 16.800.00 -> 16.800
  const m = s.match(/^(\d{1,3}(?:\.\d{3})+)\.(\d{2})$/);
  if (m) {
    return {
      value: Number(m[1].replace(/\./g, "")),
      ambiguous: true,
      reason: `"${text.trim()}" format tidak baku, dibaca ${m[1]}`,
    };
  }
  // "350.00": kemungkinan nol hilang (350.000). Keputusan user: baca sebagai ribuan.
  const m2 = s.match(/^(\d{1,3})\.(\d{2})$/);
  if (m2) {
    return {
      value: Number(m2[1]) * 1000,
      ambiguous: true,
      reason: `"${text.trim()}" dibaca ${m2[1]}.000 (kemungkinan nol hilang)`,
    };
  }
  // Fallback: buang semua pemisah
  const digits = s.replace(/[.,]/g, "");
  return { value: digits ? Number(digits) : null, ambiguous: true, reason: `"${text.trim()}" dibaca ${digits}` };
}

export function parsePrice(rawInput: unknown, qty: number | null | undefined): PriceResult {
  const q = typeof qty === "number" && qty > 0 ? qty : null;
  if (rawInput === null || rawInput === undefined || rawInput === "") {
    return { unit: null, total: null, needsCheck: false, raw: null };
  }
  if (typeof rawInput === "number") {
    return { unit: rawInput, total: q ? rawInput * q : null, needsCheck: false, raw: String(rawInput) };
  }
  const raw = String(rawInput).trim();
  if (!raw) return { unit: null, total: null, needsCheck: false, raw: null };

  // Ekspresi "A x B"
  const expr = raw.split(/\s*[x×*]\s*/i);
  if (expr.length === 2 && expr[1].trim()) {
    const a = parseIdNumber(expr[0]);
    const mult = Number(expr[1].replace(/[^\d]/g, ""));
    if (a.value === null || !mult) {
      return { unit: null, total: null, needsCheck: true, reason: "Ekspresi harga tidak terbaca", raw };
    }
    const reasons: string[] = [];
    if (a.ambiguous && a.reason) reasons.push(a.reason);
    if (q !== null && mult === q) {
      // harga satuan x qty -> konsisten
      return {
        unit: a.value,
        total: a.value * q,
        needsCheck: a.ambiguous,
        reason: reasons.join("; ") || undefined,
        raw,
      };
    }
    // Pengali != qty: harga per sub-unit x pengali = harga per unit PR (mis. 3.250/pcs x 12 = per lusin)
    const unit = a.value * mult;
    reasons.push(`Pengali ${mult} berbeda dengan qty ${q ?? "-"}; dianggap ${a.value} x ${mult} = ${unit} per unit`);
    return { unit, total: q ? unit * q : unit, needsCheck: true, reason: reasons.join("; "), raw };
  }

  const n = parseIdNumber(raw);
  if (n.value === null) return { unit: null, total: null, needsCheck: true, reason: n.reason, raw };
  return { unit: n.value, total: q ? n.value * q : null, needsCheck: n.ambiguous, reason: n.reason, raw };
}
