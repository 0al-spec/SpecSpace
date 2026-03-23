#!/usr/bin/env python3
"""Apply a lineage.json manifest to produce canonical conversation files.

Reads a lineage.json manifest (produced by ChatGPTDialogs detect_lineage.py)
from DIALOG_DIR, injects conversation_id and lineage metadata into each source
file, validates the result, and writes canonical JSON files to OUTPUT_DIR.

Usage:
    python viewer/canonicalize.py DIALOG_DIR OUTPUT_DIR
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if __package__ in {None, ""}:
    sys.path.insert(0, str(REPO_ROOT))

from viewer import schema  # noqa: E402


def load_manifest(dialog_dir: str) -> dict:
    manifest_path = os.path.join(dialog_dir, "lineage.json")
    with open(manifest_path, encoding="utf-8") as fh:
        return json.load(fh)


def apply_manifest(dialog_dir: str, output_dir: str) -> tuple[int, int]:
    """Apply lineage.json from dialog_dir, write canonical files to output_dir.

    Returns (written_count, error_count).
    """
    manifest = load_manifest(dialog_dir)
    conversations = manifest.get("conversations", [])

    os.makedirs(output_dir, exist_ok=True)

    written = 0
    errors = 0

    for entry in conversations:
        file_name = entry.get("file", "")
        conversation_id = entry.get("conversation_id", "")
        lineage_entry = entry.get("lineage")

        source_path = os.path.join(dialog_dir, file_name)
        try:
            with open(source_path, encoding="utf-8") as fh:
                payload = json.load(fh)
        except (OSError, json.JSONDecodeError) as exc:
            print(f"  ERROR reading {file_name}: {exc}", file=sys.stderr)
            errors += 1
            continue

        # Inject canonical metadata
        canonical = copy.deepcopy(payload)
        canonical["conversation_id"] = conversation_id
        if lineage_entry:
            canonical["lineage"] = lineage_entry
        else:
            canonical["lineage"] = {"parents": []}

        # Validate
        result = schema.validate_conversation(canonical)
        if result.errors:
            for err in result.errors:
                print(f"  ERROR {file_name}: [{err.code}] {err.message}", file=sys.stderr)
            errors += 1
            continue

        out_path = os.path.join(output_dir, file_name)
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(canonical, fh, ensure_ascii=False, indent=2)
            fh.write("\n")

        written += 1

    return written, errors


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dialog_dir", help="Directory containing source JSON files and lineage.json")
    parser.add_argument("output_dir", help="Directory to write canonical JSON files into")
    args = parser.parse_args()

    written, errors = apply_manifest(args.dialog_dir, args.output_dir)
    print(f"Canonicalize complete: {written} written, {errors} errors")
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
