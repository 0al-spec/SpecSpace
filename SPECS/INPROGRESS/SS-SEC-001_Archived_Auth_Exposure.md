# SS-SEC-001 — Archived authorization data exposure

**Status: OPEN.** Related: SS-QA-001 and [PR #437](https://github.com/0al-spec/SpecSpace/pull/437).
Current-file redaction is partial containment and does not close this review.

## Confirmed scope

A local read-only check on 2026-11-01 found five copies of one distinct JWT-shaped
string in the five imported HTML files changed by #437. Those copies remain in
the fetched public `main` at `bd3de613`; none remain in those files at the reviewed
PR head `86905bde`. This is a scoped comparison, not a complete history/fork audit.

All five copies have the same payload. Its unverified `exp` claim is in the past;
issuer/profile/session hints are consistent with an OpenAI session. Claims were
decoded locally without signature validation. They do not authenticate the owner
or establish provider-side revocation. No request used the exposed token, and no
account/session controls were changed. No live access was demonstrated.

Token values, token fingerprints, payload identifiers, emails and session IDs
must stay out of public review evidence. Ownership confirmation is pending.

## Outstanding checks

| Item                                | Current state                             | Evidence needed                                                                                                           |
| ----------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Current default-branch containment  | Open; redaction is only in an unmerged PR | Default-branch cleanup commit and scan result                                                                             |
| Owner attribution                   | Unknown; decoded claims are hints         | Confirmation from the export/account owner, recorded without personal values                                              |
| Associated sessions and credentials | Not assessed with the provider            | Owner-authorized assessment and a non-secret record of applicable session termination/revocation or provider confirmation |
| Adjacent export metadata            | Not established by a zero Gitleaks result | Review of nearby authorization/session fields, with no sensitive values published                                         |
| History, forks, caches and copies   | Not inventoried or removed                | Explicit owner decision on residual privacy/access risk and any required cleanup                                          |

Do not probe live access with an exposed credential to resolve uncertainty.
Owner/provider controls and trustworthy account records are the appropriate source
for session containment evidence. A past `exp` value alone is not that evidence.

## Closure

Keep this item open until current default-branch cleanup is confirmed, the owner
and affected session scope are assessed, applicable containment is recorded, and
the disposition of historical/cached copies and adjacent metadata is explicit.
Any unverified part must remain visible rather than becoming “safe” or “revoked”.

History rewriting is a separate coordinated decision, not an automatic side
effect of merging #437. GitHub recommends revoking/rotating credentials first and
notes that rewriting may be unnecessary after revocation, while forks, clones,
cached views and PR references may retain copies. See
[GitHub's sensitive-data removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

Merging the quality profile, a green CI badge or a zero current-source secret scan
must not automatically close SS-SEC-001.
