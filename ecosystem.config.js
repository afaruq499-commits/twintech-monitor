// PM2 Ecosystem Config — Project Monitor PT Twintech
// Digunakan untuk menjalankan aplikasi di PC Server (production)
//
// Cara pakai:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup

module.exports = {
  apps: [
    {
      name: "twintech-web",           // Nama proses di PM2
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "C:\\WebApps\\project-monitor", // Sesuaikan dengan lokasi folder di PC Server
      instances: 1,
      autorestart: true,              // Restart otomatis jika crash
      watch: false,                   // Jangan watch file (production)
      max_memory_restart: "512M",     // Restart jika memori > 512 MB
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Log files
      out_file: "C:\\WebApps\\logs\\twintech-web-out.log",
      error_file: "C:\\WebApps\\logs\\twintech-web-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
