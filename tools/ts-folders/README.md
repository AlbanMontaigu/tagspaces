# ts-folders

Finds every TagSpaces `.ts` meta folder below a root folder, shows what each one holds, and can delete them all.

Python 3.8+, standard library only. Recycle Bin deletion is Windows only.

## Find

Copy `ts_folders.py` into the folder you want to scan, or run it from here with `--root`:

```powershell
python ts_folders.py                         # scan from the script's own folder, recursively
python ts_folders.py --root "D:\Documents"   # scan another folder
python ts_folders.py --orphans               # also name orphan sidecars / thumbnails
python ts_folders.py --csv ts-report.csv     # one row per .ts folder (";" separated, opens in Excel)
python ts_folders.py --json > ts-report.json # machine-readable output
```

Scanning is read only. It lists folders and file sizes and never opens files, so OneDrive cloud-only files are not downloaded.

## Delete

```powershell
python ts_folders.py --delete                # list, then ask: type "yes" to move every .ts folder to the Recycle Bin
python ts_folders.py --delete --yes          # same, without the question (scripts)
python ts_folders.py --delete --permanent    # erase instead (no Recycle Bin, no undo)
```

**What you lose:** every TagSpaces tag and description kept in sidecar files, thumbnails, folder colours/settings and saved revisions. Tags written in file names (`report[tag1 tag2].pdf`) are not affected. **Close TagSpaces first**, or it recreates thumbnails in the folder it is showing.

Safeguards:

- Nothing is deleted until you type `yes` (or pass `--yes`). With no terminal to ask in, it refuses.
- By default folders go to the **Recycle Bin**, so you can restore them. If a folder can't go there (some network shares), Windows asks before erasing.
- Only folders named exactly `.ts` are touched, and each one is re-checked right before deletion.
- Links and junctions named `.ts` are ignored and never deleted through, so nothing outside the tree is touched.
- It refuses to run `--delete` on a drive root (`C:\`).
- It writes a log `ts-delete-<date>-<time>.log` in the root folder, listing every folder deleted or skipped. The exit code is non-zero if any folder failed.

To restore after a Recycle Bin delete, open the Recycle Bin, sort by *Original Location*, select the `.ts` entries and choose *Restore*.

## Columns

| Column | Meaning |
|---|---|
| folder | the folder the `.ts` belongs to, relative to the root |
| sidecars | `<file>.json`: tags and description of a file |
| thumbs | `<file>.jpg`: thumbnail of a file |
| revisions | `<uuid>/` folders / files inside them: older versions saved when revisions are on |
| orphans | sidecars or thumbnails whose file no longer exists next to the `.ts` folder (renamed or deleted outside TagSpaces). `--orphans` lists them by name |
| folder files | `meta` = `tsm.json` (folder tags, colour, perspective), `thumb` = `tst.jpg`, `bgnd` = `tsb.jpg`, `index` = `tsi.json` / `tsft.jsonl` (search index), `loc` = `tsl.json` |
| size | total size of the `.ts` folder |

Folders that can't be read (permissions, links) are listed at the end. A `.ts` folder is never searched for nested `.ts` folders.
