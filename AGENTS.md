# ContextBuilder Agent Notes

## SpecSpace

When working on the SpecSpace subproject, follow
[FSD Rules For Web Application Development](FSD.md). These rules describe the
Feature-Sliced Design structure, layer responsibilities, import direction,
public APIs, and where to place UI, API, and state code.

Store important lessons learned during SpecSpace work in [CONTRIBUTING.md](CONTRIBUTING.md), and check it first when recurring implementation, review, or deployment problems appear.

## 0AL Local Ops Logging

For cross-repo observations, coordination tasks, blockers, or handoffs, write a
local ops entry through the `.0al` logging CLI when it is available:

```bash
../.0al/scripts/0al-log.py --project specspace --kind note --owner unclassified \
  --title "<short title>" \
  --text "<what happened, what is needed, and any suggested next action>"
```

Use `.0al` only for coordination. Canonical SpecSpace changes belong in this
repository. Do not edit `.0al/tasks.md` or `.0al/decisions.md` directly unless
the user explicitly asks for tracker maintenance, and never write secrets,
credentials, private keys, or machine-local tokens to `.0al`.
