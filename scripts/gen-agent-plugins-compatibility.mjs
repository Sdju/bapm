#!/usr/bin/env node
/**
 * Generate the portable Agent Plugins v1 support boundary from executable
 * fixtures/cases. This is deliberately separate from OpenAPM CONFORMANCE.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const casesPath = resolve(repoRoot, "tests/agent-plugins/compatibility-cases.json");
const outputPath = resolve(repoRoot, "AGENT_PLUGINS_COMPATIBILITY.md");
const check = process.argv.includes("--check");
const cases = JSON.parse(readFileSync(casesPath, "utf8"));

if (
  cases.format !== "agent-plugins-v1-compatibility-cases/v1" ||
  !Array.isArray(cases.components)
) {
  throw new Error(`Invalid Agent Plugins compatibility cases: ${casesPath}`);
}

for (const component of cases.components) {
  if (
    !component.id ||
    !component.status ||
    !component.summary ||
    !component.fixture ||
    !component.test ||
    !existsSync(resolve(repoRoot, component.fixture)) ||
    !existsSync(resolve(repoRoot, component.test))
  ) {
    throw new Error(
      `Compatibility case "${component.id ?? "(unknown)"}" must cite existing fixture and test`,
    );
  }
}

const rows = cases.components
  .map(
    (component) =>
      `| \`${component.id}\` | ${component.status} | ${component.summary} | [fixture](${component.fixture}) · [test](${component.test}) |`,
  )
  .join("\n");
const output = `# ${cases.title}

${cases.boundary}

## Support matrix
| Component | Status | Boundary | Evidence |
| --- | --- | --- | --- |
${rows}

## Target behavior
Portable MCP is an input contract, not a host configuration format. The Cursor target maps supported transports into \`.cursor/mcp.json\`: \`stdio\` → \`stdio\`, \`streamable-http\` → \`http\`, and \`sse\` → \`sse\`. The OpenCode target (\`@b-apm/integration-opencode\`) maps portable \`stdio\` → OpenCode \`local\` and \`streamable-http\` → \`remote\` under project \`opencode.json\` \`mcp\`; portable \`sse\` is fail-closed. Other targets must explicitly implement their own adapter; absence of one is not a portable-plugin failure.

## Product boundary
Portable Agent Plugins are separate from bapm/OpenAPM manifests, lockfiles, producer claims, and the bapm marketplace. \`plugin.json\` is not \`bapm.yml\` or \`apm.yml\`; portable archive production does not publish to, resolve through, or imply support by a marketplace.

## Non-goals
This boundary does not provide sandboxing, OAuth or secret injection, client extensions, undeclared agents, or vendor-specific extension behavior. Declared \`commands\` / \`hooks\` paths in \`plugin.json\` are in-boundary (see matrix). Unknown manifest fields are diagnostic-only for forward compatibility; they are not an implementation claim. See [CONFORMANCE.md](CONFORMANCE.md) only for bapm's separate OpenAPM claims.

## Verification
\`\`\`bash
pnpm run agent-plugins:check
vp test packages/core/tests/agent-plugins/compatibility-status.test.ts
vp test packages/core/tests/agent-plugins/consumer.test.ts
\`\`\`
`;

if (check) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  if (current !== output) {
    console.error(
      "Agent Plugins compatibility drift: regenerate with node scripts/gen-agent-plugins-compatibility.mjs",
    );
    process.exit(1);
  }
  console.log("agent plugins compatibility check: OK");
} else {
  writeFileSync(outputPath, output, "utf8");
  console.log(`wrote ${outputPath}`);
}
