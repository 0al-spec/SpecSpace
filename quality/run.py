"""Run pinned tools; distinguish existing debt, new findings and broken analyzers."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess  # nosec B404 # fixed local development tools, never shell commands
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "quality"
TOOLS = [
    "ruff",
    "python-format",
    "basedpyright",
    "bandit",
    "eslint",
    "stylelint",
    "prettier",
    "markdownlint",
    "html-validate",
    "yamllint",
    "shellcheck",
    "shfmt",
    "actionlint",
    "hadolint",
    "gitleaks",
]


def profile_digest() -> str:
    """Invalidate debt acceptance when pinned tools, adapters or rules change."""
    paths = [
        path
        for path in sorted(CONFIG.iterdir())
        if path.is_file() and path.name not in {"baseline.json", "README.md", ".gitkeep"}
    ]
    parts = [[path.name, hashlib.sha256(path.read_bytes()).hexdigest()] for path in paths]
    return hashlib.sha256(json.dumps(parts).encode()).hexdigest()


def source_files(root: Path) -> list[str]:
    result = subprocess.run(  # nosec B603, B607 # static git command, trusted developer PATH, no shell
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=root,
        capture_output=True,
        check=True,
    )
    names = set(os.fsdecode(result.stdout).split("\0")) - {""}
    return sorted(
        name
        for name in names
        if (root / name).is_file()
        and not (root / name).is_symlink()
        and "/lib/upstream/" not in name
        and not name.endswith(("upstream.scoped.css", "motivation-full.fixture.json"))
        and name not in {"quality/baseline.json", "quality/package-lock.json"}
    )


def fingerprint(tool: str, path: str, rule: str, message: str, context: str) -> str:
    """Line numbers may move; source text and duplicate multiplicity remain binding."""
    # Some linters refer to a second location inside the prose itself.
    message = re.sub(r"\b(line|column) \d+\b", r"\1 <position>", message)
    value = [tool, path, rule, message, context.strip()]
    return hashlib.sha256(json.dumps(value, ensure_ascii=False).encode()).hexdigest()


def regressions(findings: list[dict], baseline: dict[str, int]) -> list[dict]:
    remaining = Counter(baseline)
    new = []
    for item in findings:
        key = item["fingerprint"]
        if item.get("tool") != "gitleaks" and remaining[key] > 0:
            remaining[key] -= 1
        else:
            new.append(item)
    return new


class Collector:
    def __init__(self, output: Path):
        self.output = output
        self.findings: list[dict] = []
        self.errors: list[dict] = []
        self.completed: list[str] = []
        self.returncodes: list[int] = []

    def run(self, command: list[str], allowed=(0, 1)) -> subprocess.CompletedProcess:
        result = subprocess.run(  # nosec B603 # argument arrays of pinned local tools, no shell
            command,
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=180,
            env={**os.environ, "NO_COLOR": "1", "FORCE_COLOR": "0"},
        )
        self.returncodes.append(result.returncode)
        if result.returncode not in allowed:
            raise RuntimeError(f"exit {result.returncode}: {result.stderr[:1500]}")
        return result

    def add(self, tool: str, path: str, rule: str, message: str, line=1, *, whole=False):
        raw = Path(path)
        if raw.is_absolute():
            raw = raw.relative_to(ROOT)
        path = raw.as_posix()
        if ".." in raw.parts:
            raise ValueError("Analyzer reported an out-of-repository path")
        # React compiler diagnostics embed an absolute location and numbered code
        # frame. Keep the explanation, and bind the fingerprint to source below.
        message = re.split(rf"\n{re.escape(str(ROOT))}/[^\n]+:\d+:\d+\n", message)[0]
        message = message.replace(str(ROOT), "<repo>")
        content = (ROOT / path).read_text(errors="replace") if (ROOT / path).is_file() else ""
        lines = content.splitlines()
        context = (
            hashlib.sha256(content.encode()).hexdigest()
            if whole
            else (lines[int(line) - 1] if 0 < int(line) <= len(lines) else "")
        )
        self.findings.append(
            {
                "tool": tool,
                "path": path,
                "rule": str(rule),
                "message": message,
                "line": int(line),
                "fingerprint": fingerprint(tool, path, str(rule), message, context),
            }
        )

    def collect(self, tool: str, files: list[str]):
        py = [p for p in files if p.endswith(".py")]
        web = [
            p
            for p in files
            if p.endswith((".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx"))
        ]
        data = [
            p
            for p in files
            if "/fixtures/" not in p
            and not p.endswith(".fixture.json")
            and not p.startswith("real_examples/")
        ]

        def node(name):
            return str(CONFIG / "node_modules/.bin" / name)

        def cfg(name):
            return str(CONFIG / name)

        if tool == "ruff":
            result = self.run(
                ["ruff", "check", "--config", cfg("ruff.toml"), "--output-format=json", *py]
            )
            for row in json.loads(result.stdout):
                self.add(tool, row["filename"], row["code"], row["message"], row["location"]["row"])
        elif tool == "python-format":
            result = self.run(
                [
                    "ruff",
                    "format",
                    "--config",
                    cfg("ruff.toml"),
                    "--check",
                    "--output-format=json",
                    *py,
                ]
            )
            for name in sorted({row["filename"] for row in json.loads(result.stdout)}):
                self.add(tool, name, "format", "File requires formatting", whole=True)
        elif tool == "basedpyright":
            result = self.run(
                [
                    "basedpyright",
                    "--project",
                    cfg("basedpyright.json"),
                    "--pythonpath",
                    sys.executable,
                    "--outputjson",
                ]
            )
            for row in json.loads(result.stdout)["generalDiagnostics"]:
                self.add(
                    tool,
                    row["file"],
                    row.get("rule", "typecheck"),
                    row["message"],
                    row.get("range", {}).get("start", {}).get("line", 0) + 1,
                )
        elif tool == "bandit":
            result = self.run(["bandit", "-q", "-c", cfg("bandit.yml"), "-f", "json", *py])
            parsed = json.loads(result.stdout)
            if parsed.get("errors"):
                raise RuntimeError("Bandit could not analyze all Python files")
            for row in parsed["results"]:
                self.add(
                    tool, row["filename"], row["test_id"], row["issue_text"], row["line_number"]
                )
        elif tool == "eslint":
            result = self.run(
                [
                    node("eslint"),
                    "--no-ignore",
                    "--config",
                    cfg("eslint.config.mjs"),
                    "--format",
                    "json",
                    *web,
                ]
            )
            for file in json.loads(result.stdout):
                for row in file["messages"]:
                    if row.get("fatal"):
                        raise RuntimeError(
                            f"ESLint parse/config failure: {file['filePath']}: {row['message']}"
                        )
                    self.add(
                        tool,
                        file["filePath"],
                        row.get("ruleId") or "parser",
                        row["message"],
                        row.get("line", 1),
                    )
        elif tool == "stylelint":
            result = self.run(
                [
                    node("stylelint"),
                    "--config",
                    cfg("stylelint.config.mjs"),
                    "--formatter",
                    "json",
                    *[p for p in data if p.endswith(".css")],
                ],
                allowed=(0, 2),
            )
            for file in json.loads(result.stdout or result.stderr):
                if file.get("invalidOptionWarnings"):
                    raise RuntimeError("Invalid Stylelint configuration")
                for row in file["warnings"]:
                    self.add(tool, file["source"], row["rule"], row["text"], row["line"])
        elif tool == "prettier":
            supported = (
                ".ts",
                ".tsx",
                ".js",
                ".mjs",
                ".cjs",
                ".jsx",
                ".mts",
                ".cts",
                ".css",
                ".json",
                ".md",
                ".yml",
                ".yaml",
                ".html",
            )
            result = self.run(
                [
                    node("prettier"),
                    "--config",
                    cfg("prettier.json"),
                    "--list-different",
                    *[p for p in data if p.endswith(supported)],
                ]
            )
            for name in result.stdout.splitlines():
                self.add(tool, name, "format", "File requires formatting", whole=True)
        elif tool == "markdownlint":
            result = self.run(
                [
                    node("markdownlint"),
                    "--config",
                    cfg("markdownlint.json"),
                    "--json",
                    *[p for p in data if p.endswith(".md")],
                ]
            )
            for row in json.loads(result.stdout or result.stderr or "[]"):
                self.add(
                    tool,
                    row["fileName"],
                    row["ruleNames"][0],
                    row["ruleDescription"],
                    row["lineNumber"],
                )
        elif tool == "html-validate":
            result = self.run(
                [
                    node(tool),
                    "--config",
                    cfg("htmlvalidate.json"),
                    "--formatter",
                    "json",
                    *[p for p in data if p.endswith(".html")],
                ]
            )
            for file in json.loads(result.stdout or "[]"):
                for row in file["messages"]:
                    self.add(tool, file["filePath"], row["ruleId"], row["message"], row["line"])
        elif tool == "yamllint":
            result = self.run(
                [
                    "yamllint",
                    "-c",
                    cfg("yamllint.yml"),
                    "-f",
                    "parsable",
                    *[p for p in data if p.endswith((".yaml", ".yml"))],
                ]
            )
            for match in re.finditer(
                r"^(.+?):(\d+):\d+: \[\w+\] (.*) \(([^)]+)\)$", result.stdout, re.M
            ):
                self.add(tool, match[1], match[4], match[3], int(match[2]))
            if result.returncode and not result.stdout:
                raise RuntimeError("YAML analyzer failed without diagnostics")
        elif tool == "shellcheck":
            result = self.run(
                ["shellcheck", "--format=json", *[p for p in files if p.endswith(".sh")]]
            )
            for row in json.loads(result.stdout):
                self.add(tool, row["file"], f"SC{row['code']}", row["message"], row["line"])
        elif tool == "shfmt":
            result = self.run(["shfmt", "-l", *[p for p in files if p.endswith(".sh")]])
            for name in result.stdout.splitlines():
                self.add(tool, name, "format", "Shell file requires formatting", whole=True)
        elif tool == "actionlint":
            result = self.run(
                [
                    "actionlint",
                    "-format",
                    "{{json .}}",
                    *[
                        p
                        for p in files
                        if p.startswith(".github/workflows/") and p.endswith((".yaml", ".yml"))
                    ],
                ]
            )
            for row in json.loads(result.stdout):
                self.add(tool, row["filepath"], row["kind"], row["message"], row["line"])
        elif tool == "hadolint":
            for name in [p for p in files if p.split("/")[-1] == "Dockerfile"]:
                result = self.run(["hadolint", "--format=json", name])
                for row in json.loads(result.stdout):
                    self.add(tool, name, row["code"], row["message"], row["line"])
        elif tool == "gitleaks":
            # Only tracked/in-scope source, never ignored operator data or caches.
            staging = self.output / "secret-scan-input"
            created = False
            try:
                staging.mkdir()
                created = True
                for name in files:
                    target = staging / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(ROOT / name, target)
                report = self.output / "gitleaks-redacted.json"
                self.run(
                    [
                        "gitleaks",
                        "dir",
                        "--redact=100",
                        "--no-banner",
                        "--report-format=json",
                        f"--report-path={report}",
                        str(staging),
                    ]
                )
            finally:
                # Never retain a second copy of source/possible secrets in reports.
                if created:
                    shutil.rmtree(staging)
            for row in json.loads(report.read_text()):
                name = Path(row["File"])
                if name.is_absolute():
                    name = name.relative_to(staging)
                self.add(tool, str(name), row["RuleID"], row["Description"], row["StartLine"])
        else:
            raise ValueError(f"Unknown analyzer: {tool}")

    def execute(self, tool, files):
        start = len(self.findings)
        self.returncodes = []
        try:
            self.collect(tool, files)
            if any(self.returncodes) and len(self.findings) == start:
                raise RuntimeError("Analyzer exited nonzero without structured findings")
            self.completed.append(tool)
            print(f"{tool}: {len(self.findings) - start} findings", flush=True)
        except (
            OSError,
            RuntimeError,
            ValueError,
            KeyError,
            TypeError,
            subprocess.SubprocessError,
        ) as error:
            self.errors.append({"tool": tool, "error": str(error)[:2000]})
            print(f"{tool}: ANALYZER ERROR ({type(error).__name__})", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--tools", nargs="+", choices=TOOLS, default=TOOLS)
    parser.add_argument(
        "--write-baseline",
        action="store_true",
        help="Explicit reviewed bootstrap/update; never used by CI",
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if (args.output / "report.json").exists():
        raise SystemExit(
            "Choose a new output directory so old evidence cannot masquerade as this run"
        )
    collector = Collector(args.output)
    files = source_files(ROOT)
    for tool in args.tools:
        collector.execute(tool, files)
    baseline_path = CONFIG / "baseline.json"
    baseline = json.loads(baseline_path.read_text()) if baseline_path.exists() else {"counts": {}}
    digest = profile_digest()
    if (
        baseline_path.exists()
        and not args.write_baseline
        and (baseline.get("schema_version") != 1 or baseline.get("profile_digest") != digest)
    ):
        collector.errors.append(
            {
                "tool": "baseline",
                "error": "Quality profile changed; explicitly review and regenerate baseline",
            }
        )
    new = regressions(collector.findings, baseline["counts"])
    report = {
        "schema_version": 1,
        "profile_digest": digest,
        "completed": collector.completed,
        "errors": collector.errors,
        "findings": collector.findings,
        "new_findings": new,
        "summary": dict(Counter(item["tool"] for item in collector.findings)),
    }
    (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    summary = ["# SpecSpace quality report", "", "| Tool | Findings |", "| --- | ---: |"]
    summary += [f"| {tool} | {report['summary'].get(tool, 0)} |" for tool in args.tools]
    summary += [
        "",
        f"New findings: **{len(new)}**. Analyzer errors: **{len(collector.errors)}**.",
        "",
        "Existing findings are accepted debt, not evidence of clean code.",
    ]
    (args.output / "summary.md").write_text("\n".join(summary) + "\n")
    if args.write_baseline:
        if (
            collector.errors
            or set(collector.completed) != set(TOOLS)
            or any(item["tool"] == "gitleaks" for item in collector.findings)
        ):
            raise SystemExit("Cannot baseline an incomplete or broken analyzer run")
        baseline = {
            "schema_version": 1,
            "profile_digest": digest,
            "counts": dict(Counter(item["fingerprint"] for item in collector.findings)),
            "summary": report["summary"],
        }
        baseline_path.write_text(json.dumps(baseline, indent=2) + "\n")
        print("Explicit baseline written; review the full report and baseline diff")
    print(f"New findings: {len(new)}; analyzer errors: {len(collector.errors)}")
    return int(bool(collector.errors or (new and not args.write_baseline)))


if __name__ == "__main__":
    sys.exit(main())
