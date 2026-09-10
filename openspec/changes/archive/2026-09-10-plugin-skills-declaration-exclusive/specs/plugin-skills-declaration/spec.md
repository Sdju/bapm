## Purpose

Defines exclusive `plugin.json` `skills:` declaration for portable Agent Plugins: omit keeps conventional discovery, an empty list deploys zero skills, and a non-empty list is the complete fail-closed deploy set at conventional container depth.

## ADDED Requirements

### Requirement: Omitting skills keeps conventional discovery

When a portable Agent Plugins `plugin.json` omits the top-level `skills` key, skill discovery MUST use conventional layout only: immediate child directories of `skills/` that contain `SKILL.md` (expected depth). Nested directories deeper than one level under `skills/` MUST NOT become skills via conventional discovery. Absence of a `skills/` directory MUST yield an empty skill set without error.

#### Scenario: Omit discovers immediate skills only

- **WHEN** `plugin.json` has no `skills` key and the plugin root has `skills/alpha/SKILL.md` and `skills/nested/deeper/SKILL.md`
- **THEN** discovery MUST expose only `alpha` and MUST NOT expose `nested` or `deeper` as skills

#### Scenario: Omit with no skills directory

- **WHEN** `plugin.json` has no `skills` key and there is no `skills/` directory
- **THEN** discovery MUST return zero skills without failing the manifest load

### Requirement: Empty skills list deploys zero skills

When `plugin.json` declares `"skills": []`, the plugin MUST expose zero deployable skills even if conventional `skills/<name>/SKILL.md` entries exist. Install MUST NOT materialize those shadowed skills. When the empty list shadows at least one conventionally discoverable skill, the system MUST emit a default-visible diagnostic naming the package (or plugin root) and directing the author to declare intended skills (or a conventional container) or remove the key to restore discovery.

#### Scenario: Empty array shadows skills directory

- **WHEN** `plugin.json` declares `"skills": []` and `skills/hello/SKILL.md` exists
- **THEN** discovery/install MUST deploy zero skills from that plugin and MUST emit a diagnostic that empty `skills` shadowed conventional entries

#### Scenario: Empty array with no skills directory

- **WHEN** `plugin.json` declares `"skills": []` and no conventional skills exist
- **THEN** discovery MUST return zero skills and MUST NOT require a shadow diagnostic solely for the empty directory case

### Requirement: Declared skills list is exclusive and fail-closed

When `plugin.json` declares a non-empty `skills` array, that list MUST be the complete set of skills from the plugin (exclusive): conventional directory scan MUST NOT add undeclared siblings. Each entry MUST resolve to a skill at conventional depth under the plugin root (skill directory name, path under `skills/`, or a conventional container that expands to immediate `SKILL.md` children). Missing, unknown, empty, traversal, or escaping declared entries MUST fail closed with a non-zero outcome before deployment or lockfile commit. Duplicate entries MUST be treated as a single skill after resolution.

#### Scenario: Declared subset excludes undeclared siblings

- **WHEN** `plugin.json` declares `"skills": ["keep"]` (or an equivalent path to `skills/keep`) while `skills/keep/SKILL.md` and `skills/drop/SKILL.md` both exist
- **THEN** only `keep` MUST be discovered/deployed and `drop` MUST NOT

#### Scenario: Declared container expands at expected depth

- **WHEN** `plugin.json` declares the conventional container `skills` (or `./skills`) and that directory has immediate children `a/SKILL.md` and `b/SKILL.md`
- **THEN** discovery MUST expose both `a` and `b` and MUST NOT recurse into deeper nested skill layouts as additional skills

#### Scenario: Unknown or missing declared skill fails closed

- **WHEN** `plugin.json` declares a skill name or path that does not resolve to a valid conventional-depth skill inside the plugin root
- **THEN** install MUST fail closed before deploy/lock commit with a diagnostic naming the bad declaration

#### Scenario: Traversal or escape in skills entry fails closed

- **WHEN** a `skills` entry contains path traversal (`..`), an absolute path, or resolves outside the plugin root
- **THEN** load/discover/install MUST fail closed naming the bad entry

### Requirement: Skills key shape is validated

When the `skills` key is present, its value MUST be an array of strings. Non-array shapes, non-string elements, or empty-string elements MUST fail closed at manifest validation (not silently ignored as an unknown field). Omitting the key remains valid.

#### Scenario: Non-array skills rejected

- **WHEN** `plugin.json` sets `"skills": "hello"` or `"skills": { "hello": true }`
- **THEN** manifest validation MUST fail closed

#### Scenario: Non-string element rejected

- **WHEN** `plugin.json` sets `"skills": [1]` or `"skills": [null]`
- **THEN** manifest validation MUST fail closed

### Requirement: Consumer dep subset still applies after exclusive discovery

Exclusive plugin `skills:` MUST run before consumer object-form dependency `skills:` subset filtering. A consumer subset MAY further narrow the exclusive set. Consumer `skills: []` on a dependency entry remains a manifest parse error per `deps-object-subset` and MUST NOT be reinterpreted using plugin exclusive empty-list semantics.

#### Scenario: Consumer subset narrows declared plugin skills

- **WHEN** a plugin declares `"skills": ["alpha", "beta"]` and the consumer dependency entry sets `skills: [alpha]`
- **THEN** install MUST deploy only `alpha` from that dependency

#### Scenario: Dep empty skills still parse-fails

- **WHEN** a consumer object-form dependency sets `skills: []`
- **THEN** manifest parse MUST fail closed as today and MUST NOT mean “deploy all plugin skills”
