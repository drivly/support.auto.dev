# Domain Evolution

How the system extends itself. When the business evolves — new data
providers, new API endpoints, new integration types, billing model
changes — agents propose domain changes expressed as readings. A
human reviews and approves before changes take effect.

This domain is self-referential: it describes how new readings get
added to GraphDL using GraphDL's own primitives.

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| DomainChange | ChangeId | A proposed addition or modification to the domain model |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| ChangeId | string | format: uuid |
| ReadingText | string | The proposed reading in natural language |
| Rationale | string | Why this change is needed |
| DomainName | string | Which domain the change applies to |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 86 | DomainChange has ReadingText | \*:1 |
| 87 | DomainChange has Rationale | \*:1 |
| 88 | DomainChange has DomainName | \*:1 |
| 89 | FeatureRequest leads to DomainChange | 1:\* |
| 90 | SupportRequest leads to DomainChange | 1:\* |
| 91 | ErrorPattern leads to DomainChange | 1:\* |
