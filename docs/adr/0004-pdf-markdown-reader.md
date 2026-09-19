# ADR 0004 — Original PDF + translated text reader

Status: Accepted for handoff; supersedes the initial dual-PDF MVP viewer design.

## Decision

The original is displayed as PDF. The translation is displayed as a clean Markdown/text reading surface.

The translation side does not attempt to reproduce journal layout, columns, figures, or complex tables.

## Consequences

- The original preserves documentary fidelity.
- The translated side prioritizes reading comfort.
- Figures/tables may be represented by markers linking back to the original.
- A translated PDF may be locally normalized/extracted before display.
- Automatic translation is not implied by this decision.
