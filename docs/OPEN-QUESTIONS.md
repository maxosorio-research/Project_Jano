# Open questions

These are not invitations for a coding agent to invent permanent answers. Each should be resolved through a focused implementation spike or ADR.

## 1. Physical `.jano` persistence format

Closed:
- conceptual entities;
- relative paths;
- stable IDs;
- portability.

Open:
- SQLite vs JSON vs mixed sidecars;
- cache policy;
- schema migration mechanism.

MVP guidance:
- choose a small reversible implementation behind repositories;
- do not make raw storage a public API.

Current assessment after the structured-reader work:

- JSON remains adequate for the present MVP and keeps artifacts inspectable;
- a hybrid layout is the leading candidate once alignments become editable or annotations add many small transactional writes;
- `project.json` can remain a portable bootstrap while `state.sqlite` owns relational/query-heavy state;
- per-document source, Markdown, math, and diagnostic artifacts can remain ordinary sidecars;
- schedule the storage spike before building alignment correction, not during synchronized-scroll implementation.

## 2. External translation alignment algorithm

Closed:
- align segments, not pages;
- support non-1:1 relationships;
- provide confidence/fallback;
- scroll consumes semantic anchors.

Open:
- first algorithm for existing translated documents;
- whether it uses lexical, sentence-embedding, dynamic-programming, or hybrid matching;
- quality thresholds.

MVP guidance:
- isolate behind `AlignmentEngine`;
- build deterministic fixtures;
- schedule a design spike before production-grade alignment.

## 3. Translation input normalization in 0.1

The first MVP assumed paired PDFs. Later reader design makes the right side Markdown/text.

Handoff resolution:
- right-side rendering is Markdown/text;
- translated PDFs may be locally extracted/normalized instead of displayed as a second PDF;
- automatic translation remains out of scope.

Still open:
- exact file extension/location of the derived Markdown cache;
- whether user-authored `.md` is accepted directly in the first public MVP.

## 4. PDF extraction library details

The goal is logical reading order and segment/source location preservation.

Open:
- exact extraction library/tool beyond PDF.js rendering;
- strategy for multi-column reading order;
- locator representation that best round-trips into the viewer.

OCR must not be pulled into 0.1 to solve difficult PDFs.

## 5. Toolbar placement

Minor open UX choice:
- discreet upper reader toolbar is the current default;
- can be adjusted after hands-on testing.

## 6. Licensing implementation

The intended early license policy is PolyForm Noncommercial 1.0.0 and separate trademark policy.

Before public distribution:
- copy the official license text from the authoritative source;
- perform dependency-license review;
- decide final trademark wording.

This package does not substitute for legal review.
