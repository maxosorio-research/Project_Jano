# ADR 0008 — Future plugin boundary

Status: Future architecture; not MVP implementation scope.

## Decision

Future plugins interact with Jano through a public API and permission layer, never by writing internal database tables directly.

Plugin installation remains local and does not require a marketplace.

## Consequences

- Core storage can evolve without breaking plugins.
- Plugins declare permissions and contribution points.
- Native arbitrary code should not be the first plugin model.
- No plugin runtime should be implemented in Jano 0.1.
