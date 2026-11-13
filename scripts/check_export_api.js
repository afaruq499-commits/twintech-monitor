const fs = require('fs');
const c = fs.readFileSync('src/app/api/export/jadwal/route.ts', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('ExportLaneInput') || l.includes('tanggalMulai') || l.includes('customDates')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
