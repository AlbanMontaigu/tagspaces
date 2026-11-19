// Builds md-editor-mermaid: the stock TagSpaces md-editor (from npm) plus
// Mermaid diagram rendering in ```mermaid code blocks.
//
// How it works (details in README.md next to this file):
//  1. Copy md-editor from the @tagspaces/extensions npm tarball.
//  2. Add mermaid.min.js + mermaid-loader.js (lazy loader, window.__tsMermaid).
//  3. Patch Crepe's default code-block `renderPreview: () => null` in the
//     main bundle so language "mermaid" calls window.__tsMermaid.
//  4. index.html: load the loader, allow tsfile: in the CSP (needed when the
//     extension is served from the tsplugins folder), rename package.
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function build({ out, srcDir, lib: L }) {
  const cfg = L.readJson(path.join(srcDir, 'plugin.json'));

  // 1. Upstream md-editor
  const up = L.fetchNpm(cfg.upstream, [`package/${cfg.upstreamFolder}`]);
  L.copyDir(path.join(up, 'package', cfg.upstreamFolder), out);
  const upstreamPkg = L.readJson(path.join(out, 'package.json'));
  L.log(`  upstream ${cfg.upstreamFolder} ${upstreamPkg.version}`);

  // 2. Mermaid + loader
  const mm = L.fetchNpm(cfg.mermaid, ['package/dist/mermaid.min.js', 'package/package.json']);
  const assets = path.join(out, 'build', 'assets');
  fs.copyFileSync(path.join(mm, 'package', 'dist', 'mermaid.min.js'), path.join(assets, 'mermaid.min.js'));
  fs.copyFileSync(path.join(srcDir, 'mermaid-loader.js'), path.join(assets, 'mermaid-loader.js'));
  L.log(`  mermaid ${L.readJson(path.join(mm, 'package', 'package.json')).version}`);

  // 3. Patch the main bundle (the module script referenced by index.html)
  const htmlPath = path.join(out, 'build', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/<script type="module"[^>]*src="\.\/assets\/([^"]+\.js)"[^>]*><\/script>/);
  if (!m) L.fail('could not find the module <script> in md-editor index.html');
  const bundlePath = path.join(assets, m[1]);
  let js = fs.readFileSync(bundlePath, 'utf8');
  const hook =
    'renderPreview:(l,c,a)=>{' +
    'if(typeof l!=="string"||l.toLowerCase()!=="mermaid"||!c||!c.trim()||!window.__tsMermaid)return null;' +
    'window.__tsMermaid(c).then(a,e=>a("<pre style=\\"color:#c62828;white-space:pre-wrap\\">Mermaid: "+' +
    'String(e&&e.message||e).replace(/[<>&]/g,"")+"</pre>"));' +
    'return void 0}';
  js = L.replaceOnce(js, 'renderPreview:()=>null', hook, `patch ${m[1]}`);
  fs.writeFileSync(bundlePath, js);
  L.log(`  patched ${m[1]}`);

  // 4. index.html + package.json
  html = html.replace(m[0], '<script src="./assets/mermaid-loader.js"></script>\n    ' + m[0]);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${cfg.displayName}</title>`);
  html = L.allowTsfileInCsp(html);
  fs.writeFileSync(htmlPath, html);

  const pkg = upstreamPkg;
  pkg.name = cfg.packageName;
  pkg.version = `${upstreamPkg.version}-mermaid`;
  pkg.description = `Local build of md-editor ${upstreamPkg.version} with Mermaid (${cfg.mermaid}) diagram rendering.`;
  pkg.tsextension.name = cfg.displayName;
  pkg.tsextension.enabled = true;
  pkg.tsextension.isDefault = true;
  L.writeJson(path.join(out, 'package.json'), pkg);
};
