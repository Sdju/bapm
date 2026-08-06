## MODIFIED Requirements

### Requirement: Registries parse-time validation
When a `registries` block is present, the system MUST validate registry entries for http(s) URL scheme and MUST reject unknown keys inside registry entries and tokens embedded in YAML when APM/OpenAPM rules require it (req-mf-014, req-mf-015). Allowed object keys are `url`, `aliases`, `insecure`, and `x-*` vendor extensions; other keys MUST fail (mf-015). The boolean `insecure` MAY be set on a registry object (req-sc-006). For any registry URL using the `http://` scheme, parse MUST fail closed unless `insecure: true` is set on that object entry **or** the URL host is loopback (`127.0.0.0/8`, `localhost`), IPv6 loopback (`::1`), or an RFC1918 private address; string-form registry entries (URL only) have no `insecure` flag and therefore MUST satisfy the host exemption to use `http://`. Diagnostics for http-gate failures MUST name the registry. The key `registries.default` is a special-case name pointer: it MUST NOT be validated as a registry URL; when present it MUST be a non-empty string naming a declared registry entry.

#### Scenario: Valid https registry accepted
- **WHEN** a registry entry provides an https URL with allowed keys only
- **THEN** the system MUST accept the registries block

#### Scenario: registries.default names declared registry
- **WHEN** `registries` includes named entries and `default: <name>` where `<name>` is one of those entries
- **THEN** the system MUST accept the block and retain `default`

#### Scenario: registries.default refers to missing registry
- **WHEN** `registries.default` names a registry that is not declared in the block
- **THEN** the system MUST reject the manifest

#### Scenario: Typo registry key rejected
- **WHEN** a registry entry contains an unknown/typo key
- **THEN** the system MUST reject it (req-mf-015)

#### Scenario: Non-http(s) scheme rejected
- **WHEN** a registry URL uses a non-http(s) scheme (for example `ftp:`)
- **THEN** the system MUST reject it (req-mf-014)

#### Scenario: insecure true allows remote http registry
- **WHEN** a named registry object sets `url: http://example.com/...` and `insecure: true`
- **THEN** the system MUST accept the registries block

#### Scenario: remote http without insecure rejected with registry name
- **WHEN** a named registry object sets a non-exempt `http://` URL without `insecure: true`
- **THEN** the system MUST reject the manifest with a diagnostic that names that registry

#### Scenario: loopback http allowed without insecure
- **WHEN** a registry URL uses `http://127.0.0.1/...`, `http://localhost/...`, `http://[::1]/...`, or an RFC1918 host
- **THEN** the system MUST accept the entry without requiring `insecure: true`

#### Scenario: string-form remote http rejected
- **WHEN** a registry entry is a bare string `http://example.com/...` (no object, no insecure flag) and the host is not exempt
- **THEN** the system MUST reject the manifest naming that registry
