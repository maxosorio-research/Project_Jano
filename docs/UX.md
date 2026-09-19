# UX specification

## Visual direction

Jano should feel like a quiet desktop academic tool.

Reference characteristics:

- system sans-serif UI;
- restrained macOS-like desktop hierarchy without copying Apple-specific UI;
- compact desktop density;
- subtle separators;
- moderate rounded corners;
- minimal shadows;
- progressive disclosure;
- text/content as the visual priority.

Avoid a "cyberpunk academic" aesthetic.

## Color use

Most of the interface should be neutral dark surfaces and soft text.

Use:

- teal: selected item, active controls, focus;
- amber: alignment/link relationship;
- muted red: errors or missing files;
- soft gray/white for main text.

Do not rely on color as the only status indicator.

Default theme: `Jano Dark`.

## Main layout

```text
+---------------------------------------------------------------+
| Jano — Project                         Search   Settings   ... |
+------------------+----------------------+---------------------+
| PROJECT          | ORIGINAL             | TRANSLATION         |
|                  | PDF                  | Markdown/text        |
| folders/docs     | continuous scroll    | continuous scroll   |
|                  |                      |                     |
+------------------+----------------------+---------------------+
| page | scroll link | zoom | ratio | language direction        |
+---------------------------------------------------------------+
```

The project/workspace toolbar remains at the top. The reader toolbar is a separate control surface docked to the bottom of the reading area.

## Sidebar

Show one logical document hierarchy, not two duplicated folder trees.

Support:

```text
Project
  -> folder
     -> subfolder
        -> document
```

A document row shows pair state.

When local processing is active, the same status position temporarily shows a processing indicator. The task continues when the user opens another document. On completion, only the document's persisted pair-state indicator changes to the completed color/state; Jano must not navigate back to the processed document. A failure remains attached to that document and is exposed through the indicator tooltip and its translation panel when reopened.

Examples:

```text
✓ North 1990
! Olson 1965 — missing translation
↗ Smith 2020 — file unavailable
≠ Acemoglu — manually linked names
```

## Reader proportions

Support:

- 50/50
- 70/30
- 30/70
- 100/0
- 0/100

Manual resizing should be supported when practical.

## Continuous reading

Both panels use vertical continuous reading.

Do not use horizontal page-by-page navigation as the core reading model.

Page numbers remain useful metadata in the original panel, but they are not the synchronization unit.

## Translation typography

The translation surface is optimized for reading, not publication layout reproduction.

Target characteristics:

- comfortable margins;
- approximately 65–85 characters per line where feasible;
- line height around 1.5 as a starting point;
- visible paragraph spacing;
- configurable text alignment;
- configurable reading font.

Left alignment should be a safe default. Justification can be optional.

## Search

Reader search should eventually support:

```text
[Both] [Original] [Translation]
```

Use conventional next/previous behavior such as Enter / Shift+Enter.

Search in MVP is lower priority than stable synchronized reading.

## Alignment indication

Alignment UI should remain contextual and unobtrusive.

When a translation segment is interacted with:

- identify the related source segment(s);
- visually project the relationship in the other panel;
- do not permanently occupy a large alignment sidebar.

Advanced details such as:

```text
type: 1 -> 2
confidence: high
```

can remain hidden from normal users.

## Selection

Distinguish visually:

```text
user selection           = direct/solid treatment
projected counterpart    = secondary/subtle treatment
```

Never imply that a projected span is a literal word-for-word translation.

If precision is low, highlight the broader aligned segment.

## Synchronization control

Provide a simple link/lock control with two explicit modes:

```text
linked       = synchronized semantic scrolling
unlinked     = independent panel scrolling
```

The control locks the chosen relationship between the viewers; it does not freeze either viewer. Avoid labels such as merely `locked` and `unlocked`, which can imply that scrolling itself is disabled.

Behavior:

```text
scroll source      -> source leads, translation follows
scroll translation -> translation leads, source follows
```

In independent mode, scrolling or navigating one panel must not reposition the other. Re-enabling synchronized mode does not immediately cause a disruptive jump; the user can invoke `Re-align viewers`, or the next deliberate scroll can establish the current panel as leader.

The active state must be communicated with icon + text, for example:

```text
🔗 Sincronización activa
⛓ Desplazamiento independiente
```

Do not rely on the amber/teal color treatment alone. The control should expose its state through an accessible pressed/state attribute and a tooltip explaining the behavior.

Provide a `Re-align viewers` command.

Suggested shortcut:

- Windows/Linux: `Ctrl+Shift+L`
- macOS: `Cmd+Shift+L`

## Lower reading toolbar

Use a compact persistent toolbar docked to the lower edge of the reader, visually following the supplied reference without reproducing it literally.

Recommended left-to-right grouping:

```text
[reader/outline]
[previous] [current page / total] [next]
[link icon] [synchronization state] [information]
[lock original] [lock translation]
[zoom out] [zoom value] [zoom in]
[50/50] [70/30] [30/70] [100/0] [0/100]
[swap/direction] [EN -> ES]
```

Behavioral rules:

- page navigation addresses the original PDF; in synchronized mode the translation follows the resulting semantic anchor;
- in independent mode, original page navigation does not move the translation;
- the central link control toggles synchronized and independent scrolling;
- original and translation lock buttons are separate controls and do not change that central mode;
- a locked panel preserves its current viewport, ignores direct scrolling, and cannot be moved as a synchronization follower;
- unlocking a panel does not jump immediately; `Re-align viewers` explicitly restores correspondence;
- the information control briefly explains semantic synchronization and the current fallback precision;
- zoom controls apply to the active reader surface unless a future explicit shared-zoom mode is introduced;
- ratio presets reuse the required reader proportions and clearly indicate the active value;
- language direction is informational in MVP unless both reading directions are actually supported;
- the toolbar reserves its own height and never overlays selectable document text;
- separators group functions but do not become the only means of understanding them;
- at narrow widths, lower-priority ratio presets and direction details may move into an overflow menu, while scroll mode, zoom, and the active ratio remain directly available.

The application status bar may remain beneath the reader toolbar, but project paths and diagnostic text must not compete visually with reading controls.

## Future alignment inspector

A later reader milestone may add a collapsible inspector column on the right. Closed, it occupies no reading width. Open, it provides a compact overview of the document's alignment topology rather than a third reading surface.

Suggested content:

```text
Alignment
  source summary | relation marker | translation summary
  aligned
  unmatched
  correspondence problem

Totals
  aligned segments
  unmatched segments
  problems requiring review
```

Interaction rules:

- selecting a row highlights the complete alignment group in both readers;
- activating a row navigates both readers to that group;
- the current visible group remains indicated while scrolling;
- `1:n`, `n:1`, and `n:m` groups appear as one relationship row rather than misleading parallel 1:1 rows;
- status uses icon/shape + text in addition to color;
- filtering may show all, unmatched, or problematic relationships;
- the initial inspector is read-only; splitting, merging, accepting, or correcting alignments belongs to a later explicit editing workflow;
- summary counts come from the alignment model and must not be inferred from rendered DOM nodes.

## Suggested shortcuts

| Action | Windows/Linux | macOS |
|---|---|---|
| Search | Ctrl+F | Cmd+F |
| Copy | Ctrl+C | Cmd+C |
| Select all | Ctrl+A | Cmd+A |
| Open project | Ctrl+O | Cmd+O |
| Import document | Ctrl+N | Cmd+N |
| Create folder | Ctrl+Shift+N | Cmd+Shift+N |
| Settings | Ctrl+, | Cmd+, |
| Toggle sidebar | Ctrl+B | Cmd+B |
| Toggle synchronization | Ctrl+Shift+S | Cmd+Shift+S |
| Re-align viewers | Ctrl+Shift+L | Cmd+Shift+L |
| 50/50 | Ctrl+1 | Cmd+1 |
| Original dominant | Ctrl+2 | Cmd+2 |
| Translation dominant | Ctrl+3 | Cmd+3 |
| Original only | Ctrl+Shift+1 | Cmd+Shift+1 |
| Translation only | Ctrl+Shift+2 | Cmd+Shift+2 |

Do not add many custom shortcuts before there is evidence they are needed.

## Milestone 2.5 workspace controls

Use a compact, persistent upper toolbar rather than a large page header. It provides:

- show/hide library (`Ctrl/Cmd+B`);
- return to the start screen;
- create or open another project;
- create a mirrored subfolder in both project sides;
- refresh project discovery;
- open settings (`Ctrl/Cmd+,`).

The library shows logical folders without card borders. Folder creation preserves the same relative path under `_orig` and `_trad`.

The library uses a compact expandable tree. Its header provides actions to import a document, create a mirrored folder, change sort order, reveal the current document, and collapse all folders. Keyboard navigation follows desktop tree conventions: Up/Down move between visible rows, Left/Right collapse or expand hierarchy, Home/End jump to the first or last visible row, and Enter/Space activate the focused row. Enter submits project, folder, and import forms; Escape closes dialogs.

“New file” imports a selectable-text original PDF and may also import a PDF, Markdown, or text translation. Imported files are copied into the selected logical folder without overwriting existing files. When both sides are supplied, the translation receives a matching base name so discovery creates one logical document pair.

Deletion is deliberately conservative:

- the primary action removes a document from Jano while preserving ordinary files;
- hidden documents can be restored from Settings;
- deleting an original, translation, or both requires a separate explicit action;
- never remember “delete both” as an automatic preference;
- until system Trash integration exists, the UI must state that file deletion is permanent.

Settings expose the active manual local pipeline and its conditional OCR policy. A document without a translation offers an explicit **Extract and translate** action; importing a document never starts expensive OCR or model inference automatically.

The start screen preserves the new-project card and lists recently opened project folders. Recent paths are application-level navigation history, never canonical project identity, and can be removed from the list without changing project files.
