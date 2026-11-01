"""Audit locked dependencies; distinguish vulnerabilities from failed audits."""

import argparse
import json
import subprocess  # nosec B404 # trusted local tools, argument lists only
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def audit(command, cwd, output):
    result = subprocess.run(  # nosec B603 # trusted local commands, no shell
        command, cwd=cwd, text=True, capture_output=True, timeout=300
    )
    payload = json.loads(result.stdout)
    output.write_text(json.dumps(payload, indent=2) + "\n")
    if result.returncode not in (0, 1) or "error" in payload:
        raise RuntimeError(f"Audit failed: exit {result.returncode}")
    if command[0] == "npm":
        if "metadata" not in payload or "vulnerabilities" not in payload:
            raise ValueError("npm audit returned an incomplete report")
        count = sum(
            payload["metadata"]["vulnerabilities"].get(s, 0)
            for s in ("low", "moderate", "high", "critical")
        )
    else:
        dependencies = payload["dependencies"]
        if any(item.get("skip_reason") for item in dependencies):
            raise RuntimeError("pip-audit skipped dependencies")
        count = sum(len(item["vulns"]) for item in dependencies)
    if result.returncode == 1 and count == 0:
        raise RuntimeError("Nonzero audit without vulnerability diagnostics")
    return count


def audit_runtime(output):
    # Install as Docker does, but audit only the resulting runtime tree.
    with tempfile.TemporaryDirectory(prefix="specspace-runtime-audit-") as target:
        subprocess.run(  # nosec B603 # fixed pip command, no shell
            [sys.executable, "-m", "pip", "install", "--target", target, "-r", "requirements.txt"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=300,
            check=True,
        )
        return audit(
            [
                sys.executable,
                "-m",
                "pip_audit",
                "--path",
                target,
                "--strict",
                "--progress-spinner=off",
                "--format=json",
            ],
            ROOT,
            output,
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    counts, errors = {}, {}
    for name, cwd, command in [
        *[
            (name, ROOT / name, ["npm", "audit", "--package-lock-only", "--json"])
            for name in ("graphspace", "viewer/app", "quality")
        ],
        (
            "python",
            ROOT,
            [
                sys.executable,
                "-m",
                "pip_audit",
                "--requirement",
                "quality/requirements.txt",
                "--disable-pip",
                "--no-deps",
                "--strict",
                "--progress-spinner=off",
                "--format=json",
            ],
        ),
    ]:
        try:
            counts[name] = audit(command, cwd, args.output / f"{name.replace('/', '-')}.json")
        except (
            OSError,
            ValueError,
            KeyError,
            TypeError,
            RuntimeError,
            subprocess.SubprocessError,
        ) as error:
            errors[name] = str(error)
    try:
        counts["python-runtime"] = audit_runtime(args.output / "python-runtime.json")
    except (
        OSError,
        ValueError,
        KeyError,
        TypeError,
        RuntimeError,
        subprocess.SubprocessError,
    ) as error:
        errors["python-runtime"] = str(error)
    report = {"vulnerability_counts": counts, "errors": errors}
    (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 2 if errors else int(any(counts.values()))


if __name__ == "__main__":
    sys.exit(main())
