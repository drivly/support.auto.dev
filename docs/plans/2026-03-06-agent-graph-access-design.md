# Agent Graph Access & Permission Model Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Give the support agent a unified tool to query any fact in the knowledge graph, with permission scoping and state integrity checking against authoritative sources.

**Scope:** Query-only graph tool, permission readings, integrity checking, domain model corrections, hardcoded constraint removal.

---

## 1. Domain Model Corrections

### New Subtype Declarations

- SupportResponse is a subtype of Message
- Request is a supertype of SupportRequest and FeatureRequest

### Shared Supertype — Request

Request absorbs the common readings from SupportRequest and FeatureRequest:

| Reading | Multiplicity |
|---------|-------------|
| Request has Subject | \*:1 |
| Request has Description | \*:1 |
| Request concerns APIProduct | \*:\* |
| SupportRequest is a subtype of Request | subtype |
| FeatureRequest is a subtype of Request | subtype |

Remove the duplicate Subject/Description/APIProduct readings from support.md and feature-requests.md.

### Consolidate SupportResponse Constraints into support.md

Move from listings.md to support.md:
- SupportResponse must not name ListingSource (+ all instance facts)
- SupportResponse must not reference IngestionPipeline (+ all instance facts)

Move from api-products.md to support.md:
- SupportResponse must not claim availability of UnavailableFeature (+ instance facts)

These constrain the support agent's output. They belong with the support concern regardless of what domain concept they reference.

### Fix Malformed Instance Facts

| Current (malformed) | Fix |
|---|---|
| "APIProduct covers CoverageRegion 'US'" (overly broad) | Per-product instance facts: "APIProduct 'listings' covers CoverageRegion 'US'", "APIProduct 'vinDecode' covers CoverageRegion 'International'", etc. |
| "APIProduct 'build' returns factory-installed options beyond standard equipment for the trim" (prose) | New fact types: "APIProduct resolves at TaxonomyLevel" (\*:1), "APIProduct returns EquipmentScope" (\*:1). Instances: "'build' resolves at 'VIN'", "'specs' resolves at 'YearMakeModelTrim'", "'build' returns 'FactoryOptions'", "'specs' returns 'StandardEquipment'" |
| "APIProduct 'specs' complements APIProduct 'build' for full vehicle equipment detail" (prose) | New fact type: "APIProduct complements APIProduct" (\*:\*). Instance: "'specs' complements 'build'" |
| "IngestionPipeline 'src.do' caches and proxies third-party APIs" (prose) | New fact type: "IngestionPipeline performs PipelineOperation" (\*:\*). Instances: "'src.do' performs 'cache'", "'src.do' performs 'proxy'" |

### Remove Non-Facts

| Reading | Reason |
|---|---|
| "Subscription starts with TrialEnd" | Process description. "Subscription has TrialEnd" already exists; model as alethic mandatory constraint on that role. |
| "Listing is sourced from dealers only" | Redundant with "Listing is sold by Dealer" (\*:1) which already makes Dealer mandatory. |
| "Year minimum reflects the 1981 VIN standard adoption" | Rationale for value constraint already on Year value type (minimum: 1981). |

### Pricing Clarifications

- Free is a system status (no billing relationship), not a visible plan. Customers on Free have no Stripe customer, no payment method.
- Starter is the entry-level paid plan: $0/mo base + metered billing.
- Free and Starter have the same API access: vinDecode, listings, photos.
- All plans include 1,000 free API calls per month.
- "SupportResponse must not reference ProtectedConcept 'Free plan'" is correct — the agent talks about Starter as the entry tier.

### New Value Types

| Value | Type | Constraints |
|-------|------|------------|
| TaxonomyLevel | string | enum: VIN, YearMakeModelTrim, YearMakeModel, MakeModel, Make |
| EquipmentScope | string | enum: StandardEquipment, FactoryOptions |
| PipelineOperation | string | enum: cache, proxy, load, store, normalize |

---

## 2. Agent Graph Tool

### One Tool: `query_graph`

The agent gets a single tool to query any fact in the knowledge graph.

```
query_graph({ query: "Customer lippertz@gmail.com has Plan" })
```

### Flow

1. Agent writes a fact pattern in natural language (using vocabulary from the readings in its system prompt)
2. Support worker sends the query to `/graphdl/parse` — the existing parse endpoint tokenizes it, identifies nouns and predicate structure
3. Worker translates the parsed predicate into a Payload query against `/graphdl/raw/resources`
4. **If fact exists in graph** — check against authoritative source (see Section 4) — return fact if they match
5. **If fact missing from graph** — query authoritative source — populate graph — return fact
6. **If mismatch between graph and source** — block, return state integrity violation to agent

### Permission Scoping

The worker knows the caller's identity (session email) and role (USER/ADMIN).

| Fact type | Customer access | Admin access |
|-----------|----------------|--------------|
| Schema facts (plan tiers, pricing, API products) | Allowed | Allowed |
| Instance facts about the requesting customer | Allowed | Allowed |
| Instance facts about other customers | Blocked | Allowed |

The distinction is schema (public definitions) vs instance (per-customer data), scoped by the requesting identity.

---

## 3. System Prompt — Remove Hardcoded Constraints

### Current State

`prompt.ts` has two sources of constraints:
1. Hardcoded `DEONTIC_CONSTRAINTS` array (9 items) — duplicates domain file content
2. Dynamically fetched readings from the graph

### Fix

- Remove the `DEONTIC_CONSTRAINTS` array entirely
- Readings fetched from the graph already include deontic constraints (seeded as readings containing "must")
- The `verify()` pipeline already extracts constraints from the graph independently
- Business rules accumulated from re-draft reasons (stored in KV) stay — they are runtime knowledge, not domain-modeled

One source of truth: the graph.

---

## 4. State Integrity Checking

### Authoritative Source Resolution

- Reading belongs to Domain
- Domain has Service (new reading — not yet modeled)
- Service has BaseURL

When the `query_graph` tool needs to verify or populate a fact:
1. Identify which domain the reading belongs to
2. Look up the domain's authoritative service
3. Query that service's API for the canonical value
4. Compare with graph value

For the current scope, auth.vin is the only authoritative source (for Customer/Subscription/Plan facts). The pattern generalizes to any API-backed fact.

### Integrity Violation Handling

When the graph value and the authoritative source disagree:
- Block plan-related questions
- Agent tells the customer there's an account issue being investigated
- Worker logs the violation for operational review
- Agent can still help with non-plan questions

### Cookie Treatment

The session cookie is used for authentication (identity) only. It is never trusted for business logic. The graph is the read layer; the authoritative service is the write layer.

---

## 5. Permission Readings (Subset Constraints)

Permissions are expressed as readings with subset constraints, not code-level checks.

### Current Scope (Query-Only)

```
Agent queries Graph                                                (no constraint)
Customer queries own Fact                                          (permitted)
Customer who queries other Customer Fact ⊂ Customer who has AdminRole  (subset)
```

### Fact Assertion (Write)

```
Agent asserts Fact                                                 (*:*)
Agent who asserts PlanChange ⊂ Agent who has AdminRole             (subset)
PlanChange requires explicit Customer confirmation                 (deontic, already exists)
```

---

## 6. Event Firing from Fact Assertions

### Current State

The state machine runtime lives in `apis/state/` with instance state in KV. The graphdl-orm has all the schema infrastructure but no runtime wiring:

- **Events collection** exists with fields: type, timestamp, graph, stateMachine — but nothing creates instances
- **EventTypes** are seeded from domain markdown and reference Verbs and Transitions
- **Transitions** link statuses via EventTypes, with optional Verb -> Function -> CallbackUrl chains
- **Hook patterns** are well-established: Readings `afterChange` creates Roles, GraphSchemas `beforeChange` creates Constraints

The pattern to follow is already in the codebase — just not connected to event firing.

### Design

When a Resource is created or updated in GraphDL, and the change corresponds to a Verb that is linked to an EventType:

1. **Resources `afterChange` hook** detects the change
2. Looks up whether the Resource's graph schema has a Verb associated with the change
3. If a Verb exists: finds the EventType created by that Verb (`canBeCreatedbyVerbs` relationship)
4. Finds the Transition that references that EventType from the current status
5. Creates an Event instance in the `events` collection (type, timestamp, resource, stateMachine)
6. Updates the Resource's stateMachine status to the Transition's target
7. If the Transition's EventType has a Verb -> Function -> CallbackUrl: fires the HTTP callback

### Example Flow

```
Agent asserts: "Customer lippertz@gmail.com subscribes to Plan 'Growth'"
  -> Worker calls POST /graphdl/raw/resources (create/update resource)
  -> Resources afterChange hook fires
  -> Verb "subscribe" -> EventType "subscribe" -> Transition(Active -> Active)
  -> Event created in events collection
  -> Status updated on resource
  -> Callback: POST auth.vin/api/internal/billing/change-plan
```

### What This Replaces

- `apis/state/runtime.ts` — no longer needed; GraphDL is the runtime
- `apis/state/helpers.ts` — queries move into the hook
- State instance KV storage — Resources collection stores state directly
- Separate `/state/:machineType/:instanceId/:event` endpoint — assertions through `/graphdl/raw/resources` fire events

### The `graph` Tool Becomes Read + Write

The agent's single tool handles both queries and assertions:

```
graph({ query: "Customer lippertz@gmail.com has Plan" })           -> read
graph({ assert: "Customer lippertz@gmail.com subscribes to Plan 'Growth'" })  -> write (fires event)
```

Subset constraints gate which assertions are permitted. The parse pipeline structures the natural language. The hook handles the event machinery.

### Migration Path

1. Implement the Resources `afterChange` hook in graphdl-orm
2. Add an `/assert` endpoint to graphdl-orm (parallel to `/parse` and `/extract`)
3. Add `assert_graph` proxy in apis/ (parallel to `parseProxy`, `extractProxy`)
4. Wire the agent's `graph` tool to call assert for writes
5. Once verified, deprecate `apis/state/` runtime and KV storage

---

## Architecture Summary

```
Customer -> chat.auto.dev -> support worker -> graph tool
                                                  |
                                        query or assert?
                                        /              \
                                    query:            assert:
                                /graphdl/parse      /graphdl/parse
                                      |                   |
                              /graphdl/raw/*       /graphdl/raw/resources
                                (read facts)         (create/update)
                                      |                   |
                          fact missing?              afterChange hook
                          -> auth.vin                     |
                             (populate)            Verb -> EventType
                          fact mismatch?                  |
                          -> block + log            Transition fires
                          fact matches?                   |
                          -> return               Callback -> auth.vin
                                                         |
                                                  Event recorded
                                                  Status updated
```

The agent speaks natural language. The parse pipeline structures it. The graph stores it. Authoritative services verify it. Subset constraints gate it. Assertions fire events. One interface, no bespoke tools.
