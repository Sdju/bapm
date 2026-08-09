## Context

After shipping the full opt-in host matrix, `@bapm/integration-api` already provides `primitivesMaterialize` and `materializeSkill`. Large hosts still paste assert+mkdir+write+`DeployedFile`, AGENTS.md compile loops, and identical Claude-subset frontmatter allowlists.

## Goals / Non-Goals

**Goals**

- Export four helpers that preserve today’s observable file contents and `CompileReport` / `DeployedFile` shapes.
- Migrate hosts mechanically; keep host-prefixed diagnostic codes and layout paths in packages.

**Non-Goals**

- Ownership sidecars, hook script copy, MCP merge/normalize (P1/P2).
- One declarative host factory.
- Changing core compile orchestration or last-writer policy for shared `AGENTS.md`.

## Decisions

### D1 — `writeDeployedFile` owns assert + mkdir + write + inventory row

```ts
writeDeployedFile(args: {
  cwd: string;
  deployRoots: string[];
  destRel: string; // cwd-relative posix or OS path
  content: string | Buffer;
  primitive?: { name: string; packageName?: string };
}): DeployedFile
```

Resolves `destRel` under `cwd`, calls `assertUnderDeployRoots`, `mkdirSync(dirname, { recursive: true })`, writes, returns `{ path: toPosixRel(...), primitive? }`.

### D2 — Compile split: render string vs write report

```ts
renderPrimitivesMarkdown(args: {
  primitives: AttributedPrimitive[];
  title: string;
  filter?: (p: AttributedPrimitive) => boolean;
  emptyMessage?: string;
  sectionHeading?: (p: AttributedPrimitive) => string;
  preferredFile?: string; // passed to readPrimitiveContent
}): string

compileMarkdownReport(args: {
  cwd: string;
  outputFile: string;
  write: boolean;
  content: string;
  requireBasename?: string;
  outsideCwdMessage?: string;
}): CompileReport
```

Default section heading: `` `${name} (${type})` ``. Default empty: `_No discoverable primitives._`. `compileMarkdownReport` refuses paths outside cwd (same rules as cursor today) and optional basename gate (GEMINI.md).

### D3 — `filterFrontmatterKeys` is line-based allowlist

Match existing cursor/claude/grok behavior: parse `---` fence, keep lines whose key is in `preserved` (or non-key lines), drop others, return `{ content, droppedKeys }`. Export optional constant `SHARED_COMMAND_FRONTMATTER_KEYS` for the shared five keys — hosts may still pass a custom set. The export name MUST stay host-neutral (no product names in the identifier).

### D4 — Migration is behavior-preserving

No intentional content diffs. Hosts keep custom filters/titles/basenames via helper options.

## Risks / Trade-offs

- Gemini’s instruction-only heading without `(type)` needs `sectionHeading` — do not hardcode AGENTS layout.
- Copilot uses `toPosixRel` for outside-cwd check (slightly different from `relative` + `..` on Windows); `compileMarkdownReport` should use the same containment rule as cursor (`relative` + reject `..` prefix) — verify copilot tests still pass; adjust if needed to match prior host behavior per host call site by keeping thin wrappers where checks differ.

## Migration Plan

1. Implement + unit-test helpers in integration-api.
2. Migrate full-AGENTS hosts (cursor, opencode, grok-build, codex), then thin/filter hosts (kiro, antigravity, copilot), then gemini (basename + custom heading).
3. Migrate frontmatter hosts (cursor, claude, grok-build).
4. Migrate markdown deploy writes where the pattern is pure (instruction/agent/command without extra transform before write — command hosts call filter then writeDeployedFile).
5. README + build/tests.
