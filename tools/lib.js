// Shared helpers for the TagSpaces plugin toolkit. Node >= 22, no dependencies.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PLUGINS_SRC = path.join(ROOT, 'plugins');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, 'cache');
const BACKUPS = path.join(ROOT, 'backups');
const TEMPLATES = path.join(ROOT, 'templates');

// Where TagSpaces looks for user-installed extensions (main.ts `load-extensions`).
const TS_PLUGINS_DIR =
  process.env.TAGSPACES_PLUGINS_DIR ||
  path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'TagSpaces', 'tsplugins');
const TS_EXT_DIR = path.join(TS_PLUGINS_DIR, '@tagspaces', 'extensions');
const TS_EXE = process.env.TAGSPACES_EXE || 'C:\\Program Files\\TagSpaces\\TagSpaces.exe';

// Use Windows' bsdtar explicitly: a GNU tar from Git Bash on PATH mangles C:\ paths.
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';

function log(...a) {
  console.log(...a);
}

function fail(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

function copyDir(src, dst) {
  fs.cpSync(src, dst, { recursive: true, force: true });
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p, base));
    else out.push(path.relative(base, p));
  }
  return out.sort();
}

/**
 * Download an npm package tarball into cache/npm (once) and extract selected
 * members. Downloaded content is treated as data: it is never executed.
 * @param {string} spec e.g. "mermaid@11.4.1"
 * @param {string[]} members tar member paths, e.g. ["package/dist/mermaid.min.js"]
 * @returns {string} directory containing the extracted "package/" folder
 */
function fetchNpm(spec, members) {
  const npmCache = path.join(CACHE, 'npm');
  fs.mkdirSync(npmCache, { recursive: true });
  const safe = spec.replace(/^@/, '').replace(/[\/@]/g, '-');
  const tgz = path.join(npmCache, safe + '.tgz');
  if (!fs.existsSync(tgz)) {
    log(`  downloading ${spec} ...`);
    // cwd = cache dir so no path with spaces goes through the shell.
    const out = execSync(`npm pack "${spec}" --ignore-scripts --json --pack-destination .`, {
      cwd: npmCache,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const info = JSON.parse(out)[0];
    fs.renameSync(path.join(npmCache, info.filename), tgz);
  }
  const dest = path.join(npmCache, safe);
  rmrf(dest);
  fs.mkdirSync(dest, { recursive: true });
  execFileSync(TAR, ['-xzf', tgz, '-C', dest, ...members], { stdio: 'inherit' });
  return dest;
}

/** Add `tsfile:` to the directives TagSpaces needs when loading from tsplugins. */
function allowTsfileInCsp(html) {
  return html.replace(
    /(http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i,
    (m, pre, csp, post) => {
      const directives = csp.split(';').map((d) => d.trim()).filter(Boolean);
      const want = ['default-src', 'script-src', 'style-src', 'font-src'];
      const fixed = directives.map((d) => {
        const [name, ...vals] = d.split(/\s+/);
        if (want.includes(name) && !vals.includes('tsfile:')) {
          const i = vals.indexOf("'self'");
          vals.splice(i >= 0 ? i + 1 : 0, 0, 'tsfile:');
        }
        return [name, ...vals].join(' ');
      });
      return pre + fixed.join('; ') + ';' + post;
    },
  );
}

/** Replace exactly one occurrence, or fail loudly (bundles change between versions). */
function replaceOnce(text, find, replacement, what) {
  const n = text.split(find).length - 1;
  if (n !== 1) fail(`${what}: expected exactly 1 match for ${JSON.stringify(find)}, found ${n}. The upstream bundle changed — see docs.`);
  return text.replace(find, () => replacement);
}

function isTagSpacesRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq TagSpaces.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
    return /TagSpaces\.exe/i.test(out);
  } catch {
    return false;
  }
}

function pluginNames() {
  if (!fs.existsSync(PLUGINS_SRC)) return [];
  return fs.readdirSync(PLUGINS_SRC, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}

function requirePluginArg(argv) {
  const name = argv[0];
  if (!name) fail(`plugin name required. Available: ${pluginNames().join(', ') || '(none)'}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) fail(`invalid plugin name "${name}" (use lowercase, digits, dashes)`);
  return name;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

module.exports = {
  ROOT, PLUGINS_SRC, DIST, CACHE, BACKUPS, TEMPLATES, TS_PLUGINS_DIR, TS_EXT_DIR, TS_EXE,
  log, fail, readJson, writeJson, rmrf, copyDir, listFiles, fetchNpm, allowTsfileInCsp,
  replaceOnce, isTagSpacesRunning, pluginNames, requirePluginArg, timestamp,
};
