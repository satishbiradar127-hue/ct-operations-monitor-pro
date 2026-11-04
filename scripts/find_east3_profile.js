const fs = require('fs');
const path = require('path');
const base = 'C:\\Users\\Orange Carrot\\AppData\\Local\\Google\\Chrome\\User Data';

fs.readdirSync(base).forEach(dir => {
  const sessDir = path.join(base, dir, 'Sessions');
  if (fs.existsSync(sessDir)) {
    try {
      const files = fs.readdirSync(sessDir);
      for (const f of files) {
        if (f.startsWith('Session_') || f.startsWith('Tabs_')) {
          const full = path.join(sessDir, f);
          const buf = fs.readFileSync(full);
          const str = buf.toString('latin1');
          if (str.includes('east-3.calltools.io') || str.includes('east-3')) {
            console.log(`Found east-3 in ${dir} / ${f}`);
            const urls = str.match(/https?:\/\/[a-zA-Z0-9\.\-\_\/\?\&=\+]+/g) || [];
            const e3 = Array.from(new Set(urls.filter(u => u.includes('east-3'))));
            console.log('  URLs:', e3);
          }
        }
      }
    } catch (e) {}
  }
});

