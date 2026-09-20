# Versioning and tags

Jano uses Semantic Versioning. Git release tags use the same version prefixed
with `v`:

```text
manifest version: 0.1.0-rc.0
Git tag:          v0.1.0-rc.0
```

The version must agree in `package.json`, `src-tauri/Cargo.toml`, the root Jano
package entry in `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`.

## Release-candidate sequence

The first tagged baseline is `v0.1.0-rc.0`. Each materially improved candidate
increments the prerelease number (`rc.1`, `rc.2`, and so on). The stable tag
`v0.1.0` is reserved for the candidate that passes the documented exit test and
public-distribution checks.

## Tag procedure

1. Update the four version declarations and `CHANGELOG.md`.
2. Run the complete frontend and Rust verification suite.
3. Commit and synchronize with `origin/main`.
4. Create an annotated tag on the verified commit.
5. Push the branch and the tag, then verify both remote references.

Published tags are immutable. A correction receives a new version instead of a
moved or replaced tag.
