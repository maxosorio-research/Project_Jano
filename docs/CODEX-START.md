# First prompt for Codex

Use the following as the first implementation request after this documentation is committed.

---

Read `AGENTS.md` and all files it marks as required.

Do not implement the product yet.

Your first task is **Milestone 0 — repository scaffold** from `docs/IMPLEMENTATION-PLAN.md`.

Requirements:

1. Create the smallest Tauri 2 + React + TypeScript application structure consistent with `docs/ARCHITECTURE.md`.
2. Establish clear `domain`, `application`, `infrastructure`, and UI boundaries.
3. Configure formatting, linting, TypeScript checking, frontend tests, and Rust tests.
4. Add a minimal CI workflow if the repository is hosted on GitHub.
5. Render one basic Jano desktop window with placeholder areas only.
6. Do not add PDF.js, storage schema, translation, AI, Zotero, plugins, OCR, or alignment algorithms yet.
7. If the proposed folder structure introduces an architectural commitment not present in the docs, explain it before implementing and add an ADR if needed.
8. Run the available checks and report:
   - files created;
   - commands run;
   - test/check results;
   - assumptions;
   - next recommended task.

Do not start Milestone 1 until this scaffold is clean.

---
