const fs = require('fs');
try {
    const buf = fs.readFileSync('C:\\Users\\Orange Carrot\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 20\\History');
    const s = buf.toString('latin1');
    const re = /https?:\/\/east-3\.calltools\.io[^\s\x00-\x1f\"\'<>]*/gi;
    const matches = Array.from(new Set(s.match(re) || []));
    console.log('History EAST-3 URLs:', matches);
} catch (e) {
    console.error(e);
}
