const fs = require('fs');
const c = fs.readFileSync('src/components/LaneGridEditorClient.tsx', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('applyCellAction') || l.includes('handleCellClick')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
