const fs = require('fs');
const c = fs.readFileSync('src/components/CreateProjectScheduleClient.tsx', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('jumlahHari') || l.includes('tanggalMulai') || l.includes('customDates')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
