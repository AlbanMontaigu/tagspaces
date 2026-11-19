/*
 * Mermaid support for the TagSpaces md-editor (local build).
 * Loads mermaid.min.js lazily on the first ```mermaid block and exposes
 * window.__tsMermaid(code) -> Promise<svgString>, called from the
 * code-block renderPreview hook patched into the editor bundle by build.js.
 *
 * securityLevel 'strict' disables click handlers / scripts in diagrams and
 * HTML labels are sanitized — diagram source comes from user files.
 */
(function () {
  var loading = null;
  var counter = 0;

  function loadMermaid() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      if (window.mermaid) return resolve(window.mermaid);
      var s = document.createElement('script');
      s.src = './assets/mermaid.min.js';
      s.onload = function () {
        if (!window.mermaid) return reject(new Error('mermaid failed to load'));
        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          // window.theme is set by md-editor from the ?theme= URL parameter.
          theme: window.theme === 'dark' ? 'dark' : 'default',
        });
        resolve(window.mermaid);
      };
      s.onerror = function () {
        loading = null;
        reject(new Error('could not load mermaid.min.js'));
      };
      document.head.appendChild(s);
    });
    return loading;
  }

  window.__tsMermaid = function (code) {
    return loadMermaid().then(function (mermaid) {
      counter += 1;
      return mermaid.render('ts-mermaid-' + counter, code).then(function (r) {
        return r.svg;
      });
    });
  };
})();
