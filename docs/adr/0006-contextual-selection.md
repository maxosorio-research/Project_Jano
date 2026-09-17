# ADR 0006 — Contextual bilingual selection

Status: Accepted

## Decision

The user's selection is the only real selection. Jano projects a contextual counterpart in the other language.

Correspondence is semantic/contextual rather than necessarily lexical.

## Precision fallback

```text
precise span
  -> sentence/clause
  -> full aligned segment
```

MVP may stop at full aligned segment when fine alignment is unavailable.

## Consequences

The UI must visually distinguish actual selection from projected counterpart.
