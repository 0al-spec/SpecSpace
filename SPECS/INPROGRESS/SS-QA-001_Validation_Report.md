# SS-QA-001 validation

The static profile runs 15 analyzers, plus four locked dependency audits in a
separate weekly/manual workflow. Tools/configs are pinned; native binary downloads
are SHA-256 checked. No application behavior or production dependency upgrades are
part of this slice. The main CI now also handles PRs targeting stack branches.

The first full scan completed every analyzer without operational errors. Running
on a separate TB5 source copy with fresh app dependencies returned identical
fingerprints and multiplicities, despite a different absolute checkout path.
React compiler code frames are normalized before fingerprinting. Existing debt
is retained explicitly in `quality/baseline.json`; it is not reported as fixed.
The quality implementation and configs are checked separately from legacy debt.

Eleven focused tests cover duplicate growth, source changes, failed analyzers,
invalid JSON, empty nonzero results, non-baselinable secrets, whole-file formatter
fingerprints, path normalization, incomplete baseline writes, changed profiles
and dependency-audit failure semantics. Reports and generated dependencies are on
the verified external TB5 disk; the existing application environments are intact.

Dependency audit returned 22 affected npm packages in graphspace, 24 in viewer/app
and 20 in tooling; Python returned zero advisories. There were no audit errors.
These numbers are advisory-service observations at execution time, not counts of
exploitable product defects. Dependency upgrades remain a separate follow-up.

Gitleaks exposed archived JWT-shaped authentication data in five imported HTML
files. Their payload `exp` timestamps were in the past. Replacement was verified
byte-for-byte against HEAD with only matching JWT ranges redacted; conversation
text and line endings are preserved. Current source scans now return zero secret
findings. Historical Git objects were not rewritten; signatures and live sessions
were not checked. Quality artifacts exclude raw source and Gitleaks uses full
redaction. The secret scan temporary copy is removed even if the tool fails.

**Security review remains open:** [SS-SEC-001](SS-SEC-001_Archived_Auth_Exposure.md)
tracks owner attribution, associated sessions, adjacent export metadata and the
disposition of historical copies. On 2026-11-01, the scoped default-branch check
confirmed one distinct JWT-shaped string repeated in five files; unverified
expiry claims do not establish revocation or current access. No live credential
probe or session changes were performed. Redaction/merge/green CI cannot close it.

No hosted CI result, independent review, merge or deployment is asserted by this
local report. Existing primary checkout reused; no extra Git worktree created.

After #436 review fixes, bootstrap was regenerated against `ce50f3b4`: 7,787
diagnostics, all 15 analyzers completed, zero analyzer errors and zero findings
in the quality implementation/configs. Scope initialization and typed JSON test
fixtures removed additional diagnostics. This is still the initial profile;
ongoing CI cannot refresh the baseline. The first #437 head passed hosted CI;
the updated stack requires new checks on its new head.

README badges: native main-branch workflow status plus five stack SVGs generated
from the Dockerfile/runtime tag and exact npm lock versions. The full badge set
is revision-bound and published atomically to a dedicated metadata branch only
after a successful quality run on a main push. PR jobs generate preview artifacts
without publishing. Twenty ratchet/badge tests passed, including stale revision,
forbidden PR publication, initial branch creation, API failures, version changes
and non-forced ref updates. Five SVGs rendered and were inspected in Chromium.
All 15 analyzers completed with zero errors and no new findings; README formatter
normalization reduced bootstrap debt to 7,758. No live badge publication was made
from the developer machine; initial hosted publication remains a post-merge check.
