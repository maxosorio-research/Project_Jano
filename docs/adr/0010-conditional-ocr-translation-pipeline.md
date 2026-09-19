# ADR 0010 — Conditional OCR and automatic translation pipeline

Status: Accepted direction; implementation deferred

## Context

The source conversations define automatic translation as a future local-first capability. They also distinguish digital PDFs with usable text from scanned or damaged pages. Running OCR on every imported document would be unnecessarily slow and would discard information already available in a native text layer.

Milestone 2.5 adds a settings surface for this direction, but it does not add an OCR engine, translation runtime, provider, model download, or automatic processing.

## Decision

The future automatic pipeline will be:

```text
import or discover file
        ↓
inspect format and text quality
        ↓
extract native text when usable
        or
run OCR only on pages that need it
        ↓
normalize reading order
        ↓
create stable segments and IDs
        ↓
translate contextual groups while preserving IDs
        ↓
validate completeness and order
        ↓
render clean Markdown/text
        ↓
record provenance and alignment
```

Automatic processing is project-configurable and must be explicitly enabled. The original remains canonical and unmodified. Local processing is the default direction. Any remote provider is optional and requires explicit consent before document content leaves the computer.

## Consequences

- OCR is conditional, not an unconditional post-import step.
- Segmentation happens before translation so generated translations retain structural identity.
- The translated surface does not reproduce PDF layout.
- Provider and runtime choices remain behind interfaces; this ADR selects neither.
- Translation metadata must eventually record provider/runtime, model, target language, creation time, and review status, but never credentials.
- Failures must be visible and resumable; a failed translation must not replace or modify the original.
- Settings shown in Milestone 2.5 are preparatory and must say that processing is not active.
