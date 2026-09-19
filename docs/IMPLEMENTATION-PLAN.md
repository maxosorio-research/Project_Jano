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

## Milestone 2.5 — workspace shell and settings boundary

Goal: make projects navigable and manageable before adding the translated reader.

Deliverables:

- compact persistent project toolbar;
- return home, create another project, and open another project;
- collapsible library with keyboard shortcut;
- Obsidian-style nested library tree with reveal, collapse, and sort controls;
- safe document import into the selected logical folder;
- mirrored nested-folder creation;
- conservative remove/hide flow with restoration;
- explicit permanent deletion choices for original, translation, or both;
- locally persisted reader settings behind a repository boundary;
- visibly inactive settings for the future conditional OCR → translation pipeline;
- ADR for the future pipeline without implementing an engine or provider.

## Milestone 2.6 — Ollama diagnostic spike

Goal: validate the user's local runtime without coupling it to project documents.

Deliverables:

- `LocalTranslationRuntime` application boundary;
- fixed loopback Ollama adapter;
- runtime and installed-model detection;
- persisted model selection with migration from the initial Qwen placeholder;
- `translategemma:4b` as the hardware-tested diagnostic recommendation;
- reproducible EN→target-language academic smoke test based on the Cranmer and Desmarais (2011) test PDF;
- raw result, duration, and token-count display;
- explicit statement that document translation remains inactive.

This historical diagnostic choice was later superseded for the active document
pipeline: ADR 0012 designates `translategemma:12b` as the official translation
model and separates conservative review into its own model role.

## Milestone 3 — translated text surface

Goal: a clean right-hand reading panel.

Deliverables:

- normalize/extract selectable translated PDF text, or load supported Markdown input;
- render paragraphs as addressable segments;
- continuous reading;
- readable typography;
- segment DOM/view mapping.

Do not implement language translation.

## User-authorized extension — local processing pipeline

After the Ollama diagnostic spike, the user explicitly authorized a manual local pipeline beyond the original 0.1 scope:

- inspect native PDF text page by page;
- run bundled English OCR only on deficient pages;
- persist a transparent TXT artifact and structured segments;
- translate bounded segment batches through loopback Ollama;
- reject incomplete or malformed segment output;
- generate and render translated Markdown;
- persist generated 1:1 structural alignment by segment ID.

See ADR 0012. Automatic processing on import, remote providers, and production-grade multicolumn reconstruction remain deferred.

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
- explicit synchronized and independent scroll modes;
- link/lock control whose semantics select the scroll relationship without freezing either document;
- separate original and translation panel-lock controls;
- locked followers remain stationary and unlocking does not force an immediate jump;
- re-align command;
- persistent lower reading toolbar with document navigation, synchronization state, zoom, panel-ratio presets, and language direction;
- responsive toolbar behavior that preserves direct access to scroll mode, zoom, and the active ratio;
- icon + text + accessible state for synchronization, without relying on color alone;
- tests for mapping/interpolation independent of UI.

The lower toolbar must remain a presentation layer over the reader/session APIs. Page navigation, zoom, panel ratio, synchronization mode, and language direction should dispatch explicit reader actions rather than reading or mutating viewer DOM state directly.

## Milestone 7 — bilingual selection projection

Goal: visually connect related passages.

Deliverables:

- preserve actual browser/PDF user selection;
- identify affected segment(s);
- project aligned segment(s) on opposite side;
- visually distinguish real vs projected selection;
- whole-segment fallback.

Fine contextual span inference is optional after MVP proof.

## Milestone 7.5 — collapsible alignment inspector

Goal: make alignment quality visible without permanently reducing reading space.

Deliverables:

- right-side inspector that is closed by default and consumes no width while closed;
- one row per alignment group, including non-1:1 cardinalities;
- aligned, unmatched, and problematic states with icon + text + color;
- current visible/aligned group indication;
- click-to-navigate and whole-group highlighting in both readers;
- filters and summary counts derived from domain alignment data;
- read-only first iteration.

Manual correction, split/merge operations, and confidence approval remain a later workflow because they require versioning and durable mutation semantics.

## Storage design spike — before editable alignment

The current versioned JSON strategy remains valid for the synchronized-reader milestone. Before alignment correction, annotations, or substantially larger structured datasets, run a focused SQLite-versus-hybrid spike.

Evaluate this candidate split:

```text
.jano/project.json        bootstrap, schema version, portable folder names
.jano/state.sqlite        documents, representations, segments, alignments,
                          reading positions, revisions and future annotations
.jano/documents/...       inspectable source/translation/math artifacts
```

The spike must include:

- migration from existing `documents.json` and per-document JSON artifacts;
- relative paths only;
- atomic schema migrations and backup before migration;
- foreign-key and transaction behavior for alignment replacement;
- performance comparison on realistic papers and a roughly 20-document project;
- recovery/export strategy so a damaged index does not make original and translation files inaccessible;
- behavior inside folders synchronized by OneDrive, Dropbox, Syncthing, or similar tools;
- repository interfaces that keep SQL out of UI/domain code.

Do not store original PDFs or the only readable copy of a translation inside SQLite.

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
