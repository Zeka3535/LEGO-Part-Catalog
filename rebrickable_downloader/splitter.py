from __future__ import annotations

import csv
import math
import os
from pathlib import Path
from typing import Iterable, Tuple


def human_mb(num_bytes: int) -> float:
    return round(num_bytes / (1024 * 1024), 2)


def split_inventory_parts(
    source_csv: Path,
    target_dir: Path,
    max_part_size_mb: int = 20,
    base_filename: str = "inventory_parts_part_",
) -> Tuple[int, int, int]:
    """Split a large inventory_parts.csv into ~20MB chunks.

    Returns a tuple: (num_parts, total_rows, header_columns)
    """
    target_dir.mkdir(parents=True, exist_ok=True)

    header: list[str] | None = None
    part_index = 0
    total_rows = 0
    bytes_written_current = 0
    writer = None
    outfile = None

    def open_new_part(idx: int):
        nonlocal writer, outfile, bytes_written_current
        part_name = f"{base_filename}{idx:03d}.csv"
        outfile = (target_dir / part_name).open("w", newline="", encoding="utf-8")
        writer = csv.writer(outfile)
        writer.writerow(header)
        bytes_written_current = 0

    with source_csv.open("r", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i == 0:
                header = row
                continue

            if writer is None:
                part_index += 1
                open_new_part(part_index)

            # write row
            writer.writerow(row)
            total_rows += 1

            # approximate bytes just by len of joined line plus newline
            bytes_written_current += len(
                (",".join(row) + "\n").encode("utf-8", errors="ignore")
            )

            if bytes_written_current >= max_part_size_mb * 1024 * 1024:
                outfile.close()
                writer = None
                outfile = None

    # ensure closed
    if outfile is not None:
        outfile.close()

    return part_index, total_rows, len(header or [])


def write_parts_info(
    info_path: Path,
    original_csv: Path,
    num_parts: int,
    total_rows: int,
    max_part_size_mb: int,
    parts_dir: Path,
):
    lines = []
    size_bytes = original_csv.stat().st_size if original_csv.exists() else 0
    lines.append(f"Файл разбит на {num_parts} частей")
    lines.append(f"Исходный файл: {original_csv}")
    lines.append(f"Размер исходного файла: {human_mb(size_bytes)} MB")
    lines.append(f"Строк в исходном файле: {total_rows:,}".replace(",", " "))
    lines.append(f"Максимальный размер части: {max_part_size_mb} MB")

    # estimate lines per part (rough)
    if num_parts > 0:
        lines_per_part = math.ceil(total_rows / num_parts)
        lines.append(f"Строк на часть: {lines_per_part:,}".replace(",", " "))

    lines.append("")
    lines.append("Список частей:")

    for i in range(1, num_parts + 1):
        filename = parts_dir / f"inventory_parts_part_{i:03d}.csv"
        if filename.exists():
            size_mb = human_mb(filename.stat().st_size)
            lines.append(f"{filename.name}: {size_mb} MB")

    info_path.write_text("\n".join(lines), encoding="utf-8")


