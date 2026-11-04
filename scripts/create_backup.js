const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const now = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', `BACKUP_${now}`);
fs.mkdirSync(backupDir, { recursive: true });

const east2Src = path.join(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East2');
const east3Src = path.join(__dirname, '..', 'CT_OPERATIONS_DUAL_DIALER_RELEASE', 'CT_Operations_Monitor_East3');

copyDirSync(east2Src, path.join(backupDir, 'CT_Operations_Monitor_East2'));
copyDirSync(east3Src, path.join(backupDir, 'CT_Operations_Monitor_East3'));

console.log(`Backup successfully created at: ${backupDir}`);

