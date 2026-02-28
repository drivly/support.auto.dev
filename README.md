# auto.dev GraphDL Domain Model

Atomic fact types for the [auto.dev](https://auto.dev) platform, modeled in [GraphDL](../graphdl-orm).

The goal is to formalize the entire business domain so that:
- An AI support agent can handle customer questions, billing issues, and bug reports with human-in-the-loop approval
- Subscription and upgrade logic is driven by a single state machine instead of scattered across repos
- Support patterns feed back into product development via feature requests
- The system evolves through natural language — modifying readings modifies the system
- Profitability becomes queryable by modeling the full business domain

## Domains

- [Customer & Auth](domains/customer-auth.md) — users, API keys, OAuth
- [Plans & Subscriptions](domains/plans-subscriptions.md) — billing tiers, Stripe subscriptions
- [API Products](domains/api-products.md) — the 12+ APIs, data providers, coverage regions
- [Integrations](domains/integrations.md) — external service connections
- [Support](domains/support.md) — customer support requests
- [Feature Requests](domains/feature-requests.md) — product feedback loop from support
- [Vehicle Data](domains/vehicle-data.md) — vehicle taxonomy, provider ID mapping (from Vindex NORMA model)

## State Machines

- [Subscription Lifecycle](state-machines/subscription-lifecycle.md) — Free → Trialing → Active → PastDue → Cancelled
- [Plan Change](state-machines/plan-change.md) — Starter ↔ Growth ↔ Scale
- [Support Request Lifecycle](state-machines/support-request-lifecycle.md) — Received → Triaging → Investigating → Resolved → Closed
- [Feature Request Lifecycle](state-machines/feature-request-lifecycle.md) — Proposed → Investigating → Approved → InProgress → Shipped → Closed
- [Connect Session](state-machines/connect-session.md) — Pending → Success | Error | Cancelled
