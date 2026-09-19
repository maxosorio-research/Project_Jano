# ADR 0011 — Ollama local runtime diagnostic spike

Status: Accepted experimental spike; production-model choice superseded by ADR 0012

## Context

Automatic translation remains outside the Jano 0.1 document pipeline. The user explicitly requested an early Ollama integration test to validate an installed local runtime before committing to document processing or a production translation model.

The first observed environment exposes Ollama 0.34.1 at its standard loopback API and had `qwen2.5:0.5b` installed. A manual EN→ES academic sample proved connectivity but showed grammatical errors, so connectivity and translation quality must remain separate conclusions. The user then explicitly requested a suitable replacement model and a test using the PDF stored in the workspace `tests` folder.

## Decision

Jano adds a narrow `LocalTranslationRuntime` boundary with an Ollama adapter. Settings may:

- inspect only `http://127.0.0.1:11434`;
- display the local Ollama version and installed models;
- persist the selected model as an application preference;
- recommend `translategemma:4b` for this hardware and migrate the earlier experimental Qwen preference;
- use TranslateGemma's language-name/language-code prompt shape when that model is selected;
- run one fixed, reproducible academic translation smoke test using the abstract extracted from Cranmer and Desmarais (2011);
- display raw output, duration, and token counts.

The test PDF is read only for this explicit benchmark. The smoke test does not modify it, persist generated translations into a Jano project, or enable automatic translation. `translategemma:4b` was the diagnostic model for the observed machine during this spike. The later production pipeline decision in ADR 0012 designates `translategemma:12b` as Jano's official translation model.

## Consequences

- A successful test proves local connectivity and generation, not acceptable academic quality.
- The fixed loopback endpoint prevents the diagnostic from becoming an arbitrary network client.
- Model downloads remain explicit user-authorized actions outside Jano for this spike.
- The benchmark artifact records the source excerpt, output, model, duration, and token counts so later models can be compared reproducibly.
- Document extraction, segmentation, provenance, validation, and Markdown generation remain deferred under ADR 0010.
- Later runtimes can implement the same application boundary without changing Settings.
