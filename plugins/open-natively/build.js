// Builds open-natively: a placeholder viewer showing the file name, folder and
// a "Copy path" button, for file types you'd rather open outside TagSpaces.
//  1. Copy src/ and the shared TagSpaces bridge from templates/viewer.
//  2. Write package.json from plugin.json.
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function build({ out, srcDir, lib: L }) {
  const cfg = L.readJson(path.join(srcDir, 'plugin.json'));

  L.copyDir(path.join(srcDir, 'src'), out);
  fs.copyFileSync(
    path.join(L.TEMPLATES, 'viewer', 'src', 'build', 'tagspaces-bridge.js'),
    path.join(out, 'build', 'tagspaces-bridge.js'),
  );

  const exts = [...new Set(cfg.fileTypes.map((e) => e.replace(/^\./, '').toLowerCase()))];
  L.writeJson(path.join(out, 'package.json'), {
    name: cfg.packageName,
    version: cfg.version,
    description: 'Shows the file name, folder and a Copy path button instead of rendering the file.',
    license: 'MIT',
    tsextension: {
      name: cfg.displayName,
      types: ['viewer'],
      color: '#2d8282',
      fileTypes: exts.map((ext) => ({ ext })),
      buildFolder: 'build',
      enabled: true,
    },
  });
};
