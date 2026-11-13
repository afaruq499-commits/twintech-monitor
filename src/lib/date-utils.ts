const HARI_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const BULAN_PENDEK_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Konversi Date atau string ISO ke "YYYY-MM-DD" (selalu aman dari geseran timezone). */
export function toIsoDateStr(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    value = parsed;
  }
  if (Number.isNaN(value.getTime())) return null;

  // Jika Date objek berada pada midnight lokal (misal dari kalender UI FullCalendar):
  // gunakan getter lokal agar tanggal tidak bergeser ke hari kemarin pada zona waktu positif (seperti WIB UTC+7).
  if (value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Jika Date objek adalah UTC midnight (misal dari database @db.Date):
  if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Fallback umum: gunakan tanggal lokal user
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Buat objek Date UTC midnight dari "YYYY-MM-DD" untuk disimpan ke kolom @db.Date SQL Server. */
export function fromIsoDateStr(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const s = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

/** Tanggal hari ini menurut zona waktu lokal user dalam format "YYYY-MM-DD". */
export function todayIsoLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Tambah/kurang hari pada string "YYYY-MM-DD". */
export function addDaysIso(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/** Selisih hari (b - a), mis. diffDaysIso("2026-10-29", "2026-11-03") = 5. */
export function diffDaysIso(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.slice(0, 10).split("-").map(Number);
  const [by, bm, bd] = bIso.slice(0, 10).split("-").map(Number);
  const msA = Date.UTC(ay, am - 1, ad);
  const msB = Date.UTC(by, bm - 1, bd);
  return Math.round((msB - msA) / 86_400_000);
}

/** Hitung nomor Day 1..N relatif terhadap tanggal mulai lane (1-based). */
export function dayNumberFromLaneStart(laneStartIso: string, cellDateIso: string): number {
  return diffDaysIso(laneStartIso, cellDateIso) + 1;
}

/** Dapatkan daftar tanggal ISO untuk Day 1..jumlahHari pada sebuah lane (memperhitungkan customDates jika ada). */
export function laneDatesIso(
  laneStartIso: string,
  jumlahHari: number,
  customDates?: string[] | null
): string[] {
  const count = Math.max(1, jumlahHari);
  return Array.from({ length: count }, (_, idx) => {
    if (
      customDates &&
      customDates[idx] &&
      /^\d{4}-\d{2}-\d{2}$/.test(customDates[idx])
    ) {
      return customDates[idx];
    }
    return addDaysIso(laneStartIso, idx);
  });
}

/** Format "Senin, 2 Nov 2026" */
export function formatTanggalId(isoOrDate: Date | string | null | undefined, withDayName = true): string {
  const iso = toIsoDateStr(isoOrDate);
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const hari = HARI_ID[dt.getUTCDay()];
  const bln = BULAN_PENDEK_ID[m - 1];
  return withDayName ? `${hari}, ${d} ${bln} ${y}` : `${d} ${bln} ${y}`;
}

/** Format ringkas "Senin 12 Nov" untuk pesan alert konflik */
export function formatHariTanggalSingkat(isoOrDate: Date | string): string {
  const iso = toIsoDateStr(isoOrDate);
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const hari = HARI_ID[dt.getUTCDay()];
  const bln = BULAN_PENDEK_ID[m - 1];
  return `${hari} ${d} ${bln}`;
}

export function formatRupiah(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
}

/** Libur Nasional Tetap Indonesia (format "MM-DD") */
const LIBUR_NASIONAL_TETAP: Record<string, string> = {
  "01-01": "Tahun Baru Masehi",
  "05-01": "Hari Buruh Internasional",
  "06-01": "Hari Lahir Pancasila",
  "08-17": "Hari Kemerdekaan RI",
  "12-25": "Hari Raya Natal",
};

/**
 * Daftar Hari Libur Nasional & Cuti Bersama Indonesia (format "YYYY-MM-DD")
 * Berdasarkan SKB 3 Menteri & kalender resmi (2024-2027).
 */
const LIBUR_NASIONAL_VARIABEL: Record<string, string> = {
  // 2024
  "2024-02-08": "Isra Miraj Nabi Muhammad SAW",
  "2024-02-09": "Cuti Bersama Tahun Baru Imlek",
  "2024-02-10": "Tahun Baru Imlek 2575 Kongzili",
  "2024-03-11": "Hari Suci Nyepi (Tahun Baru Saka 1946)",
  "2024-03-29": "Wafat Yesus Kristus",
  "2024-03-31": "Hari Paskah",
  "2024-04-10": "Hari Raya Idul Fitri 1445 H",
  "2024-04-11": "Hari Raya Idul Fitri 1445 H",
  "2024-05-09": "Kenaikan Yesus Kristus",
  "2024-05-23": "Hari Raya Waisak 2568 BE",
  "2024-06-17": "Hari Raya Idul Adha 1445 H",
  "2024-07-07": "Tahun Baru Islam 1446 H",
  "2024-09-16": "Maulid Nabi Muhammad SAW",

  // 2025
  "2025-01-27": "Isra Miraj Nabi Muhammad SAW",
  "2025-01-28": "Cuti Bersama Imlek",
  "2025-01-29": "Tahun Baru Imlek 2576 Kongzili",
  "2025-03-28": "Cuti Bersama Nyepi",
  "2025-03-29": "Hari Suci Nyepi (Tahun Baru Saka 1947)",
  "2025-03-31": "Hari Raya Idul Fitri 1446 H",
  "2025-04-01": "Hari Raya Idul Fitri 1446 H",
  "2025-04-02": "Cuti Bersama Idul Fitri",
  "2025-04-03": "Cuti Bersama Idul Fitri",
  "2025-04-04": "Cuti Bersama Idul Fitri",
  "2025-04-07": "Cuti Bersama Idul Fitri",
  "2025-04-18": "Wafat Yesus Kristus",
  "2025-04-20": "Hari Paskah",
  "2025-05-12": "Hari Raya Waisak 2569 BE",
  "2025-05-13": "Cuti Bersama Waisak",
  "2025-05-29": "Kenaikan Yesus Kristus",
  "2025-05-30": "Cuti Bersama Kenaikan",
  "2025-06-06": "Hari Raya Idul Adha 1446 H",
  "2025-06-09": "Cuti Bersama Idul Adha",
  "2025-06-27": "Tahun Baru Islam 1447 H",
  "2025-09-05": "Maulid Nabi Muhammad SAW",
  "2025-12-26": "Cuti Bersama Hari Raya Natal",

  // 2026
  "2026-01-16": "Isra Miraj Nabi Muhammad SAW",
  "2026-02-16": "Cuti Bersama Imlek",
  "2026-02-17": "Tahun Baru Imlek 2577 Kongzili",
  "2026-03-19": "Hari Suci Nyepi (Tahun Baru Saka 1948)",
  "2026-03-20": "Hari Raya Idul Fitri 1447 H",
  "2026-03-21": "Hari Raya Idul Fitri 1447 H",
  "2026-03-23": "Cuti Bersama Idul Fitri",
  "2026-03-24": "Cuti Bersama Idul Fitri",
  "2026-04-03": "Wafat Yesus Kristus",
  "2026-04-05": "Hari Paskah",
  "2026-05-14": "Kenaikan Yesus Kristus",
  "2026-05-27": "Hari Raya Idul Adha 1447 H",
  "2026-05-31": "Hari Raya Waisak 2570 BE",
  "2026-06-16": "Tahun Baru Islam 1448 H",
  "2026-08-25": "Maulid Nabi Muhammad SAW",
  "2026-12-24": "Cuti Bersama Hari Raya Natal",
  "2026-12-26": "Cuti Bersama Hari Raya Natal",

  // 2027
  "2027-01-06": "Isra Miraj Nabi Muhammad SAW",
  "2027-02-06": "Tahun Baru Imlek 2578 Kongzili",
  "2027-03-09": "Hari Raya Idul Fitri 1448 H",
  "2027-03-10": "Hari Raya Idul Fitri 1448 H",
  "2027-03-26": "Wafat Yesus Kristus",
  "2027-04-08": "Hari Suci Nyepi (Tahun Baru Saka 1949)",
  "2027-05-06": "Kenaikan Yesus Kristus",
  "2027-05-16": "Hari Raya Idul Adha 1448 H",
  "2027-05-20": "Hari Raya Waisak 2571 BE",
  "2027-06-06": "Tahun Baru Islam 1449 H",
  "2027-08-15": "Maulid Nabi Muhammad SAW",
};

export interface TanggalMerahInfo {
  isRed: boolean;
  keterangan?: string;
  isSunday: boolean;
  isSaturday?: boolean;
  isWeekend?: boolean;
  isHoliday: boolean;
}

/**
 * Cek apakah tanggal merupakan Tanggal Merah (Hari Sabtu, Hari Minggu, atau Libur Nasional / Cuti Bersama Indonesia).
 */
export function isTanggalMerah(
  isoOrDate: Date | string | null | undefined
): TanggalMerahInfo {
  const iso = toIsoDateStr(isoOrDate);
  if (!iso) {
    return {
      isRed: false,
      isSunday: false,
      isSaturday: false,
      isWeekend: false,
      isHoliday: false,
    };
  }

  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dt.getUTCDay();
  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;
  const isWeekend = isSunday || isSaturday;

  const mmDd = iso.slice(5, 10);
  const fixedHoliday = LIBUR_NASIONAL_TETAP[mmDd];
  const variableHoliday = LIBUR_NASIONAL_VARIABEL[iso];
  const holidayLabel = variableHoliday || fixedHoliday;
  const isHoliday = Boolean(holidayLabel);

  if (isHoliday) {
    const weekendSuffix = isSunday
      ? " (Minggu)"
      : isSaturday
        ? " (Sabtu)"
        : "";
    return {
      isRed: true,
      keterangan: `${holidayLabel}${weekendSuffix}`,
      isSunday,
      isSaturday,
      isWeekend,
      isHoliday: true,
    };
  }

  if (isSunday) {
    return {
      isRed: true,
      keterangan: "Hari Minggu",
      isSunday: true,
      isSaturday: false,
      isWeekend: true,
      isHoliday: false,
    };
  }

  if (isSaturday) {
    return {
      isRed: true,
      keterangan: "Hari Sabtu",
      isSunday: false,
      isSaturday: true,
      isWeekend: true,
      isHoliday: false,
    };
  }

  return {
    isRed: false,
    isSunday: false,
    isSaturday: false,
    isWeekend: false,
    isHoliday: false,
  };
}

