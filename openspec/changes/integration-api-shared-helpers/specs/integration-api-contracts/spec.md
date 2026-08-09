## ADDED Requirements

### Requirement: writeDeployedFile helper

`@bapm/integration-api` MUST export `writeDeployedFile` that writes content under registered deploy roots and returns a `DeployedFile` inventory row.

#### Scenario: Write under deploy roots

- **WHEN** a host calls `writeDeployedFile` with `cwd`, `deployRoots`, a cwd-relative `destRel` under those roots, and string content
- **THEN** the file MUST be created (parents created as needed), the path MUST pass deploy-root containment, and the return value MUST include a posix cwd-relative `path` and optional `primitive` attribution from the call

#### Scenario: Refuse outside deploy roots

- **WHEN** `destRel` resolves outside every registered deploy root
- **THEN** `writeDeployedFile` MUST throw without writing the file

### Requirement: renderPrimitivesMarkdown helper

`@bapm/integration-api` MUST export `renderPrimitivesMarkdown` that builds a deterministic markdown document from attributed primitives for host compile hooks.

#### Scenario: Default AGENTS-style document

- **WHEN** called with a title and a list of primitives (no filter)
- **THEN** the document MUST start with the title, include the generated-by comment, sort primitives by type then name then path, and emit `## name (type)` sections with bodies from `readPrimitiveContent`

#### Scenario: Filter and custom empty message

- **WHEN** a `filter` excludes all primitives
- **THEN** the document MUST still include the title and comment and MUST use `emptyMessage` when provided (otherwise the default empty placeholder)

### Requirement: compileMarkdownReport helper

`@bapm/integration-api` MUST export `compileMarkdownReport` that turns markdown content into a `CompileReport` with optional durable write.

#### Scenario: Preview without write

- **WHEN** `write` is false and `outputFile` is cwd-relative
- **THEN** the helper MUST return `{ path, content, wrote: false }` and MUST NOT create the output file

#### Scenario: Write and basename gate

- **WHEN** `write` is true and optional `requireBasename` matches the output basename
- **THEN** the helper MUST create parent directories as needed, write `content`, and return `wrote: true`

#### Scenario: Reject escape from cwd

- **WHEN** `outputFile` resolves outside `cwd`
- **THEN** the helper MUST throw and MUST NOT write

### Requirement: filterFrontmatterKeys helper

`@bapm/integration-api` MUST export `filterFrontmatterKeys` that drops YAML frontmatter keys not in a caller-supplied allowlist while preserving body text.

#### Scenario: Drop non-preserved keys

- **WHEN** markdown starts with a `---` frontmatter block containing both preserved and non-preserved keys
- **THEN** the returned `content` MUST keep only preserved (and non-key) frontmatter lines, and `droppedKeys` MUST list removed key names in encounter order

#### Scenario: No frontmatter fence

- **WHEN** the source has no leading `---` frontmatter fence
- **THEN** `content` MUST equal the source and `droppedKeys` MUST be empty

### Requirement: Shared command frontmatter allowlist constant

`@bapm/integration-api` MUST export a frozen allowlist constant covering at least `description`, `allowed-tools`, `model`, `argument-hint`, and `input` for hosts that share the same command frontmatter policy. The constant's **exported identifier** MUST NOT embed concrete host product names (so the package stays host-neutral in source).

#### Scenario: Constant usable with filterFrontmatterKeys

- **WHEN** a host passes the exported constant as the preserved set to `filterFrontmatterKeys`
- **THEN** filtering MUST treat those five keys as preserved
