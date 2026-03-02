# Multi-Tenancy Design — Domain-Scoped GraphDL

**Date:** 2026-03-02
**Context:** GraphDL needs to serve multiple users, each with their own isolated domain models, on a shared MongoDB instance. Tenancy is expressed as readings — not bolted-on infrastructure.

## Decisions

- **Tenant boundary:** Per API key (auth.vin user). No organization entity for now.
- **Isolation:** Domain entity in graphdl-orm. Top-level ORM primitives belong to a Domain. Child entities inherit scope through their parent.
- **API surface:** High-level readings API on apis/ + raw Payload REST as escape hatch.
- **Domain dependencies:** Domains can depend on other domains (as libraries). Public domains are importable by any user. Private domains are owner-only.

## Domain: Tenancy & Domains

### Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Domain | Customer + DomainSlug | A user's isolated application/model space |

### Value Types

| Value | Type | Constraints |
|-------|------|------------|
| DomainSlug | string | pattern: [a-z0-9-]+ |
| DomainDescription | string | |
| DomainVisibility | string | enum: private, public |

### Readings

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

## What This Produces

The generator turns these 9 readings into:

- **Domains collection** with `customer` (relationship), `domainSlug` (text, unique per customer), `domainDescription` (text), `domainVisibility` (select: private/public)
- **`domain` relationship field** on Nouns, Readings, GraphSchemas, StateMachineDefinitions, Generators
- **`domainDependsOnDomain` M:M** — the dependency graph between domains
- **Access control** scoping all reads/writes: user sees only their own domains, plus public domains they depend on

## Noun Resolution Across Dependencies

When a domain depends on another, its readings can reference nouns from the dependency. The generator resolves nouns across the dependency chain:

1. Readings in "support-app" reference "Customer" (defined in "auth" domain)
2. Generator walks the dependency graph: support-app → auth
3. Customer noun is found in the auth domain and used to resolve the reading

This means the OpenAPI/Payload/XState output for "support-app" includes Customer-related schemas inherited from "auth."

## API Surface on apis/

### High-Level Readings API

```
POST   /graphdl/domains                      → create a domain
GET    /graphdl/domains                      → list my domains
GET    /graphdl/domains/:slug                → get domain details

POST   /graphdl/domains/:slug/readings       → create a reading (nouns auto-created)
GET    /graphdl/domains/:slug/readings       → list readings in domain
DELETE /graphdl/domains/:slug/readings/:id   → remove a reading

POST   /graphdl/domains/:slug/state-machines → create a state machine
POST   /graphdl/domains/:slug/generate       → run generators, return output

POST   /graphdl/domains/:slug/dependencies   → add a domain dependency
GET    /graphdl/domains/:slug/dependencies   → list dependencies

GET    /graphdl/library                      → browse public domains
```

### Raw Payload Escape Hatch

```
GET/POST/PATCH /graphdl/raw/nouns            → proxied to Payload /api/nouns with tenant+domain filter
GET/POST/PATCH /graphdl/raw/graph-schemas    → proxied to Payload /api/graph-schemas
... (all 22 collections)
```

## Implementation Sequence

1. Add tenancy domain readings to `auto.dev-graphdl/domains/tenancy.md`
2. Seed tenancy readings into graphdl-orm alongside existing domains
3. Verify the generator produces the Domain collection and domain fields on existing collections
4. Add domain-aware access control to graphdl-orm
5. Add `/graphdl/*` routes to apis/ Worker
6. Wire the high-level readings API to Payload REST calls with domain scoping
