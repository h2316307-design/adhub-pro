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

// Search for template3 rendering
console.log('Searching for template3 occurrences:');
lines.forEach((line, index) => {
  if (line.includes("coverTemplate === 'template3'")) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});

// Let's print template1 code
console.log('\n--- Printing template1 ---');
// L4982 was "if (coverTemplate === 'template1') {"
printRange(4980, 5060);

// Let's print template3 code (it's likely after template2 or between template2 and template4)
// Let's find template3 in template rendering block. Let's search for "template3"
const t3Index = lines.findIndex(l => l.includes("coverTemplate === 'template3'"));
if (t3Index !== -1) {
  printRange(t3Index - 5, t3Index + 80);
}
