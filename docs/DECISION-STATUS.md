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

## Open: final `.jano` storage

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

Milestone 1 adopts versioned `project.json` and `documents.json` files as the temporary strategy. See `adr/0009-versioned-json-persistence.md`. The final storage split remains open.

## Open: alignment algorithm

The required alignment behavior is clear, but the exact algorithm for external translations is not closed.

Therefore:
- define an `AlignmentEngine` interface;
- support deterministic fixtures/mock alignments early;
- keep algorithm-specific code isolated;
- do not claim semantic precision that has not been measured.

A separate design spike should choose the first production alignment algorithm.

## Closed: workspace and reader toolbar placement

Milestone 2.5 adopts a compact persistent upper toolbar for project navigation, sidebar visibility, mirrored-folder creation, refresh, and settings.

Reader-specific controls use a separate persistent toolbar docked to the bottom of the reading area. It groups original-document navigation, synchronized/independent scroll state, zoom, panel-ratio presets, and language direction. The toolbar must reserve layout space rather than obscure document content.

The scroll-link control has two explicit modes:

- **Synchronized** — the panel manipulated by the user becomes the temporary leader and the other panel follows semantic anchors.
- **Independent** — each panel keeps its own position and user scrolling affects only that panel.

The lock/link control selects the interaction mode; it does not freeze either document or disable scrolling.

Freezing a viewer is a separate per-panel action. The original and translation may each be locked independently without changing whether the session's scroll mode is synchronized or independent. A locked follower is not moved by synchronization; unlocking it preserves its current position until a deliberate re-alignment or subsequent synchronization action.

## Future: collapsible alignment inspector

The reader may later add a collapsible column on the right for inspecting alignment groups, unmatched segments, and correspondence problems. It consumes the same `Alignment` model as scrolling and selection, but it is not part of the scroll controller. Its first iteration should be read-only navigation; manual correction requires a separate workflow and persistence decision.

## Implemented initial slice: synchronized structured reader

Processed documents can now load their persisted source segments, translations, and generated alignments into one reader session. The translated surface renders addressable segments, and the original PDF exposes page-local semantic anchors derived from segment order and text weight. A pure mapping layer handles alignment intervals, bidirectional interpolation, viewport focus placement, and a dead zone. The reader exposes synchronized/independent modes, explicit re-alignment, independent per-panel locks, panel ratios, PDF navigation, and zoom through the lower toolbar.

This is the generated-translation vertical slice, not the final alignment solution. Precise PDF text-item/rectangle locators, external translation alignment, persisted reading position, and contextual span projection remain follow-up work.

Whole-segment bilingual selection projection is now connected to the same
alignment groups. Selected text uses Jano amber; the projected counterpart uses
a quieter amber field with an edge marker so it remains distinguishable from
the user's real browser selection. Precise contextual spans still remain future
work.

## Implemented initial slice: conditional OCR and local translation

At the user's explicit request, Jano now implements a manual local processing flow. It first inspects native PDF text and uses bundled English OCR only when text is absent or deficient. It then normalizes, segments, translates through loopback Ollama while preserving segment IDs, persists transparent artifacts, and renders generated Markdown. See `adr/0010-conditional-ocr-translation-pipeline.md` and `adr/0012-local-document-processing-pipeline.md`.

## Local runtime: Ollama

Milestone 2.6 detected the loopback Ollama runtime, listed installed models, tested `translategemma:4b` on the observed machine, and ran a fixed translation smoke test. The user subsequently authorized the manual document pipeline and designated `translategemma:12b` as Jano's official translation model. Conservative review remains a separate configurable role, defaulting to `qwen2.5:7b-instruct`. No remote endpoint is used. See ADRs 0011 and 0012.

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
