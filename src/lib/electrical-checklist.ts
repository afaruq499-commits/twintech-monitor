export interface ElectricalChecklistCategory {
  id: string;
  nama: string;
  kategoriLabel: string;
  deskripsi: string;
  contohPart: string;
  matcher: (comp: { partType: string; partName: string; kelompok: string }) => boolean;
}

export const ELECTRICAL_CHECKLIST_CATEGORIES: ElectricalChecklistCategory[] = [
  {
    id: "box-panel",
    nama: "Box Panel & Enclosure",
    kategoriLabel: "Enclosure",
    deskripsi: "Box enclosure pelindung komponen elektrikal panel kontrol",
    contohPart: "Box Panel 600x700x265 / Enclosure Custom BS Teknik",
    matcher: (c) =>
      /box\s*panel|enclosure|panel\s*box/i.test(`${c.partType} ${c.partName}`),
  },
  {
    id: "mcb",
    nama: "Main Breaker & MCB",
    kategoriLabel: "Power Distribution",
    deskripsi: "MCB 3-Phase daya utama & MCB 1-Phase kontrol 24VDC / 220VAC",
    contohPart: "MCB Chint / Schneider NXB-63 3P 10A, 2P 6A, 2P 4A",
    matcher: (c) =>
      /\bmcb\b|\bmccb\b|\bbreaker\b|\bmain\s*switch\b/i.test(
        `${c.partType} ${c.partName}`
      ),
  },
  {
    id: "power-supply",
    nama: "Power Supply 24VDC",
    kategoriLabel: "DC Power",
    deskripsi: "Catu daya switching 24VDC untuk PLC, relay, dan sensor",
    contohPart: "Omron S8FS-C / Meanwell 24VDC 5A / 10A / 14A",
    matcher: (c) =>
      /power\s*supply|switching|s8fs|meanwell|\bpsu\b/i.test(
        `${c.partType} ${c.partName}`
      ),
  },
  {
    id: "noise-filter",
    nama: "Noise Filter (EMI/EMC)",
    kategoriLabel: "Power Quality",
    deskripsi: "Meredam gangguan frekuensi & harmonik listrik panel",
    contohPart: "TDK-Lambda RSEN-2006 / RSAL-2006 1-Phasa 6A",
    matcher: (c) =>
      /noise\s*filter|filter\s*noise|rsen|rsal|tdk-lambda/i.test(
        `${c.partType} ${c.partName}`
      ),
  },
  {
    id: "plc",
    nama: "PLC Controller & Modul I/O",
    kategoriLabel: "Main Controller",
    deskripsi: "CPU Controller otomasi mesin & ekspansi digital/analog I/O",
    contohPart: "Mitsubishi FX5U-32MR / 64MR, FX3U, Keyence KV, Omron CP1E",
    matcher: (c) =>
      /\bplc\b|fx5u|fx3u|cp1e|cp1l|s7-1200|kv-nano|kv-/i.test(
        `${c.partType} ${c.partName}`
      ),
  },
  {
    id: "safety-system",
    nama: "Safety Relay & Emergency Circuit",
    kategoriLabel: "Safety Interlock",
    deskripsi: "Modul safety relay unit & pemutus darurat E-Stop",
    contohPart: "Omron G9SA-TH301, G9SE, Pilz, Emergency Stop Turn Reset",
    matcher: (c) =>
      /safety\s*relay|g9sa|g9se|emergency\s*stop|\be-stop\b|estop|safety\s*door|light\s*curtain/i.test(
        `${c.partType} ${c.partName}`
      ),
  },
  {
    id: "relay",
    nama: "Industrial Relay (8-Pin / 14-Pin)",
    kategoriLabel: "Switching & Isolation",
    deskripsi: "Relay kontak switching beban & isolasi sinyal output PLC",
    contohPart: "Omron MY2N-D2 24VDC (8-Pin DPDT), MY4N, Socket PYF08A",
    matcher: (c) =>
      /\brelay\b|my2n|my4n|ly2n|rxm|pyf08a/i.test(
        `${c.partType} ${c.partName}`
      ) && !/safety\s*relay|g9sa/i.test(`${c.partType} ${c.partName}`),
  },
  {
    id: "terminal-block",
    nama: "Terminal Block & Din Rail",
    kategoriLabel: "Terminal & Din Rail",
    deskripsi: "Terminal blok distribusi perkabelan & Din Rail aluminium",
    contohPart: "FORT TBD-10A / 20A / 30A (1 Lusin), Din Rail 35mm Slotted",
    matcher: (c) =>
      /terminal\s*block|\btb\b|tbd-|din\s*rail/i.test(
        `${c.partType} ${c.partName}`
      ),
  },
  {
    id: "hmi",
    nama: "HMI Touchscreen / Operator Display",
    kategoriLabel: "Display & Monitor",
    deskripsi: "Layar monitor operasional & setting parameter resep mesin",
    contohPart: "Mitsubishi GOT GS2107 / GT2507, Weintek, Pro-face 7-inch",
    matcher: (c) =>
      /\bhmi\b|touchscreen|got|gs2107|weintek|proface|kinco/i.test(
        `${c.partType} ${c.partName}`
      ),
  },
  {
    id: "push-button",
    nama: "Push Button & Selector (OP Panel)",
    kategoriLabel: "Operator Control",
    deskripsi: "Tombol Start, Stop, Reset, Selector Switch Auto/Man, Pilot Lamp",
    contohPart: "IDEC YW1B / YW1L LED 22mm, Selector 2/3 Posisi, Pilot Lamp",
    matcher: (c) =>
      /push\s*button|selector\s*switch|\bsw\b|illuminated|pilot\s*lamp|indicator/i.test(
        `${c.partType} ${c.partName}`
      ) && !/emergency/i.test(`${c.partType} ${c.partName}`),
  },
  {
    id: "alarm",
    nama: "Alarm System (Tower Lamp & Buzzer)",
    kategoriLabel: "Signaling & Alert",
    deskripsi: "Indikator status visual (Merah/Kuning/Hijau) & sirine audio",
    contohPart: "Patlite LR5-302 / QLight Tower Lamp 24VDC, Buzzer 22mm",
    matcher: (c) =>
      /tower\s*lamp|patlite|buzzer|sirine|siren|alarm/i.test(
        `${c.partType} ${c.partName}`
      ),
  },
  {
    id: "sensor",
    nama: "Sensor Lapangan (Input Mesin)",
    kategoriLabel: "Field Sensors",
    deskripsi: "Sensor posisi part, silinder pneumatik, & inspeksi",
    contohPart: "Omron E2E Proximity NPN/PNP, Keyence Photoelectric, Auto Switch D-M9N",
    matcher: (c) =>
      /sensor|proximity|photoelectric|fiber|reed\s*switch|auto\s*switch|d-m9/i.test(
        `${c.partType} ${c.partName}`
      ),
  },
  {
    id: "wiring-material",
    nama: "Material Wiring Wajib (Kabel & Duct)",
    kategoriLabel: "Wiring & Consumables",
    deskripsi: "Kabel NYAF 0.34-6mm, Kabel Core, Ducting PVC, Skun Y, Kabel Bakar",
    contohPart: "NYAF 0.34/0.75/2.5/6mm, Ducting 30x40, Skun Y 1.25, Kabel Bakar",
    matcher: (c) =>
      /nyaf|kabel\s*core|ducting|skun|kabel\s*bakar|heat\s*shrink/i.test(
        `${c.partType} ${c.partName}`
      ),
  },
];
