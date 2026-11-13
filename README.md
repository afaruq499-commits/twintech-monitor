# Project Monitor — PT. Twintech Precision

Aplikasi web pribadi (**single-user**) berbahasa Indonesia untuk engineer otomasi industri yang menangani beberapa proyek sekaligus (wiring panel, programming PLC/HMI, testing/FAT, dan commissioning di site client).

Dirancang untuk berjalan lokal di laptop dengan database **SQL Server Express** lokal (`localhost:1433`), lengkap dengan fitur **PWA** agar dapat dipasang sebagai aplikasi mandiri di desktop maupun dibuka melalui jaringan Wi-Fi/hotspot di HP saat berada di lapangan.

---

## Fitur Utama

1. **Dashboard Operasional**: Kartu ringkasan proyek aktif, komponen belum datang, agenda 7 hari ke depan, proyek berisiko deadline, daftar tugas **Hari Ini** & **Besok**, serta panel alert terpusat (termasuk usulan status `DELAY` otomatis dengan konfirmasi manual).
2. **Manajemen Proyek (CRUD)**: Kode proyek, nama, client, tanggal mulai, deadline/delivery, level prioritas (`Tinggi`/`Sedang`/`Rendah`), status pengerjaan, status PR, warna kalender, progress kesiapan komponen, jadwal hierarkis, dan catatan.
3. **Buat / List Komponen PR di Web + Master Katalog 107+ Komponen + Rekomendasi Machine Learning**:
   - **Asisten Machine Learning Komponen Inti**: Cukup tuliskan deskripsi singkat komponen inti proyek (contoh: `"3 valve, 1 robot Yasakawa tipe a, dan 2 motor servo seri b"`), model *Hybrid Weighted k-NN + Domain TF-Cosine + Electrical Panel Sizing* (yang juga belajar dari riwayat proyek Anda di SQL Server) langsung mengidentifikasi dan merekomendasikan **seri PSU 24VDC**, **seri Safety Relay/Controller**, **jumlah Relay + Socket beserta rinciannya**, **seri PLC (Relay vs High-Speed Transistor vs Modular iQ-R)**, serta **spesifikasi MCB/MCCB utama & cabang**, siap dimasukkan 1-klik ke daftar PR.
   - Menyusun daftar Purchase Requisition langsung di web (`/buat-pr`): tinggal pilih dari **107+ katalog komponen otomasi bawaan** atau ketik manual dengan *floating autocomplete* cerdas sesuai *key search* (mendukung 1 huruf awalan, singkatan otomasi seperti `PB`, `PSU`, `ESTOP`, dan pencarian multi-kata).
   - Mendukung pengelompokan komponen (`Panel Utama`, `OP Panel`, `Sensor & Push Button`, atau kelompok bebas), simpan komponen custom baru ke Master Katalog, simpan ke proyek, serta **Export ke Excel dengan format yang sama persis dengan template Import PR** (kotak tanda tangan `DEPARTMENT`/`NOTE`/`PREPARED`/`CHECKED`/`PURCHASING`/`APPROVED`, merge cell `B:C`, `D:F`, `J:K`, pemisah kelompok, dan footer `PARTS NAME`/`PARTS NUMBER`/`JOB NUMBER`/`CUSTOMER` yang lolos *round-trip* saat di-import kembali).
4. **Import & Monitoring Komponen PR (Toleran Data Kotor)**:
   - Membaca format Purchase Requisition (`PURCHASE REQUISITION - ... .xlsx`) termasuk merged cells (`B:C`, `D:F`, `J:K`), pemisah kelompok via baris kosong, serta auto-isi nama proyek, kode job, dan client dari footer.
   - Parser harga toleran untuk format Indonesia, harga kosong, maupun ekspresi seperti `"16.800.00 x 3"`, `"3.250 x 12"` (`1 lsn`), atau `"350.00"` (otomatis ditandai badge **Perlu dicek** beserta nilai mentah `harga_raw`).
   - Deteksi komponen duplikat (`Gabungkan Qty` atau `Biarkan Terpisah`), edit inline di layar preview, serta **Mode MERGE** untuk revisi PR (mempertahankan status pembelian yang sudah diupdate, menandai item `BARU` dan `HILANG_DI_REVISI` tanpa menghapus otomatis).
   - Tracking status per komponen (`Belum PR` s/d `Terpasang`), bulk update, progress bar kesiapan, dan export daftar komponen terbaru ke Excel.
4. **Jadwal Hierarkis (Kalender & Grid Editor)**:
   - Hierarki 5 level: `Proyek -> Lane/Area -> Pekerjaan -> Sub-scope -> Detail tugas`.
   - Tanggal disimpan sebagai tanggal kalender asli; tampilan `Day 1..N` dihitung dinamis dari tanggal mulai masing-masing lane.
   - **Tampilan Kalender** (FullCalendar bulanan/mingguan/harian dengan drag-and-drop) dan **Grid Editor** mirip Excel referensi dengan klik/drag pengisian status (`TARGET`, `ON PROGRES`, `DONE`, `DELAY`).
   - **Template Pekerjaan** siap pakai ulang beserta sub-scope dan detail tugasnya.
5. **Aturan Konflik & Peringatan Otomatis**:
   - **Blokir Konflik Kapasitas Harian**: Default maksimal `1` pekerjaan utama per hari lintas **semua proyek dan lane** (`Meeting` dan pekerjaan bertanda `Boleh paralel` dikecualikan). Jika tanggal sudah terisi, penyimpanan diblokir dengan pesan jelas beserta **3 saran tanggal kosong terdekat**.
   - **Warning Komponen Belum Lengkap**: Menjadwalkan `Wiring` atau `Instalasi di Site` saat komponen proyek (atau komponen tertaut `WorkItemComponent`) belum datang akan memunculkan peringatan daftar komponen beserta estimasi tibanya.
   - **Risiko Deadline**: Menandai proyek dengan deadline `< 7` hari yang belum memiliki jadwal atau komponennya belum 100% datang.
6. **Prioritas Minggu Ini**: Perankingan otomatis berdasarkan kedekatan deadline, level prioritas, dan persentase kesiapan komponen lengkap dengan alasan tertulis serta fitur override urutan manual.
7. **Export Jadwal ke Excel (Replikasi Format Client)**:
   - Menggunakan **ExcelJS** dengan 1 sheet per lane bernama `<Client> | <Lane>` (contoh: `MGS | Glasstech`).
   - Kop perusahaan & logo dinamis dari halaman **Pengaturan**, header 2 baris ter-merge, merge vertikal `NO`, `DESCRIPTION`, dan `SCOPE of WORK`, pewarnaan penuh sel hari (`TARGET` `#00B050`, `ON PROGRES` `#FFD966`, `DONE` `#00B0F0`, `DELAY` `#F4B084`), legenda warna, toggle baris tanggal kalender aktual, serta print setup **A4 Landscape Fit to 1 Page Wide**.

---

## Prasyarat

- **Node.js** versi `20.x` atau `22.x` LTS
- **SQL Server Express** lokal (mis. `localhost\SQLEXPRESS`) dengan **Windows Authentication** dan protokol **TCP/IP port `1433`** aktif.

> **Catatan Aktivasi TCP Port 1433 SQL Server Express:**
> Secara bawaan, SQL Server Express menonaktifkan TCP/IP. Jika belum aktif, jalankan PowerShell **Run as Administrator**:
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\scripts\enable-sqlserver-tcp.ps1
> ```
> Lalu buat database kosong bernama `ProjectMonitor` (jika belum ada):
> ```powershell
> sqlcmd -S "localhost\SQLEXPRESS" -C -Q "IF DB_ID('ProjectMonitor') IS NULL CREATE DATABASE [ProjectMonitor];"
> ```

---

## Instalasi & Menjalankan di Laptop

1. **Pasang dependensi**:
   ```bash
   npm install
   ```

2. **Siapkan file `.env`** (salin dari `.env.example` bila belum ada):
   ```env
   DATABASE_URL="sqlserver://localhost:1433;database=ProjectMonitor;integratedSecurity=true;trustServerCertificate=true"
   APP_PASSWORD="twintech2026"
   SESSION_SECRET="ganti-dengan-string-acak-minimal-32-karakter"
   ```

3. **Sinkronkan skema Prisma & isi data awal (seed File 1 + File 2 + Template)**:
   ```bash
   npx prisma generate
   npm run db:push
   npm run db:seed
   ```

4. **Jalankan aplikasi**:
   - Mode pengembangan:
     ```bash
     npm run dev
     ```
   - Mode produksi lokal (lebih ringan & cepat untuk pemakaian harian):
     ```bash
     npm run build
     npm start
     ```

5. Buka browser di **[http://localhost:3000](http://localhost:3000)** dan masuk menggunakan password `APP_PASSWORD` dari `.env` (default: `twintech2026`).

### Membuka dengan 2x Klik dari Desktop (Tanpa Buka Terminal)

Shortcut bernama **Project Monitor** (berikon biru `PM`) telah dibuat otomatis di Desktop Windows Anda:
- **Klik 2x `Project Monitor` di Desktop** (atau klik 2x `Buka Project Monitor.bat` di folder proyek):
  - Jika server belum menyala (mis. laptop baru dinyalakan), script otomatis menyalakan server di latar belakang tanpa jendela CMD hitam, lalu membuka `http://localhost:3000` di browser.
  - Jika server sudah menyala, browser langsung terbuka seketika tanpa menduplikasi proses server.
- Jika sewaktu-waktu ingin mematikan server latar belakang, klik 2x `Matikan Server Project Monitor.bat` di folder proyek.
- Jika shortcut Desktop terhapus, jalankan ulang `powershell -ExecutionPolicy Bypass -File .\scripts\create-desktop-shortcut.ps1`.

---

## Pemasangan PWA (Desktop & HP di Lapangan)

- **Di Laptop (Chrome / Edge)**: Klik tombol **"Pasang Aplikasi (PWA)"** di sidebar kiri bawah (atau ikon install di address bar browser) agar Project Monitor memiliki ikon sendiri di Desktop/Taskbar.
- **Akses dari HP di Jaringan Wi-Fi / Hotspot Sama**:
  1. Pastikan laptop dan HP terhubung ke Wi-Fi/hotspot yang sama.
  2. Cek IP lokal laptop (`ipconfig`, mis. `192.168.1.10`) dan buka `http://192.168.1.10:3000` dari browser HP (pastikan port `3000` diizinkan pada Windows Firewall jaringan Private).

---

## Pengujian Otomatis (Vitest)

Seluruh aturan bisnis inti diuji dengan **Vitest** menggunakan kedua file Excel referensi asli di `docs/reference/`:

- `tests/pr-parser.test.ts`: Parser harga kotor/ekspresi, pembacaan nyata File 1 (26 baris, 3 kelompok, 22 OK, 4 Perlu dicek, footer proyek), deteksi duplikat, dan revisi PR mode `MERGE`.
- `tests/schedule-and-priority.test.ts`: Blokir konflik kapasitas harian lintas proyek + 3 saran tanggal kosong terdekat, pengecualian `Meeting`/`bolehParalel`, warning komponen belum datang, deteksi usulan `DELAY`, dan skor prioritas mingguan.
- `tests/exporter.test.ts`: Perbandingan struktural hasil export ExcelJS terhadap File 2 (`MGS | Glasstech` & `MGS | LandGlass` — nama sheet, kolom hari, jumlah merge vertikal/header, kode warna RGB status, legenda, dan print setup A4 landscape).

Jalankan seluruh unit test:
```bash
npm test
```

---

## Migrasi ke PostgreSQL / Cloud di Masa Depan

Skema Prisma menggunakan tipe standar yang mudah dipindahkan ke PostgreSQL jika suatu saat ingin di-deploy ke VPS/Cloud:
1. Ubah `provider = "sqlserver"` menjadi `provider = "postgresql"` pada `prisma/schema.prisma`.
2. Arahkan `DATABASE_URL` di `.env` ke connection string PostgreSQL.
3. Jalankan `npx prisma db push` dan `npm run db:seed`.
