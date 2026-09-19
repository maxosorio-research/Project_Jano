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

The current custom icon coverage and the remaining drawing backlog are tracked in `docs/ICON-INVENTORY.md`.

Long-term concepts are in `docs/ROADMAP.md`. Architecture decisions already made are recorded under `docs/adr/`.

## Development status

The current implementation combines the workspace shell, local processing pipeline, and an initial synchronized-reader vertical slice:

- Tauri 2 desktop shell;
- React and TypeScript frontend;
- explicit `domain`, `application`, `infrastructure`, and `ui` boundaries;
- formatting, linting, type checking, frontend tests, and Rust tests;
- create and open portable project folders;
- discover original PDF and translated PDF/Markdown/text files;
- persist stable document identity and project-relative file references;
- show complete, missing, moved, renamed, and conflict pair states;
- render original PDFs locally with PDF.js and an isolated web worker;
- provide continuous vertical reading, selectable text, and 50%–250% zoom;
- report the current page and a provisional within-page viewer position;
- lazily render distant pages and bundle PDF.js fonts, CMaps, color profiles, and WASM resources for offline use;
- provide a compact upper toolbar, return/new/open project navigation, and a collapsible library;
- load structured segments, translations, and generated alignment records into the reader session;
- render generated translations as individually addressable Markdown segments;
- synchronize both reading surfaces bidirectionally through aligned semantic anchors and interpolation;
- switch explicitly between synchronized and independent scrolling;
- lock the original or translation panel independently of the selected scroll mode;
- provide a persistent lower reading toolbar with PDF navigation, zoom, panel ratios, synchronization, re-alignment, locks, and language direction;
- use the bundled Jano SVG icon language for document states and the principal library, reader, and translation actions;
- create nested folders as matching paths in both `_orig` and `_trad`;
- hide documents without touching their files and restore them from Settings;
- expose separate, explicit permanent deletion actions for each counterpart;
- persist reader preferences locally through a settings repository;
- document and preview the future conditional OCR → translation flow without activating processing;
- detect a local Ollama runtime and list its installed models;
- recommend the local `translategemma:4b` model and run a reproducible academic translation smoke test based on the Cranmer and Desmarais (2011) test PDF, without modifying project documents;
- GitHub Actions CI on Windows.

The translated reading surface now supports a manual local pipeline: PDF.js native extraction, conditional bundled English OCR, TXT and structured artifacts, ID-preserving Ollama translation, generated Markdown, and safe Markdown rendering. Generated translations use deterministic 1:1 alignment. Source anchors currently estimate within-page segment positions from stored reading order and text weight; precise PDF text-item/rectangle locators remain follow-up work. External-translation alignment, contextual span alignment, additional OCR languages, automatic processing on import, Zotero, and plugin behavior are not implemented yet.

The project library is an expandable folder tree with compact file rows, sorting, reveal-current and collapse-all actions. Use **Ctrl/Cmd+N** to import an original PDF (plus an optional translation), **Ctrl/Cmd+Shift+N** to create a mirrored folder, arrow keys to navigate the tree, and Enter to submit naming dialogs.

The home view keeps the portable-project creation card and remembers up to eight recently opened project folders. To process a document, select an original without a translation and choose **Extract and translate** in the Translation panel. Ollama must be running with the selected model installed.

To try Milestone 2.6, install `translategemma:4b` in Ollama, run `pnpm tauri dev`, open **Ajustes → Ollama local**, and execute the fixed sample. The former `qwen2.5:0.5b` diagnostic preference is migrated automatically. For reader testing, create or open a project, place a text-selectable PDF in its `_orig` folder, choose **Refresh**, and select the document in the library.

## Prerequisites

- Node.js 24
- pnpm 11.19
- Rust stable with `cargo`, `rustfmt`, and `clippy`
- the platform prerequisites listed in the Tauri 2 documentation

## Commands

```text
pnpm install
pnpm dev
pnpm check:frontend
pnpm tauri dev
pnpm build:desktop
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

Use `pnpm build:desktop` for a standalone executable. A plain `cargo build` omits Tauri's production protocol and creates an executable that expects the Vite development server at `127.0.0.1`.

## Core principles

- Local-first.
- Original document is canonical.
- User files remain ordinary files.
- Project metadata is portable.
- Synchronize semantic position, not page numbers.
- Segments and alignments are first-class concepts.
- The MVP must remain small.
