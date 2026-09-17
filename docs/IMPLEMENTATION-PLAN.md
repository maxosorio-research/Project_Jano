# MVP implementation plan

This is a sequencing document, not permission to implement all phases in one task.

## Milestone 0 — repository scaffold

Goal: a reproducible empty desktop app.

Deliverables:

- Tauri 2 application;
- React + TypeScript UI;
- linting/formatting/type checking;
- frontend test runner;
- Rust tests;
- basic CI;
- one empty Jano window;
- domain/application/infrastructure folder boundaries.

No PDF functionality yet.

## Milestone 1 — project and file model

Goal: open a project and correctly discover documents.

Deliverables:

- create/open project;
- detect `*_orig`, `*_trad`, `.jano`;
- relative paths;
- stable `document_id`;
- pair discovery;
- pair-state sidebar;
- basic persistence adapter;
- tests for rename/path-independent identity logic.

Do not build advanced move/delete UX until basic discovery is stable.

## Milestone 2 — original PDF reader

Goal: a reliable source panel.

Deliverables:

- PDF.js integration;
- continuous vertical scrolling;
- zoom;
- selectable text;
- current page/position metadata;
- source segment/viewer locator experiment.

## Milestone 3 — translated text surface

Goal: a clean right-hand reading panel.

Deliverables:

- normalize/extract selectable translated PDF text, or load supported Markdown input;
- render paragraphs as addressable segments;
- continuous reading;
- readable typography;
- segment DOM/view mapping.

Do not implement language translation.

## Milestone 4 — structured segments

Goal: domain-level source and target segments.

Deliverables:

- segment IDs;
- ordering;
- source page/location metadata;
- persistence through repository interface;
- fixtures from several real academic PDFs.

## Milestone 5 — alignment design spike

Goal: choose the first real algorithm without hard-coding it into the UI.

Deliverables:

- `AlignmentEngine` interface;
- alignment fixture format;
- baseline algorithm proposal;
- benchmark cases;
- explicit ADR describing the chosen MVP algorithm.

Until then, viewer work may use fixture alignments.

## Milestone 6 — synchronized scroll

Goal: prove Jano's central interaction.

Deliverables:

- leader/follower model;
- semantic anchor lookup;
- interpolation between anchors;
- tolerance/dead zone;
- sync on/off;
- re-align command;
- tests for mapping/interpolation independent of UI.

## Milestone 7 — bilingual selection projection

Goal: visually connect related passages.

Deliverables:

- preserve actual browser/PDF user selection;
- identify affected segment(s);
- project aligned segment(s) on opposite side;
- visually distinguish real vs projected selection;
- whole-segment fallback.

Fine contextual span inference is optional after MVP proof.

## Milestone 8 — MVP hardening

Deliverables:

- test project with ~20 documents;
- missing/moved/conflict states;
- reopen persistence;
- keyboard controls;
- basic search if stability allows;
- large-document smoke tests;
- Windows x64 build;
- macOS compilation/CI check if environment supports it.

## MVP exit test

A user must be able to read an entire real paper while original and translation remain reasonably synchronized, without Internet access.
