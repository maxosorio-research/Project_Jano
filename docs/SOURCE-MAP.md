# Source map

This handoff was synthesized from the project's design notes. The purpose of this map is traceability, not to make Codex read every historical conversation.

Key source files:

- `Diseñar lector bilingüe.txt` — original concept, segment/alignment model, early architecture.
- `[Punto 1] - MVP.txt` — original 0.1 scope and exclusions.
- `Hilo · [Lista] Aspectos a tratar.txt` — project/library model; scroll; UX; extraction; distribution; AI/profile discussions across several branches.
- `[Punto 7] - Selección de texto.txt` — contextual bilingual selection.
- `[Punto 9] - Pipeline de trabajo.txt` — extraction/translation pipeline and PDF + Markdown direction.
- `[Punto 17] - Backup y portabilidad.txt` — relative paths, stable IDs, hashes, portable projects.
- `[Punto 20] - Plugins y complementos.txt` — future plugin architecture.
- `[Punto 22] - Tipo de licencia.txt` — source-available non-commercial license direction.
- `Explorar color principal de Jano.txt` and related UI discussions — visual identity.
- `Trasladar proyecto a Codex.txt` — handoff discussion.

## Important supersession

The original MVP described a dual-PDF viewer. Later extraction/pipeline/UX work changed the preferred visible reader to:

```text
original PDF + translated Markdown/text
```

This handoff treats the later decision as authoritative and documents that explicitly in `DECISION-STATUS.md`.

## Important unresolved source points

Historical notes leave these intentionally unresolved:

- exact physical `.jano` persistence format;
- final alignment algorithm;
- final public plugin runtime;
- final reciprocal/non-reciprocal licensing decision before 1.0.
