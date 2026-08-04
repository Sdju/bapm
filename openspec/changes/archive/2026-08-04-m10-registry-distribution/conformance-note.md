# M10 Conformance note (Consumer)

- **lk-013** (digest before extract): covered by `@bapm/core` Registry materialize + acceptance `resolve-install` mismatch case.
- **rs-009** (mirror-by-hash): covered by frozen install + `mirrorUrl` / rewritten download URL with `resolved_hash` verify.
- **OpenAPM Registry class (rg-001 host)**: **N/A** — bapm does not ship or claim a registry host; mock HTTP fixture is test-only.
