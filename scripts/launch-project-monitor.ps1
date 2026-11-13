param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $PSScriptRoot
$Port = 3000
$Url = "http://localhost:$Port"

function Test-PortOpen {
  param([int]$TargetPort)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect("127.0.0.1", $TargetPort, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(400, $false)
    if ($ok -and $client.Connected) {
      $client.EndConnect($iar)
      return $true
    }
    return $false
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

# 1. Jika server Project Monitor sudah aktif di port 3000, langsung buka browser!
if (Test-PortOpen -TargetPort $Port) {
  if (-not $NoBrowser) {
    Start-Process $Url
  }
  exit 0
}

# 2. Cari lokasi node.exe
$NodeExe = $null
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCmd) {
  $NodeExe = $NodeCmd.Source
} elseif (Test-Path "C:\Program Files\nodejs\node.exe") {
  $NodeExe = "C:\Program Files\nodejs\node.exe"
}

if (-not $NodeExe) {
  if (-not $NoBrowser) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      "Node.js tidak ditemukan di komputer ini. Pastikan Node.js terpasang di C:\Program Files\nodejs.",
      "Project Monitor",
      "OK",
      "Error"
    ) | Out-Null
  }
  exit 1
}

# 3. Pastikan hasil build produksi (.next\BUILD_ID) tersedia
$BuildIdPath = Join-Path $ProjectDir ".next\BUILD_ID"
if (-not (Test-Path $BuildIdPath)) {
  $NpmCmd = Join-Path (Split-Path -Parent $NodeExe) "npm.cmd"
  Start-Process -FilePath $NpmCmd -ArgumentList "run build" -WorkingDirectory $ProjectDir -Wait
}

# 4. Jalankan server Next.js di latar belakang tanpa jendela CMD hitam
$OutLog = Join-Path $ProjectDir ".next\server-stdout.log"
$ErrLog = Join-Path $ProjectDir ".next\server-stderr.log"

Start-Process `
  -FilePath $NodeExe `
  -ArgumentList @("node_modules\next\dist\bin\next", "start", "-p", "$Port") `
  -WorkingDirectory $ProjectDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog | Out-Null

# 5. Tunggu hingga port 3000 siap (biasanya ~1 detik), lalu buka browser otomatis
$MaxTries = 50
for ($i = 0; $i -lt $MaxTries; $i++) {
  if (Test-PortOpen -TargetPort $Port) {
    if (-not $NoBrowser) {
      Start-Process $Url
    }
    exit 0
  }
  Start-Sleep -Milliseconds 300
}

if (-not $NoBrowser) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    "Server Project Monitor belum merespons di $Url. Periksa log di:`n$ErrLog",
    "Project Monitor",
    "OK",
    "Warning"
  ) | Out-Null
}
exit 1
