"""Generate one revision-bound stack badge set; publish only from main push CI."""

import argparse
import html
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRANCH = "quality-badges"


def svg(label: str, value: str, revision: str) -> str:
    left, right = len(label) * 7 + 14, len(value) * 7 + 14
    total = left + right
    title = html.escape(f"{label}: {value}; source {revision}", quote=True)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total}" height="20" '
        f'viewBox="0 0 {total} 20" role="img" aria-label="{title}">'
        f'<title>{title}</title><rect width="{total}" height="20" rx="3" fill="#555"/>'
        f'<path d="M{left} 0h{right}v20H{left}z" fill="#007ec6"/>'
        '<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">'
        f'<text x="{left / 2}" y="14">{html.escape(label)}</text>'
        f'<text x="{left + right / 2}" y="14">{html.escape(value)}</text></g></svg>\n'
    )


def build(root: Path, revision: str) -> dict[str, str]:
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("A full source Git SHA is required")
    python = re.search(
        r"^FROM python:([0-9]+\.[0-9]+(?:\.[0-9]+)?)(?:[-@]|$)",
        (root / "Dockerfile").read_text(),
        re.M,
    )
    if python is None:
        raise ValueError("Cannot determine the Python runtime from Dockerfile")
    packages = json.loads((root / "graphspace/package-lock.json").read_text())["packages"]
    values = {"python": ("Python", python[1])}
    for slug, label, name in (
        ("react", "React", "react"),
        ("typescript", "TypeScript", "typescript"),
        ("vite", "Vite", "vite"),
        ("react-flow", "React Flow", "@xyflow/react"),
    ):
        version = packages[f"node_modules/{name}"]["version"]
        if not isinstance(version, str) or not re.fullmatch(
            r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.+-]+)?", version
        ):
            raise ValueError(f"Invalid locked version for {name}")
        values[slug] = (label, version)
    files = {f"{slug}.svg": svg(label, value, revision) for slug, (label, value) in values.items()}
    files["manifest.json"] = (
        json.dumps(
            {
                "artifact_kind": "specspace_stack_badges",
                "schema_version": 1,
                "source_revision": revision,
                "sources": ["Dockerfile", "graphspace/package-lock.json"],
                "versions": {slug: value for slug, (_, value) in values.items()},
            },
            indent=2,
        )
        + "\n"
    )
    return files


def github(repository: str, endpoint: str, method="GET", payload=None):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Invalid GitHub repository")
    token = os.environ["GH_TOKEN"]
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}{endpoint}",
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2026-03-10",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:  # nosec B310 # constant HTTPS GitHub API origin
        return json.load(response)


def publish(files: dict[str, str], revision: str) -> None:
    if (
        os.environ.get("GITHUB_EVENT_NAME") != "push"
        or os.environ.get("GITHUB_REF") != "refs/heads/main"
        or os.environ.get("GITHUB_SHA") != revision
    ):
        raise ValueError("Badge publication is restricted to its exact main push revision")
    repository = os.environ["GITHUB_REPOSITORY"]
    if github(repository, "/git/ref/heads/main")["object"]["sha"] != revision:
        print("Skipping superseded main revision")
        return
    parent = None
    try:
        parent = github(repository, f"/git/ref/heads/{BRANCH}")["object"]["sha"]
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
    tree = github(
        repository,
        "/git/trees",
        "POST",
        {
            "tree": [
                {"path": name, "mode": "100644", "type": "blob", "content": content}
                for name, content in sorted(files.items())
            ]
        },
    )["sha"]
    commit = github(
        repository,
        "/git/commits",
        "POST",
        {
            "message": f"Update stack badges for {revision}",
            "tree": tree,
            "parents": [parent] if parent else [],
        },
    )["sha"]
    # A single ref update publishes the whole set. Never force over another writer.
    if github(repository, "/git/ref/heads/main")["object"]["sha"] != revision:
        print("Skipping superseded main revision before publication")
        return
    if parent:
        github(repository, f"/git/refs/heads/{BRANCH}", "PATCH", {"sha": commit, "force": False})
    else:
        github(repository, "/git/refs", "POST", {"ref": f"refs/heads/{BRANCH}", "sha": commit})
    print(f"Published stack badges for {revision}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    files = build(ROOT, args.revision)
    args.output.mkdir(parents=True, exist_ok=False)
    for name, content in files.items():
        (args.output / name).write_text(content, encoding="utf-8")
    if args.publish:
        publish(files, args.revision)


if __name__ == "__main__":
    main()
