## ADDED Requirements

### Requirement: Registries aliases are typed hostname lists
On read, `registries.<name>.aliases` MUST be accepted only as an array of strings. Each string MUST be a hostname or a URL from which a hostname can be extracted. Non-array / non-string alias values MUST fail validation with a diagnostic naming the registry path. Parsed aliases MUST be retained on the in-memory registry entry so credential host-class union can bind alias hosts to the registry entry’s `url` host class. Empty arrays MUST be allowed. Absence of `aliases` MUST remain valid.

#### Scenario: String alias array accepted
- **WHEN** a registry object includes `aliases: ["mirror.example.net", "https://cdn.example.org/path"]`
- **THEN** parse MUST succeed and retain alias hostnames usable for credential class union

#### Scenario: Non-array aliases rejected
- **WHEN** a registry object sets `aliases` to a string or object instead of an array
- **THEN** validation MUST fail closed with a diagnostic naming `registries.<name>.aliases`
