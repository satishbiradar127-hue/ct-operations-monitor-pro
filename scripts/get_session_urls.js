const fs = require('fs');
const buf = fs.readFileSync('C:\\Users\\Orange Carrot\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 20\\Sessions\\Session_13438186333604446');
const str = buf.toString('latin1');
const urls = str.match(/https?:\/\/[a-zA-Z0-9\.\-\_\/\?\&=\+]+/g) || [];
const unique = Array.from(new Set(urls.filter(u => u.includes('calltools.io'))));
console.log('CallTools URLs in Session:', unique);

