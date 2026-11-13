const fs = require('fs');
const c = fs.readFileSync('src/app/(app)/jadwal/lane/[id]/page.tsx', 'utf8');
console.log(c.slice(0, 1500));
