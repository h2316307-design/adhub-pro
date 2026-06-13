const fs = require('fs');
const logPath = 'C:\\Users\\p\\.gemini\\antigravity\\brain\\6bb409be-b1f5-42c3-bf97-16c53a5c71ef\\.system_generated\\logs\\transcript.jsonl';
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  if (obj.step_index === 1706) {
    console.log("=== STEP 1706 ===");
    console.log("Type:", obj.type);
    console.log("Content:");
    console.log(obj.content);
  }
}
