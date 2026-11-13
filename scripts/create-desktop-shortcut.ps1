$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $PSScriptRoot
$VbsPath = Join-Path $PSScriptRoot "launch-hidden.vbs"
$IconPath = Join-Path $ProjectDir "public\project-monitor.ico"

$DesktopDir = [Environment]::GetFolderPath("Desktop")
if (-not $DesktopDir -or -not (Test-Path $DesktopDir)) {
  $DesktopDir = Join-Path $env:USERPROFILE "Desktop"
}

$ShortcutPath = Join-Path $DesktopDir "Project Monitor.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "$env:SystemRoot\System32\wscript.exe"
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WorkingDirectory = $ProjectDir
if (Test-Path $IconPath) {
  $Shortcut.IconLocation = "$IconPath,0"
}
$Shortcut.Description = "Buka Aplikasi Project Monitor - PT. Twintech Precision"
$Shortcut.Save()

Write-Host "Shortcut Desktop berhasil dibuat di: $ShortcutPath"
