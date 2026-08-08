## MODIFIED Requirements

### Requirement: MarketplacePlugin and MarketplaceManifest

The system MUST represent each plugin with `name`, `source` (string or structured object), optional `description`, `version`, `tags`, optional `registry` string, and optional `tag_pattern`. A manifest MUST hold marketplace `name`, ordered plugins, and optional metadata fields (`owner_name`, `description`, `plugin_root`). Manifest MUST support exact case-insensitive plugin lookup by name. Manifest MUST expose search-by-query helpers that match against plugin `name`, `description`, and `tags` (case-insensitive substring), used by top-level search and resolve wiring.

#### Scenario: Find plugin by name case-insensitive

- **WHEN** a manifest contains a plugin named `Foo` and a caller looks up `foo`
- **THEN** the lookup MUST return that plugin entry

#### Scenario: Search matches description and tags

- **WHEN** a manifest plugin has description or tags containing query text
- **THEN** manifest search MUST include that plugin in the result set
