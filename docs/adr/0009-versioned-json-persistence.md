# ADR 0009 — Versioned JSON persistence for Milestone 1

Status: Accepted for MVP implementation

## Context

The domain model deliberately leaves the final SQLite-versus-JSON allocation open. Milestone 1 needs durable project and document identity without making that storage choice irreversible.

## Decision

Milestone 1 stores two versioned JSON documents inside the project-local `.jano/` directory:

- `project.json` contains project identity, schema version, and the names of the original and translation directories;
- `documents.json` contains stable document IDs and relative file references with hashes and basic file metadata.

Absolute project paths are runtime-only and are never persisted. Application commands use a repository boundary rather than reading JSON directly.

## Consequences

- A complete project remains portable as an ordinary folder.
- Renames and moves can preserve document identity through content hashes.
- Files remain inspectable and easy to migrate during the MVP.
- Atomic writes, concurrent editing, and large structured datasets are not solved by this decision.
- A later ADR may replace JSON with SQLite or a hybrid layout without changing the public project model.
