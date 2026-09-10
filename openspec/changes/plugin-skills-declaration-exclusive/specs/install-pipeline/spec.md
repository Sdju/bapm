## ADDED Requirements

### Requirement: Install respects exclusive plugin skills declaration

When install discovers portable Agent Plugin skill primitives from a dependency package root, it MUST use exclusive `plugin.json` `skills:` semantics from `plugin-skills-declaration`: omit → conventional discovery; `"skills": []` → zero skills from that plugin (with shadow diagnostic when applicable); non-empty list → only resolved declared skills. Invalid declared skills MUST fail the install closed before harness deploy or lockfile commit for that run. Successful installs of plugins with an empty declared list MUST NOT materialize shadowed conventional skills and MAY still succeed when other work completes.

#### Scenario: Install deploys only declared plugin skills

- **WHEN** install runs against a portable plugin dependency whose `plugin.json` declares `"skills": ["keep"]` while undeclared `skills/drop/SKILL.md` also exists
- **THEN** only `keep` MUST be materialized to active hosts and `drop` MUST NOT appear under harness skill roots

#### Scenario: Install deploys nothing for empty plugin skills

- **WHEN** install runs against a portable plugin dependency with `"skills": []` and a conventional `skills/hello/SKILL.md`
- **THEN** install MUST NOT materialize `hello` from that plugin and MUST surface the empty-declaration shadow diagnostic

#### Scenario: Invalid declared plugin skill aborts before lock commit

- **WHEN** install encounters a portable plugin whose declared `skills` entry is missing or escapes the plugin root
- **THEN** install MUST fail closed before deploy/lock commit with a diagnostic naming the bad declaration
