# Changelog

## Unreleased

### BREAKING — portable `plugin.json` `skills:` is exclusive

Aligned with APM 0.29 plugin exclusive skills:

- **Omit** `skills` → keep conventional discovery of immediate `skills/<name>/SKILL.md`.
- **`"skills": []`** → deploy **zero** skills even when `skills/` exists (shadow diagnostic when conventional entries are present). Omit the key to restore discovery.
- **Non-empty list** → only resolved declared names / `skills/<name>` / container `skills`|`./skills`; missing, unknown, traversal, or escape **fail closed** before deploy/lock commit.

**Not the same as** consumer object-form dependency `skills:` (deps-object-subset): an empty list on a dependency entry remains a **manifest parse error** and does not mean “deploy all plugin skills”. Exclusive plugin declaration runs first; consumer subset may further narrow the result.
