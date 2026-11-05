"""Exercise hook installation, input forwarding and fail-closed checks."""

import os
import shutil
import subprocess  # nosec B404 # fixed commands in an isolated test repository
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(*args, cwd, env=None, input_text=None, check=True):
    return subprocess.run(  # nosec B603 # test constructs every argument without a shell
        args, cwd=cwd, env=env, input=input_text, text=True, capture_output=True, check=check
    )


class LocalQualityHookTests(unittest.TestCase):
    def test_make_init_preserves_hook_when_core_hookspath_is_githooks(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            run("git", "init", "-q", cwd=repo)
            run("git", "config", "core.hooksPath", ".githooks", cwd=repo)
            (repo / ".githooks").mkdir()
            shutil.copy2(ROOT / "Makefile", repo / "Makefile")
            for name in ("install", "pre-push"):
                shutil.copy2(ROOT / ".githooks" / name, repo / ".githooks" / name)
            hook = repo / ".githooks/pre-push"
            before = hook.read_bytes()
            result = run("make", "init", cwd=repo)
            self.assertIn("already active", result.stdout)
            self.assertEqual(hook.read_bytes(), before)
            self.assertFalse((repo / ".githooks/pre-push.specspace-previous").exists())

    def test_existing_hook_and_quality_run_and_dirty_tree_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            repo = base / "repo"
            repo.mkdir()
            run("git", "init", "-q", cwd=repo)
            run("git", "config", "user.email", "test@example.invalid", cwd=repo)
            run("git", "config", "user.name", "Test", cwd=repo)
            (repo / ".githooks").mkdir()
            shutil.copy2(ROOT / "Makefile", repo / "Makefile")
            for name in ("install", "pre-push"):
                shutil.copy2(ROOT / ".githooks" / name, repo / ".githooks" / name)
            for name in (
                "scripts/check-timeweb-deploy-branch.sh",
                "quality/.venv/bin/python",
                "quality/node_modules/.bin/eslint",
                "graphspace/node_modules/.bin/steiger",
            ):
                path = repo / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("#!/bin/sh\nexit 0\n")
                path.chmod(0o755)
            (repo / "tracked").write_text("clean\n")
            run("git", "add", "-f", ".", cwd=repo)
            run("git", "commit", "-qm", "fixture", cwd=repo)
            hooks = repo / ".git/hooks"
            old = hooks / "pre-push"
            old.write_text('#!/bin/sh\ncat > "$HOOK_INPUT"\nprintf "%s\\n" "$@" > "$HOOK_ARGS"\n')
            old.chmod(0o755)
            run("make", "init", cwd=repo)
            run("make", "init", cwd=repo)
            self.assertTrue((hooks / "pre-push.specspace-previous").is_file())
            binaries = base / "bin"
            binaries.mkdir()
            for name in ("make", "npm"):
                script = binaries / name
                script.write_text('#!/bin/sh\nprintf "%s\\n" "$0" >> "$QUALITY_CALLS"\n')
                script.chmod(0o755)
            env = dict(os.environ, PATH=f"{binaries}:{os.environ['PATH']}")
            env.update(
                HOOK_INPUT=str(base / "input"),
                HOOK_ARGS=str(base / "args"),
                QUALITY_CALLS=str(base / "calls"),
            )
            head = run("git", "rev-parse", "HEAD", cwd=repo).stdout.strip()
            refs = f"refs/heads/main {head} refs/heads/main {'0' * 40}\n"
            run(str(hooks / "pre-push"), "origin", "url", cwd=repo, env=env, input_text=refs)
            self.assertEqual((base / "input").read_text(), refs)
            self.assertEqual((base / "args").read_text(), "origin\nurl\n")
            self.assertEqual(len((base / "calls").read_text().splitlines()), 2)
            (repo / "tracked").write_text("dirty\n")
            failed = run(
                str(hooks / "pre-push"),
                "origin",
                "url",
                cwd=repo,
                env=env,
                input_text=refs,
                check=False,
            )
            self.assertNotEqual(failed.returncode, 0)
            self.assertIn("clean working tree", failed.stderr)
            self.assertEqual(len((base / "calls").read_text().splitlines()), 2)


if __name__ == "__main__":
    unittest.main()
