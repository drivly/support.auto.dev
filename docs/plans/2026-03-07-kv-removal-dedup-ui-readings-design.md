# Design: KV Removal, Seed Dedup, UI Readings

Date: 2026-03-07

## Overview

Three related tasks that move the platform toward a fully model-driven architecture:

1. **Remove GRAPHDL_USERS KV** from the apis worker
2. **Prevent duplicate state machine definitions** during reseed
3. **Model chat.auto.dev UI** as domain model readings

## Task A: Remove GRAPHDL_USERS KV

### Problem

The `GRAPHDL_USERS` KV namespace serves two purposes:
- **User API key caching** in `withGraphDLUser` (email → API key, 24h TTL)
- **State machine instance storage** in `helpers.ts` (`state:{type}:{id}` → JSON)

KV adds complexity and stale-cache risk. The graphdl-orm already has a `StateMachines` collection for instance state.

### Design

**User API key caching**: Remove entirely. `withGraphDLUser` will re-provision on every request. Latency cost (~100ms extra) is acceptable; optimize later if needed.

**State machine instances**: Move to graphdl-orm's `StateMachines` collection via the raw proxy API:
- `getInstance` → `GET /api/state-machines?where[name][equals]={instanceId}&where[stateMachineType][equals]={definitionId}`
- `putInstance` → `POST /api/state-machines` (create) or `PATCH /api/state-machines/{id}` (update status)

**Prerequisite**: Fix `StateMachines.ts` — the `stateMachineType` field has `relationTo: 'state-machines'` (self-referential bug). Must be `'state-machine-definitions'`.

### Files Changed

| File | Change |
|------|--------|
| `graphdl-orm/src/collections/StateMachines.ts` | Fix `stateMachineType` relationTo |
| `apis/graphdl/with-graphdl-user.ts` | Remove KV cache read/write |
| `apis/state/helpers.ts` | Replace KV getInstance/putInstance with graphdl-orm API calls |
| `apis/graphdl/helpers.ts` | Remove `GRAPHDL_USERS` from Env type |
| `apis/wrangler.jsonc` | Remove GRAPHDL_USERS KV binding |

## Task B: Seed Dedup for State Machines

### Problem

`seedStateMachine()` in `graphdl-orm/src/seed/handler.ts` creates state machine definitions, statuses, transitions, and guards unconditionally. Reseeding produces duplicates. Other seed functions (`ensureNoun`, `ensureDomain`, `ensureEventType`) already have dedup.

### Design

Add four `ensure*` functions following the existing pattern:

```
ensureStateMachineDefinition(payload, title)  — dedup by title
ensureStatus(payload, name, definitionId)     — dedup by name + definition
ensureTransition(payload, from, to, eventType) — dedup by from + to + eventType
ensureGuard(payload, transition, expression)   — dedup by transition + expression
```

Update `seedStateMachine()` to call these instead of `payload.create()` directly.

### Files Changed

| File | Change |
|------|--------|
| `graphdl-orm/src/seed/handler.ts` | Add ensure* functions, update seedStateMachine() |

## Task C: Model chat.auto.dev UI as Domain Readings

### Core Principles

1. **Permissions are implicit in fact types.** If `Admin redrafts SupportResponse with Reason` exists as a reading, Admin has permission to redraft. No separate "is permitted to" readings.

2. **Subtyping creates role hierarchy.** `Admin is a subtype of Customer` gives Admin all Customer capabilities plus Admin-specific ones.

3. **Draft visibility is a state machine.** SupportResponse lifecycle (Draft -> Sent) controls what customers see — they only see responses in "Sent" status.

4. **Display properties are instance facts.** `Status 'Triaging' has DisplayColor 'amber'` — colors are data in a `ui` domain, not hardcoded.

5. **SubTabs derive from state machine topology.** The "Escalated" subtab exists because Triaging has no incoming transitions from Resolved (it's a pre-resolution state). Never modeled explicitly.

### Domain Changes

#### `customer-auth.md` additions

New value type: `EmailDomain` (string)

New readings:
- `Admin is a subtype of Customer` (subtype)
- `Customer has EmailDomain` (*:1)

New instance facts:
- `Customer with EmailDomain 'driv.ly' has UserRole 'ADMIN'`
- `Customer with EmailDomain 'repo.do' has UserRole 'ADMIN'`

#### `support.md` additions

New readings (Admin-specific fact types = implicit permissions):
- `Admin redrafts SupportResponse with Reason` (*:*)
- `Admin resolves SupportRequest` (*:*)
- `Admin reopens SupportRequest` (*:*)
- `Admin merges SupportRequest into SupportRequest` (*:*)
- `Admin adds Constraint to SupportResponse` (*:*)
- `SupportResponse is a subtype of Message` (subtype)

#### New state machine: `support-response-lifecycle.md`

States: Draft, Sent

| From | To | Event |
|------|-----|-------|
| Draft | Sent | send |

This controls customer visibility: customers only see SupportResponses that have reached "Sent" status.

#### New domain: `ui.md`

Value types:
- `DisplayColor` (string, enum: green, amber, red, blue, violet, gray)

Readings:
- `Status has DisplayColor` (*:1)

Instance facts mapping every status across all state machines to a display color:
- Received -> blue, Triaging -> amber, Investigating -> violet
- WaitingOnCustomer -> amber, Resolved -> green
- Draft -> gray, Sent -> green
- Proposed -> blue, Approved -> green, InProgress -> violet, Shipped -> green

#### `feature-request-lifecycle.md` simplification

Remove `Closed` state entirely. Remove `reject` and `confirm` transitions. Add `defer` (Investigating -> Proposed). Shipped becomes the terminal state.

Final transitions:
| From | To | Event |
|------|-----|-------|
| Proposed | Investigating | investigate |
| Investigating | Approved | approve |
| Investigating | Proposed | defer |
| Approved | InProgress | startWork |
| InProgress | Shipped | deploy |

#### `feature-requests.md` enrichment

New readings:
- `Customer votes on FeatureRequest` (*:*)
- `FeatureRequest has Priority` (*:1)

Reuses `Priority` value type from support domain.

### Files Changed

| File | Change |
|------|--------|
| `support.auto.dev/domains/customer-auth.md` | Add EmailDomain, Admin subtype |
| `support.auto.dev/domains/support.md` | Add Admin fact types, SupportResponse subtype |
| `support.auto.dev/domains/feature-requests.md` | Add votes, priority |
| `support.auto.dev/domains/ui.md` | New domain for display properties |
| `support.auto.dev/state-machines/support-response-lifecycle.md` | New state machine |
| `support.auto.dev/state-machines/feature-request-lifecycle.md` | Simplify (remove Closed) |

## Execution Order

1. Task B first (seed dedup) — prevents duplicates before any reseeding
2. Task A second (KV removal) — depends on StateMachines.ts fix from B's prerequisite
3. Task C third (readings) — domain model changes, then reseed
