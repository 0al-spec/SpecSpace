# Next Task: CTXB-P2R-B5 — Message node title is draggable and shows sockets; overlapped by message node; collapse button floats

**Priority:** P1
**Phase:** Phase 2R: React Flow refinements
**Effort:** 4h
**Dependencies:** CTXB-P2R-T3, CTXB-P2R-T4
**Status:** Selected

## Description

The title inside an expanded message subflow currently behaves like an interactive node, which makes it draggable, shows sockets, and visually collides with the first real message node. The expand/collapse control also floats with the sub-node instead of staying attached to the conversation header. The title should be rendered as a passive decorator so it stays lightweight and does not participate in graph interactions.

## Next Step

Run the PLAN command to generate the implementation-ready PRD.
