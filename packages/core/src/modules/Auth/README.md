# Auth

Shared OpenAPM §10.3 credential host-class helpers for `@bapm/core`.

## Public API

- `credentialHostClassOf` / `sameCredentialHostClass` — PSL eTLD+1 ∪ `registries.*.aliases`
- `resolveCredentialsForHost` — per-class resolve; source-id diagnostics; port in cache key
- `fetchWithRedirectAuthDrop` — manual redirects; drop Auth on cross-class 3xx
- `buildGitChildEnv` — ambient token suppress + selected-class attach; sc-008 https refuse
- `selectProviderClassForHost` — operator overlap (ADO wins over `GITHUB_HOST`)

## Example

```ts
import { credentialHostClassOf, fetchWithRedirectAuthDrop, buildGitChildEnv } from "@/modules/Auth";

credentialHostClassOf("api.github.com"); // "github.com"
```
