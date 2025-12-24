from __future__ import annotations

import gzip
import io
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict

try:
    import requests
except Exception:  # pragma: no cover
    requests = None  # type: ignore

try:
    # When running as a package: python -m rebrickable_downloader.downloader
    from .urls import REBRICKABLE_GZ_URLS
    from .splitter import split_inventory_parts, write_parts_info
except Exception:  # When frozen into an EXE, relative imports may fail
    from rebrickable_downloader.urls import REBRICKABLE_GZ_URLS  # type: ignore
    from rebrickable_downloader.splitter import (  # type: ignore
        split_inventory_parts,
        write_parts_info,
    )


def ensure_requests():
    if requests is None:
        raise RuntimeError(
            "The 'requests' package is required. Install with: pip install requests"
        )


def timestamped_dir(base: Path) -> Path:
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    out = base / f"rebrickable_{ts}"
    out.mkdir(parents=True, exist_ok=True)
    return out


def download_gz(url: str) -> bytes:
    ensure_requests()
    with requests.get(url, stream=True, timeout=60) as r:  # type: ignore
        r.raise_for_status()
        return r.content


def gunzip_bytes(data: bytes) -> bytes:
    with gzip.GzipFile(fileobj=io.BytesIO(data)) as gz:
        return gz.read()


def write_file(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        f.write(data)


def download_and_extract_all(output_root: Path) -> Path:
    out_dir = timestamped_dir(output_root)
    for name, url in REBRICKABLE_GZ_URLS.items():
        gz_bytes = download_gz(url)
        csv_bytes = gunzip_bytes(gz_bytes)
        write_file(out_dir / name, csv_bytes)
    return out_dir


def split_inventory_parts_like_data(output_dir: Path, max_part_size_mb: int = 20) -> None:
    source_csv = output_dir / "inventory_parts.csv"
    if not source_csv.exists():
        print(f"inventory_parts.csv not found in {output_dir}")
        return

    parts_dir = output_dir / "inventory_parts_split"
    num_parts, total_rows, _ = split_inventory_parts(
        source_csv=source_csv,
        target_dir=parts_dir,
        max_part_size_mb=max_part_size_mb,
    )

    write_parts_info(
        info_path=parts_dir / "parts_info.txt",
        original_csv=source_csv,
        num_parts=num_parts,
        total_rows=total_rows,
        max_part_size_mb=max_part_size_mb,
        parts_dir=parts_dir,
    )

    # Remove original inventory_parts.csv after successful split
    try:
        if num_parts > 0 and source_csv.exists():
            source_csv.unlink()
            print(f"Removed original file: {source_csv.name}")
    except Exception as e:
        print(f"Warning: failed to remove {source_csv.name}: {e}")


def main(argv=None) -> int:
    argv = argv or sys.argv[1:]
    base = Path.cwd() / "Downloads"
    if len(argv) >= 1:
        base = Path(argv[0]).expanduser().resolve()
    out_dir = download_and_extract_all(base)
    split_inventory_parts_like_data(out_dir, max_part_size_mb=20)
    print(f"Done. Output: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


