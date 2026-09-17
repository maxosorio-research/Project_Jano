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
| ratio controls                       synchronization state     |
+---------------------------------------------------------------+
```

The exact toolbar vertical placement is not a hard requirement.

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

Provide a simple enabled/disabled control.

Behavior:

```text
scroll source      -> source leads, translation follows
scroll translation -> translation leads, source follows
```

Provide a `Re-align viewers` command.

Suggested shortcut:

- Windows/Linux: `Ctrl+Shift+L`
- macOS: `Cmd+Shift+L`

## Suggested shortcuts

| Action | Windows/Linux | macOS |
|---|---|---|
| Search | Ctrl+F | Cmd+F |
| Copy | Ctrl+C | Cmd+C |
| Select all | Ctrl+A | Cmd+A |
| Open project | Ctrl+O | Cmd+O |
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
