# ADR 0003 — Segment-first document model

Status: Accepted

## Decision

Jano models bilingual correspondence through document structure and segments, not page-to-page equivalence.

```text
Document
  -> blocks
  -> segments
  -> alignments
  -> viewer behavior
```

## Consequences

- Alignment supports 1:1, 1:n, n:1, and potentially n:m relationships.
- Scroll and selection consume alignment data.
- Different pagination between languages is normal.
