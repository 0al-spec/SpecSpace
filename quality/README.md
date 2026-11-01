# SpecSpace quality checks

The profile covers the languages used in this repository. It reports legacy debt
and rejects new violations without mass-reformatting existing application code.
Application builds, FSD checks, unit tests and browser tests remain in the main CI.

## README badges

Native GitHub workflow badges track `main`: application CI, polyglot quality and
the separate dependency audit. Passing static checks means no new debt beyond the
baseline; it is not a security or coverage score.

Stack badges use exact React, TypeScript, Vite and React Flow versions from
`graphspace/package-lock.json`, plus the Python runtime tag in `Dockerfile`.
Every PR generates a preview artifact. After a successful quality run on a `main`
push, CI publishes all SVGs and `manifest.json` in one commit to the dedicated
`quality-badges` branch. The manifest and each SVG carry the source commit SHA.
No source files or README versions are rewritten by the bot. PRs cannot publish;
publication uses a separate job with write permission and never forces a ref.
Superseded main revisions are skipped. GitHub image caches may delay display.

The image URLs become available after the first successful `main` publication;
before this PR is merged, review the `stack-badges` workflow artifact instead.
No successful hosted dependency audit is implied until that workflow has run.

```bash
quality/.venv/bin/python quality/badges.py --revision "$(git rev-parse HEAD)" --output quality/reports/badges-preview
```

## Tools

| Source                     | Checks                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Python                     | Ruff lint and format, BasedPyright types, Bandit security                             |
| Both React/TypeScript apps | ESLint typed rules, React, Hooks, JSX accessibility, Security, SonarJS, React Refresh |
| CSS                        | Stylelint standard rules with CSS Modules support                                     |
| Web/config/docs formatting | Prettier                                                                              |
| HTML                       | HTML Validate                                                                         |
| Markdown                   | Markdownlint                                                                          |
| YAML                       | Yamllint                                                                              |
| Shell                      | ShellCheck and shfmt                                                                  |
| GitHub Actions             | actionlint, including shell checks                                                    |
| Dockerfiles                | Hadolint                                                                              |
| Source secrets             | Gitleaks, fully redacted reports                                                      |
| Locked dependencies        | npm audit for all three npm locks; pip-audit for runtime and the Python quality lock  |

Tool versions and transitive dependencies are pinned in `package-lock.json` and
the hashed `requirements.txt`. `binaries.json` pins native downloads and their
SHA-256 digests for macOS arm64 and Linux x86_64. ESLint 9 is deliberately retained
for the selected plugin compatibility; upgrades require reviewing the profile.
Existing graphspace Steiger/FSD checks and TypeScript builds are complementary.
This is a finite static profile, not a claim of complete correctness or security.

## Setup and run

Use Python 3.12 and Node 24.8 or newer. Keep this environment separate from the
application environment. Local build/cache routing policies still apply; an
external environment may be linked at `quality/.venv` and `quality/node_modules`.
Do not overwrite existing environments or move their caches implicitly.

```bash
python3.12 -m venv quality/.venv
quality/.venv/bin/python -m pip install --require-hashes -r quality/requirements.txt
npm ci --prefix quality
npm ci --prefix graphspace
npm ci --prefix viewer/app
quality/.venv/bin/python quality/install_binaries.py --destination quality/.bin
export PATH="$PWD/quality/.venv/bin:$PWD/quality/.bin:$PATH"
quality/.venv/bin/python -m pytest -q tests/test_quality_ratchet.py tests/test_quality_badges.py
quality/.venv/bin/python quality/run.py --output quality/reports/local-1
```

Choose a fresh report directory each run. The runner writes `report.json` and
`summary.md`, with findings, new findings, completed tools, analyzer errors and
the profile digest. It exits nonzero for regressions or failed analyzers. A
missing executable, invalid JSON, parse/config failure or nonzero result without
structured findings cannot be accepted as a clean run. Partial runs are available
with `--tools ruff bandit`; they never certify the whole profile.

Config files under this directory can also be selected in editor integrations.
The pinned ESLint flat config is `quality/eslint.config.mjs`; it uses the actual
application TypeScript projects, so both app dependency trees must be installed.
ESLint and Prettier include `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`, `.mts`
and `.cts` source files. Typed ESLint rules remain scoped to the configured app
TypeScript projects.

## Debt contract

`baseline.json` records counts of diagnostic fingerprints, not a blanket allowlist
of files or rules. A fingerprint includes tool, path, rule, normalized message and
the affected source line. Moving a line alone does not create new debt; another
copy of the same violation does. A changed offending line must be fixed.

Formatter findings bind to the whole file digest: once an already unformatted file
is edited, format that entire file. This deliberately makes incremental formatting
visible. Removing findings reduces reported debt; the stored allowance changes only
when the baseline is explicitly refreshed and reviewed:

```bash
quality/.venv/bin/python quality/run.py --output quality/reports/review-1 --write-baseline
git diff -- quality/baseline.json
```

Only a complete run can write a baseline. Tool/config/adapter/lock changes invalidate
its profile digest and require review and a new full run. CI never refreshes it.
Gitleaks findings are always new and cannot be accepted into the baseline.
The initial baseline is bootstrap debt, not evidence that old findings were fixed
or that the code is clean. Review the uploaded report when reducing that debt.

## Scope and exclusions

The runner scans Git-tracked and unignored source files. It does not follow source
symlinks. Ignored runtime state, environments, build outputs and caches are absent
from the input list. Immutable Viewer `lib/upstream` source, generated scoped CSS
and the generated full graph fixture are excluded: upstream byte/hash verification
in the main CI is their integrity check. `quality/baseline.json` and the tooling
lockfile are excluded from formatting/analysis input.

Imported `real_examples/` HTML/text are conversation evidence, not authored UI.
They are excluded from formatting and HTML/docs validation, but remain in the
Gitleaks scan. Other test fixtures are excluded from generic web/data formatting.
Bandit checks test code but permits pytest assertions; production assertions remain
checked. Every other suppression must have a specific rationale.

Gitleaks stages only the selected source, uses `--redact=100`, removes its temporary
copy and never uploads raw source as a quality artifact. It scans current files,
not Git history. The bootstrap removed archived authentication JWT strings from
five imported HTML files; their `exp` fields were in the past. This does not prove
revocation or remove historical copies. No Git history was rewritten.
The security review remains open in
[SS-SEC-001](../SPECS/INPROGRESS/SS-SEC-001_Archived_Auth_Exposure.md).
The maintainer confirmed ownership; provider/session checks remain outstanding.
A clean source scan or merge of the redaction does not close that review.

## Dependency audits

```bash
quality/.venv/bin/python quality/audit_dependencies.py --output quality/reports/audit-1
```

Exit 0 means no known advisories returned, 1 means vulnerabilities, and 2 means an
incomplete/failed audit. All raw structured audit reports are retained. Audits need
network access and advisory results change over time, so they have a separate
weekly/manual workflow, outside the reproducible static baseline and PR gate.
Existing advisories are not hidden by `continue-on-error`. No automatic dependency
upgrades or `audit fix` run. Python resolves and audits the runtime dependency tree
independently from the locked application/dev/tool environment; npm includes runtime
and development tooling. Runtime transitive versions are resolved at audit time and
may differ from an earlier image build unless its dependency tree is locked.

## Extending the profile

Keep tools compatible, pinned and independently useful; installing every competing
linter is not a quality goal. Coverage thresholds, mutation testing, dead-code and
clone analysis need their own measured scopes and budgets. Add them as separate
profiles after the static debt and dependency audit reports have actionable owners.
