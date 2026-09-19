# Source map

This handoff was synthesized from the project's design notes. The purpose of this map is traceability, not to make Codex read every historical conversation.

The original ChatGPT design discussions are archived under `docs/source-notes/`. They provide rationale and historical context, but they are not implementation requirements by themselves.

When sources disagree, use this precedence order:

1. `AGENTS.md` and explicit user instructions;
2. `docs/DECISION-STATUS.md` and accepted ADRs;
3. `docs/MVP-0.1.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, and `docs/UX.md`;
4. roadmap and implementation-planning documents;
5. archived source notes.

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

## Archived source notes

The repository preserves the supplied discussions with their original filenames:

- `[Punto 00] - Idea inicial.txt`
- `[Punto 00] - Indice general de aspectos.txt`
- `[Punto 01] - MVP.txt`
- `[Punto 02] - Modelo de proyecto y biblioteca.txt`
- `[Punto 04] - Extraccion y representacion.txt`
- `[Punto 06] - Scroll sincronizado.txt`
- `[Punto 07] - Seleccion de texto.txt`
- `[Punto 08] - Identidad visual y color.txt`
- `[Punto 08] - Visualizacion.txt`
- `[Punto 09] - Pipeline de trabajo.txt`
- `[Punto 10] - Traduccion local contextual.txt`
- `[Punto 10-11] - Modelos locales y contexto disciplinar.txt`
- `[Punto 13] - Integracion con Zotero.txt`
- `[Punto 14] - Evidencia y anotaciones.txt`
- `[Punto 16] - Seguridad privacidad y BYOK.txt`
- `[Punto 17] - Backup y portabilidad.txt`
- `[Punto 20] - Plugins y complementos.txt`
- `[Punto 22] - Tipo de licencia.txt`
- `[Punto 23] - Distribucion multiplataforma.txt`
- `[Punto 25] - Traslado a Codex y roadmap.txt`

These files intentionally retain ChatGPT export markers such as `filecite` references. Those markers are historical artifacts and must not be treated as live repository citations.

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
