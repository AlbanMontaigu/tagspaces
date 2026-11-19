# How TagSpaces extensions work (desktop 6.x)

Notes taken from the TagSpaces source (`tagspaces-develop`) and the installed 6.15.1 build.

## Discovery

- At startup the renderer sends `load-extensions`. Main (`src/main/main.ts`) scans `%APPDATA%\TagSpaces\tsplugins\@tagspaces\extensions\*` and `...\@tagspacespro\extensions\*` (`src/main/extension-utils.ts`).
- Each subfolder needs a `package.json` with a `tsextension` block:

```json
"tsextension": {
  "name": "Shown in Settings",
  "types": ["viewer", "editor"],
  "color": "#beefed",
  "fileTypes": [{ "ext": "md" }, { "ext": "mdx", "types": ["viewer"] }],
  "buildFolder": "build",
  "enabled": true,
  "isDefault": true
}
```

- `extensionId` = `@tagspaces/extensions/<folder>/<buildFolder>`. The folder name is the ID, so give every plugin a unique folder name (e.g. `md-editor-mermaid`, not `md-editor`).
- User ("external") extensions are listed **disabled** until switched on in Settings → Extensions. That state is stored in the renderer's `localStorage`.
- Built-in file-type mappings win over user ones (`updateByProp` keeps existing non-empty values). So you must pick the plugin in **Settings → File Types**. That also records `extensionExternalPath`, which makes the host load it as `tsfile:///<tsplugins>/<extensionId>/index.html`.
- **Settings → Extensions → Install Extension** takes a `.zip` and unzips it into `tsplugins\@tagspaces\extensions\<zip name without .zip>` (`npm run package`).

## Loading

The host renders an `<iframe>` (out-of-process, sandboxed Chromium) at:

```
<extension>/index.html?file=<path>&theme=light|dark&locale=en
   &primecolor=%23..&textcolor=%23..&bgndcolor=%23..&eventID=<id>
   [&edit=true] [&query=<search text>] [&thumb=<path>] [&t=<mtime>]
```

**CSP:** user extensions are served from `tsfile://`. A CSP of `script-src 'self'` blocks your own scripts there and you get a blank page. Add `tsfile:` to `default-src`, `script-src`, `style-src` and `font-src`. `tools/build.js` checks this.

## Messages

Extension → host. This must be a **JSON string** with the URL's `eventID`, otherwise the host ignores it (`FileView.tsx`):

```js
window.parent.postMessage(JSON.stringify({ command, eventID, ...payload }), '*');
```

| command | payload | effect (`EntryContainer.tsx`) |
|---|---|---|
| `parentLoadTextContent` | | host replies with `fileContent` (BOM stripped) |
| `contentChangedInEditor` | | marks the file dirty |
| `savingFile` | `content` | saves the content if the file is dirty |
| `editDocument` | | switches to edit mode (if editable) |
| `showAlertDialog` | `title`, `message` | notification |
| `openLinkExternally` | `link` | opens a URL or `ts://` link (handled in `MainPage.tsx`) |
| `requestFilePicker` | `options` | host file picker; reply via `postMessage` with the same eventID |
| `loadDefaultTextContent` / `loadDefaultBinaryContent` | | legacy: host calls `window.setContent(content, dir, readOnly, theme)` |

Host → extension, sent as a plain **object**:

| action | payload |
|---|---|
| `fileContent` | `content`, `isEditMode` |
| `savingFile` | (user pressed Save in the host toolbar; reply with `savingFile` + content) |

The host also calls `window.setTheme(mode)` directly when the app theme changes, if the function exists.

`templates/viewer/src/build/tagspaces-bridge.js` wraps all of this as `window.TS`.

**No "open natively" from an extension.** The iframe is sandboxed (`allow-same-origin allow-scripts allow-modals allow-downloads`). Its origin is `null`, so it can't touch `window.parent.electronIO`. `openLinkExternally` with `file://` reaches the main process's `openUrl`, and that only allows `http: https: mailto: tel:`. With no `allow-popups`, `window.open` is blocked too. Point users to the host's own *Open File Natively* (`Ctrl+Enter`) instead.

## Debugging

- Close TagSpaces and run `npm run test -- <name> <sample>`. It starts a portable instance with a temp profile and `--remote-debugging-port=9333`. While it runs you can open `http://127.0.0.1:9333/json`. The extension shows up as its own `iframe` target.
- To debug the real app: start `TagSpaces.exe --remote-debugging-port=9333`, then open `chrome://inspect` in Edge/Chrome. Use `--remote-debugging-port` only on your own machine: it gives full control of the app.
- Errors such as `violates the following Content Security Policy directive` mean `tsfile:` is missing from the CSP.

## Building with a framework (React/Vite etc.)

Any bundler works as long as the output is static files with relative paths (Vite: `base: './'`) and a `package.json` with `tsextension`. Put the source in `plugins/<name>/`. Write a `build.js` that runs your bundler (`execSync('npx vite build', { cwd: srcDir })`) and copies the output plus `package.json` into `out`. `tools/build.js` then runs the usual checks.
