#!/usr/bin/env bash
set -euo pipefail

deploy_root="${1:-.}"
target_file="${TIMEWEB_TARGET_COMPOSE:-docker-compose.yml}"
artifact_base_url="${TIMEWEB_REQUIRED_ARTIFACT_BASE_URL:-https://specgraph.tech}"
python_bin="${PYTHON:-python3}"

"$python_bin" - "$deploy_root" "$target_file" "$artifact_base_url" <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path


root = Path(sys.argv[1]).resolve()
target_file = sys.argv[2]
artifact_base_url = sys.argv[3]
compose_path = root / target_file

allowed_top_level = {target_file, "README.md"}
errors: list[str] = []

if not compose_path.is_file():
    errors.append(f"missing {target_file}")

if root.is_dir():
    actual_top_level = {
        entry.name
        for entry in root.iterdir()
        if entry.name != ".git"
    }
    unexpected = sorted(actual_top_level - allowed_top_level)
    if unexpected:
        errors.append(
            "manifest-only branch contains unexpected top-level entries: "
            + ", ".join(unexpected)
        )

if errors:
    raise SystemExit("\n".join(errors))

text = compose_path.read_text(encoding="utf-8")
lines = text.splitlines()

if re.search(r"(?m)^[ \t]*build:", text):
    errors.append(f"{target_file} must not build from source")
if re.search(r"(?m)^[ \t]*volumes:", text):
    errors.append(f"{target_file} must not declare volumes")
if re.search(r"\$\{[^}]*\?", text):
    errors.append(f"{target_file} must not use required env interpolation")
if "/app/deploy/specspace-demo" in text:
    errors.append(f"{target_file} must not reference bundled demo artifacts")
if "--artifact-base-url" not in text:
    errors.append(f"{target_file} must configure --artifact-base-url")
if artifact_base_url not in text:
    errors.append(
        f"{target_file} must point at artifact base URL: {artifact_base_url}"
    )


def service_blocks() -> tuple[list[str], dict[str, list[str]]]:
    in_services = False
    order: list[str] = []
    blocks: dict[str, list[str]] = {}
    current: str | None = None

    for line in lines:
        if line == "services:":
            in_services = True
            continue
        if not in_services:
            continue
        if line and not line.startswith(" "):
            break
        match = re.match(r"^  ([A-Za-z0-9_.-]+):\s*$", line)
        if match:
            current = match.group(1)
            order.append(current)
            blocks[current] = []
            continue
        if current is not None:
            blocks[current].append(line)

    return order, blocks


order, blocks = service_blocks()
if not order:
    errors.append(f"{target_file} must declare services")
elif order[0] != "app":
    errors.append(
        f"{target_file} must declare the UI service first as 'app', got {order[0]!r}"
    )


def image_for(service_name: str) -> str | None:
    for line in blocks.get(service_name, []):
        match = re.match(r"^    image:\s*(.+?)\s*$", line)
        if match:
            return match.group(1).strip().strip('"').strip("'")
    return None


digest_ref = re.compile(r"^[a-z0-9][a-z0-9._/-]*(?::[a-z0-9._-]+)?@sha256:[0-9a-f]{64}$")
for service_name in ("app", "specspace-api"):
    image = image_for(service_name)
    if image is None:
        errors.append(f"{service_name} must declare an image")
        continue
    if ":latest" in image:
        errors.append(f"{service_name} image must not use latest: {image}")
    if not digest_ref.match(image):
        errors.append(f"{service_name} image must be digest-pinned: {image}")

if errors:
    raise SystemExit("\n".join(errors))

print(f"Timeweb deploy tree OK: {root}")
PY
