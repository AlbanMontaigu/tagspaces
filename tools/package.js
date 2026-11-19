// Zip dist/<name> into dist/<name>-<version>.zip, the format accepted by
// TagSpaces > Settings > Extensions > "Install Extension" (it unzips into
// tsplugins/@tagspaces/extensions/<zip-name-without-.zip>). Use this to share
// a plugin with someone who doesn't have this toolkit.
//   node tools/package.js <name>
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lib');

const name = L.requirePluginArg(process.argv.slice(2));
const src = path.join(L.DIST, name);
if (!fs.existsSync(path.join(src, 'package.json'))) L.fail(`dist/${name} not built — run: npm run build -- ${name}`);
const pkg = L.readJson(path.join(src, 'package.json'));
// The installer uses the zip's file name as the folder name, so keep it == <name>.
const zip = path.join(L.DIST, `${name}.zip`);
fs.rmSync(zip, { force: true });
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar';
// bsdtar writes a zip when -a sees the .zip suffix. Files at the zip root.
execFileSync(tar, ['-a', '-c', '-f', zip, '-C', src, ...fs.readdirSync(src)], { stdio: 'inherit' });
L.log(`Packaged ${pkg.name}@${pkg.version} -> ${path.relative(L.ROOT, zip)} (${(fs.statSync(zip).size / 1048576).toFixed(1)} MB)`);
L.log('Install elsewhere via TagSpaces > Settings > Extensions > Install Extension (keep the file name).');
