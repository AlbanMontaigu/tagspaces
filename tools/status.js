// Show plugins in this workspace vs. what is installed in TagSpaces.
//   node tools/status.js
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

function version(dir) {
  const p = path.join(dir, 'package.json');
  return fs.existsSync(p) ? L.readJson(p).version : '-';
}

function sameTree(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  const fa = L.listFiles(a);
  const fb = L.listFiles(b);
  if (fa.join('|') !== fb.join('|')) return false;
  return fa.every((f) => fs.readFileSync(path.join(a, f)).equals(fs.readFileSync(path.join(b, f))));
}

L.log(`TagSpaces exe : ${L.TS_EXE} ${fs.existsSync(L.TS_EXE) ? '' : '(NOT FOUND)'}`);
L.log(`Plugin folder : ${L.TS_EXT_DIR}`);
L.log(`Running       : ${L.isTagSpacesRunning() ? 'yes' : 'no'}\n`);

const installed = fs.existsSync(L.TS_EXT_DIR)
  ? fs.readdirSync(L.TS_EXT_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];
const names = [...new Set([...L.pluginNames(), ...installed])].sort();
const rows = names.map((n) => {
  const dist = path.join(L.DIST, n);
  const inst = path.join(L.TS_EXT_DIR, n);
  return {
    plugin: n,
    source: fs.existsSync(path.join(L.PLUGINS_SRC, n)) ? 'yes' : 'no',
    built: version(dist),
    installed: version(inst),
    'dist==installed': fs.existsSync(dist) && fs.existsSync(inst) ? (sameTree(dist, inst) ? 'yes' : 'NO') : '-',
  };
});
console.table(rows);
