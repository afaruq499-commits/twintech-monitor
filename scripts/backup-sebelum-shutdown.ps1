# ============================================================
# BACKUP DARURAT — Jalan otomatis saat Windows akan shutdown/restart
# Daftarkan via Task Scheduler (lihat instruksi di bawah)
#
# CARA DAFTAR KE TASK SCHEDULER:
# 1. Buka Task Scheduler (Win+R → taskschd.msc)
# 2. Create Task (bukan Basic Task)
# 3. Tab General:
#    - Name: "Backup SQL Sebelum Shutdown"
#    - Run As: SYSTEM
#    - Run with highest privileges: ✓
# 4. Tab Triggers → New:
#    - Begin the task: On an event
#    - Log: System
#    - Source: User32
#    - Event ID: 1074   ← ini event saat PC mau shutdown/restart
# 5. Tab Actions → New:
#    - Program: powershell.exe
#    - Arguments: -NonInteractive -ExecutionPolicy Bypass -File "C:\WebApps\scripts\backup-sebelum-shutdown.ps1"
# 6. Tab Settings:
#    - Stop the task if it runs longer than: 2 minutes
# ============================================================

$instance   = "localhost\SQLEXPRESS"   # Sesuaikan dengan nama instance SQL Server Anda
$database   = "ProjectMonitor"
$backupDir  = "C:\Backup\ProjectMonitor"
$logFile    = "C:\WebApps\logs\shutdown-backup.log"

# Buat folder jika belum ada
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null

$timestamp  = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupFile = "$backupDir\SHUTDOWN_$timestamp.bak"

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $logFile -Value $line
    Write-Host $line
}

Log "=== BACKUP DARURAT SEBELUM SHUTDOWN DIMULAI ==="

try {
    $query = @"
BACKUP DATABASE [$database]
TO DISK = '$backupFile'
WITH FORMAT, INIT, COMPRESSION, STATS = 10;
"@
    # Jalankan backup via sqlcmd
    $result = sqlcmd -S $instance -E -Q $query 2>&1
    Log "Hasil backup: $result"

    if (Test-Path $backupFile) {
        $sizeMB = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
        Log "SUKSES — File: $backupFile ($sizeMB MB)"
    } else {
        Log "GAGAL — File backup tidak ditemukan"
    }
} catch {
    Log "ERROR: $_"
}

# Hapus backup SHUTDOWN yang lebih dari 7 hari (simpan yang terbaru)
Get-ChildItem "$backupDir\SHUTDOWN_*.bak" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } |
    ForEach-Object {
        Log "Hapus backup lama: $($_.Name)"
        Remove-Item $_.FullName
    }

Log "=== BACKUP DARURAT SELESAI ==="
