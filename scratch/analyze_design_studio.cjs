const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'DesignStudio.tsx');
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching for keywords "cover" and "غلاف"...');
const results = [];
lines.forEach((line, index) => {
  const lineNum = index + 1;
  const matchCover = line.toLowerCase().includes('cover');
  const matchArabic = line.includes('غلاف');
  if (matchCover || matchArabic) {
    results.push({ lineNum, line: line.trim() });
  }
});

console.log(`Found ${results.length} matches.`);
results.slice(0, 150).forEach(r => {
  console.log(`L${r.lineNum}: ${r.line}`);
});
