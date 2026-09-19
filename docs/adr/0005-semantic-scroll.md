# ADR 0005 — Semantic synchronized scroll

Status: Accepted

## Decision

Synchronize what the user is reading, not the file coordinate.

Do not synchronize:
- page number;
- absolute scroll percentage.

Use:
- aligned content anchors;
- temporary leader/follower panel;
- interpolation between anchors;
- a tolerance/dead zone;
- manual re-alignment.

## Consequences

Different page numbers between source and translation are expected and valid.
