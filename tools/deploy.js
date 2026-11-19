// Install dist/<name> into the TagSpaces user plugin folder.
//   node tools/deploy.js <name>
// An existing installed copy is first copied to backups/ and only then
// replaced (copy-before-delete, so a failure never loses the old version).
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const name = L.requirePluginArg(process.argv.slice(2));
const src = path.join(L.DIST, name);
if (!fs.existsSync(path.join(src, 'package.json'))) L.fail(`dist/${name} not built — run: npm run build -- ${name}`);
const dst = path.join(L.TS_EXT_DIR, name);

if (fs.existsSync(dst)) {
  const bak = path.join(L.BACKUPS, `${name}-${L.timestamp()}`);
  fs.mkdirSync(L.BACKUPS, { recursive: true });
  L.copyDir(dst, bak);
  L.log(`Backed up installed copy -> ${path.relative(L.ROOT, bak)}`);
  L.rmrf(dst);
}
fs.mkdirSync(path.dirname(dst), { recursive: true });
L.copyDir(src, dst);
const pkg = L.readJson(path.join(dst, 'package.json'));
L.log(`Deployed ${pkg.name}@${pkg.version} -> ${dst}`);

if (L.isTagSpacesRunning()) {
  L.log('\nTagSpaces is running: restart it to pick up the change (the extension iframe is cached).');
}
L.log(`\nFirst install only: Settings > Extensions > enable "${pkg.tsextension.name}",`);
L.log(`then Settings > File Types > choose it as viewer/editor for: ${(pkg.tsextension.fileTypes || []).map((f) => f.ext).join(', ')}`);
