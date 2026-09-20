# ADR 0014 — Hybrid project storage

Status: Accepted target; migration deferred until after `v0.1.0-rc.0`

## Context

ADR 0009 intentionally selected versioned JSON for the earliest milestones.
The current reader now persists catalogs, source and target segments,
alignments, review state, processing metadata, and future-facing relationships.
Trash recovery, editable alignment, annotations, and search would require
coordinating increasingly many files and maintaining secondary indexes.

The active 66-document test project currently contains 42 JSON metadata files
totalling about 2.2 MB. Size and read performance are not yet a problem. The
pressure comes from transactional integrity, relational constraints, migrations,
and future queries rather than raw volume.

## Decision

Jano will use a hybrid project format:

- `.jano/project.json` remains a small, human-readable bootstrap with schema
  version, portable folder names, and the state-database location.
- `.jano/state.sqlite` becomes the canonical store for documents,
  representations, segments, translations, alignments, review warnings,
  processing runs, reading positions, revisions, and trash-operation state.
- Original PDFs and generated readable Markdown/TXT remain ordinary project
  files. Large or inspectable processing artifacts may remain beneath
  `.jano/documents/` and are referenced by relative path and hash.
- JSON snapshots are explicit, versioned import/export or diagnostic artifacts.
  They are never independently editable mirrors of canonical SQLite rows.

SQLite access belongs to the Rust infrastructure repository. React continues
to call typed application commands and receives domain values; it does not gain
a generic SQL API. The initial implementation should use a direct Rust SQLite
library rather than the Tauri SQL frontend plugin.

The initial database profile is one serialized writer, short transactions,
`foreign_keys=ON`, `trusted_schema=OFF`, rollback-journal `DELETE`, and
`synchronous=EXTRA`. WAL is not the default because Jano projects are portable
folders that users may copy or place in synchronization tools, and Jano does not
need reader/writer concurrency at the current scale.

## Migration boundary

`v0.1.0-rc.0` keeps the current JSON implementation. A later migration must:

1. back up and validate existing JSON;
2. build a temporary database and run schema migrations transactionally;
3. import and validate counts, identities, foreign keys, hashes, and alignments;
4. run integrity checks;
5. atomically activate the database while retaining a recoverable JSON export;
6. support reopen, rollback, and interrupted-migration tests.

Jano does not support simultaneous writes to the same project from multiple
machines. A project database is copied or synchronized only while Jano is
closed; network-filesystem projects require an explicit warning or unsupported
state. Trash file moves use a persisted operation state plus recovery, because
no SQLite transaction can make external filesystem moves atomic.

## Consequences

- Multi-record changes gain transactions, constraints, indexes, and durable
  schema migrations.
- Original and readable derived content remain accessible without database
  tooling.
- Portability remains a folder-copy operation while Jano is closed.
- The project gains migration and backup complexity, but avoids maintaining a
  custom transactional multi-file JSON database.
- There is no JSON/SQLite dual-write mode; that would create ambiguous recovery
  and conflict rules.
