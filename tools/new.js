// Scaffold a new plugin from templates/viewer.
//   node tools/new.js <name> --ext csv,log [--title "My Viewer"] [--editor]
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const args = process.argv.slice(2);
const name = L.requirePluginArg(args);
const opt = (flag) => {
  const i = args.indexOf(flag);
  return i > -1 ? args[i + 1] : undefined;
};
const exts = (opt('--ext') || '').split(',').map((s) => s.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
if (!exts.length) L.fail('--ext is required, e.g. --ext csv,tsv');
const title = opt('--title') || name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const editor = args.includes('--editor');

const dst = path.join(L.PLUGINS_SRC, name);
if (fs.existsSync(dst)) L.fail(`plugins/${name} already exists`);
L.copyDir(path.join(L.TEMPLATES, 'viewer'), dst);

const pkgPath = path.join(dst, 'src', 'package.json');
const pkg = L.readJson(pkgPath);
pkg.name = `@local/${name}`;
pkg.description = `${title} — local TagSpaces extension`;
pkg.tsextension.name = title;
pkg.tsextension.types = editor ? ['viewer', 'editor'] : ['viewer'];
pkg.tsextension.fileTypes = exts.map((ext) => ({ ext }));
L.writeJson(pkgPath, pkg);

const htmlPath = path.join(dst, 'src', 'build', 'index.html');
fs.writeFileSync(htmlPath, fs.readFileSync(htmlPath, 'utf8').replace(/__TITLE__/g, title));

L.log(`Created plugins/${name} for .${exts.join(', .')}${editor ? ' (viewer + editor)' : ''}`);
L.log(`Edit plugins/${name}/src/build/app.js, then: npm run build -- ${name} && npm run deploy -- ${name}`);
