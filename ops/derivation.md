---
description: How this knowledge system was derived — enables architect and reseed commands
created: 2026-05-01
engine_version: "1.0.0"
---

# System Derivation

## Configuration Dimensions

| Dimension | Position | Conversation Signal | Confidence |
|-----------|----------|--------------------|--------------------|
| Granularity | Moderate | "Capture per feature: what was built, why it was built, which files changed, status" — per-feature notes, not atomic decomposition | High |
| Organization | Flat | "Single project, navigation by feature name" — flat with feature register as hub | High |
| Linking | Explicit | Features may depend on or relate to other features via explicit wiki links | Medium |
| Processing | Light-Moderate | "Know what features exist at a glance" — capture when building, light extraction | High |
| Navigation | 2-tier | "Single project scope, navigate by feature name" — feature register + individual feature records | High |
| Maintenance | Condition-based | Status changes (shipped/in-progress/reverted) trigger updates; staleness in a fast-moving codebase | High |
| Schema | Dense | "Status, which files changed, why it was built" — all explicit required fields | High |
| Automation | Full | Claude Code platform with hook support — full automation available | High |

## Personality Dimensions

| Dimension | Position | Signal |
|-----------|----------|--------|
| Warmth | Clinical | Technical/engineering domain, no emotional signals | default |
| Opinionatedness | Neutral | "Know what features exist" — informational, not editorial | default |
| Formality | Formal | Software development domain, professional context | default |
| Emotional Awareness | Task-focused | Feature tracking is intellectual, not emotional | default |

## Vocabulary Mapping

| Universal Term | Domain Term | Category |
|---------------|-------------|----------|
| notes | features | folder |
| inbox | staging | folder |
| archive | shipped | folder |
| note (type) | feature record | note type |
| note_plural | feature records | note type |
| reduce | document | process phase |
| reflect | trace connections | process phase |
| reweave | update | process phase |
| verify | review | process phase |
| validate | validate | process phase |
| rethink | retrospect | meta process |
| MOC | feature register | navigation |
| topic_map | feature register | navigation |
| description | feature summary | schema field |
| topics | areas | schema field |
| relevant_notes | related features | schema field |
| domain | ContextBuilder | domain name |
| cmd_reduce | /arscontexta:document | command |
| cmd_reflect | /arscontexta:trace | command |
| cmd_reweave | /arscontexta:update | command |
| cmd_verify | /arscontexta:review | command |
| cmd_rethink | /arscontexta:retrospect | command |

## Platform

- Tier: Claude Code
- Automation level: full
- Automation: full (default)

## Active Feature Blocks

- [x] wiki-links — always included (kernel)
- [x] maintenance — always included (always)
- [x] self-evolution — always included (always)
- [x] session-rhythm — always included (always)
- [x] templates — always included (always)
- [x] ethical-guardrails — always included (always)
- [x] atomic-notes — included (moderate granularity benefits from composability principles)
- [x] mocs — included (2-tier navigation with feature register)
- [x] processing-pipeline — included (full automation from day one)
- [x] schema — included (dense schema required)
- [x] helper-functions — always included
- [x] graph-analysis — always included
- [x] methodology-knowledge — always included
- [ ] semantic-search — excluded (single project, explicit linking sufficient at expected volume)
- [ ] personality — excluded (no personality signals, neutral-helpful default)
- [ ] multi-domain — excluded (single project scope)
- [ ] self-space — excluded (research/tracking use case, goals route to ops/)

## Coherence Validation Results

- Hard constraints checked: 3. Violations: none
- Soft constraints checked: 7. Auto-adjusted: none. User-confirmed: none
- Compensating mechanisms active: none required
- Note: moderate granularity + full automation + 2-tier nav — no violations. Dense schema + full automation — good (automation validates schema).

## Failure Mode Risks

1. Productivity Porn (HIGH for PM/dev) — building the tracking system instead of using it; spending more time on CLAUDE.md than on feature records
2. Temporal Staleness (HIGH for PM/dev) — feature status becoming outdated as codebase evolves; shipped features remaining marked as in-progress
3. Schema Erosion (medium) — status fields and file lists drifting without enforcement
4. Cognitive Outsourcing (medium) — using the knowledge system instead of the code as ground truth for what actually exists

## Generation Parameters

- Folder names: features/ (notes), staging/ (inbox), shipped/ (archive), templates/, ops/, manual/
- Preset: PM preset adapted for software feature tracking
- Skills to generate: all 16 (vocabulary-transformed)
- Hooks to generate: session-orient.sh, session-capture.sh, validate-note.sh, auto-commit.sh
- Templates to create: feature-record.md, feature-register.md, observation-note.md
- Topology: single-agent / skills
- Domain: ContextBuilder software project
