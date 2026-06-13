const fs = require('fs');

const logPath = 'C:\\Users\\p\\.gemini\\antigravity\\brain\\6bb409be-b1f5-42c3-bf97-16c53a5c71ef\\.system_generated\\logs\\transcript.jsonl';
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

console.log("Searching current log path. Total lines:", lines.length);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  if (line.toLowerCase().includes('dummycards')) {
    console.log(`Match at line ${i}:`);
    const obj = JSON.parse(line);
    console.log(`type: ${obj.type}, step_index: ${obj.step_index}`);
    if (obj.content && obj.content.includes('dummyCards')) {
      fs.writeFileSync(`step_${obj.step_index}_content.txt`, obj.content);
      console.log(`Saved content to step_${obj.step_index}_content.txt`);
    }
  }
}
