import type { ProjectType, WorkType } from "./constants";

export interface TemplateSubPekerjaan {
  judul: string;
  rincianText: string;
}

export interface TemplatePekerjaan {
  judul: string;
  jenis: WorkType;
  subPekerjaan: TemplateSubPekerjaan[];
}

/**
 * Template Pekerjaan Proyek Automation Kecil
 * Mengacu 100% pada struktur schedule proyek Function Tester (9 Pekerjaan Utama)
 */
export const AUTOMATION_KECIL_TEMPLATE: TemplatePekerjaan[] = [
  {
    judul: "Analisis & Spesifikasi",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Analisis Produk & Kebutuhan Test",
        rincianText:
          "a. Memahami produk yang dites dan parameter test (tegangan, arus, komunikasi, dll.).\nb. Menentukan alat ukur, jig/fixture, dan aktuator (pneumatik/servo) yang dipakai.",
      },
      {
        judul: "2. Penyusunan Alur Test",
        rincianText:
          "a. Pembuatan flowchart proses test dan kriteria OK/NG.\nb. Penentuan daftar mode operasi, alarm, dan draft I/O.",
      },
    ],
  },
  {
    judul: "List Part Elektrikal & Order",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Pembuatan List Part Elektrikal",
        rincianText:
          "a. Perhitungan kebutuhan daya, pemilihan PLC, HMI, power supply, MCB, dan relay.\nb. Pemilihan sensor, solenoid valve, komponen safety, terminal, kabel, dan komponen panel.\nc. Pembuatan Purchase Requisition (PR) dan pengecekan ulang kelengkapan part.",
      },
      {
        judul: "2. Order & Monitoring Komponen",
        rincianText:
          "a. Pengajuan PR dan order komponen secepatnya.\nb. Monitoring status order dan lead time komponen.",
      },
    ],
  },
  {
    judul: "Desain Elektrikal",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Diagram Wiring & Alamat I/O",
        rincianText:
          "a. Pembuatan diagram wiring power, kontrol, I/O, dan komunikasi.\nb. Penetapan alamat I/O final (dikunci sebelum program berjalan jauh).",
      },
      {
        judul: "2. Layout & Review",
        rincianText:
          "a. Pembuatan layout panel dan panel operasi.\nb. Review gambar wiring dan layout dengan tim.",
      },
    ],
  },
  {
    judul: "Pembuatan Program",
    jenis: "PROGRAMMING",
    subPekerjaan: [
      {
        judul: "1. Program PLC",
        rincianText:
          "a. Penyusunan struktur program dan I/O assignment.\nb. Pembuatan manual mode (jog aktuator) dan interlock.\nc. Pembuatan auto sequence test dan logika judgement OK/NG.\nd. Pembuatan alarm dan error handling.",
      },
      {
        judul: "2. HMI & Komunikasi",
        rincianText:
          "a. Desain layar HMI (operasi, manual, alarm, setting).\nb. Pembuatan komunikasi ke alat ukur/PC (jika ada).",
      },
    ],
  },
  {
    judul: "Perakitan Panel",
    jenis: "WIRING",
    subPekerjaan: [
      {
        judul: "1. Incoming Komponen",
        rincianText: "a. Pengecekan komponen yang datang terhadap PR.",
      },
      {
        judul: "2. Perakitan Panel",
        rincianText:
          "a. Mounting komponen dan wiring panel.\nb. Labeling dan pengecekan kontinuitas.",
      },
    ],
  },
  {
    judul: "Wiring Mesin",
    jenis: "WIRING",
    subPekerjaan: [
      {
        judul: "1. Instalasi Panel & Kabel",
        rincianText:
          "a. Pemasangan panel pada mesin.\nb. Penarikan kabel ke sensor, aktuator, dan fixture.\nc. Grounding dan perapihan kabel.",
      },
    ],
  },
  {
    judul: "Commissioning",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. I/O Check & Safety Test",
        rincianText:
          "a. Pengecekan I/O satu per satu tanpa gerakan mesin.\nb. Pengujian Emergency Stop dan interlock safety.",
      },
      {
        judul: "2. Test per Modul",
        rincianText:
          "a. Jog aktuator dan tuning (servo/pneumatik).\nb. Download program PLC dan HMI, test per modul lalu digabung.",
      },
    ],
  },
  {
    judul: "Trial & Tuning",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Trial Function Test",
        rincianText:
          "a. Trial dengan sampel OK dan NG.\nb. Tuning timing dan batas judgement.",
      },
      {
        judul: "2. Uji Alarm & Error",
        rincianText:
          "a. Uji skenario alarm dan error (sensor tidak aktif, E-Stop saat auto, dll.).",
      },
    ],
  },
  {
    judul: "Dokumentasi & Serah Terima",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Dokumentasi & Training",
        rincianText:
          "a. Backup program PLC dan HMI.\nb. Gambar as-built dan manual operasi.\nc. Penjelasan singkat dan training ke operator.",
      },
    ],
  },
];

/**
 * Template Pekerjaan Proyek IoT
 */
export const IOT_PROYEK_TEMPLATE: TemplatePekerjaan[] = [
  {
    judul: "Analisis & Arsitektur IoT",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Kebutuhan Sensor & Gateway",
        rincianText:
          "a. Penentuan parameter telemetri (suhu, getaran, arus, flow, dll.).\nb. Pemilihan mikrokontroler / IoT Gateway (ESP32/Raspberry Pi/Industrial Gateway).",
      },
      {
        judul: "2. Protokol Komunikasi & Keamanan",
        rincianText:
          "a. Desain protokol transmisi (MQTT / HTTP REST / Modbus TCP / LoRaWAN).\nb. Konfigurasi keamanan data (TLS/SSL encryption & API Key).",
      },
    ],
  },
  {
    judul: "Hardware & Sensor Integration",
    jenis: "WIRING",
    subPekerjaan: [
      {
        judul: "1. Perakitan Modul & Power Supply",
        rincianText:
          "a. Perakitan modul gateway, interface RS485/analog, dan catu daya.\nb. Instalasi sensor telemetri di mesin target.",
      },
    ],
  },
  {
    judul: "Firmware & Edge Computing",
    jenis: "PROGRAMMING",
    subPekerjaan: [
      {
        judul: "1. Pemrograman Edge Gateway",
        rincianText:
          "a. Coding akuisisi data sensor dan filtering noise sinyal.\nb. Integrasi mekanisme offline caching / auto-reconnect saat jaringan putus.",
      },
    ],
  },
  {
    judul: "Cloud Platform & Dashboard",
    jenis: "PROGRAMMING",
    subPekerjaan: [
      {
        judul: "1. Backend & Visualisasi Data",
        rincianText:
          "a. Setup broker MQTT, database time-series, dan server API.\nb. Desain dashboard monitoring real-time, grafik tren, dan notifikasi alarm via WhatsApp/Telegram.",
      },
    ],
  },
  {
    judul: "Uji Lapangan & Serah Terima",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Testing Komunikasi & Kalibrasi",
        rincianText:
          "a. Uji kestabilan transmisi data 24/7 dan akurasi pembacaan.\nb. Dokumentasi API, panduan dashboard, dan serah terima ke client.",
      },
    ],
  },
];

/**
 * Template Pekerjaan Proyek Automation Besar
 */
export const AUTOMATION_BESAR_TEMPLATE: TemplatePekerjaan[] = [
  {
    judul: "Konsep & Engineering Review",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Spesifikasi Mesin & Layout Area",
        rincianText:
          "a. Review spesifikasi mechanical 3D CAD dan cycle time target.\nb. Penentuan arsitektur multi-PLC, safety PLC, dan jaringan industri (EtherNet/IP, CC-Link IE, Profinet).",
      },
    ],
  },
  {
    judul: "Procurement & Part Monitoring",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Pembuatan PR & Komponen Import",
        rincianText:
          "a. Pembuatan PR servo motor, robot arm, sensor presisi, dan panel enclosure.\nb. Monitoring lead time pengiriman part impor.",
      },
    ],
  },
  {
    judul: "Desain Sistem & Panel Utama",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. E-Plan Wiring Diagram",
        rincianText:
          "a. Gambar sirkuit daya 380V, kontrol 24V, multi-station I/O distribution, dan safety circuit.",
      },
    ],
  },
  {
    judul: "Fabrikasi Panel & Multi-Station Wiring",
    jenis: "WIRING",
    subPekerjaan: [
      {
        judul: "1. Perakitan Main Panel & Remote I/O",
        rincianText:
          "a. Wiring kabinet utama, VFD drive rack, dan remote I/O junction box tiap station.\nb. Penarikan kabel fleksibel pada drag-chain antar meja mesin.",
      },
    ],
  },
  {
    judul: "Pemrograman PLC, Robot & SCADA",
    jenis: "PROGRAMMING",
    subPekerjaan: [
      {
        judul: "1. Programming Sequence & Motion",
        rincianText:
          "a. Pembuatan program sekuensial multi-station PLC.\nb. Handshake komunikasi robot 6-axis / SCARA.\nc. Desain antarmuka SCADA / IPC dan data logging produksi.",
      },
    ],
  },
  {
    judul: "Dry Run & Station Tuning",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. I/O Check & Motion Verification",
        rincianText:
          "a. Pengecekan I/O seluruh stasiun, limit switch, dan kalibrasi origin servo.\nb. Uji interlock keselamatan safety light curtain & area scanner.",
      },
    ],
  },
  {
    judul: "Commissioning & Trial Produksi",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Running Test & CPK Verification",
        rincianText:
          "a. Uji kapasitas produksi kontinu dengan produk nyata.\nb. Evaluasi cycle time dan toleransi akurasi mesin.",
      },
    ],
  },
  {
    judul: "Final Buy-Off & Serah Terima",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Training & Dokumentasi Final",
        rincianText:
          "a. Serah terima dokumen as-built, backup program, sertifikat kalibrasi, dan pelatihan komprehensif teknisi client.",
      },
    ],
  },
];

/**
 * Template Pekerjaan Proyek After Sale (Service, Maintenance, Modifikasi)
 */
export const AFTER_SALES_TEMPLATE: TemplatePekerjaan[] = [
  {
    judul: "Identifikasi & Troubleshooting",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Analisis Masalah di Lapangan",
        rincianText:
          "a. Pengecekan riwayat alarm/error log pada PLC dan HMI.\nb. Observasi kondisi mesin, pengetesan sinyal I/O dan sensor di site client.",
      },
      {
        judul: "2. Penentuan Solusi & Spare Part",
        rincianText:
          "a. Identifikasi komponen yang rusak atau aus.\nb. Pembuatan daftar rekomendasi perbaikan dan spare part pengganti.",
      },
    ],
  },
  {
    judul: "Perbaikan & Penggantian Part",
    jenis: "WIRING",
    subPekerjaan: [
      {
        judul: "1. Instalasi Spare Part",
        rincianText:
          "a. Penggantian komponen rusak (sensor/relay/power supply/drive/kabel).\nb. Pengecekan wiring, grounding, dan kerapihan instalasi.",
      },
    ],
  },
  {
    judul: "Modifikasi & Pembaruan Program",
    jenis: "PROGRAMMING",
    subPekerjaan: [
      {
        judul: "1. Penyesuaian Program PLC & HMI",
        rincianText:
          "a. Update logika sekuensial PLC sesuai kebutuhan/kondisi mesin terbaru.\nb. Pembaruan tampilan HMI dan batas parameter setting.",
      },
    ],
  },
  {
    judul: "Trial Operasional & Kalibrasi",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Running Test & Verifikasi Fungsi",
        rincianText:
          "a. Dry run dan pengetesan dengan produk aktual bersama operator client.\nb. Verifikasi fungsi safety, interlock, dan respon Emergency Stop.",
      },
    ],
  },
  {
    judul: "Berita Acara & Serah Terima",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Laporan Service & Handover",
        rincianText:
          "a. Backup program final dan dokumentasi perbaikan.\nb. Pembuatan Service Report / Berita Acara Serah Terima (BAST) dan tanda tangan client.",
      },
    ],
  },
];

/**
 * Template Pekerjaan Proyek Integrasi Robot (Articulated Robot, SCARA, Delta, Cobot)
 */
export const INTEGRASI_ROBOT_TEMPLATE: TemplatePekerjaan[] = [
  {
    judul: "Analisis Jangkauan & Cycle Time",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Analisis Layout & Reachability",
        rincianText:
          "a. Analisis jangkauan kerja robot (reach study), payload, dan end-effector/gripper.\nb. Simulasi cycle time, jalur pergerakan, dan mitigasi area blind spot.",
      },
      {
        judul: "2. Spesifikasi Interlock & Safety Zone",
        rincianText:
          "a. Penentuan zona aman (safety fence, light curtain, safety scanner).\nb. Konfigurasi safety signal (E-Stop, fence door interlock, safe speed).",
      },
    ],
  },
  {
    judul: "List Part & Pengadaan Robot System",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Pembuatan PR Robot & Aksesoris",
        rincianText:
          "a. Pemilihan robot controller, teach pendant, kabel robot, dan base mounting.\nb. Pemilihan gripper, vacuum generator, tool changer, sensor deteksi part, dan kabel fleksi.\nc. Pembuatan Purchase Requisition (PR) dan monitoring lead time.",
      },
    ],
  },
  {
    judul: "Desain Elektrikal & Interface Komunikasi",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Diagram Wiring Interface PLC-Robot",
        rincianText:
          "a. Desain wiring I/O digital atau fieldbus (CC-Link, Profinet, EtherNet/IP, DeviceNet).\nb. Pemetaan alamat sinyal handshake (Robot Ready, Program Call, Cycle Start, Busy, Part Grip, Alarm).",
      },
      {
        judul: "2. Layout Panel & Jalur Kabel Robot",
        rincianText:
          "a. Penempatan controller robot, panel utama, dan rute cable track fleksibel ke arm.\nb. Review integrasi grounding dan proteksi surge.",
      },
    ],
  },
  {
    judul: "Instalasi Mekanikal & Wiring Robot",
    jenis: "WIRING",
    subPekerjaan: [
      {
        judul: "1. Base Mounting & Leveling Robot",
        rincianText:
          "a. Pemasangan robot ke pedestal/frame dan pengecekan kekokohan baut dinabolt/anchor.\nb. Leveling kerataan base robot.",
      },
      {
        judul: "2. Pemasangan Tooling Gripper & Wiring",
        rincianText:
          "a. Pemasangan mechanical gripper pada flange wrist robot.\nb. Penataan selang pneumatik dan kabel sensor pada arm robot dengan cable clamp.",
      },
    ],
  },
  {
    judul: "Pemrograman PLC & Teaching Point Robot",
    jenis: "PROGRAMMING",
    subPekerjaan: [
      {
        judul: "1. Teaching Posisi Gerakan Robot",
        rincianText:
          "a. Kalibrasi tool center point (TCP) dan base coordinate system.\nb. Teaching posisi Home, Standby, Pick Point, Retract, Transfer, dan Place Point.\nc. Optimasi kecepatan akselerasi/deselerasi dan penghindaran tabrakan (anti-collision).",
      },
      {
        judul: "2. Pemrograman PLC & Interlock Handshake",
        rincianText:
          "a. Pembuatan program PLC sequence kontrol stasiun mesin dan handshake sinyal robot.\nb. Integrasi HMI untuk status robot, mode manual jog, pemilihan resep/tipe produk, dan display alarm.",
      },
    ],
  },
  {
    judul: "Commissioning & Uji Coba Integrasi",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Dry Run & Slow Motion Test",
        rincianText:
          "a. Uji pergerakan robot langkah per langkah (step test) pada kecepatan rendah (T1 mode).\nb. Pengecekan respons Emergency Stop, safety fence open, dan auto-hold.",
      },
      {
        judul: "2. Full Speed Cycle Run & Akurasi",
        rincianText:
          "a. Uji continuous running pada 100% kecepatan kerja dengan beban produk aktual.\nb. Verifikasi akurasi penempatan (repeatability) dan pencapaian target cycle time.",
      },
    ],
  },
  {
    judul: "Dokumentasi & Serah Terima",
    jenis: "COMMISSIONING",
    subPekerjaan: [
      {
        judul: "1. Backup & Pelatihan Operator",
        rincianText:
          "a. Backup program robot (.tp / .src / .prg) dan program PLC ke flashdisk/cloud.\nb. Penyusunan manual operasional, panduan recovery alarm, dan training teknisi/operator client.",
      },
    ],
  },
];

export function getTemplateByProjectType(type: ProjectType): TemplatePekerjaan[] {
  switch (type) {
    case "IOT":
      return IOT_PROYEK_TEMPLATE;
    case "AUTOMATION_BESAR":
      return AUTOMATION_BESAR_TEMPLATE;
    case "INTEGRASI_ROBOT":
      return INTEGRASI_ROBOT_TEMPLATE;
    case "AFTER_SALES":
      return AFTER_SALES_TEMPLATE;
    case "AUTOMATION_KECIL":
    default:
      return AUTOMATION_KECIL_TEMPLATE;
  }
}
