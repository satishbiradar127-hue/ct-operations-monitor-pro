const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/Orange Carrot/.gemini/antigravity/brain/9b0c936b-8ac2-438c-b440-22a29c77b327/.system_generated/logs/transcript_full.jsonl'),
  crlfDelay: Infinity
});
rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    if (obj.step_index === 1583) {
      fs.writeFileSync('temp_step1583.txt', obj.content);
      console.log('Written step 1583, length:', obj.content.length);
    }
  } catch(e) {}
});

