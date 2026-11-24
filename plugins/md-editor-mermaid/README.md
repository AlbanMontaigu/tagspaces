# md-editor-mermaid

The stock TagSpaces Markdown editor (`@tagspaces/extensions/md-editor`, Milkdown Crepe), plus rendering of ```` ```mermaid ```` code blocks as diagrams.

## Install

Needs Node ≥ 22 and network access to npm: the build downloads the upstream editor and Mermaid into `cache/npm` (first time only).

```powershell
npm run mermaid                  # build + deploy (same as: npm run build -- md-editor-mermaid; npm run deploy -- md-editor-mermaid)
```

Then **restart TagSpaces**: close it fully, including the tray icon. It reads plugins only at startup and caches the extension page.

First deploy only, in TagSpaces:

1. **Settings → Extensions**: switch on **MD Editor (crepe + Mermaid)**. User plugins start disabled.
2. **Settings → File Types**:
   - `md`: set **Viewer** and **Editor** to *MD Editor (crepe + Mermaid)*
   - `mdx`: set **Viewer** to *MD Editor (crepe + Mermaid)*

   Pick it from the dropdown: that also records the path to the user plugin folder.
3. Open [`sample.md`](sample.md). You should see a flowchart and a sequence diagram, not code.

Later updates: run `npm run mermaid` again and restart TagSpaces. The settings stay.

Back to the stock editor: set `md` / `mdx` back to *MD Editor (crepe)* in **Settings → File Types** first, then `npm run undeploy -- md-editor-mermaid`.

To install on a PC without this toolkit, run `npm run package -- md-editor-mermaid` and use **Settings → Extensions → Install Extension** with `dist\md-editor-mermaid.zip`. Don't rename the zip.

Optional check without touching your real TagSpaces (close it first):

```powershell
npm run test -- md-editor-mermaid plugins/md-editor-mermaid/sample.md --expect ".preview svg"
```

Full procedure, rollback and troubleshooting: [docs/deploy-and-activate.md](../../docs/deploy-and-activate.md).

## Why it exists

TagSpaces 6.15 has no Mermaid support. Crepe's code-block feature has a `renderPreview(language, content, applyPreview)` hook. TagSpaces leaves it at the default `() => null`. The only built-in user is the LaTeX feature: it handles `latex` and falls through to that default for every other language. So nothing ever renders Mermaid.

## What `build.js` does

| Step | Change |
|---|---|
| 1 | Copies `md-editor/` out of the `@tagspaces/extensions` npm tarball, at the version set in `plugin.json` |
| 2 | Adds `assets/mermaid.min.js` (from npm) and `assets/mermaid-loader.js`, which loads Mermaid lazily and exposes `window.__tsMermaid(code) → Promise<svg>` |
| 3 | Replaces `renderPreview:()=>null` in the main bundle. For language `mermaid` the new hook returns `undefined` (Crepe shows "Loading…") and later calls `applyPreview(svg)`. On a syntax error it shows the error in red. Other languages return `null` as before. |
| 4 | `index.html`: loads the loader script and adds `tsfile:` to the CSP. Extensions installed in `tsplugins` are served from `tsfile://`, so the stock `'self'`-only CSP gives a blank page. Renames the package and display name so it sits next to the stock editor instead of replacing it. |

Crepe's preview sanitizer (DOMPurify) keeps `<foreignObject>` inside SVG, so Mermaid's HTML labels survive. Mermaid runs with `securityLevel: 'strict'`.

## Upgrading

- **New TagSpaces / md-editor version:** check `npm view @tagspaces/extensions version`, set `upstream` in `plugin.json`, then `npm run mermaid`.
- **New Mermaid:** set `mermaid` in `plugin.json` (`npm view mermaid version`), then `npm run mermaid`.

If the build fails with `expected exactly 1 match for "renderPreview:()=>null"`, the upstream bundle changed shape. Search the new `dist/md-editor-mermaid/build/assets/index-*.js` for `renderPreview`, find the code-block default config (next to `previewLoading:"Loading..."`), and adjust the `replaceOnce` anchor in `build.js`.

Match `upstream` to the md-editor version in your installed TagSpaces. A much newer editor may expect a newer host. Your installed version is the `@tagspaces/extensions` entry under `Program Files\TagSpaces\resources\app.asar` (`npx @electron/asar list`). For TagSpaces 6.15.1 it is `1.0.259`.

## Known limits

- The Mermaid theme (light/dark) is chosen when Mermaid first loads. After switching the TagSpaces theme, reopen the file.
- File/folder **descriptions** use the app's own editor, not this extension. Supporting them needs a change in the TagSpaces source (`createCrepeEditor` in `src/renderer/components/md/utils.ts`).
- This is a frozen copy: TagSpaces updates don't reach it. Rebuild after upgrading TagSpaces.
