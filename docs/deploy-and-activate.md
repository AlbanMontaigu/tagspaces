# Deploy, activate, update, remove

This is the procedure for any plugin in `plugins/`. Examples use `md-editor-mermaid`.

All commands run from this folder (`...\VSCode\tagspaces`) in PowerShell or the VS Code terminal.

---

## 1. First-time setup (once per machine)

Check:

```powershell
node --version     # must be >= 22
npm --version
npm run status     # shows where TagSpaces and the plugin folder are
```

Nothing else to install. If TagSpaces isn't in `C:\Program Files\TagSpaces`, set the path first:

```powershell
$env:TAGSPACES_EXE = 'D:\Apps\TagSpaces\TagSpaces.exe'
```

---

## 2. Build and deploy

```powershell
npm run build  -- md-editor-mermaid
npm run deploy -- md-editor-mermaid
```

Shortcut for the Mermaid editor: `npm run mermaid`. In VS Code: `Ctrl+Shift+B`, then type the plugin name.

`deploy` copies `dist\md-editor-mermaid` to:

```
%APPDATA%\TagSpaces\tsplugins\@tagspaces\extensions\md-editor-mermaid
```

Any copy already installed is saved to `backups\` first.

Then **restart TagSpaces**: close it fully (also from the system tray if it's there) and open it again. TagSpaces reads plugins only at startup, and caches the extension page.

---

## 3. Activate in TagSpaces (first deploy only)

User plugins start **disabled**, and the built-in viewer keeps its file types. You have to switch both over by hand, once.

### 3a. Enable the extension

1. **Settings** (gear icon, bottom-left, or `Ctrl+,`)
2. **Extensions** tab
3. Find **MD Editor (crepe + Mermaid)** in the *external* list and switch it **on**.

If it's not in the list, the deploy didn't land or TagSpaces wasn't restarted. Run `npm run status` and check the `installed` column.

### 3b. Assign it to file types

1. **Settings → File Types** tab
2. Find the row **`md`**:
   - **Viewer** → *MD Editor (crepe + Mermaid)*
   - **Editor** → *MD Editor (crepe + Mermaid)*
3. Do the same for **`mdx`** (viewer only).
4. Close Settings. Changes apply immediately.

Choosing it in the *Viewer* dropdown is the important step. It also stores the path to the user plugin folder. If you edit the settings any other way, the file type points at a folder that doesn't exist.

### 3c. Check

Open `plugins\md-editor-mermaid\sample.md` in TagSpaces. You should see a flowchart and a sequence diagram, not code. Each diagram block has an **Edit** button that toggles back to the Mermaid source.

---

## 4. Update a plugin (after changing code or versions)

```powershell
npm run build  -- md-editor-mermaid
npm run deploy -- md-editor-mermaid
```

Then restart TagSpaces. Skip step 3: the settings stay because the folder name doesn't change.

Upgrading the upstream editor or Mermaid: edit `plugins\md-editor-mermaid\plugin.json`. See that plugin's README.

**After a TagSpaces update:** your plugin keeps working, but it's still the old editor version. Look up the new md-editor version (README, "Upgrading"), bump `upstream`, and rebuild and redeploy.

---

## 5. Roll back

Every deploy keeps the previous copy in `backups\<name>-<timestamp>\`. To restore one:

```powershell
$b = 'backups\md-editor-mermaid-2026-11-19T11-01-12'   # pick one
Copy-Item -Recurse -Force "$b\*" "$env:APPDATA\TagSpaces\tsplugins\@tagspaces\extensions\md-editor-mermaid\"
```

Then restart TagSpaces.

---

## 6. Go back to the stock editor / remove

**Temporarily:** in **Settings → File Types**, set `md` / `mdx` back to *MD Editor (crepe)*.

**Remove completely:**

1. Do the step above **first**. Otherwise `.md` files open in a missing extension and show a blank page.
2. ```powershell
   npm run undeploy -- md-editor-mermaid     # moves it to backups\
   ```
3. Restart TagSpaces. Optionally switch it off or remove it in **Settings → Extensions**.

---

## 7. Install on another PC / give to a colleague (no toolkit needed)

```powershell
npm run package -- md-editor-mermaid      # -> dist\md-editor-mermaid.zip
```

On the other PC:

1. **Settings → Extensions → Install Extension**, then select `md-editor-mermaid.zip`. **Don't rename the zip**: its name becomes the plugin folder name.
2. Restart TagSpaces, then do **step 3** (enable and assign file types).

---

## 8. Smoke test without touching your real TagSpaces

```powershell
# close TagSpaces first: it only allows one instance
npm run test -- md-editor-mermaid plugins/md-editor-mermaid/sample.md --expect ".preview svg"
```

This starts a throwaway portable TagSpaces with its own temp profile and loads the built plugin. It writes `dist\md-editor-mermaid-test.png` and prints PASS/FAIL. Your settings are never used or changed.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Plugin not listed in Settings → Extensions | Not deployed, or TagSpaces not restarted. Run `npm run status`. Make sure no TagSpaces process is left (Task Manager). |
| Listed but not in the File Types dropdown | It's switched off: do step 3a. |
| `.md` opens a **blank** page | `index.html` CSP lacks `tsfile:` (the build checks this), or the plugin folder was removed while still assigned (step 6). |
| Mermaid block shows "Loading…" forever | `assets\mermaid.min.js` missing: rebuild. |
| Red "Mermaid: …" text | Syntax error in the diagram. The message is Mermaid's own. |
| Diagram colours wrong after theme switch | Reopen the file. The Mermaid theme is set once per page load. |
| Changes not visible after deploy | Restart TagSpaces. The extension page is cached. |
| `npm run test` says TagSpaces is running | Close it, including the tray icon. |
| Build error `expected exactly 1 match` | The upstream bundle changed. See `plugins\md-editor-mermaid\README.md`, "Upgrading". |
