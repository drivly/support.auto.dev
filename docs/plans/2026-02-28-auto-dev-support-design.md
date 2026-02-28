# auto.dev GraphDL Support System Design

## Vision

Formalize the auto.dev business domain as GraphDL readings so that:
- An AI support agent handles customer questions, billing issues, and bug reports with human-in-the-loop approval
- Subscription and upgrade logic is driven by a single state machine instead of scattered across repos
- Support patterns feed back into product development via feature requests
- The system evolves through natural language — modifying readings modifies the system
- Profitability becomes queryable by modeling the full business domain

## Architecture

Three layers: definition, implementation, execution.

### Definition: GraphDL

GraphDL is the source of truth. The domain is expressed as atomic fact types
(readings), which define graph schemas, roles, constraints, and state machines.

65 readings across 7 domains:
- Customer & Auth (6 readings)
- Plans & Subscriptions (6 readings)
- API Products (9 readings)
- Integrations (3 readings)
- Support (6 readings)
- Feature Requests (5 readings)
- Vehicle Data (30 readings)

5 state machines:
- Subscription Lifecycle (Free → Trialing → Active → PastDue → Cancelled)
- Plan Change (Starter ↔ Growth ↔ Scale)
- Support Request Lifecycle (Received → Triaging → Investigating → Resolved → Closed)
- Feature Request Lifecycle (Proposed → Investigating → Approved → InProgress → Shipped → Closed)
- Connect Session (Pending → Success | Error | Cancelled)

### Implementation: auth.vin (Payload CMS)

The Generator produces Payload CMS collection definitions from the readings.
These collections become the database tables, REST API, and GraphQL API in auth.vin.

Hooks on collections invoke the agent when events occur (new support request,
subscription change, etc.). This follows the same pattern as commerce/Rocket Auto,
where Airtable hooks routed events to the LLM.

### Execution: state.do

State machine instances run on state.do (Cloudflare Durable Objects + XState).
GraphDL defines the machine (states, transitions, guards). state.do executes it.
Callbacks on transitions fire HTTP requests to auth.vin's API and external
services (Stripe, Slack, ClickHouse).

## How It Works

### Customer signs up

1. Customer signs up through auto.dev → auth.vin creates user, Stripe creates customer
2. Existing flow, unchanged
3. Stripe webhook fires → auth.vin processes it → Slack notification
4. Subscription state machine instance created in state.do

### Support request arrives (Slack or email)

1. Ingestion layer watches Slack channel / email inbox
2. Creates a SupportRequest record in auth.vin (generated collection)
3. afterChange hook fires, invokes the agent with message context
4. Agent transitions request to Triaging, investigates using generated tools:
   - Platform capability: traverses APIProduct → DataProvider → CoverageRegion graph
   - Billing: queries Stripe API for subscription state
   - Bug reports: checks ClickHouse for error logs, API fail rates
5. Agent drafts a response, posts for human approval (e.g. Slack thread)
6. Human approves or edits → response sent to customer
7. If agent detects a pattern (repeated requests about same capability), creates
   a FeatureRequest and transitions it to Investigating

### Upgrade flow

1. Customer initiates upgrade via dashboard or support request
2. State machine enforces valid transitions (Starter → Growth, not Growth → Starter via upgrade)
3. state.do callbacks handle Stripe checkout session creation
4. Webhook confirms payment → state machine transitions to Active
5. Single source of truth — dashboard and auth.vin both read from the state machine

### Feature request lifecycle

1. Support agent creates FeatureRequest when pattern detected
2. LLM agent transitions to Investigating — researches feasibility
3. Agent approves with recommendation or rejects with rationale
4. Human only involved when agent needs a decision (new provider contract, large build)
5. Approved → InProgress → Shipped → Closed tracks through to deployment

## What's Proven

- GraphDL Generator already produces OpenAPI specs and schema definitions from readings
- auth.vin already runs on Payload CMS — target platform matches source platform
- state.do already runs XState machines in production (powered Rocket Auto)
- Event-driven agent invocation worked in commerce via hooks
- Payload CMS has the same hook system (beforeChange, afterChange) — in-process TypeScript

## What Needs To Be Built

1. **Extend Generator to output Payload CMS collections.** Currently produces
   JSON Schema / OpenAPI. Needs to produce the actual TypeScript collection files
   with fields, hooks, and access control.

2. **Agent prompt and tool generation.** Commerce had a hand-written LLM.md.
   The goal is that readings produce the prompt and tools. The Generator already
   produces tool definitions — needs templating for LLM context.

3. **Slack/email ingestion layer.** Something watches Slack and writes to the
   SupportRequest collection. Straightforward integration work.

4. **Human-in-the-loop approval flow.** Agent drafts responses, human approves
   before they go out. Could be a Slack thread with reaction-based approval.

## Migration Strategy

Incremental. No big-bang cutover.

1. **Generate new collections first.** SupportRequest, FeatureRequest don't
   exist in auth.vin yet. No migration concern. Immediate value.

2. **Extend Generator to produce Payload collections.** Validate that generated
   output matches existing hand-written collections for Users, Subscriptions, etc.

3. **Add hooks for agent invocation.** New collections get hooks that invoke
   the agent on events.

4. **Wire state machines to state.do.** Subscription lifecycle, support request
   lifecycle, feature request lifecycle.

5. **Build Slack ingestion.** Watch support channels, create SupportRequest records.

6. **Gradually replace hand-written collections.** As generated output matches
   existing schema, swap them in. Auth.vin's collections become generated artifacts.

## Risks

- **Generator producing correct Payload collections is the hardest part.**
  OpenAPI is a spec; Payload collections are executable code with hooks, access
  control, field validation. The gap between schema and working collection is real.

- **Migration with live data.** Auth.vin has production data. Generated collections
  must match existing schema before they can replace hand-written ones.

- **Mitigation:** Start with new collections (no migration), validate against
  existing ones, replace incrementally.
