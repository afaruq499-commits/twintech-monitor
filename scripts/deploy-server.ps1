# ============================================================
# DEPLOY SERVER — Jalankan di PC Server (sebagai Administrator)
# Salin dan jalankan SETIAP BARIS satu per satu di PowerShell
# ============================================================
# Jalankan PowerShell sebagai ADMINISTRATOR

# --- LANGKAH 1: Pastikan folder ada ---
New-Item -ItemType Directory -Force -Path "C:\WebApps\project-monitor"
New-Item -ItemType Directory -Force -Path "C:\WebApps\logs"
New-Item -ItemType Directory -Force -Path "C:\Backup\ProjectMonitor"

# --- LANGKAH 2: Masuk ke folder aplikasi ---
Set-Location "C:\WebApps\project-monitor"

# --- LANGKAH 3: Install dependencies (tanpa devDependencies) ---
npm install --omit=dev

# --- LANGKAH 4: Generate Prisma client untuk environment server ---
npx prisma generate

# --- LANGKAH 5: Buat tabel di SQL Server (jalankan sekali saja!) ---
# PASTIKAN .env sudah diisi dengan benar sebelum langkah ini
npx prisma db push

# --- LANGKAH 6: Install PM2 secara global ---
npm install -g pm2
npm install -g pm2-windows-startup

# --- LANGKAH 7: Daftarkan PM2 agar auto-start saat Windows boot ---
pm2-startup install

# --- LANGKAH 8: Jalankan aplikasi via PM2 ---
pm2 start ecosystem.config.js

# --- LANGKAH 9: Simpan konfigurasi PM2 ---
pm2 save

# --- LANGKAH 10: Cek status aplikasi ---
pm2 status
# Harus muncul: twintech-web | online

# --- LANGKAH 11: Test akses lokal ---
# Buka browser di PC Server: http://localhost:3000
# Harus muncul halaman login

# ============================================================
# KONFIGURASI IIS (jalankan setelah PM2 jalan)
# ============================================================

# --- LANGKAH 12: Aktifkan IIS (jika belum) ---
# Buka: Control Panel > Programs > Turn Windows features on or off
# Centang: Internet Information Services > World Wide Web Services > semua
# Centang: Web Management Tools > IIS Management Console
# Klik OK

# --- LANGKAH 13: Download dan install modul IIS ---
# A. URL Rewrite Module:
#    https://www.iis.net/downloads/microsoft/url-rewrite
#    (download versi x64)
#
# B. Application Request Routing (ARR):
#    https://www.iis.net/downloads/microsoft/application-request-routing
#    (download versi x64)

# --- LANGKAH 14: Aktifkan Proxy di ARR ---
# Buka IIS Manager (tekan Win+R, ketik: inetmgr)
# Klik nama server (paling atas) > Application Request Routing Cache
# Klik "Server Proxy Settings" di panel kanan
# Centang "Enable proxy" > klik Apply

# --- LANGKAH 15: Buat Website baru di IIS ---
# Di IIS Manager:
# Klik kanan "Sites" > Add Website
#   Site name    : TwintechWeb
#   Physical path: C:\WebApps\project-monitor   (folder yang ada web.config)
#   Port         : 80
# Klik OK

# --- LANGKAH 16: Buka Firewall untuk port 80 ---
New-NetFirewallRule `
    -DisplayName "Twintech Web (HTTP)" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 80 `
    -Action Allow

# --- LANGKAH 17: Test akses dari PC lain di jaringan ---
# Di PC lain, buka browser: http://[IP-SERVER]
# (ganti [IP-SERVER] dengan IP statis PC server, misal: 192.168.1.100)
