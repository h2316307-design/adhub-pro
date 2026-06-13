const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'DesignStudio.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

function printRange(start, end) {
  console.log(`--- Lines ${start} to ${end} ---`);
  for (let i = start - 1; i < end && i < lines.length; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}

printRange(5060, 5260);
