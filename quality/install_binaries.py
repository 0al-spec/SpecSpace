"""Install only pinned, SHA-256 checked tools into a caller-selected directory."""

import argparse
import hashlib
import io
import json
import platform
import tarfile
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument("--destination", required=True, type=Path)
args = parser.parse_args()
key = f"{platform.system().lower()}-{platform.machine().lower()}"
if key == "darwin-aarch64":
    key = "darwin-arm64"
lock = json.loads(Path(__file__).with_name("binaries.json").read_text())
for name, tool in lock.items():
    asset = tool["assets"].get(key)
    if not asset:
        raise SystemExit(f"No pinned {name} binary for {key}")
    url = urlsplit(asset["url"])
    if url.scheme != "https" or url.hostname != "github.com":
        raise SystemExit("Pinned binary downloads must use HTTPS on github.com")
    with urllib.request.urlopen(asset["url"], timeout=60) as response:  # nosec B310 # validated HTTPS origin; digest checked below
        data = response.read()
    if hashlib.sha256(data).hexdigest() != asset["sha256"]:
        raise SystemExit(f"SHA-256 mismatch for {name}")
    if asset["url"].endswith(".tar.gz"):
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            member = archive.getmember(name)
            if not member.isfile():
                raise SystemExit(f"Unexpected archive member for {name}")
            stream = archive.extractfile(member)
            if stream is None:
                raise SystemExit(f"Missing binary stream for {name}")
            data = stream.read()
    args.destination.mkdir(parents=True, exist_ok=True)
    target = args.destination / name
    target.write_bytes(data)
    target.chmod(0o755)
    print(f"{name} {tool['version']}: downloaded archive verified")
