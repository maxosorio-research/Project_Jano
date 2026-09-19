# Data model

This document defines the conceptual model. It does **not** decide the final SQLite-vs-JSON persistence split.

## Project

```ts
type Project = {
  projectId: string;
  name: string;
  root: string; // runtime only; do not persist as canonical absolute identity
  schemaVersion: number;
};
```

A project contains user folders plus `.jano/`.

Example:

```text
Tesis/
  Tesis_orig/
  Tesis_trad/
  .jano/
```

## Document

`document_id` is the durable Jano identity.

```ts
type Document = {
  documentId: string;
  original: DocumentFileRef | null;
  translation: DocumentFileRef | null;
  hidden?: boolean; // library visibility only; never means file deletion
  sourceLanguage?: string;
  targetLanguage?: string;
};
```

Filename matching discovers relationships; it must not remain the permanent identity after pairing.

Milestone 2.5 persists `hidden` in the document catalog so “Remove from Jano” remains reversible and does not cause the same ordinary files to be rediscovered as a new document. Restoring clears the flag and preserves `documentId`.

Logical project folders are the union of relative directories found beneath the original and translation roots. Creating a folder through Jano creates the same relative path on both sides.

## File reference

```ts
type DocumentFileRef = {
  relativePath: string;
  sha256?: string;
  size?: number;
  modifiedAt?: string;
  mediaType?: string;
};
```

Rules:

- persist project-relative paths;
- use hashes to identify a concrete file version, not the conceptual document;
- do not store original PDF modifications for Jano metadata.

## Block and segment

The internal representation must preserve logical reading order.

```ts
type Segment = {
  segmentId: string;
  documentId: string;
  side: "source" | "translation";
  ordinal: number;
  page?: number;
  blockType:
    | "title"
    | "heading"
    | "paragraph"
    | "quote"
    | "footnote"
    | "list"
    | "figure-marker"
    | "table-marker"
    | "equation-marker"
    | "other";
  text: string;
  sourceLocator?: SourceLocator;
};
```

Example locator:

```ts
type SourceLocator = {
  page?: number;
  textStart?: number;
  textEnd?: number;
  viewportHint?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
};
```

The exact locator representation depends on PDF extraction/viewer behavior and may change.

### Milestone 2 viewer-locator experiment

The original PDF reader currently reports a runtime-only locator:

```ts
type SourceViewerLocator = {
  pageNumber: number;
  pageOffset: number; // clamped 0..1 within the visible page
};
```

This is intentionally not persisted and is not an alignment or synchronized-scroll unit. It exists to validate page/view round-tripping while the segment locator remains an open design question. Semantic synchronization must continue to use segment anchors rather than this percentage.

## Alignment

Alignments point to segments, not files or matching page numbers.

```ts
type Alignment = {
  alignmentId: string;
  sourceSegmentIds: string[];
  targetSegmentIds: string[];
  type: "1:1" | "1:n" | "n:1" | "n:m";
  confidence?: number;
  method?: string;
};
```

Example:

```json
{
  "alignmentId": "al_03822",
  "sourceSegmentIds": ["seg_en_148"],
  "targetSegmentIds": ["seg_es_151", "seg_es_152"],
  "type": "1:n",
  "confidence": 0.97
}
```

Do not assume all translations preserve paragraph boundaries.

## Optional contextual spans

Fine selection alignment is future-capable but not required for initial MVP.

```ts
type ContextSpanAlignment = {
  alignmentId: string;
  source: {
    segmentId: string;
    start: number;
    end: number;
  };
  target: {
    segmentId: string;
    start: number;
    end: number;
  };
  confidence?: number;
};
```

These can be computed on demand later rather than precomputed for every word.

## Reading position

Prefer semantic location over page-only state.

```ts
type ReadingPosition = {
  documentId: string;
  activeSide: "source" | "translation";
  segmentId?: string;
  page?: number;
  viewportOffset?: number;
  updatedAt: string;
};
```

Priority:

```text
segment -> page -> approximate viewport position
```

## Project file states

Suggested domain states:

```ts
type PairState =
  | "paired"
  | "missing-original"
  | "missing-translation"
  | "unavailable"
  | "manually-linked"
  | "conflict";
```

UI should present icon + text, not color alone.

## `.jano` conceptual contents

The final physical layout is open, but conceptually `.jano` owns:

```text
project configuration
document identities
relative file references
hashes
segments
alignments
reading positions
future annotations
future external integration keys
future translation metadata
```

It must **not** become the only place where the user's original/translation files exist.

## Persistence boundary

Create repository abstractions, for example:

```ts
interface ProjectRepository {
  load(root: string): Promise<Project>;
  save(project: Project): Promise<void>;
}

interface DocumentRepository {
  list(projectId: string): Promise<Document[]>;
  get(documentId: string): Promise<Document | null>;
  save(document: Document): Promise<void>;
}

interface SegmentRepository {
  list(documentId: string, side: "source" | "translation"): Promise<Segment[]>;
  replace(documentId: string, side: "source" | "translation", segments: Segment[]): Promise<void>;
}
```

The implementation may start with JSON or SQLite, but application/domain code must not depend on raw storage details.
