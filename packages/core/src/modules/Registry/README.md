# Registry

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

HTTP client and helpers for APM de-facto `/v1/packages/{owner}/{repo}` wire:
list versions, download archives, publish PUT, flat publish zip, self-update check.

## Public API

See `index.ts`. Injectable `RegistryHttpTransport` for mock-registry tests.

## Experimental gate

`BAPM_EXPERIMENTAL_REGISTRIES=1` required for registry resolve/install and publish.
