const fs = require('fs');
const c = fs.readFileSync('src/lib/export/schedule-exporter.ts', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('laneDatesIso') || l.includes('jumlahHari') || l.includes('tanggalMulai') || l.includes('customDates')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
