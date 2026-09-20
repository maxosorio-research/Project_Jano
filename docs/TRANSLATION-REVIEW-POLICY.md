# Translation review policy

Status: Accepted UX policy; disclosure UI pending

Translation review status describes confidence in translated content. It is not
the document pair state and must not be encoded as one.

## Severity and behavior

| Status | Meaning | Reader behavior |
|---|---|---|
| `approved` | Review accepted the translated segment. | Render normally. |
| `not-reviewed` | No review result exists. | Render normally with neutral metadata when details are requested. |
| `base-retained` | Review produced no safer replacement. | Render the structurally valid base translation and show a subtle amber icon plus “Se conservó la traducción base”. |
| `needs-review` | A protected value, reference, or review rule requires human verification. | Render the structurally valid base translation with an amber edge marker, icon, and “Revisar”; expose the recorded reason. |

Warnings are never communicated by color alone. The document reader shows the
number of segments requiring attention and provides next/previous warning
navigation. A tooltip or details surface exposes the warning reasons without
injecting them into copied translation text.

An integrity failure that breaks the structural contract—missing segment IDs,
duplicate IDs, invalid protected-token recovery, or incomplete output—continues
to block persistence. By contrast, a valid `base-retained` or `needs-review`
segment does not block the entire document: the safest available base text is
shown with explicit disclosure.

For 0.1, warning interaction is read-only. Accepting, editing, or suppressing a
warning requires durable revision semantics and belongs to a later workflow.
