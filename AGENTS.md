# Jano agent instructions

These instructions apply to the whole repository.

## Before changing code

Read, in this order:

1. `docs/DECISION-STATUS.md`
2. `docs/MVP-0.1.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DATA-MODEL.md`
5. `docs/UX.md`
6. `docs/OPEN-QUESTIONS.md`

When a change affects an architectural decision, also read the relevant file under `docs/adr/`.

## Scope discipline

Jano 0.1 is the only implementation target unless the user explicitly requests otherwise.

Do **not** implement the following in 0.1:

- OCR
- automatic translation
- remote AI APIs or API-key management
- local LLM runtimes
- Zotero integration
- persistent research annotations or notes
- plugins
- semantic search
- cloud accounts or Jano-hosted sync
- DOCX/EPUB/HTML support
- word-by-word bilingual alignment
- translation editing
- marketplace infrastructure

Roadmap documentation describes future architecture, not current implementation scope.

## Product invariants

Do not violate these without a new ADR approved by the user:

- The original document is the canonical source.
- Jano must not modify the original PDF to store Jano metadata.
- A project must remain understandable as ordinary folders and files.
- Internal project paths are relative to the project root.
- Stable `document_id` values preserve identity after rename/move.
- Document structure is modeled through blocks/segments/alignment, not page-to-page equivalence.
- Synchronized scrolling follows semantic anchors, not page numbers or absolute scroll percentages.
- User selection and Jano-projected counterpart are distinct states.
- Core reading functionality must work without Internet access.

## Implementation baseline

The historical design notes did not formally close the exact technology stack. To unblock the MVP, use this baseline unless there is a concrete implementation blocker:

- Desktop shell: Tauri 2
- UI: React + TypeScript
- Native/core commands: Rust where needed
- Original PDF rendering/text layer: PDF.js
- Translation surface: Markdown/text renderer
- MVP reference platform: Windows x64
- Keep platform abstractions compatible with macOS from the beginning

Changing this baseline requires a short ADR explaining the reason.

## Engineering rules

- Prefer small modules with explicit interfaces.
- Keep filesystem/native access behind adapters.
- Keep viewer state separate from domain entities.
- Do not let UI components write project storage directly.
- Keep the alignment implementation behind an interface; the final alignment algorithm is an open decision.
- Avoid absolute OS paths in persisted project state.
- Treat destructive filesystem operations conservatively.
- Add tests for domain logic before UI polish.

## Completion checklist for every task

Before declaring a task complete:

1. Confirm it does not expand beyond MVP scope.
2. Add/update tests for new domain behavior.
3. Run formatting, linting, type checking, frontend tests, and Rust tests available in the repository.
4. Update documentation when behavior changes.
5. If the change introduces a new architectural commitment, add an ADR.
6. State any unresolved assumptions instead of silently deciding them.
