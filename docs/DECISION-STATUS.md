# Decision status and supersessions

This file exists because the project evolved over several design conversations. Coding agents must not treat every historical statement as simultaneously current.

## Status legend

- **Closed** — treat as current requirement.
- **Handoff resolution** — a later design direction clearly supersedes an earlier one; this package makes the supersession explicit.
- **Open** — do not hard-code a permanent architectural choice.
- **Future** — designed conceptually but outside MVP 0.1.

## Closed decisions

### Project model
Each Jano project is an autonomous folder containing user-visible original/translation folders and an internal `.jano/` metadata area.

### Stable document identity
Filename matching is useful for discovering a pair, but `document_id` becomes the durable identity after pairing.

### Portability
Persist project-relative paths. Copying a portable project folder should be enough to move it to another computer.

### Canonical original
Do not modify the original PDF to store Jano metadata.

### Structured document model
Blocks, segments, and alignments are first-class entities.

### Semantic synchronized scroll
Do not synchronize page numbers or absolute scroll percentages. Use aligned content anchors and interpolation.

### Contextual bilingual selection
The user selection remains the real selection. Jano may project a semantically corresponding span or segment in the other panel.

### Local-first
Core reading works offline.

## Handoff resolution: dual PDF vs PDF + Markdown

The first MVP definition described two selectable PDFs and a dual-PDF viewer.

Later extraction, pipeline, and UX decisions changed the preferred representation:

```text
left:  original PDF
right: clean translated Markdown/text
```

For the implementation handoff, **the later PDF + translated-text reader is authoritative**.

To preserve the original MVP workflow, Jano 0.1 may still discover paired source PDFs. The translation side can be locally normalized/extracted into a derived text/Markdown representation for display. Automatic language translation is still out of scope.

Do not rebuild the translated document's original page layout.

## Open: exact `.jano` storage

The project has not formally decided how much state is:

- SQLite;
- JSON;
- per-document sidecar files.

The domain model is defined, but the physical persistence split remains open.

For MVP work:
- put storage behind repository/interfaces;
- choose the smallest reversible implementation;
- do not expose raw database tables as public plugin/API contracts;
- document the selected temporary storage strategy in an ADR.

## Open: alignment algorithm

The required alignment behavior is clear, but the exact algorithm for external translations is not closed.

Therefore:
- define an `AlignmentEngine` interface;
- support deterministic fixtures/mock alignments early;
- keep algorithm-specific code isolated;
- do not claim semantic precision that has not been measured.

A separate design spike should choose the first production alignment algorithm.

## Open: exact toolbar placement

The UX direction is closed, but whether proportion/sync controls live at the top or bottom was left minorly open. Prefer a discreet upper toolbar unless implementation testing provides a better answer.

## Handoff assumption: technology stack

The design repeatedly favored Tauri + React/TypeScript and PDF.js but did not formally close the stack.

To unblock Codex, this package adopts:

- Tauri 2
- React
- TypeScript
- PDF.js
- Rust native layer as necessary

This is an implementation assumption, not a product invariant. Replace it only through an ADR.

## Future, not MVP

The following have conceptual designs but must not leak into 0.1 implementation scope:

- OCR
- automatic translation
- local and remote AI providers
- disciplinary translation profiles and glossaries
- Zotero
- research evidence/annotations
- plugins
- backup packages
- Word/Writer integrations
- semantic search
