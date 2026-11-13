-- ============================================================
-- BACKUP & RESTORE SQL SERVER — PT Twintech
-- Jalankan via SQL Server Management Studio (SSMS)
-- ============================================================

-- ============================
-- A. BACKUP di Laptop
--    Jalankan di laptop sebelum pindah ke server
-- ============================

-- Backup database ke file .bak
BACKUP DATABASE [ProjectMonitor]
TO DISK = 'C:\Backup\ProjectMonitor_backup_laptop.bak'
WITH
    FORMAT,         -- Buat file backup baru (timpa jika ada)
    INIT,           -- Inisialisasi media backup
    COMPRESSION,    -- Kompres file (lebih kecil)
    STATS = 10;     -- Tampilkan progress setiap 10%

-- Verifikasi backup berhasil
RESTORE VERIFYONLY
FROM DISK = 'C:\Backup\ProjectMonitor_backup_laptop.bak';

-- ============================
-- B. RESTORE di PC Server
--    Jalankan di PC Server setelah copy file .bak
-- ============================

-- Pastikan database belum ada (atau drop dulu jika perlu reset)
-- HATI-HATI: perintah DROP menghapus semua data!
-- DROP DATABASE IF EXISTS [ProjectMonitor];

-- Restore dari file backup
-- Sesuaikan path file .bak dengan lokasi di PC server
RESTORE DATABASE [ProjectMonitor]
FROM DISK = 'C:\Backup\ProjectMonitor_backup_laptop.bak'
WITH
    MOVE 'ProjectMonitor' TO 'C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\DATA\ProjectMonitor.mdf',
    MOVE 'ProjectMonitor_log' TO 'C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\DATA\ProjectMonitor_ldf.ldf',
    REPLACE,        -- Timpa jika sudah ada
    STATS = 10;

-- ============================
-- C. BUAT SQL LOGIN untuk Aplikasi
--    Jalankan di PC Server setelah restore
--    Agar aplikasi bisa konek tanpa Windows Authentication
-- ============================

-- Buat login di SQL Server level
CREATE LOGIN [twintech_app] WITH
    PASSWORD = 'TwintechApp#2024!',   -- Ganti password ini!
    CHECK_EXPIRATION = OFF,
    CHECK_POLICY = OFF;

-- Buat user di database ProjectMonitor
USE [ProjectMonitor];
CREATE USER [twintech_app] FOR LOGIN [twintech_app];

-- Beri hak akses penuh ke database
ALTER ROLE [db_owner] ADD MEMBER [twintech_app];

-- ============================
-- D. BACKUP OTOMATIS (Jadwalkan via Task Scheduler Windows)
--    Simpan sebagai: C:\Backup\backup-nightly.sql
--    Lalu buat scheduled task yang jalankan:
--    sqlcmd -S localhost\SQLEXPRESS -E -i C:\Backup\backup-nightly.sql
-- ============================

DECLARE @BackupFile NVARCHAR(500);
SET @BackupFile = 'C:\Backup\ProjectMonitor_' +
    CONVERT(VARCHAR, GETDATE(), 112) +  -- Format: YYYYMMDD
    '_' +
    REPLACE(CONVERT(VARCHAR, GETDATE(), 108), ':', '') +  -- Format: HHMMSS
    '.bak';

BACKUP DATABASE [ProjectMonitor]
TO DISK = @BackupFile
WITH FORMAT, INIT, COMPRESSION, STATS = 10;

-- Hapus backup lebih dari 30 hari (opsional, jalankan manual)
-- EXEC xp_delete_file 0, 'C:\Backup\', 'bak', DATEADD(day, -30, GETDATE());
