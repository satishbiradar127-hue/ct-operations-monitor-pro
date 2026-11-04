const fs = require('fs');
const path = require('path');
const base = 'C:\\Users\\Orange Carrot\\AppData\\Local\\Google\\Chrome\\User Data';

function searchInDir(dir, depth = 0) {
  if (depth > 3) return;
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        searchInDir(full, depth + 1);
      } else if (item === 'History' || item.endsWith('.log') || item.endsWith('.ldb') || item === 'Preferences' || item === 'Secure Preferences') {
        try {
          const buf = fs.readFileSync(full);
          if (buf.includes('east-3.calltools.io')) {
            console.log(`Found east-3.calltools.io in: ${full}`);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

searchInDir(base);

