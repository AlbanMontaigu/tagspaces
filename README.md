# TagSpaces local plugins

Build, test and deploy custom extensions for the installed TagSpaces desktop app (Windows), without admin rights and without touching `C:\Program Files`.

Requirements: Node ≥ 22 and `npm` (used only for `npm pack` downloads). No `npm install` needed: the tools have zero dependencies.

> **Step-by-step deploy / activate / update / rollback / remove:** [docs/deploy-and-activate.md](docs/deploy-and-activate.md)

## Quick start

```powershell
npm run status                       # what's built vs. installed
npm run mermaid                      # rebuild + redeploy the Mermaid markdown editor
npm run new -- csv-viewer --ext csv,tsv --title "CSV Viewer"   # scaffold a new plugin
npm run build -- csv-viewer
npm run deploy -- csv-viewer
```

After a **first** deploy, in TagSpaces:

1. **Settings → Extensions**: switch the plugin on. User plugins start disabled.
2. **Settings → File Types**: select it as viewer (and editor) for its extensions. Selecting it is what makes TagSpaces load it from the user plugin folder.
3. Restart TagSpaces after any redeploy. The extension iframe is cached.

VS Code: **Terminal → Run Task** lists the same commands. `Ctrl+Shift+B` runs build + deploy.

## Commands

| Command | What it does |
|---|---|
| `npm run status` | Table of plugins: source / built version / installed version / whether dist matches installed |
| `npm run new -- <name> --ext a,b [--title T] [--editor]` | Copies `templates/viewer` to `plugins/<name>` |
| `npm run build -- <name>` | Builds into `dist/<name>` and checks package.json, index.html and CSP |
| `npm run deploy -- <name>` | Copies `dist/<name>` to `%APPDATA%\TagSpaces\tsplugins\@tagspaces\extensions\<name>`. Backs up the previous copy to `backups/` first |
| `npm run undeploy -- <name>` | Moves the installed copy to `backups/` |
| `npm run package -- <name>` | `dist/<name>.zip` for **Settings → Extensions → Install Extension** on another machine |
| `npm run test -- <name> <sample> [--expect sel]` | Headless smoke test in a throwaway portable TagSpaces; writes `dist/<name>-test.png`. **Close TagSpaces first** (single-instance app) |

## Layout

```
tools/        build / deploy / test scripts (plain Node)
plugins/      one folder per plugin
  <name>/build.js      optional custom build (gets {out, srcDir, lib})
  <name>/src/          or: copied verbatim when there's no build.js
templates/viewer/      starting point for `npm run new`
docs/         how TagSpaces extensions work
dist/ cache/ backups/  generated, git-ignored
```

## Plugins

- [md-editor-mermaid](plugins/md-editor-mermaid/README.md): stock Markdown editor + Mermaid diagrams.
- [open-natively](plugins/open-natively/README.md): a placeholder viewer showing the file name, folder and a "Copy path" button, for types you open with TagSpaces' own *Open File Natively* (`npm run open-natively`).

## Notes

- See [docs/deploy-and-activate.md](docs/deploy-and-activate.md) for the full user procedure, and [docs/extension-guide.md](docs/extension-guide.md) for the extension format, the host↔iframe message protocol and how TagSpaces discovers plugins.
- Downloads from npm (`@tagspaces/extensions`, `mermaid`) are cached in `cache/npm` and only extracted, never executed.
- Override paths with `TAGSPACES_EXE` / `TAGSPACES_PLUGINS_DIR` (e.g. a portable install).
