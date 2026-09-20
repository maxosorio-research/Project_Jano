# Project-local trash design

Status: Planned; not implemented in `v0.1.0-rc.0`

## Purpose

Jano must make ordinary mistakes recoverable without confusing three different
actions:

- **Hide from library** changes visibility only and remains immediately
  reversible.
- **Move to Jano Trash** removes the document from the active library while
  preserving user files, generated artifacts, identity, and provenance.
- **Delete permanently** is available only from Trash, requires an explicit
  confirmation, and states the exact files affected.

The first implementation should use project-local storage rather than operating
system Trash APIs so project moves, backups, and restore behavior remain
portable and testable.

## Proposed layout

```text
.jano/
  trash/
    index.json
    <trash-id>/
      manifest.json
      original/<relative project path>
      translation/<relative project path>
      artifacts/<document-id>/...
```

`manifest.json` records at least the trash schema version, trash ID, document
ID, deletion timestamp, prior catalog record, original relative paths, hashes,
sizes, media types, and the list of moved derived artifacts. It contains only
relative paths.

## Move transaction

1. Resolve and validate every source and destination under the project root.
2. Reject ambiguous, missing, or escaping paths before moving anything.
3. Write a complete manifest to a staging directory in `.jano/trash`.
4. Move the original, generated translation, and derived artifacts into that
   staging entry without overwriting an existing path.
5. Atomically replace the catalog and trash index.
6. Atomically rename the staging entry to its final trash ID.

If any step fails, Jano must leave enough information to roll back or resume and
must never silently discard the only readable copy. Catalog and trash-index
writes require temporary-file-plus-rename semantics.

## Restore

Restore preserves `documentId`. If an original destination is occupied, Jano
offers an explicit safe alternative name or cancels; it never overwrites. If
only derived artifacts conflict, Jano may restore the source and mark the
artifacts for regeneration after explaining the difference.

## Emptying Trash

There is no automatic retention policy in the first iteration. Permanent
deletion lists the affected paths and requires one confirmation per operation;
Jano never remembers that choice. A failed partial purge remains represented in
the index for recovery and diagnosis.

## Required tests

- move and restore original-only and fully processed documents;
- nested folders and duplicate file names;
- destination conflict on restore;
- failure injection before and after each atomic boundary;
- reopen after interrupted move, restore, and purge;
- protection against absolute paths, traversal, symlink escape, and overwrite;
- preservation of hashes, `documentId`, and generated artifacts.
