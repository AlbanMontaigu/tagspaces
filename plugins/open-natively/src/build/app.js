/*
 * Open Natively: a placeholder viewer for files you'd rather open outside
 * TagSpaces. Shows the file name, its folder and a "Copy path" button.
 * To open the file, use TagSpaces' own Open > Open File Natively (Ctrl+Enter).
 * The file content is never loaded: the host passes the path in the URL (?file=...).
 */
(function () {
  var filePath = TS.filePath;

  function $(id) { return document.getElementById(id); }
  var copyBtn = $('copy');
  var statusEl = $('status');

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.className = kind || '';
  }

  function splitPath(p) {
    var i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
    return { dir: i > -1 ? p.slice(0, i) : '', name: i > -1 ? p.slice(i + 1) : p };
  }

  function render() {
    var parts = splitPath(filePath);
    var dot = parts.name.lastIndexOf('.');
    var ext = dot > 0 ? parts.name.slice(dot + 1) : '';
    $('name').textContent = parts.name || '(no file)';
    $('folder').textContent = parts.dir;
    $('icon').textContent = ext ? ext.slice(0, 5).toUpperCase() : 'FILE';
    document.title = parts.name || 'Open Natively';
    if (TS.colors.primary) document.documentElement.style.setProperty('--accent', TS.colors.primary);
  }

  function copyPath() {
    var done = function () { setStatus('Path copied.', 'ok'); setTimeout(function () { setStatus(''); }, 2000); };
    var fallback = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = filePath;
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? done() : setStatus('Copy failed. Select the path above instead.', 'error');
      } catch (e) {
        console.warn('open-natively: copy failed', e);
        setStatus('Copy failed.', 'error');
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(filePath).then(done, fallback);
    } else {
      fallback();
    }
  }

  render();
  if (copyBtn) {
    copyBtn.disabled = !filePath;
    copyBtn.addEventListener('click', copyPath);
  }
})();
