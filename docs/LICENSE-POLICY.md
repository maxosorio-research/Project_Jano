# License policy

## Intended early policy

The project design currently intends:

- source code publicly inspectable;
- free personal, academic, educational, scientific, governmental, and other allowed non-commercial use;
- modification and non-commercial forks;
- no sale of Jano or substantial derivatives;
- no commercial SaaS/service offering based on Jano;
- code license separate from the Jano name/logo/official identity.

The selected early license direction is:

**PolyForm Noncommercial 1.0.0**

This means Jano should be described as **source-available non-commercial**, not as OSI-approved open source.

## Repository status and action before public release

Do not generate a homemade license.

The official, unmodified PolyForm Noncommercial 1.0.0 text is already present
in `LICENSE`. Before public distribution:

1. confirm that `LICENSE` still matches the authoritative text;
2. add and verify `THIRD_PARTY_LICENSES.md` from a complete bundled/runtime
   dependency review;
3. add a separate `TRADEMARKS.md` at the final public-release stage.

Items 1 and 2 are public-distribution gates. The trademark file is explicitly
deferred by the project owner and is not a blocker for internal 0.1 release
candidates.

## Dependency policy

Preferred dependency licenses:

- MIT
- BSD
- ISC
- Apache-2.0

Require explicit review before adopting:

- GPL
- AGPL
- LGPL
- MPL
- source-available licenses
- custom licenses

Milestone 2 adds `pdfjs-dist` under Apache-2.0 and `vite-plugin-static-copy` under MIT. Both fit the preferred dependency policy. This is not a complete transitive-dependency review for public distribution.

This document is an engineering policy, not legal advice.
