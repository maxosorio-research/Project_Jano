# ADR 0012 — Local document processing pipeline

Status: Accepted and implemented as an initial slice

## Context

ADR 0010 defined conditional OCR and translation as a deferred direction. After validating Ollama locally, the user explicitly requested activation of the end-to-end flow: native text extraction or OCR, a transparent TXT artifact, structured segments, local translation, and translated Markdown rendering.

The original PDF remains canonical. Generated text and translations are derived data and must never modify it.

## Decision

Jano implements a user-initiated local pipeline:

1. PDF.js extracts the native text layer page by page. Native text items retain their page coordinates long enough for a deterministic recursive whitespace analysis to identify horizontal regions, columns, and spanning blocks before producing logical reading order.
2. A deterministic quality check chooses usable native text.
3. Pages with absent or deficient text use bundled Tesseract.js OCR when the `when-needed` policy is enabled.
4. The normalized text is segmented before translation and receives stable per-run segment IDs. Equation lines, figure captions, table captions, raster images, and sufficiently complex vector drawings receive conservative structural markers.
5. Mathematical content, numeric values, dates, percentages, URLs, DOI references, and email addresses are replaced with indivisible protected tokens before model calls. Exact source values are restored only after translation and review. Explicit LaTeX is restored for KaTeX; uncertain PDF-extracted notation is shown literally instead of being guessed.
6. Segments are sent to the fixed loopback Ollama runtime in bounded contextual batches. Translation and conservative post-translation review use independently configurable installed models. `translategemma:12b` is the official translation model; `qwen2.5:7b-instruct` is the default reviewer.
7. Ollama must return structured JSON containing every original segment ID. Mathematical tokens remain mandatory. If the translation model loses a protected numeric value or reference after bounded recovery, Jano preserves a visible verification warning containing only the missing source values instead of discarding the complete document.
8. The project stores `source.txt`, `segments.json`, `translation.json`, `alignment.json`, `math.json`, and `processing.json` under `.jano/documents/<document_id>/`.
9. The readable output is written as `<source-stem>.<target-language>.md` under the mirrored translation folder and rendered without raw HTML. It includes a visible `------------[Página N° <n>]------------` marker at the start of every source page. Figures, charts, and tables are represented as page-linked notices rather than unreliable layout reconstructions.
10. Pipeline failures are classified by stage. Recoverable model-output and server failures use at most five retries per batch or recovered fragment after the initial attempt. Invalid multi-segment output is divided into smaller batches; transient server failures retry the same batch with bounded backoff. Cleanup failures never replace the original processing error. Permanent failures such as an invalid PDF, an unavailable configured model, or a denied filesystem write are reported immediately.
11. The application-level processing coordinator owns active jobs by project and document identity. Changing the selected document does not cancel or detach a running job. Completion refreshes the project snapshot and its library indicator without changing the user's current document selection; job progress and failures remain session-local UI state.

OCR assets and the English trained-data file are bundled with the desktop frontend. No OCR or document content is fetched from a CDN. Translation uses only `http://127.0.0.1:11434`.

## Consequences

- Digital PDFs avoid OCR when their native text is usable.
- Scanned or deficient pages can be processed offline after the app and Ollama model are installed.
- Generated translations have deterministic structural alignment by segment ID.
- Existing single-model preferences migrate by role: translation moves to the official TranslateGemma 12B model, while another legacy model can remain the review model.
- Missing numeric or reference tokens remain visible for manual verification; Jano does not silently invent or omit them.
- Failures do not modify the original PDF and incomplete translations are not saved.
- A malformed equation cannot crash the whole reading surface: rendering falls back to faithful literal text.
- Graphic detection is deliberately conservative. Jano points readers to the canonical PDF page and does not infer chart geometry or values from extracted labels.
- The initial OCR language is English, matching the current EN-to-target workflow.
- Reading-order reconstruction is coordinate-aware and supports mixed column/full-width regions through recursive whitespace partitioning. It remains heuristic for irregular overlaps, rotated text, and highly graphical layouts and therefore requires a growing regression corpus.
- A document can continue processing while the reader inspects another document. The library communicates running, completed, and failed states without redirecting the reader.
- Cancellation, resumable batches, richer block classification, and additional OCR languages remain follow-up work.
