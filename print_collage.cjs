const fs = require('fs');
const logPath = 'C:\\Users\\p\\.gemini\\antigravity\\brain\\6bb409be-b1f5-42c3-bf97-16c53a5c71ef\\.system_generated\\logs\\transcript.jsonl';
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  if (obj.step_index === 418) {
    const content = obj.content;
    const contentLines = content.split('\n');
    
    // Print lines containing the collage card logic
    let print = false;
    for (let i = 0; i < contentLines.length; i++) {
      const cl = contentLines[i];
      if (cl.includes('dummyCards =')) {
        print = true;
      }
      if (print) {
        console.log(cl);
      }
      if (cl.includes('No image placeholder') || i > 150) {
        break;
      }
    }
    break;
  }
}
