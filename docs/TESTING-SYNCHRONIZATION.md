# Synchronization test environment

This procedure uses selected PDFs from the active `Bibliografía Tesis` project.
The PDFs stay in that user-owned project; the repository contains only a
de-identified structural fixture with lengths, sentence-length profiles, page
numbers, IDs, and statuses.

## Selected corpus

| Role | Document | Document ID | Current shape |
|---|---|---|---|
| Baseline | `F22_Bunker_2025_Decades_of_democracy_Insights_into_the_political_landscape_of_Chile.pdf` | `08c3ecef-a541-4e62-9a8f-c2d75c811da2` | 8 native pages, 104 aligned segments, 1 review warning |
| Conditional OCR | `F12_Titelman_2019_La_nueva_izquierda_chilena.pdf` | `713e76b1-839f-4c73-99cb-d995c375f309` | 11 native pages plus 1 OCR page, 91 aligned segments |
| Warning disclosure | `H6_Cox_2025_Affective_polarization_and_democratic_erosion_Weak_partisanship.pdf` | `18aef245-b555-4242-a76d-2c439c741b5b` | 8 native pages, 62 aligned segments, 20 review warnings |

Start with F22. It is short enough for a full read-through while still including
two-column pages, a chart, references, and a non-fatal review case. Use F12 only
after the native baseline passes, and H6 when warning disclosure is available.

## Automated structural fixture

Regenerate the fixture after intentionally reprocessing F22:

```powershell
pnpm fixture:sync:export -- `
  --project-root "<path-to-Bibliografía Tesis>" `
  --document-id "08c3ecef-a541-4e62-9a8f-c2d75c811da2" `
  --name "f22-bunker-baseline" `
  --output "tests/fixtures/synchronization/f22-sync-shape.json"
```

The exporter rejects incomplete relationships and writes no source or translated
text. The frontend test uses the recorded shapes to verify bidirectional,
monotonic semantic mapping over the complete document. It also reconstructs
synthetic text with the same sentence-length profile and verifies experimental
resegmentation without retaining any academic wording.

## Experimental resegmentation procedure

The temporary **Resegmentar (prueba)** button beside **Regenerar traducción**
operates only on the open, already processed document. It does not call Ollama,
write JSON or Markdown, or change the project catalog. Selecting it again as
**Restaurar segmentos**, changing document, or reopening Jano returns to the
persisted representation.

1. Open F22 and record the source/translation segment counts shown after
   enabling the experiment.
2. Verify selection projection and synchronized scrolling at the beginning,
   middle, and end in both directions.
3. Inspect several long paragraphs: selectable units should be a sentence or a
   short sentence group rather than a full extracted paragraph.
4. Verify that headings, figure/table markers, equations, and page boundaries
   have not been split or relabeled.
5. Exercise an unequal sentence count and confirm navigation remains forward
   and the broader side is represented as `1:n`, `n:1`, or `n:m`.
6. Choose **Restaurar segmentos** and confirm the original counts and behavior
   return immediately.
7. Repeat on F12, including its OCR page, and then on H6 with visible review
   warnings before authorizing any persistent or recursive migration.

The experiment passes only if normalized source and target text are preserved,
every child ID participates exactly once in an alignment, mappings never move
backward, and structural blocks remain whole. Any missing content, duplicate
coverage, oscillation, or misleading cross-page correspondence blocks rollout.

## Manual baseline procedure

Record the Git tag, Windows version, display scaling, Jano build, Ollama model,
and result before testing.

1. Open the active project offline and select F22 without regenerating it.
2. At the beginning, middle, and final page, scroll the original and confirm the
   translation follows the corresponding segment without oscillation.
3. Repeat in the reverse direction, using the translation as leader.
4. Switch to independent mode and verify that neither panel moves the other.
5. Re-enable synchronization: there must be no immediate jump. Invoke
   **Re-align viewers** and verify an intentional correspondence jump.
6. Lock each panel in turn and confirm it cannot move as a follower; unlocking
   must not jump until realignment or deliberate scrolling.
7. Select passages on each side and verify that the projected counterpart is a
   semantic segment highlight, visually distinct from the real selection.
8. Navigate original pages through the toolbar in linked and independent modes.
9. Close and reopen the project; confirm the same document identity, artifacts,
   and alignments are reused.
10. Read the whole eight-page paper and note every visible mismatch, jump,
    missing segment, or misleading chart/footnote relationship.

## Pass criteria

- No crash, network dependency, silent regeneration, or source-file mutation.
- Every persisted source and target segment participates in exactly one current
  generated-ID alignment.
- Mapping works in both directions and never moves backward while the leader
  advances through ordered segments.
- Independent mode, panel locks, and explicit realignment follow the documented
  UX semantics.
- Figures, tables, equations, and footnotes degrade to honest page-linked or
  literal representations rather than invented layout or content.
- Review warnings remain visible as verification work and do not masquerade as
  missing translations.

Any crash, data loss, overwrite, non-monotonic jump, or absent correspondence is
a failed release-candidate exit. Minor imprecision inside the correct aligned
segment is recorded for later tuning but is not automatically a blocker.

## Test log

| Date | Tag/commit | Platform/build | Document | Result | Notes |
|---|---|---|---|---|---|
| 2026-09-20 | `v0.1.0-rc.1` | Automated fixture | F22 sentence shape | Pass | No text retained; complete, monotonic child alignment |
| — | `v0.1.0-rc.1` | Packaged Windows build | F22/F12/H6 manual | Not run | Visual walkthrough pending |
