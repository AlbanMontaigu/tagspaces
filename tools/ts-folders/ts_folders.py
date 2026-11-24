#!/usr/bin/env python3
"""Find every TagSpaces ``.ts`` meta folder below a root folder and report what it holds.

TagSpaces keeps its data for a folder in a hidden ``.ts`` subfolder:

    <name>.json   sidecar: tags / description of the file <name>
    <name>.jpg    thumbnail of the file <name>
    tsm.json      metadata of the folder itself (tags, colour, perspective...)
    tst.jpg       folder thumbnail          tsb.jpg   folder background
    tsi.json      location search index     tsft.jsonl full-text index
    tsl.json      location / tag-group settings
    <uuid>/       revisions (older versions) of a file, when revisions are on

By default the scan starts in the folder where this script is placed; ``--root`` overrides it.
Scanning is read only: it lists directories and reads file sizes, never file contents, so
OneDrive cloud-only files are not downloaded.

    python ts_folders.py                    # scan from the script's folder
    python ts_folders.py --root "D:\\Docs"   # scan elsewhere
    python ts_folders.py --orphans          # also list orphan sidecars / thumbnails
    python ts_folders.py --csv report.csv   # one row per .ts folder
    python ts_folders.py --json             # machine-readable output on stdout

    python ts_folders.py --delete           # list, ask "yes", then move every .ts folder to the Recycle Bin
    python ts_folders.py --delete --yes     # same, without the question
    python ts_folders.py --delete --permanent   # erase instead of Recycle Bin (no undo)

Deleting a .ts folder removes the TagSpaces tags, descriptions, thumbnails and revisions it holds.
Tags kept in file names ("report[tag1 tag2].pdf") are not affected. Close TagSpaces first,
otherwise it recreates thumbnails for the folder it is showing.

Python 3.8+, standard library only. Recycle Bin deletion is Windows only.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import stat
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

META_FOLDER = ".ts"
FOLDER_FILES = {
    "tsm.json": "folder_meta",
    "tst.jpg": "folder_thumb",
    "tsb.jpg": "folder_background",
    "tsi.json": "index",
    "tsft.jsonl": "index",
    "tsl.json": "location_settings",
}
SIDECAR_EXT = ".json"
THUMB_EXT = ".jpg"


@dataclass
class TsFolder:
    path: str  # the .ts folder, relative to the root
    owner: str  # the folder it belongs to, relative to the root
    sidecars: int = 0
    thumbnails: int = 0
    revision_dirs: int = 0
    revision_files: int = 0
    other: int = 0
    folder_meta: bool = False
    folder_thumb: bool = False
    folder_background: bool = False
    index: bool = False
    location_settings: bool = False
    orphan_sidecars: int = 0
    orphan_thumbnails: int = 0
    size_bytes: int = 0
    orphans: list = field(default_factory=list)  # names only, filled with --orphans
    errors: list = field(default_factory=list)


def safe_scandir(path: str):
    try:
        with os.scandir(path) as it:
            return list(it)
    except OSError as e:
        return e


def entry_size(entry: os.DirEntry) -> int:
    try:
        return entry.stat(follow_symlinks=False).st_size
    except OSError:
        return 0


def analyse_ts_folder(ts_path: str, root: str, keep_orphan_names: bool) -> TsFolder:
    owner = os.path.dirname(ts_path)
    info = TsFolder(path=os.path.relpath(ts_path, root), owner=os.path.relpath(owner, root))

    owner_entries = safe_scandir(owner)
    owner_names = set() if isinstance(owner_entries, OSError) else {e.name.lower() for e in owner_entries}
    entries = safe_scandir(ts_path)
    if isinstance(entries, OSError):
        info.errors.append(f"cannot list: {entries.strerror or entries}")
        return info

    for e in entries:
        name = e.name
        low = name.lower()
        if e.is_dir(follow_symlinks=False):
            # A <uuid> folder holds the revisions of one file.
            info.revision_dirs += 1
            sub = safe_scandir(e.path)
            if isinstance(sub, OSError):
                info.errors.append(f"cannot list {name}: {sub.strerror or sub}")
                continue
            for s in sub:
                if s.is_file(follow_symlinks=False):
                    info.revision_files += 1
                    info.size_bytes += entry_size(s)
            continue

        info.size_bytes += entry_size(e)
        if low in FOLDER_FILES:
            setattr(info, FOLDER_FILES[low], True)
        elif low.endswith(SIDECAR_EXT):
            info.sidecars += 1
            if low[: -len(SIDECAR_EXT)] not in owner_names:
                info.orphan_sidecars += 1
                if keep_orphan_names:
                    info.orphans.append(name)
        elif low.endswith(THUMB_EXT):
            info.thumbnails += 1
            if low[: -len(THUMB_EXT)] not in owner_names:
                info.orphan_thumbnails += 1
                if keep_orphan_names:
                    info.orphans.append(name)
        else:
            info.other += 1
    return info


def find_ts_folders(root: str, keep_orphan_names: bool, progress: bool):
    """Walk the tree top-down; yield one TsFolder per .ts folder. Never descends into .ts folders."""
    walk_errors = []
    scanned = 0
    last_tick = time.monotonic()

    def on_error(err: OSError):
        walk_errors.append(f"{os.path.relpath(err.filename or '?', root)}: {err.strerror or err}")

    for dirpath, dirnames, _ in os.walk(root, topdown=True, onerror=on_error, followlinks=False):
        scanned += 1
        if progress and time.monotonic() - last_tick > 2:
            last_tick = time.monotonic()
            print(f"  ... {scanned} folders scanned", file=sys.stderr)
        if META_FOLDER in dirnames:
            dirnames.remove(META_FOLDER)  # analysed here, not walked into
            ts_path = os.path.join(dirpath, META_FOLDER)
            if is_link_or_junction(ts_path):
                walk_errors.append(f"{os.path.relpath(ts_path, root)}: is a link/junction, ignored")
                continue
            yield analyse_ts_folder(ts_path, root, keep_orphan_names)
    find_ts_folders.scanned = scanned
    find_ts_folders.errors = walk_errors


def is_link_or_junction(path: str) -> bool:
    """True for symlinks and Windows junctions / other reparse points: never delete through those."""
    try:
        st = os.lstat(path)
    except OSError:
        return True
    if stat.S_ISLNK(st.st_mode):
        return True
    attrs = getattr(st, "st_file_attributes", 0)
    return bool(attrs & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))


def recycle(path: str) -> None:
    """Move a file or folder to the Windows Recycle Bin (SHFileOperationW with FOF_ALLOWUNDO)."""
    import ctypes
    from ctypes import wintypes

    class SHFILEOPSTRUCTW(ctypes.Structure):
        if ctypes.sizeof(ctypes.c_void_p) == 4:
            _pack_ = 1  # shellapi.h packs this struct to 1 byte on 32-bit Windows
        _fields_ = [
            ("hwnd", wintypes.HWND),
            ("wFunc", wintypes.UINT),
            ("pFrom", wintypes.LPCWSTR),
            ("pTo", wintypes.LPCWSTR),
            ("fFlags", ctypes.c_ushort),
            ("fAnyOperationsAborted", wintypes.BOOL),
            ("hNameMappings", ctypes.c_void_p),
            ("lpszProgressTitle", wintypes.LPCWSTR),
        ]

    FO_DELETE = 0x0003
    FOF_SILENT = 0x0004
    FOF_NOCONFIRMATION = 0x0010
    FOF_ALLOWUNDO = 0x0040
    FOF_NOERRORUI = 0x0400
    FOF_WANTNUKEWARNING = 0x4000  # ask before erasing when the Recycle Bin can't take it (e.g. network share)

    op = SHFILEOPSTRUCTW()
    op.wFunc = FO_DELETE
    op.pFrom = os.path.abspath(path) + "\0"  # the API wants a double-NUL-terminated list
    op.fFlags = FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI | FOF_WANTNUKEWARNING
    rc = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
    if rc != 0:
        raise OSError(f"Recycle Bin move failed (SHFileOperation code 0x{rc:X})")
    if op.fAnyOperationsAborted:
        raise OSError("cancelled")


def erase(path: str) -> None:
    """Delete a folder tree for good, clearing read-only flags on the way."""

    def on_error(func, p, _exc):
        os.chmod(p, stat.S_IWRITE)
        func(p)

    if sys.version_info >= (3, 12):
        shutil.rmtree(path, onexc=on_error)
    else:
        shutil.rmtree(path, onerror=on_error)


def tagspaces_running() -> bool:
    if os.name != "nt":
        return False
    try:
        out = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq TagSpaces.exe", "/NH"], capture_output=True, text=True, timeout=10
        ).stdout
        return "tagspaces.exe" in out.lower()
    except (OSError, subprocess.SubprocessError):
        return False


def delete_folders(folders: list, root: str, permanent: bool) -> tuple:
    """Delete each .ts folder. Returns (deleted, failed) lists of (TsFolder, message)."""
    deleted, failed = [], []
    for f in folders:
        full = os.path.join(root, f.path)
        # Re-check right before deleting: still a real folder named .ts, inside the root, not a link.
        if os.path.basename(full) != META_FOLDER or not os.path.isdir(full) or is_link_or_junction(full):
            failed.append((f, "skipped: gone, or not a plain folder (link/junction)"))
            continue
        if os.path.commonpath([os.path.abspath(full), root]) != root:
            failed.append((f, "skipped: outside the root"))
            continue
        try:
            (erase if permanent else recycle)(full)
            deleted.append((f, ""))
        except OSError as e:
            failed.append((f, str(e)))
    return deleted, failed


def human(n: int) -> str:
    size = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{n} B"


def flags(f: TsFolder) -> str:
    out = []
    if f.folder_meta:
        out.append("meta")
    if f.folder_thumb:
        out.append("thumb")
    if f.folder_background:
        out.append("bgnd")
    if f.index:
        out.append("index")
    if f.location_settings:
        out.append("loc")
    return ",".join(out) or "-"


def print_table(folders: list, root: str, show_orphans: bool) -> None:
    headers = ["folder", "sidecars", "thumbs", "revisions", "orphans", "folder files", "size"]
    rows = [
        [
            f.owner if f.owner != "." else "(root)",
            str(f.sidecars),
            str(f.thumbnails),
            f"{f.revision_dirs}/{f.revision_files}" if f.revision_dirs else "-",
            str(f.orphan_sidecars + f.orphan_thumbnails) or "0",
            flags(f),
            human(f.size_bytes),
        ]
        for f in folders
    ]
    widths = [max(len(h), *(len(r[i]) for r in rows)) if rows else len(h) for i, h in enumerate(headers)]
    widths[0] = min(widths[0], 70)

    def fmt(cells):
        first = cells[0] if len(cells[0]) <= widths[0] else "..." + cells[0][-(widths[0] - 3) :]
        rest = [c.rjust(w) for c, w in zip(cells[1:], widths[1:])]
        return "  ".join([first.ljust(widths[0]), *rest])

    print(f"Root: {root}\n")
    if not rows:
        print("No .ts folder found.")
        return
    print(fmt(headers))
    print("  ".join("-" * w for w in widths))
    for f, r in zip(folders, rows):
        print(fmt(r))
        for err in f.errors:
            print(f"    ! {err}")
        if show_orphans:
            for name in f.orphans:
                print(f"    orphan: {name}")


def main(argv=None) -> int:
    here = Path(__file__).resolve().parent
    p = argparse.ArgumentParser(description="List (and optionally delete) TagSpaces .ts meta folders below a root folder.")
    p.add_argument("--root", default=str(here), help="folder to scan (default: the folder containing this script)")
    p.add_argument("--orphans", action="store_true", help="list sidecars/thumbnails whose file no longer exists")
    p.add_argument("--csv", metavar="FILE", help="also write one row per .ts folder to this CSV file")
    p.add_argument("--json", action="store_true", help="print JSON instead of the table")
    p.add_argument("--quiet", action="store_true", help="no progress messages on stderr")
    p.add_argument("--delete", action="store_true", help="after listing, delete every .ts folder found (asks first)")
    p.add_argument("--yes", action="store_true", help="with --delete: don't ask for confirmation")
    p.add_argument("--permanent", action="store_true", help="with --delete: erase instead of moving to the Recycle Bin")
    args = p.parse_args(argv)

    if (args.yes or args.permanent) and not args.delete:
        p.error("--yes and --permanent only make sense with --delete")
    if args.delete and args.json:
        p.error("--delete can't be combined with --json")
    if args.delete and not args.permanent and os.name != "nt":
        p.error("the Recycle Bin is Windows only: add --permanent to erase")

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print(f"ERROR: not a folder: {root}", file=sys.stderr)
        return 2
    if args.delete and os.path.dirname(root) == root:
        print(f"ERROR: refusing to delete from a drive root ({root}). Point --root at a folder.", file=sys.stderr)
        return 2

    started = time.monotonic()
    try:
        folders = list(find_ts_folders(root, args.orphans or args.json, progress=not args.quiet and not args.json))
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130
    folders.sort(key=lambda f: f.owner.lower())
    elapsed = time.monotonic() - started
    scanned = getattr(find_ts_folders, "scanned", 0)
    walk_errors = getattr(find_ts_folders, "errors", [])

    totals = {
        "ts_folders": len(folders),
        "folders_scanned": scanned,
        "sidecars": sum(f.sidecars for f in folders),
        "thumbnails": sum(f.thumbnails for f in folders),
        "revision_files": sum(f.revision_files for f in folders),
        "orphans": sum(f.orphan_sidecars + f.orphan_thumbnails for f in folders),
        "size_bytes": sum(f.size_bytes for f in folders),
        "seconds": round(elapsed, 1),
    }

    if args.csv:
        try:
            with open(args.csv, "w", newline="", encoding="utf-8-sig") as fh:
                cols = [k for k in asdict(folders[0]).keys() if k not in ("orphans", "errors")] if folders else ["path"]
                w = csv.DictWriter(fh, fieldnames=cols + ["errors"], extrasaction="ignore", delimiter=";")
                w.writeheader()
                for f in folders:
                    row = asdict(f)
                    row["errors"] = " | ".join(f.errors)
                    w.writerow(row)
        except OSError as e:
            print(f"ERROR: cannot write {args.csv}: {e}", file=sys.stderr)
            return 1

    if args.json:
        json.dump(
            {"root": root, "totals": totals, "ts_folders": [asdict(f) for f in folders], "walk_errors": walk_errors},
            sys.stdout,
            indent=2,
            ensure_ascii=False,
        )
        print()
        return 0

    print_table(folders, root, args.orphans)
    print(
        f"\n{totals['ts_folders']} .ts folder(s) in {scanned} folder(s) scanned, {elapsed:.1f}s. "
        f"{totals['sidecars']} sidecars, {totals['thumbnails']} thumbnails, {totals['revision_files']} revision files, "
        f"{totals['orphans']} orphan(s), {human(totals['size_bytes'])} total."
    )
    if walk_errors:
        print(f"\n{len(walk_errors)} folder(s) could not be read:")
        for err in walk_errors[:20]:
            print(f"  ! {err}")
        if len(walk_errors) > 20:
            print(f"  ... and {len(walk_errors) - 20} more")
    if args.csv:
        print(f"\nCSV written: {args.csv}")
    if args.delete:
        return run_delete(folders, root, totals, args)
    return 0


def run_delete(folders: list, root: str, totals: dict, args) -> int:
    if not folders:
        return 0
    where = "ERASED for good (no Recycle Bin, no undo)" if args.permanent else "moved to the Recycle Bin"
    print(f"\n--delete: the {len(folders)} .ts folder(s) above ({human(totals['size_bytes'])}) will be {where}.")
    print(
        f"This removes the TagSpaces tags/descriptions of {totals['sidecars']} file(s), "
        f"{totals['thumbnails']} thumbnail(s) and {totals['revision_files']} revision file(s)."
    )
    if tagspaces_running():
        print("WARNING: TagSpaces is running. Close it first, or it may recreate .ts folders as you browse.")
    if not args.yes:
        if not sys.stdin.isatty():
            print("ERROR: no terminal to confirm. Re-run with --yes to delete without asking.", file=sys.stderr)
            return 1
        try:
            answer = input('Type "yes" to delete: ').strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = ""
        if answer != "yes":
            print("Cancelled, nothing deleted.")
            return 1

    deleted, failed = delete_folders(folders, root, args.permanent)
    log_path = os.path.join(root, f"ts-delete-{time.strftime('%Y%m%d-%H%M%S')}.log")
    try:
        with open(log_path, "w", encoding="utf-8") as log:
            log.write(f"root={root}\nmode={'permanent' if args.permanent else 'recycle-bin'}\n")
            for f, _ in deleted:
                log.write(f"DELETED  {f.path}\n")
            for f, msg in failed:
                log.write(f"FAILED   {f.path}  {msg}\n")
    except OSError as e:
        log_path = f"(not written: {e})"

    freed = sum(f.size_bytes for f, _ in deleted)
    print(
        f"\nDeleted {len(deleted)} .ts folder(s), {human(freed)} {'freed' if args.permanent else 'moved to the Recycle Bin'}."
    )
    for f, msg in failed:
        print(f"  ! {f.path}: {msg}")
    print(f"Log: {log_path}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
