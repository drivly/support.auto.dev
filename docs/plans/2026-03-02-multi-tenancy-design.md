# Multi-Tenancy Design — Domain-Scoped GraphDL

**Date:** 2026-03-02
**Context:** GraphDL needs to serve multiple users, each with their own isolated domain models, on a shared MongoDB instance.

## Decisions

- **Tenant boundary:** Per API key (auth.vin user). No organization entity for now.
- **Isolation:** Domain entity scopes all ORM primitives. Child entities inherit scope through their parent.
- **API surface:** High-level readings API on apis/ + raw Payload REST as escape hatch.
- **Domain dependencies:** Domains can depend on other domains (as libraries). Public domains are importable by any user.

## Separation of Concerns

Two separate sets of changes:

### 1. auto.dev-graphdl (the application domain model)

Business-level readings about what a Domain IS:

| # | Reading | Multiplicity |
|---|---------|-------------|
| 130 | Customer has Domain | 1:* |
| 131 | Domain has DomainDescription | *:1 |
| 132 | Domain has DomainVisibility | *:1 |
| 133 | Domain depends on Domain | *:* |

These describe the product: customers create domains, domains have descriptions and visibility, domains can depend on other domains. This is the same kind of reading as "Customer submits SupportRequest."

### 2. graphdl-orm (the framework)

Built-in framework feature: every top-level ORM primitive is domain-scoped.

- Noun belongs to a Domain
- Reading belongs to a Domain
- GraphSchema belongs to a Domain
- StateMachineDefinition belongs to a Domain
- Generator belongs to a Domain

These are NOT readings in the application domain model. They are structural changes to graphdl-orm itself — the framework knows about Domains natively. A customer using GraphDL to model their app should not see "Noun belongs to Domain" in their schema; it's infrastructure.

Implementation: add a `domain` relationship field to these 5 collections in graphdl-orm's source code, with access control that filters by domain ownership. This is a framework concern, not a domain concern.

## What This Produces

**From the application readings (auto.dev-graphdl):**
- Domains collection with `customer` (relationship), `domainSlug` (text), `domainDescription` (text), `domainVisibility` (select: private/public)
- Domain dependency M:M relationship

**From the framework changes (graphdl-orm):**
- `domain` relationship field on Nouns, Readings, GraphSchemas, StateMachineDefinitions, Generators
- Access control scoping all reads/writes by domain ownership
- Noun resolution across domain dependencies

## Noun Resolution Across Dependencies

When a domain depends on another, its readings can reference nouns from the dependency:

1. Readings in "support-app" reference "Customer" (defined in "auth" domain)
2. Generator walks the dependency graph: support-app → auth
3. Customer noun is found in the auth domain and used to resolve the reading

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
GET/POST/PATCH /graphdl/raw/nouns            → proxied to Payload /api/nouns with domain filter
GET/POST/PATCH /graphdl/raw/graph-schemas    → proxied to Payload /api/graph-schemas
... (all collections)
```

## Implementation Sequence

1. Add application-level tenancy readings to `auto.dev-graphdl/domains/tenancy.md` (done)
2. Add `domain` field to graphdl-orm's 5 top-level collections (framework change)
3. Add domain-aware access control to graphdl-orm
4. Seed tenancy readings + existing domains, verify generator output
5. Add `/graphdl/*` routes to apis/ Worker
6. Wire the high-level readings API to Payload REST calls with domain scoping
