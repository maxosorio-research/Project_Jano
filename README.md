# Jano

Jano is a local-first bilingual academic reader designed to let a reader use an original scholarly document and its working translation as one synchronized reading surface.

The canonical source remains the original document. Translations, alignments, reading state, annotations, and future integrations are derived or auxiliary layers.

## Current target

The immediate target is **Jano 0.1 / MVP**. It tests one product hypothesis:

> Can an original and its translation be read comfortably as one synchronized bilingual document?

The MVP is intentionally narrower than the long-term vision. Do not implement roadmap features merely because they are documented.

## Read order for contributors and coding agents

1. `AGENTS.md`
2. `docs/DECISION-STATUS.md`
3. `docs/PRODUCT.md`
4. `docs/MVP-0.1.md`
5. `docs/ARCHITECTURE.md`
6. `docs/DATA-MODEL.md`
7. `docs/UX.md`
8. `docs/OPEN-QUESTIONS.md`
9. `docs/IMPLEMENTATION-PLAN.md`

Long-term concepts are in `docs/ROADMAP.md`. Architecture decisions already made are recorded under `docs/adr/`.

## Core principles

- Local-first.
- Original document is canonical.
- User files remain ordinary files.
- Project metadata is portable.
- Synchronize semantic position, not page numbers.
- Segments and alignments are first-class concepts.
- The MVP must remain small.
