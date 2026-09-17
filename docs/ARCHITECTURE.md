# Architecture

## Architectural goal

The system should keep product concepts independent from the current viewer, persistence implementation, or future external integrations.

## High-level layers

```text
Desktop shell
  |
  +-- UI / Reader
  |
  +-- Application services
  |
  +-- Domain
  |     +-- Project
  |     +-- Document
  |     +-- Segment
  |     +-- Alignment
  |     +-- Reading position
  |
  +-- Infrastructure
        +-- filesystem
        +-- PDF parsing/rendering adapter
        +-- persistence adapter
        +-- platform adapter
```

## Implementation baseline for 0.1

```text
Tauri 2
  |
  +-- React + TypeScript
  |     +-- sidebar
  |     +-- reader layout
  |     +-- PDF viewer integration
  |     +-- Markdown/text reader
  |     +-- sync controller
  |
  +-- Rust/native commands
        +-- project filesystem operations
        +-- hashing / file identity as needed
        +-- platform-specific safe operations
```

Use PDF.js for the original PDF renderer/text layer unless a concrete blocker appears.

## Domain pipeline

```text
Project folders
  -> file discovery
  -> document identity / pairing
  -> source extraction
  -> text blocks
  -> segments
  -> alignment
  -> reader view models
  -> synchronized scroll
```

## Separation rules

### UI does not own persistence
React components should call application/domain services, not write `.jano` state directly.

### Filesystem is behind an adapter
Persist relative project paths. Platform-specific behavior belongs in adapters.

### PDF rendering is an adapter
Domain objects should not depend on PDF.js types.

### Alignment is an interface
The exact alignment algorithm is open. Use an interface such as:

```ts
interface AlignmentEngine {
  align(source: Segment[], target: Segment[]): Promise<AlignmentSet>;
}
```

Do not couple scrolling or selection to one particular alignment implementation.

### Scroll controller consumes alignments
The scroll synchronizer should operate over abstract anchor positions, not PDF page equivalence.

### Selection projection consumes alignments
Selection projection should be able to fall back:

```text
precise span -> clause/sentence -> full aligned segment
```

For MVP, full aligned segment fallback is sufficient.

## Source extraction

The extraction goal is **logical reading order**, not reconstruction of page layout.

For multi-column PDFs, the future extractor must linearize reading order.

The structured representation should preserve:

- page/source reference;
- block type;
- segment text;
- ordering;
- enough location information to map back to the original viewer.

Do not use plain `.txt` as the only internal representation.

## Translation representation

The right panel is a reading representation, not a visual clone of the published document.

Preferred visible representation:

```text
original: PDF
translation: Markdown/text
```

Tables/figures should eventually appear as references back to the original rather than being reconstructed.

## Project portability

A portable project is self-contained:

```text
Project/
  Project_orig/
  Project_trad/
  .jano/
```

Persist paths relative to `Project/`.

Do not embed Jano metadata into the original PDF.

## Platform strategy

Design cross-platform from the beginning.

MVP reference:

- Windows 10/11
- x86_64

Architecture should avoid Windows-only path or UI assumptions so macOS can be supported without rewriting domain logic.

## Future architecture boundaries

Future systems should attach through interfaces rather than invade the reader core:

- translation providers;
- local model runtimes;
- annotation/evidence system;
- Zotero;
- plugins;
- exporters.

Do not build these interfaces prematurely unless needed to keep the MVP modular.
