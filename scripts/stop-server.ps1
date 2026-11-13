$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($p in $pids) {
    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    Write-Host "Proses server PID $p pada port 3000 berhasil dihentikan."
  }
} else {
  Write-Host "Server Project Monitor sedang tidak berjalan di port 3000."
}
