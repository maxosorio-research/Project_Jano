# JSON, SQLite, or both?

Evaluation date: 2026-09-20

## Recommendation

Use **both, with a strict ownership split**. SQLite should own structured,
mutable, relational state; JSON should remain only for small bootstrap data and
explicit portable exports; original PDFs and readable/generated artifacts stay
as ordinary files.

Do not migrate during `v0.1.0-rc.0`. The current dataset is small and the first
priority is validating the bilingual reader. Implement the migration before
editable alignment, annotations, trash history, or broad search make multi-file
updates routine.

## Evidence from Jano

The active test project has 66 catalogued documents and 6 processed documents.
Its `.jano` directory contains 42 JSON files totalling about 2.2 MB; the largest
is about 276 KB. JSON parsing cost is therefore not the present problem.

The current catalog writer replaces `documents.json` with a direct filesystem
write, while processing artifacts are replaced one file at a time. Even when
individual writes are made atomic, one processing result spans segments,
translations, math objects, metadata, alignments, Markdown, and catalog state;
the filesystem cannot commit that set as one transaction.

## Comparison

| Criterion | Versioned JSON files | SQLite | Hybrid target |
|---|---|---|---|
| Human inspection and diffs | Excellent | Requires SQLite tools | Excellent for bootstrap/exports and artifacts |
| Atomic multi-entity update | Custom protocol required | Native transactions | SQLite transaction plus recovery protocol for file moves |
| IDs, uniqueness, relationships | Application checks | Constraints and foreign keys | SQLite owns relational invariants |
| Search and future annotations | Full scans/custom indexes | Indexed queries/FTS-ready | SQLite indexes; files remain portable |
| Schema evolution | Hand-written file migrations | Transactional migrations | SQLite migrations plus versioned export schema |
| Crash recovery | Must be designed per file/set | Journal and integrity tools | Database recovery plus artifact reconciliation |
| Folder portability | Directly readable | Cross-platform single file | Preserved when application is closed |
| Cloud/network concurrent writes | Conflict-prone | Unsafe/unsupported on unreliable network locking | One-writer, closed-before-sync policy |
| Implementation cost now | Already paid | Migration required | Migration required, staged after RC baseline |

## Why not JSON only

JSON is still appropriate for `project.json` and exports. It is a poor long-term
database for mutable segment graphs: atomic rename protects one file, not a
coordinated set; uniqueness, referential integrity, queries, and migrations all
become custom application code.

SQLite documents atomic transactions, cross-platform files, indexes, and schema
evolution as strengths of an application file format. Those advantages match
Jano's upcoming alignment revisions, warnings, annotations, reading positions,
and trash-operation log. See [SQLite as an application file
format](https://www.sqlite.org/appfileformat.html) and [atomic
commit](https://www.sqlite.org/atomiccommit.html).

## Why not SQLite only

The original PDF must remain canonical and untouched. Generated Markdown/TXT is
useful outside Jano, while OCR/source diagnostics, crops, and future media can be
large. Storing every artifact as a BLOB would reduce inspectability and make
recovery/export unnecessarily dependent on the database.

SQLite also does not make external file moves transactional. A trash operation
still needs staging and replay/rollback metadata. Keeping content files outside
the database makes that boundary explicit.

## Journal and synchronization policy

Start in rollback-journal `DELETE` mode with `synchronous=EXTRA`. SQLite states
that WAL creates additional `-wal` and `-shm` state that must travel with the
database, does not work across hosts on network filesystems, and requires
checkpoint management. The current workload has one application writer and no
measured need for WAL concurrency. See the official [WAL
tradeoffs](https://www.sqlite.org/wal.html) and [network filesystem
caveats](https://www.sqlite.org/useovernet.html).

If future measurement justifies WAL, first require a bundled SQLite version
with the 2026 WAL-reset fix (3.51.3 or an official fixed backport), keep every
connection on the same host, and add checkpoint/copy tests. Do not enable WAL
merely as a generic performance setting.

For every connection, explicitly enable foreign keys because SQLite does not
guarantee them on by default, turn off trusted schemas, set a bounded busy
timeout, and run `quick_check` at controlled reopen/backup boundaries plus full
`integrity_check` and `foreign_key_check` in diagnostics. See the official
[PRAGMA reference](https://www.sqlite.org/pragma.html).

## Rust/Tauri boundary

The official Tauri SQL plugin is designed to expose SQL through JavaScript guest
bindings and requires explicit dangerous-command permissions. That is useful
for database-driven frontends, but Jano already has a native repository boundary
and needs arbitrary portable project roots. Keep SQL in Rust with a direct,
pinned SQLite binding and expose typed commands only. The plugin documentation
remains useful for its transactional migration model: [Tauri SQL
plugin](https://v2.tauri.app/plugin/sql/).

## Go/no-go conditions for migration

Proceed when one of these begins:

- editable alignment or review decisions;
- annotations or evidence records;
- project-local trash operation history;
- indexed full-project search;
- measured startup/query problems from JSON scans.

Before proceeding, require a schema ADR, dependency/license audit, migration and
rollback fixtures, corrupted/interrupted-state tests, and a verified export that
can reconstruct all canonical structured state.
