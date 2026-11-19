/*
 * TagSpaces host <-> extension bridge (TagSpaces 6.x).
 * Reverse-engineered from the app source: src/renderer/components/FileView.tsx
 * (iframe URL + message filter) and EntryContainer.tsx (handleMessage).
 *
 * The host loads   <ext>/build/index.html?file=<path>&theme=light|dark
 *                  &locale=en&primecolor=%23..&textcolor=..&bgndcolor=..
 *                  &eventID=<id>[&edit=true][&query=<search>]
 *
 * Extension -> host: window.parent.postMessage(JSON.stringify({command, eventID, ...}), '*')
 *   The host ignores messages that are not JSON *strings* or whose eventID
 *   does not match the one in the URL.
 *   commands: parentLoadTextContent       ask host for the file as text
 *             contentChangedInEditor      mark the file dirty (enables Save)
 *             savingFile {content}        save content (only if dirty)
 *             editDocument                ask host to switch to edit mode
 *             showAlertDialog {title,message}  host notification
 *             openLinkExternally {link}   open URL / ts:// link via host
 *
 * Host -> extension: postMessage({action, ...}) as an OBJECT
 *   actions:  fileContent {content, isEditMode}  reply to parentLoadTextContent
 *             savingFile                         user pressed Save in host toolbar
 *
 * The host also calls window.setTheme(mode) directly if the extension defines it.
 */
(function () {
  var params = new URLSearchParams(location.search);
  var handlers = { fileContent: [], save: [], theme: [] };

  var TS = {
    params: params,
    filePath: params.get('file') || '',
    theme: params.get('theme') || 'light',
    locale: params.get('locale') || 'en',
    isEditMode: params.get('edit') === 'true',
    searchQuery: params.get('query') || '',
    colors: {
      primary: params.get('primecolor') || '',
      text: params.get('textcolor') || '',
      background: params.get('bgndcolor') || '',
    },

    send: function (command, payload) {
      var msg = Object.assign({ command: command, eventID: params.get('eventID') || '' }, payload || {});
      window.parent.postMessage(JSON.stringify(msg), '*');
    },
    /** Ask the host for the file content; fn(content, isEditMode). */
    loadText: function (fn) {
      if (fn) handlers.fileContent.push(fn);
      TS.send('parentLoadTextContent');
    },
    markChanged: function () { TS.send('contentChangedInEditor'); },
    save: function (content) { TS.send('savingFile', { content: content }); },
    requestEdit: function () { TS.send('editDocument'); },
    notify: function (title, message) { TS.send('showAlertDialog', { title: title, message: message || '' }); },
    openLink: function (link) { TS.send('openLinkExternally', { link: link }); },
    /** fn() must return the content to save when the host's Save button is used. */
    onSaveRequest: function (fn) { handlers.save.push(fn); },
    onThemeChange: function (fn) { handlers.theme.push(fn); },
  };

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.action === 'fileContent') {
      if (typeof d.isEditMode === 'boolean') TS.isEditMode = d.isEditMode;
      handlers.fileContent.forEach(function (fn) { fn(d.content, TS.isEditMode); });
    } else if (d.action === 'savingFile') {
      handlers.save.forEach(function (fn) {
        var c = fn();
        if (typeof c === 'string') TS.save(c);
      });
    }
  });

  window.setTheme = function (mode) {
    TS.theme = mode;
    document.documentElement.dataset.theme = mode;
    handlers.theme.forEach(function (fn) { fn(mode); });
  };
  document.documentElement.dataset.theme = TS.theme;

  window.TS = TS;
})();
