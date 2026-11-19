/*
 * Your extension logic. Starts as a minimal text viewer/editor:
 *  - view mode: shows the file as preformatted text
 *  - edit mode (if "editor" is in tsextension.types): a textarea, Ctrl+S saves
 * Replace render() with whatever your file type needs.
 */
(function () {
  var app = document.getElementById('app');
  var meta = document.getElementById('meta');
  var saveBtn = document.getElementById('save');
  var editor = null;

  function render(content, isEditMode) {
    app.textContent = '';
    meta.textContent = content.split('\n').length + ' lines';
    if (isEditMode) {
      editor = document.createElement('textarea');
      editor.value = content;
      editor.spellcheck = false;
      editor.addEventListener('input', function () { TS.markChanged(); }, { once: false });
      app.appendChild(editor);
      saveBtn.hidden = false;
      editor.focus();
    } else {
      editor = null;
      saveBtn.hidden = true;
      var pre = document.createElement('pre');
      pre.textContent = content; // textContent: never inject file content as HTML
      app.appendChild(pre);
    }
  }

  function currentContent() {
    return editor ? editor.value : undefined;
  }

  TS.loadText(render);
  TS.onSaveRequest(currentContent); // host toolbar Save button
  saveBtn.addEventListener('click', function () { TS.save(currentContent()); });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && editor) {
      e.preventDefault();
      TS.save(currentContent());
    }
  });
  // Double-click in view mode asks the host to switch to edit mode.
  app.addEventListener('dblclick', function () { if (!editor) TS.requestEdit(); });
})();
