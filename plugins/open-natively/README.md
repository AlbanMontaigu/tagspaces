# open-natively

A TagSpaces viewer for files you'd rather open outside TagSpaces. It doesn't render the file. It shows the file name, its folder and a **Copy path** button.

To open the file in its default app, use TagSpaces' own **Open → Open File Natively** (`Ctrl+Enter`), or **Show in File Manager**.

## Why it can't open the file itself

TagSpaces 6.15 gives extensions no "open natively" command. An extension runs in a sandboxed iframe with an opaque (`null`) origin, so:

- it can't reach the host's `window.electronIO`
- `openLinkExternally` with a `file://` link is dropped by the main process (`openUrl` only allows `http:`, `https:`, `mailto:`, `tel:`)
- `window.open` / `target=_blank` are blocked (no `allow-popups` in the sandbox)

An earlier version worked around this with a local helper service. It was removed because the built-in command already does the job.

## Install

```powershell
npm run open-natively            # build + deploy
```

Then restart TagSpaces and, the first time only:

1. **Settings → Extensions**: switch on **Open Natively**.
2. **Settings → File Types**: choose **Open Natively** as the viewer for the types you want (docx, xlsx, pptx, msg…). The build declares a broad list in [`plugin.json`](plugin.json); nothing switches over until you pick it here.
