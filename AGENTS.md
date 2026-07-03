# ContextBuilder Agent Notes

## SpecSpace

When working on the SpecSpace subproject, follow
[FSD Rules For Web Application Development](FSD.md). These rules describe the
Feature-Sliced Design structure, layer responsibilities, import direction,
public APIs, and where to place UI, API, and state code.

For frontend component work, use the dev UI catalog/workbench first. Search for
an existing example under `/dev/ui-catalog` and the linked fixture galleries
before creating a new component; when adding or changing a component, render the
smallest useful isolated state there with realistic fixture data, verify layout
with screenshots/DOM measurements for relevant viewports, and only then wire the
component into production pages or panels.

Store important lessons learned during SpecSpace work in [CONTRIBUTING.md](CONTRIBUTING.md), and check it first when recurring implementation, review, or deployment problems appear.

For idea-to-spec Product Workspace work, keep the active UI/product backlog in
[SPECS/IDEA_TO_SPEC_PRODUCT_WORKSPACE_WORKPLAN.md](SPECS/IDEA_TO_SPEC_PRODUCT_WORKSPACE_WORKPLAN.md).
Use that file for current friction, next slices, and cross-repo handoff notes
that affect SpecSpace UX. Keep proven demo/smoke procedures in Platform
runbooks, and keep producer-side artifact/contract plans in SpecGraph roadmaps;
do not bury actionable SpecSpace UI tasks only in PR summaries or chat history.

## 0AL Local Ops Logging

For cross-repo observations, coordination tasks, blockers, or handoffs, write a
local ops entry through the `.0al` logging CLI when it is available:

```bash
../.0al/scripts/0al-log.py --project specspace --kind note --owner unclassified \
  --title "<short title>" \
  --text "<what happened, what is needed, and any suggested next action>"
```

Use `.0al` only for coordination. Canonical SpecSpace changes belong in this
repository. Do not edit `../.0al/tasks.md` or `../.0al/decisions.md` directly unless
the user explicitly asks for tracker maintenance, and never write secrets,
credentials, private keys, or machine-local tokens to `.0al`.
