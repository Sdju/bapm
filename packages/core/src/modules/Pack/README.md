# Pack

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Plain-zip producer archive for OpenAPM Producer (M7): pack, extract, sc-007 secret refuse, pr-004 release tag gate.

## Public API

| Export                                                            | Kind                          |
| ----------------------------------------------------------------- | ----------------------------- |
| `runPack`, `packProject`, `packArchive`                           | pack zip                      |
| `extractPackArchive`, `unpackArchive`, `extractPack`              | extract                       |
| `checkReleaseTag`, `checkRelease`, `runCheckRelease`              | pr-004 gate                   |
| `validatePackStrictMetadata`, `validateMarketplaceStrictMetadata` | `--strict-metadata` preflight |
| `assertPortableAgentPluginPackSet`                                | portable declared-path guard  |
| `buildClaudePluginBundle`                                         | Claude plugin bundle builder  |
| `isSecretPackPath`                                                | sc-007                        |
| `PackError`, types                                                | errors / options              |

## Notes

- Default archive format is **plain zip**. `--format claude-plugin` emits a Claude Code
  plugin zip with `plugin.json` and `.claude-plugin/plugin.json` plus the preserved
  plugin-native tree. APM authoring manifests/locks are omitted from that bundle.
- `--agent-plugins`: portable `plugin.json` root; the pack set preserves `commands/`,
  `hooks/`, `agents/`, `skills/`, root `mcp.json`, native manifests, and sibling assets
  at their original relative paths. Declared paths are validated against the collected
  set; missing / traversal / symlink / `.bapmignore`-excluded declarations fail closed.
- Secrets: `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519` — fail closed before durable zip.
- `--check-release`: compare tag (optional `v`) to manifest `version`; never create/push tags.
- pr-005: unsigned tags are advisory warnings only in M7.

## Example

```ts
import { runPack, checkReleaseTag } from "@/modules/Pack";

await checkReleaseTag({ cwd: ".", tag: "v1.2.3" });
await runPack({ cwd: ".", archive: true });
```
