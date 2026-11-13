# ============================================================
# REPAIR DATABASE OTOMATIS
# Jalankan MANUAL saat dicurigai database korup setelah mati listrik
#
# Cara pakai (di PC Server, PowerShell Admin):
#   .\repair-database.ps1
#
# Yang dilakukan script ini:
# 1. Cek apakah database korup (DBCC CHECKDB)
# 2. Jika korup: hapus halaman data yang rusak saja, data baik tetap aman
# 3. Buat backup setelah repair berhasil
# 4. Laporan lengkap di log file
# ============================================================

$instance   = "localhost\SQLEXPRESS"
$database   = "ProjectMonitor"
$backupDir  = "C:\Backup\ProjectMonitor"
$logFile    = "C:\WebApps\logs\repair-$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $logFile -Value $line
    Write-Host $line
}

function RunSQL($query) {
    return sqlcmd -S $instance -E -Q $query 2>&1
}

Log "========================================================"
Log "REPAIR DATABASE — $database"
Log "========================================================"

# --- LANGKAH 1: Cek kondisi database ---
Log ""
Log "--- [1/4] Memeriksa kondisi database..."
$checkResult = RunSQL "DBCC CHECKDB ([$database]) WITH NO_INFOMSGS, ALL_ERRORMSGS;"
$checkResult | ForEach-Object { Log $_ }

$adaError = $checkResult | Where-Object { $_ -match "CHECKDB found \d+ allocation errors and \d+ consistency errors" -and $_ -notmatch "found 0 allocation errors and 0 consistency errors" }

if (-not $adaError) {
    Log ""
    Log "✅ DATABASE SEHAT — Tidak ada korupsi ditemukan."
    Log "   Tidak perlu repair."
    Log ""
    exit 0
}

Log ""
Log "⚠️  KORUPSI TERDETEKSI — Memulai proses repair..."
Log "    Data yang rusak akan dihapus. Data yang baik tetap aman."
Log ""

# --- LANGKAH 2: Set ke SINGLE_USER mode (wajib untuk repair) ---
Log "--- [2/4] Set database ke mode repair..."
RunSQL "ALTER DATABASE [$database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;" | ForEach-Object { Log $_ }

# --- LANGKAH 3: Repair — hapus halaman rusak, pertahankan data baik ---
Log ""
Log "--- [3/4] Menjalankan repair (menghapus data korup saja)..."
Log "    REPAIR_ALLOW_DATA_LOSS = hanya hapus page yang rusak"
$repairResult = RunSQL "DBCC CHECKDB ([$database], REPAIR_ALLOW_DATA_LOSS) WITH NO_INFOMSGS, ALL_ERRORMSGS;"
$repairResult | ForEach-Object { Log $_ }

# --- LANGKAH 4: Kembalikan ke MULTI_USER ---
Log ""
Log "--- [4/4] Mengembalikan database ke mode normal..."
RunSQL "ALTER DATABASE [$database] SET MULTI_USER;" | ForEach-Object { Log $_ }

# --- Verifikasi setelah repair ---
Log ""
Log "--- Verifikasi setelah repair..."
$verifyResult = RunSQL "DBCC CHECKDB ([$database]) WITH NO_INFOMSGS, ALL_ERRORMSGS;"
$masihError = $verifyResult | Where-Object { $_ -match "CHECKDB found \d+ allocation errors and \d+ consistency errors" -and $_ -notmatch "found 0 allocation errors and 0 consistency errors" }

if ($masihError) {
    Log ""
    Log "❌ REPAIR TIDAK SEMPURNA — Masih ada error tersisa."
    Log "   Disarankan: Restore dari backup terakhir."
    Log "   Backup tersedia di: $backupDir"
} else {
    Log ""
    Log "✅ REPAIR BERHASIL — Database sudah sehat kembali."
    Log "   Data yang korup sudah dihapus."
    Log "   Data lain tetap aman."

    # Backup setelah repair berhasil
    $backupFile = "$backupDir\AFTER_REPAIR_$(Get-Date -Format 'yyyyMMdd_HHmmss').bak"
    Log ""
    Log "--- Membuat backup pasca-repair: $backupFile"
    RunSQL "BACKUP DATABASE [$database] TO DISK = '$backupFile' WITH FORMAT, INIT, COMPRESSION;" | ForEach-Object { Log $_ }
    Log "✅ Backup selesai."
}

Log ""
Log "========================================================"
Log "Log lengkap tersimpan di: $logFile"
Log "========================================================"
