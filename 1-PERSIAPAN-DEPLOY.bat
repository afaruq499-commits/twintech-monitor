@echo off
:: ============================================================
:: DEPLOY PROJECT MONITOR KE PC SERVER PT TWINTECH
:: Jalankan file ini di LAPTOP sebelum pindah ke server
:: Hasil: folder siap kirim ada di deploy-siap-kirim\
:: ============================================================

echo.
echo ============================================
echo   PERSIAPAN DEPLOY PROJECT MONITOR
echo   PT Twintech Precision
echo ============================================
echo.

:: Pastikan di folder yang benar
cd /d "%~dp0"

echo [1/4] Membersihkan folder deploy lama...
if exist deploy-siap-kirim rmdir /s /q deploy-siap-kirim
mkdir deploy-siap-kirim

echo [2/4] Build aplikasi untuk production...
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build gagal! Periksa error di atas.
    pause
    exit /b 1
)

echo [3/4] Menyalin file ke folder deploy...
:: File dan folder yang perlu disalin ke server
xcopy /E /I /Q .next                deploy-siap-kirim\.next
xcopy /E /I /Q prisma               deploy-siap-kirim\prisma
xcopy /E /I /Q public               deploy-siap-kirim\public
xcopy /E /I /Q src                  deploy-siap-kirim\src
copy package.json                   deploy-siap-kirim\
copy package-lock.json              deploy-siap-kirim\
copy next.config.ts                 deploy-siap-kirim\
copy ecosystem.config.js            deploy-siap-kirim\
copy web.config                     deploy-siap-kirim\
copy .env.server.example            deploy-siap-kirim\
copy eng.traineddata                deploy-siap-kirim\

echo [4/4] Selesai!
echo.
echo ============================================
echo  Folder siap kirim: deploy-siap-kirim\
echo.
echo  LANGKAH SELANJUTNYA:
echo  1. Copy folder deploy-siap-kirim ke PC Server
echo     (via USB atau share folder jaringan)
echo  2. Di PC Server, rename folder menjadi:
echo     C:\WebApps\project-monitor\
echo  3. Ikuti panduan DEPLOY-SERVER.md
echo ============================================
echo.
pause
