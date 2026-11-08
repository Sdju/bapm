# SharedCache

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Opt-in shared bare git mirror + HTTP response cache (inspired by APM
`cache/git_cache.py` and `cache/http_cache.py`). Default install behavior is
unchanged.

## Enable / disable

| Env                   | Effect                                                      |
| --------------------- | ----------------------------------------------------------- |
| `BAPM_CACHE_DIR`      | Enables the shared cache root. Unset = off.                 |
| `BAPM_NO_CACHE=1`     | Disables all shared-cache use even when a cache dir is set. |
| `BAPM_HTTP_CACHE=0`   | Disables only HTTP caching (git mirror still works).        |
| `BAPM_HTTP_CACHE_TTL` | HTTP freshness in seconds (default 300; integer ≥ 0).       |

## Layout

```text
<BAPM_CACHE_DIR>/git/<sha256(normalized repo url)>.git   # bare mirror
<BAPM_CACHE_DIR>/http/<sha256(url + request headers)>    # GET 200 entry
```

The git key uses `normalizeRepoIdentity` (host case / `.git` / disclosed path
folding), never the ref alone. Local `path`, `file://`, and `local:` sources are
never cached.

The HTTP key lowercases/sorts header names and includes the URL. Only anonymous
`GET` responses with status 200 are cached; `Authorization`/`Cookie` requests,
other methods, 4xx/5xx, and redirect statuses are never stored. Cache errors
fall back to the network.

## Download flow

1. Ensure the bare mirror (`git clone --mirror` or `git remote update --prune`).
2. Clone the requested commit from the mirror into the existing atomic temp dir.
3. Set the checkout's `origin` back to the manifest URL, then swap into place.
4. On any cache error, warn and fall back to a direct clone. A stale mirror is
   reused when the update failed but already contains the requested commit.

## Clean / prune semantics

`sharedGitCacheClean` removes only mirrors under `<BAPM_CACHE_DIR>/git`.
`sharedHttpCacheClean` removes only entries under `<BAPM_CACHE_DIR>/http`.
Neither deletes project `apm_modules`; that remains `cacheClean`.

`pruneSharedCache` removes git mirrors whose directory `mtime`/`atime` is older
than `days` (default 30; `0` makes all existing mirrors eligible).
`pruneSharedHttpCache` does the same for HTTP entry files. Both skip symlinks,
delete per entry, count only successful removals, and report failures per entry.
Invalid `days` is rejected before mutation. Missing `BAPM_CACHE_DIR` is an
informational no-op.
