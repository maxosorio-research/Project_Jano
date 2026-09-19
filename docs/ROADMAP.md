# Roadmap

Only 0.1 is an active implementation scope. Later sections document product direction so today's code does not block tomorrow's features.

## 0.1 — synchronized bilingual reader

Focus:

- project folders;
- document identity and pairing;
- original PDF reader;
- translated text/Markdown reader;
- structured segments;
- alignment;
- synchronized semantic scroll;
- bilingual counterpart highlighting;
- local/offline operation.

## Post-0.1 — extraction robustness

Future work may include:

- better multi-column reconstruction;
- problematic text layers;
- progressive OCR for pages that cannot be extracted natively;
- better handling of notes, equations, captions, tables and figures.

OCR should be progressive:

```text
native extraction
  -> quality check
  -> OCR suspicious pages
  -> full-document OCR only when necessary
```

## Translation engine

Future translation pipeline:

```text
extract
  -> normalize
  -> segment + IDs
  -> group contextual blocks
  -> translate while preserving IDs
  -> validate
  -> generate Markdown
  -> structural alignment
  -> optional fine contextual alignment
```

The engine should be provider-agnostic.

## Local AI

Long-term design:

```text
Jano Translation Engine
  -> local runtime adapter
  -> Ollama / future runtimes
  -> user-selected model

or

  -> optional remote provider
```

Core principles:

- local mode can be fully offline;
- model and runtime are separate choices;
- remote APIs are optional;
- model downloads require explicit consent;
- model license/origin/size should be visible.

## Disciplinary project context

Future projects may store:

- primary discipline;
- secondary disciplines;
- subfield;
- source/target language;
- academic translation profile;
- project description;
- terminology/glossary.

Priority when translating:

```text
source text
  > immediate context
  > explicit glossary
  > disciplinary label
```

## Research evidence and annotations

Future Jano should be able to store local highlights/comments/tags/notes without requiring Zotero.

The original remains the cited/canonical text; translation remains auxiliary.

## Zotero

Conceptual future flow:

```text
select translated passage
  -> resolve aligned original
  -> create/save original evidence
  -> associate working translation
  -> optional Zotero synchronization
```

Jano remains the specialized reader; Zotero remains the bibliographic manager.

## Plugins

Future plugin system is local/drop-in:

- no mandatory marketplace;
- plugins use a public Jano API;
- plugins do not write internal DB tables directly;
- explicit permissions;
- constrained contribution points;
- JavaScript/TypeScript first, possible WebAssembly later.

Potential contribution points:

- commands
- context menus
- reader toolbar
- sidebar panels
- settings
- translation providers
- exporters
- annotation actions
- document processors

## Backup and portability

Long-term project packages may include:

- `.jano-project` for one project;
- `.jano-backup` for broader profile/configuration backup.

Projects remain normal folders first.

## Distribution

Architecture is cross-platform from the start.

Release order:

1. Windows x64 reference MVP;
2. macOS as a first-class next platform;
3. Linux later.

Avoid platform-specific assumptions in domain code.

## Licensing

Intended early code policy:

- source-available;
- non-commercial;
- PolyForm Noncommercial 1.0.0;
- Jano name/logo handled separately as trademark/brand assets.

Dependency licenses must be reviewed before distribution.
