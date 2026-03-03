# Tenancy & Domains

Customers can create multiple isolated domains (applications).
Domains can depend on other domains as libraries — public domains
are importable by any customer.

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

| Reading | Multiplicity |
|---------|-------------|
| Customer has Domain | 1:\* |
| Domain has DomainDescription | \*:1 |
| Domain has DomainVisibility | \*:1 |
| Domain depends on Domain | \*:\* |
