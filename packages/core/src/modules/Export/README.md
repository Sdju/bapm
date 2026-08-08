# Export

Read-only SBOM inventory export from a recorded lockfile (`exportSbom`).

## Public API

| Symbol                                                 | Role                                                |
| ------------------------------------------------------ | --------------------------------------------------- |
| `exportSbom`                                           | CycloneDX 1.5 (default) / SPDX 2.3 from lock fields |
| `buildPurl`, `scrubUrl`                                | purl identity + credential scrubbing                |
| `FORMAT_CYCLONEDX`, `FORMAT_SPDX`, `SUPPORTED_FORMATS` | format constants                                    |

## Example

```ts
import { exportSbom } from "@/modules/Export";

const result = await exportSbom({
  cwd: process.cwd(),
  format: "cyclonedx",
  timestamp: "2020-01-01T00:00:00Z",
});
if (result.ok) console.log(result.json);
```

Does not resolve, download, re-hash, or mutate the project.
