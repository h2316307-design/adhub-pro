const fs = require('fs');
const logPath = 'C:\\Users\\p\\.gemini\\antigravity\\brain\\6bb409be-b1f5-42c3-bf97-16c53a5c71ef\\.system_generated\\logs\\transcript.jsonl';
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  if (obj.tool_calls) {
    for (const tc of obj.tool_calls) {
      if (tc.name === 'view_file' && tc.args.AbsolutePath.includes('DesignStudio.tsx')) {
        const start = parseInt(tc.args.StartLine);
        const end = parseInt(tc.args.EndLine);
        // We want to find any view_file that covers lines 3080-3220
        if (start <= 3180 && end >= 3150) {
          console.log(`Found step ${obj.step_index} viewing lines ${start} to ${end}`);
        }
      }
    }
  }
}
