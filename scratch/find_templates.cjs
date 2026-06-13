const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'DesignStudio.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

function findOccurrences(query) {
  const matches = [];
  lines.forEach((line, index) => {
    if (line.includes(query)) {
      matches.push({ lineNum: index + 1, line: line.trim() });
    }
  });
  return matches;
}

console.log('Searching template blocks...');
const t1 = findOccurrences("coverTemplate === 'template1'");
const t2 = findOccurrences("coverTemplate === 'template2'");
const t3 = findOccurrences("coverTemplate === 'template3'");
const t4 = findOccurrences("coverTemplate === 'template4'");

console.log('\ntemplate1 occurrences:', t1.map(o => o.lineNum));
console.log('template2 occurrences:', t2.map(o => o.lineNum));
console.log('template3 occurrences:', t3.map(o => o.lineNum));
console.log('template4 occurrences:', t4.map(o => o.lineNum));

// Let's print around L4980-L5020, L5250-L5280, L5310-L5340
console.log('\n--- Printing around L4982 (template1) ---');
for (let i = 4975; i < 5035; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

console.log('\n--- Printing around L5256 (template2) ---');
for (let i = 5250; i < 5310; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

console.log('\n--- Printing around L5313 (template4) ---');
for (let i = 5305; i < 5365; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
