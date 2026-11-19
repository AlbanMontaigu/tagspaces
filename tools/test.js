// Headless smoke test: start a THROWAWAY portable TagSpaces (own temp profile,
// never touches your real settings), load dist/<name> in an iframe from
// tsfile://, feed it a sample file the way TagSpaces does, and screenshot it.
//   node tools/test.js <name> <sample-file> [--expect "css selector"]
//
// TagSpaces is single-instance: close your normal TagSpaces window first,
// otherwise the test instance exits immediately.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const L = require('./lib');

const args = process.argv.slice(2);
const name = L.requirePluginArg(args);
const sample = args[1] && path.resolve(args[1]);
if (!sample || !fs.existsSync(sample)) L.fail('usage: node tools/test.js <name> <sample-file> [--expect selector]');
const ei = args.indexOf('--expect');
const expect = ei > -1 ? args[ei + 1] : null;
const dist = path.join(L.DIST, name);
if (!fs.existsSync(path.join(dist, 'package.json'))) L.fail(`dist/${name} not built`);
if (!fs.existsSync(L.TS_EXE)) L.fail(`TagSpaces not found at ${L.TS_EXE} (set TAGSPACES_EXE)`);
if (L.isTagSpacesRunning()) L.fail('TagSpaces is running. Close it first (single-instance app), then re-run.');

const pkg = L.readJson(path.join(dist, 'package.json'));
const indexHtml = path.join(dist, pkg.tsextension.buildFolder || '', 'index.html').replace(/\\/g, '/');
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-plugin-test-'));
const shot = path.join(L.ROOT, 'dist', `${name}-test.png`);

async function cdp(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.consoleAPICalled' && /error|warn/.test(m.params.type)) logs.push(`console.${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
    else if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('error: ' + m.params.entry.text.slice(0, 300));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) return 'EXC ' + r.result.exceptionDetails.exception?.description;
    return r.result?.result?.value;
  };
  return { ws, send, evaluate, logs };
}

async function targets() {
  return (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
}

(async () => {
  L.log(`Starting throwaway TagSpaces (profile: ${work}) ...`);
  const child = spawn(L.TS_EXE, ['-p', `--remote-debugging-port=${PORT}`], { cwd: work, detached: false, stdio: 'ignore' });
  let ok = 0;
  try {
    let page;
    for (let i = 0; i < 60 && !page; i++) {
      await sleep(1000);
      try { page = (await targets()).find((t) => t.type === 'page'); } catch {}
    }
    if (!page) throw new Error('TagSpaces did not start (is another instance running?)');
    await sleep(4000);
    const host = await cdp(page);
    const src = `tsfile:///${indexHtml}?file=${encodeURIComponent(sample.replace(/\\/g, '/'))}&theme=light&locale=en&eventID=plugintest`;
    await host.evaluate(`(() => { const f = document.createElement('iframe'); f.style.cssText='position:fixed;left:0;top:0;width:1000px;height:750px;z-index:99999;background:#fff;border:0'; f.src=${JSON.stringify(src)}; document.body.appendChild(f); })()`);

    let frameTarget;
    for (let i = 0; i < 20 && !frameTarget; i++) {
      await sleep(500);
      frameTarget = (await targets()).find((t) => t.type === 'iframe' && t.url.startsWith('tsfile:'));
    }
    if (!frameTarget) throw new Error('extension iframe never loaded');
    const fr = await cdp(frameTarget);
    await fr.send('Runtime.enable');
    await fr.send('Log.enable');
    await fr.send('Page.enable');
    await fr.send('Page.reload', { ignoreCache: true }); // capture logs from the start
    await sleep(3000);
    // Deliver the file like EntryContainer.tsx does for 'parentLoadTextContent'.
    const content = fs.readFileSync(sample, 'utf8').replace(/^﻿/, '');
    await fr.evaluate(`window.postMessage({ action: 'fileContent', content: ${JSON.stringify(content)}, isEditMode: false }, '*')`);
    await sleep(6000);

    const nodes = await fr.evaluate(`document.body ? document.body.querySelectorAll('*').length : 0`);
    L.log(`DOM nodes in extension: ${nodes}`);
    let pass = nodes > 5;
    if (expect) {
      const n = await fr.evaluate(`document.querySelectorAll(${JSON.stringify(expect)}).length`);
      L.log(`--expect ${expect}: ${n} match(es)`);
      pass = pass && n > 0;
    }
    const s = await host.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1000, height: 750, scale: 1 } });
    fs.writeFileSync(shot, Buffer.from(s.result.data, 'base64'));
    L.log(`Screenshot: ${path.relative(L.ROOT, shot)}`);
    if (fr.logs.length) { L.log('--- extension errors/warnings ---'); fr.logs.forEach((l) => L.log(l)); }
    L.log(pass ? '\nPASS' : '\nFAIL');
    ok = pass ? 0 : 1;
    host.ws.close(); fr.ws.close();
  } catch (e) {
    console.error('FAIL: ' + e.message);
    ok = 1;
  } finally {
    try { process.kill(child.pid); } catch {}
    // Kill only processes started with our debug port (never the user's TagSpaces).
    if (process.platform === 'win32') {
      try {
        require('child_process').execSync(
          `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='TagSpaces.exe'\\" | ? { $_.CommandLine -match 'remote-debugging-port=${PORT}' } | % { Stop-Process -Id $_.ProcessId -Force }"`,
          { stdio: 'ignore' },
        );
      } catch {}
    }
    await sleep(1500);
    L.rmrf(work);
    process.exit(ok);
  }
})();
