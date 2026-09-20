# ADR 0015: Experimental hierarchical resegmentation

- Status: Experimental
- Date: 2026-09-20

## Context

Jano 0.1 aligns generated translations by stable extraction-segment IDs. This
is reliable but often leaves an entire extracted paragraph as the smallest
selectable and synchronized unit. Word-level alignment would suggest precision
that has not been measured and would be fragile across paraphrase and reordered
syntax.

The experiment must be usable on documents already processed by Jano without
silently rewriting artifacts or requiring a new translation.

## Decision

Add a temporary reader action beside **Regenerar traducción**. For the open
document it derives an in-memory hierarchy:

- persisted paragraph/footnote segment as parent;
- sentence or short sentence-group units as children;
- contiguous alignment groups derived inside each existing parent alignment.

Sentence boundaries use `Intl.Segmenter`. Short sentences are joined to avoid
noisy micro-segments, with a target range of 90–360 characters. Headings,
equation markers, figure markers, and table markers remain whole.

If source and target produce different child counts, both sides are partitioned
by relative cumulative character length into monotonic `1:1`, `1:n`, `n:1`, or
`n:m` groups. These matches receive deliberately reduced confidence because
length is a structural heuristic, not semantic proof.

The experiment never writes project files, changes the catalog, or calls the
translation model. The same control restores the persisted reader document.

## Consequences

- Existing processed documents can be evaluated immediately and reversibly.
- Selection and scrolling can operate at smaller units while preserving every
  character and the original parent boundary.
- PDF-side positions are still approximate because anchors are inferred from
  page order and text weight rather than exact text rectangles.
- In-memory review metadata is inherited by children, but reviewed/base text is
  not split because its sentence correspondence is not guaranteed.

## Rollout gate

Do not expose recursive persistence until F22 passes the complete manual
walkthrough, followed by F12's OCR case and H6's warning case. A later ADR must
define an idempotent, versioned migration with backup/rollback, per-document
results, and compatibility with the planned hybrid SQLite/file storage. The
first persistent migration should reuse existing translations where safe and
reserve model reprocessing for explicitly flagged low-confidence groups.
