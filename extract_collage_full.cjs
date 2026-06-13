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
    
    let output = [];
    let capture = false;
    for (let i = 0; i < contentLines.length; i++) {
      const cl = contentLines[i];
      // Start capturing from "Bottom Collage" or "dummyCards"
      if (cl.includes('Bottom Collage') || cl.includes('dummyCards =')) {
        capture = true;
      }
      if (capture) {
        // Strip the line number prefix like "2917: "
        const stripped = cl.replace(/^\d+:\s?/, '');
        output.push(stripped);
      }
      // Stop after we find the closing of the cover layout
      if (capture && cl.includes('No image placeholder')) {
        break;
      }
    }
    fs.writeFileSync('collage_full_output.txt', output.join('\n'), 'utf8');
    console.log('Written ' + output.length + ' lines to collage_full_output.txt');
    break;
  }
}
