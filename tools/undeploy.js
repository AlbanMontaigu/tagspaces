// Remove an installed plugin from the TagSpaces user plugin folder.
//   node tools/undeploy.js <name>
// The removed copy is moved to backups/ first (nothing is deleted outright).
// Afterwards, set the affected file types back to a built-in viewer in
// Settings > File Types, otherwise TagSpaces points at a missing folder.
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const name = L.requirePluginArg(process.argv.slice(2));
const dst = path.join(L.TS_EXT_DIR, name);
if (!fs.existsSync(dst)) L.fail(`${name} is not installed in ${L.TS_EXT_DIR}`);
const bak = path.join(L.BACKUPS, `${name}-removed-${L.timestamp()}`);
fs.mkdirSync(L.BACKUPS, { recursive: true });
L.copyDir(dst, bak);
L.rmrf(dst);
L.log(`Removed ${dst}\nBackup: ${path.relative(L.ROOT, bak)}`);
L.log('Now reset the file types that used it in TagSpaces > Settings > File Types, and restart TagSpaces.');
