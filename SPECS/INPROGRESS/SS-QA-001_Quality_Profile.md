# SS-QA-001 — Reproducible polyglot quality profile

Cover the actual repository stack: Python, both React/TypeScript applications,
CSS/HTML, shell, YAML/JSON/Markdown, Docker and GitHub Actions. Pin tools, keep
configs/editor entry points, run a full report locally/CI and expose legacy debt.

Existing code is not mass-reformatted. Initial findings form an explicit reviewed
baseline; new fingerprints or increased duplicate counts fail. Tool failures,
invalid output and missing tools fail separately and cannot become a green empty
report. No automatic baseline refresh in CI. Third-party immutable upstream and
generated fixtures/builds have explicit exclusions; source hash checks remain.
Security/dependency findings are signals, not proof of absence of vulnerabilities.
Heavy runtime/mutation/performance testing remains a subsequent measured profile.

Keep tooling in its own Node 24+/Python environment, independent of app runtime.
New quality files must be clean; source/dependency changes are separate tasks.
