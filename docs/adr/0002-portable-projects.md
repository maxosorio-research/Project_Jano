# ADR 0002 — Portable projects and stable document identity

Status: Accepted

## Decision

A project is a normal folder with original files, translation files, and `.jano/` metadata.

Persist relative paths. Pair discovery may start from filenames, but a stable `document_id` becomes the durable identity.

## Consequences

- Rename/move within a project should not create a new conceptual document.
- Hashes identify file versions, not conceptual identity.
- Copying a portable project folder should be enough to move it between computers.
- Original PDFs remain unmodified.
