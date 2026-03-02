# Tenancy & Domains

Multi-tenancy for GraphDL as a service. Each customer can create
multiple isolated domains (applications). Domains can depend on
other domains as libraries — public domains are importable by
any customer.

This domain is self-referential: GraphDL uses its own primitives
to describe how its own data is scoped and isolated.

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Domain | Customer + DomainSlug | A user's isolated application/model space |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| DomainSlug | string | pattern: [a-z0-9-]+ |
| DomainDescription | string | |
| DomainVisibility | string | enum: private, public |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 130 | Customer has Domain | 1:* |
| 131 | Domain has DomainDescription | *:1 |
| 132 | Domain has DomainVisibility | *:1 |
| 133 | Noun belongs to Domain | *:1 |
| 134 | Reading belongs to Domain | *:1 |
| 135 | GraphSchema belongs to Domain | *:1 |
| 136 | StateMachineDefinition belongs to Domain | *:1 |
| 137 | Generator belongs to Domain | *:1 |
| 138 | Domain depends on Domain | *:* |
