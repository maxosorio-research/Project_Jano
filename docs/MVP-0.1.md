# Jano 0.1 — MVP specification

## Objective

Jano 0.1 tests one hypothesis:

> Is it comfortable to read an original and its translation as one synchronized bilingual document?

If that experience is not useful, later AI, Zotero, plugin, and annotation systems are irrelevant.

## Required user flow

1. The user opens or creates a Jano project.
2. Jano reads the project's original and translation folders.
3. Jano discovers document pairs primarily by compatible base name / project-relative location.
4. Jano shows documents and pair state in one logical sidebar.
5. The user opens a paired document.
6. The original appears on the left.
7. The translated reading representation appears on the right.
8. The user can resize/change the panel ratio.
9. The user can scroll either panel.
10. With synchronization enabled, the other panel follows the corresponding semantic position.
11. Selecting text in one side can visibly indicate the aligned segment/counterpart on the other side.
12. The user can disable synchronization and scroll independently.
13. A persistent lower reading toolbar exposes the current scroll mode together with the principal reading controls.

## Input scope

### Original
MVP original input:

- PDF
- selectable/extractable text
- no OCR requirement

### Translation
The implementation handoff uses the newer reading model:

- translated content is rendered as clean Markdown/text;
- it is not visually reconstructed as a translated PDF.

For compatibility with the original workflow, the initial importer may accept a paired translated PDF with selectable text and derive a local normalized text representation. It may also accept a pre-existing Markdown translation if doing so does not expand the implementation materially.

**Do not implement automatic language translation in 0.1.**

## Pair discovery

Initial discovery may use names and relative paths.

After a pair is established, persist a stable `document_id`.

Minimum visible pair states:

- complete pair;
- missing translation;
- missing original;
- moved/unavailable file;
- manually linked / differing names;
- conflict.

Do not rely on color alone.

## Reader

### Original panel
Must provide:

- continuous vertical PDF reading;
- zoom;
- selectable/copyable text;
- page information as secondary metadata;
- search if practical within MVP sequencing.

### Translation panel
Must provide:

- continuous vertical reading;
- clean readable typography;
- paragraphs/segments identifiable in the DOM/view model;
- selectable/copyable text.

### Layout
Required presets:

- 50/50
- 70/30
- 30/70
- 100/0
- 0/100

Manual resizing is desirable and part of the intended UI.

### Lower reading toolbar

The reading area has a compact toolbar docked to its lower edge. It should follow this grouping:

```text
document navigation | scroll link/state | zoom | panel ratio | language direction
```

It must not cover the final lines of either document. Controls may collapse into compact menus at narrow widths, but synchronization state and the active panel ratio must remain visible.

## Segments

MVP alignment unit is a paragraph or text block/segment.

Do not implement word-by-word pre-alignment.

Each segment must have a stable identifier within the processed document representation and enough source location metadata to reconnect it to the original PDF.

## Synchronized scroll

The synchronization contract is:

- no page-number synchronization;
- no absolute percentage synchronization;
- use aligned semantic anchors;
- whichever panel the user scrolls becomes the temporary leader;
- the other panel becomes the follower;
- place corresponding content at approximately the same viewport zone;
- interpolate between nearby reliable anchors;
- tolerate small offsets instead of constantly correcting them;
- provide an explicit linked/synchronized mode and an independent mode;
- treat the link/lock control as a scroll-mode selector, not as a command that freezes a document;
- allow either panel to keep and change its own position while independent mode is active;
- expose independent per-panel lock controls separately from the synchronized/independent mode choice;
- never move a locked follower until it is unlocked;
- provide a re-align command.

See `adr/0005-semantic-scroll.md`.

## Selection

For MVP, selection has two layers:

1. normal user text selection;
2. visual counterpart indication in the other panel.

A projected counterpart is not the user's real selection.

The MVP may fall back to whole-segment counterpart highlighting. Fine contextual span alignment is a later precision improvement.

## Project persistence required in MVP

Persist at minimum:

- project identity/config needed to reopen;
- document identities;
- relative paths;
- pair relationship;
- derived segment representation needed for reading;
- alignment data or references to it;
- last reading position if inexpensive.

Exact SQLite/JSON allocation is intentionally open.

## Explicitly out of scope

Do not implement:

- OCR
- automatic translation
- API keys
- local LLM integration
- remote AI providers
- Zotero
- persistent annotations
- notes
- persistent highlights
- project glossaries
- DOCX
- EPUB
- HTML
- cloud accounts
- Jano-hosted sync
- plugin runtime
- semantic search
- word-by-word alignment
- translation editor

## Definition of done

Jano 0.1 is successful when all of the following are true:

1. A project containing roughly 20 papers can be opened.
2. Pair state is correctly visible.
3. A paired paper can be opened reliably.
4. The original and translated reading representation are usable side by side.
5. Text remains selectable.
6. The user can read through a complete real paper while both panels remain reasonably aligned.
7. Synchronization works in both directions.
8. The user can disable and re-enable synchronization without losing control of either panel.
9. Reopening the project preserves document identity and does not depend on absolute machine-specific paths.
10. No Internet connection is required for the core flow.
