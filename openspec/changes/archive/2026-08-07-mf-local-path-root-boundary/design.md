## Context

Resolver currently recognizes only a subset of local string prefixes and computes a local target with host-path `resolve(item.fromDir, rel)`. It then calls `existsSync` and reads the child manifest without proving the target is below the root `cwd`; transitive items already carry their own `fromDir`. See `proposal.md` and the `dependency-resolve` delta for the behavioral contract.

## Goals / Non-Goals

**Goals:**

- Establish one lexical normalization and containment operation used before every local filesystem probe or manifest read.
- Preserve the original declared path for deterministic error diagnostics while carrying a normalized absolute target to graph resolution.
- Make failures observable through the public Resolver error-code union and stable tests, including the `resolveAndLock` no-side-effects boundary.
- Make the Mode B `req-mf-016` claim evidence-based and generated from the checklist.

**Non-Goals:**

- Resolving symlinks or defending against symlink/junction escapes after lexical containment.
- Changing cache directory identity/layout, downloader contracts, or git/registry/marketplace resolution.
- Adding a policy that categorically rejects absolute or home-prefixed paths.
- Defining workspace or monorepo root semantics beyond the current single project `cwd`.

## Decisions

### Normalize path syntax before host-path resolution

Treat `\` as a path separator for local dependency references, convert it to `/`, then normalize the resulting segments before using Node path APIs. Expand a home-prefixed local reference to its home directory and evaluate absolute references as supplied; resolve other references from `QueueItem.fromDir`.

This lets Windows-authored manifests behave consistently on POSIX hosts and allows `./a/../b`. Delegating raw backslash strings to the host path library would treat them as ordinary characters on POSIX and fail to enforce the intended boundary.

### Use lexical root containment, not string-prefix matching

Compute a normalized absolute `projectRoot` once from resolver `cwd`. For each local edge, compute its normalized absolute target and prove it is either the root itself or has the root plus path-separator as its lexical ancestor (equivalently via a relative-path boundary check). Reject all other targets with `ResolverError("LOCAL_PATH_ESCAPES_PROJECT_ROOT", ...)`, including `details` for the original path, resolved target, project root, and declaring directory.

Simple `startsWith(projectRoot)` would incorrectly accept sibling paths such as `/work/project-copy`. Realpath-based containment would alter scope and introduces symlink semantics expressly excluded from this change.

### Validate before any local dependency operation

Perform the boundary operation immediately after classification and before `existsSync`, `loadManifest`, downloader invocation, child queueing, graph records, policy candidates, `downloadPackages`, or `writeLockfile`. The graph's existing `fromDir` propagation remains the source of truth: root items begin at `cwd`; local children begin at their resolved package directory.

Putting the check only in materialization or policy would leave manifest reads and graph discovery outside the security boundary. Putting it in classification would not have the declaring directory/root context needed for transitive resolution.

### Keep classification broad; enforce only containment

Extend string detection to all seven required prefixes and retain object `{ path }` precedence. Absolute and home forms are valid local syntax; an out-of-root target fails because it violates containment, not because its syntax is disallowed. Bare-path fallback remains unchanged.

This avoids conflating recognition with an unstated product policy while still enforcing the root boundary.

### Evidence follows the existing Mode B generator

Acceptance will add an isolated root-boundary suite covering all prefixes, normalized in-root forms, direct and transitive escapes, original-path diagnostics, and spies/sentinels for prohibited side effects. General resolver tests will receive durable behavior coverage after promotion. The checklist will switch `req-mf-016` to `active` with these citations, then the existing generator will update both published conformance artifacts and the drift gate will verify them.

## Risks / Trade-offs

- [Home expansion differs across CI users] → Tests inject or derive the current home only for a contained fixture case; out-of-root home behavior asserts the domain error rather than a machine-specific path.
- [Lexical checks do not stop a symlink escape] → Explicitly retain this limitation as out of scope; do not imply realpath containment.
- [A malformed Windows drive path may be host-dependent] → The required backslash prefix cases are normalized as POSIX segments; drive-letter policy remains unchanged and is not claimed by this change.
- [Later queue edges might follow already-resolved valid edges] → Tests target rejected direct and transitive edges and assert the rejected edge causes no probes or durable write; no rollback guarantee is added for work completed before an independently later failure.

## Migration Plan

1. Add acceptance tests first and verify they fail against the current resolver.
2. Add normalized local-path resolution and the exported domain error/type, then make the acceptance suite pass.
3. Promote durable resolver/Mode B tests, update the checklist citation and status, regenerate `CONFORMANCE.md` / `CONFORMANCE.json`, and run the conformance drift gate.
4. Rollback is a revert of the resolver/checklist change; no on-disk format migration is involved.
