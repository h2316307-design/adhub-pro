const fs = require('fs');
const logPath = 'C:\\Users\\p\\.gemini\\antigravity\\brain\\6bb409be-b1f5-42c3-bf97-16c53a5c71ef\\.system_generated\\logs\\transcript.jsonl';
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

// Find any step that has the full card imgUrl logic without truncation
for (const line of lines) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  const content = obj.content || '';
  
  // Look for the imgUrl assignment in collage cards
  if (content.includes("installed_image_url' in item") && content.includes("installed_image_face_a_url") && !content.includes('<truncated')) {
    console.log(`Step ${obj.step_index} (type: ${obj.type}) has full imgUrl logic, length: ${content.length}`);
  }
}
