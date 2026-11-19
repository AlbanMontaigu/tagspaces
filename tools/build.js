// Build a plugin into dist/<name>.
//   node tools/build.js <name>
// If plugins/<name>/build.js exists it is run (it receives the output dir);
// otherwise plugins/<name>/src is copied as-is (plain HTML/JS extensions).
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const name = L.requirePluginArg(process.argv.slice(2));
const srcDir = path.join(L.PLUGINS_SRC, name);
if (!fs.existsSync(srcDir)) L.fail(`plugins/${name} does not exist`);
const out = path.join(L.DIST, name);

L.log(`Building ${name} -> dist/${name}`);
L.rmrf(out);
fs.mkdirSync(out, { recursive: true });

const custom = path.join(srcDir, 'build.js');
if (fs.existsSync(custom)) {
  require(custom)({ out, srcDir, lib: L });
} else {
  const src = path.join(srcDir, 'src');
  if (!fs.existsSync(src)) L.fail(`plugins/${name} has neither build.js nor src/`);
  L.copyDir(src, out);
}

// Sanity checks every TagSpaces extension must pass.
const pkgPath = path.join(out, 'package.json');
if (!fs.existsSync(pkgPath)) L.fail('output has no package.json');
const pkg = L.readJson(pkgPath);
const tse = pkg.tsextension;
if (!tse) L.fail('package.json has no "tsextension" section');
const index = path.join(out, tse.buildFolder || '', 'index.html');
if (!fs.existsSync(index)) L.fail(`missing ${path.relative(out, index)}`);
const html = fs.readFileSync(index, 'utf8');
const csp = (html.match(/Content-Security-Policy"\s+content="([^"]*)"/i) || [])[1];
if (csp && !/script-src[^;]*tsfile:/.test(csp)) {
  L.fail("index.html CSP lacks tsfile: in script-src — the extension will load as a blank page from tsplugins");
}

const files = L.listFiles(out);
L.log(`OK  ${pkg.name}@${pkg.version}  "${tse.name}"  types=${(tse.types || []).join('+')}  ext=${(tse.fileTypes || []).map((f) => f.ext).join(',')}  (${files.length} files)`);
