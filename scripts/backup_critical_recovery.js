const fs = require('fs');
const path = require('path');

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.resolve(`BACKUPS_CRITICAL_RECOVERY_${timestamp}`);
fs.mkdirSync(backupDir, { recursive: true });

console.log("Creating critical recovery backup in:", backupDir);

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('BACKUP') && entry.name !== 'node_modules' && entry.name !== '.git') {
        copyDir(srcPath, destPath);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(path.resolve('CT_OPERATIONS_DUAL_DIALER_RELEASE'), path.join(backupDir, 'CT_OPERATIONS_DUAL_DIALER_RELEASE'));

console.log("Critical recovery backup created successfully.");

