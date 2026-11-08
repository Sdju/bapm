# SharedCache

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Opt-in shared bare git mirror cache (inspired by APM `cache/git_cache.py`). Default install behavior is unchanged.

## Enable / disable

| Env               | Effect                                                     |
| ----------------- | ---------------------------------------------------------- |
| `BAPM_CACHE_DIR`  | Enables the shared cache root. Unset = off (direct clone). |
| `BAPM_NO_CACHE=1` | Disables cache use even when `BAPM_CACHE_DIR` is set.      |

## Layout

```text
<BAPM_CACHE_DIR>/git/<sha256(normalized repo url)>.git   # bare mirror
```

The key uses `normalizeRepoIdentity` (host case / `.git` / disclosed path folding), never the ref alone. Local `path`, `file://`, and `local:` sources are never cached.

## Download flow

1. Ensure the bare mirror (`git clone --mirror` or `git remote update --prune`).
2. Clone the requested commit from the mirror into the existing atomic temp dir.
3. Set the checkout's `origin` back to the manifest URL, then swap into place.
4. On any cache error, warn and fall back to a direct clone. A stale mirror is
   reused when the update failed but already contains the requested commit.

## Clean / prune semantics

`sharedGitCacheClean` removes only mirrors under `<BAPM_CACHE_DIR>/git`. It never
deletes project `apm_modules`; that remains `cacheClean`.

`pruneSharedCache` removes only mirrors whose directory `mtime`/`atime` is older
than `days` (default 30; `0` makes all existing mirrors eligible). It skips
symlinks, deletes per mirror, counts only successful removals, and reports
failures per entry. Invalid `days` is rejected before mutation. Missing
`BAPM_CACHE_DIR` is an informational no-op.
