# Manifest

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Discover, load, and validate OpenAPM/APM project manifests (`apm.yml` / `bapm.yml`).

## Public API

| Export                                                                                                  | Kind      |
| ------------------------------------------------------------------------------------------------------- | --------- |
| `BapmManifest`, `BapmDependency`, `DependencyEntry`, …                                                  | types     |
| `ManifestError`, `ManifestErrorCode`, `ManifestWarning`                                                 | errors    |
| `APM_MANIFEST_FILE`, `BAPM_MANIFEST_FILE`, `BAPM_LOCAL_MANIFEST_FILE`                                   | constants |
| `discoverManifestPath`, `loadBaseManifest`, `loadManifest`, `loadEffectiveManifest`, `parseManifest`, … | functions |
| `createMinimalManifest` (+ `pluginMode`), `writeProducerManifest`, `serializeManifest`                  | emit      |
| `validatePluginName`, `validateProjectName`, `createPluginJson`, `writePluginJson`                      | plugin    |

`loadYamlDocument` preserves ManifestError codes for public consumers; shared YAML parsing lives in `@/common/yaml/`.

## Example

```ts
import { loadManifest } from "@/modules/Manifest";

const { document, sourcePath } = loadManifest({ cwd: "." });
```
