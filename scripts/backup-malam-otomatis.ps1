# ============================================================
# BACKUP MALAM OTOMATIS — Jalan setiap malam jam 23:00
# Simpan 30 hari terakhir, hapus yang lebih lama
#
# CARA DAFTAR KE TASK SCHEDULER:
# 1. Buka Task Scheduler → Create Task
# 2. Tab General:
#    - Name: "Backup SQL Malam Otomatis"
#    - Run As: SYSTEM
#    - Run with highest privileges: ✓
#    - Run whether user is logged on or not: ✓
# 3. Tab Triggers → New:
#    - Daily, jam 23:00
# 4. Tab Actions → New:
#    - Program: powershell.exe
#    - Arguments: -NonInteractive -ExecutionPolicy Bypass -File "C:\WebApps\scripts\backup-malam-otomatis.ps1"
# ============================================================

$instance   = "localhost\SQLEXPRESS"
$database   = "ProjectMonitor"
$backupDir  = "C:\Backup\ProjectMonitor"
$logFile    = "C:\WebApps\logs\backup-malam.log"
$simpanHari = 30   # Simpan backup berapa hari

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null

$timestamp  = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupFile = "$backupDir\NIGHTLY_$timestamp.bak"

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $logFile -Value $line
}

Log "=== BACKUP MALAM DIMULAI ==="

try {
    $query = @"
BACKUP DATABASE [$database]
TO DISK = '$backupFile'
WITH FORMAT, INIT, COMPRESSION, STATS = 10;
"@
    sqlcmd -S $instance -E -Q $query 2>&1 | ForEach-Object { Log $_ }

    if (Test-Path $backupFile) {
        $sizeMB = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
        Log "SUKSES — $backupFile ($sizeMB MB)"
    } else {
        Log "GAGAL — file tidak terbuat"
    }
} catch {
    Log "ERROR: $_"
}

# Hapus backup lebih dari $simpanHari hari
$dihapus = 0
Get-ChildItem "$backupDir\NIGHTLY_*.bak" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$simpanHari) } |
    ForEach-Object {
        Remove-Item $_.FullName
        $dihapus++
    }
if ($dihapus -gt 0) { Log "Hapus $dihapus file backup lama (> $simpanHari hari)" }

Log "=== BACKUP MALAM SELESAI ==="
