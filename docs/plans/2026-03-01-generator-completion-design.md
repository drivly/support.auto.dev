# Generator Completion Design

> Goal: The Generator produces everything needed to stand up a Payload CMS app and run AI agents within domain constraints — all derived from readings and state machine definitions. No intermediate representations; JSON Schema is the single source of truth.

## Scope (this sprint)

Two features, both outputting file content as strings in `output.files`:

1. **Payload TS Exporter** — JSON Schema → `.ts` CollectionConfig files
2. **XState + Agent Tool Generator** — StateMachineDefinitions → XState JSON + tool schemas + system prompt

## 1. Payload TS Exporter

### Architecture

Remove the `payloadCollections` JSON block from Generator.ts. Replace with a function that reads the already-generated OpenAPI `components.schemas` and noun metadata to emit TypeScript strings.

The Generator hook already has access to nouns (with permissions, referenceScheme, format, enum, valueType) and the flattened JSON Schemas. The exporter walks each entity noun with permissions and produces a CollectionConfig.

### Output Format

```
output.files: {
  'collections/support-requests.ts': 'import type { CollectionConfig } ...',
  'collections/customers.ts': '...',
}
```

### Core Field Mapping (ship first)

| JSON Schema | Payload Field Type |
|---|---|
| `string` | `text` |
| `string` + `format: email` | `email` |
| `string` + `format: date-time` / `date` | `date` |
| `string` + `enum` | `select` with options |
| `number` / `integer` | `number` |
| `boolean` | `checkbox` |
| `$ref` to entity | `relationship` with `relationTo` |
| `array` of `$ref` | `relationship` with `hasMany: true` |
| Reverse of 1:* relationship | `join` field |

### Core Collection Config (ship first)

- `slug` from noun plural
- `labels` from noun name/plural
- `admin.useAsTitle` from referenceScheme
- `timestamps: true`
- `access` from noun permissions (create/read/update/delete → `authenticated`)
- `auth: true` when permissions includes `login`
- `fields` from schema properties

### Full Picture (iterate toward)

These patterns come from the hand-written commerce/Rocket Auto collections and represent what a production-ready generator should eventually produce:

- **Groups** — nested field blocks for compound structures (Address → city, state, zip)
- **Rows** — horizontal layout for related fields
- **Collapsibles with conditions** — `admin.condition` for conditional visibility, maps to ORM constraints
- **Computed/virtual fields** — `readOnly: true` + `hidden: true` fields populated by hooks, maps to derived facts
- **Custom endpoints** — verbs acting on nouns (e.g., `/from-preapproval`)
- **Hook stubs** — `afterChange` skeletons with `context.noop` guard for state machine integration, external APIs, computed field population
- **`defaultColumns`** — referenceScheme + key value fields for list view
- **`versions: { maxPerDoc: 0 }`** — standard config
- **Array fields with RowLabel** — repeating field blocks with custom labels
- **`admin.allowCreate`** on relationships — inline creation
- **`filterOptions`** on relationships — scoped relationship pickers

### What Gets Removed

The ~120-line `payloadCollections` generation block (lines 268-391 of Generator.ts) and associated `payloadCollections` key in the output JSON. The existing tests that assert on `output.payloadCollections` get rewritten to assert on `output.files`.

## 2. XState + Agent Tool Generator

### Architecture

The ORM already models state machines: `StateMachineDefinitions` → `Statuses` → `Transitions` (with `eventType`, `guard`, `verb`). The Generator hook already loads these. A new function walks this graph and produces:

1. XState JSON config
2. Agent tool schemas (one per EventType)
3. System prompt (domain context from readings + state machine context)

### XState Output

For each StateMachineDefinition, emit an XState-compatible JSON config:

```json
{
  "id": "support-request-lifecycle",
  "initial": "Received",
  "states": {
    "Received": {
      "on": { "triage": { "target": "Triaging" } }
    },
    "Triaging": {
      "on": {
        "investigate": { "target": "Investigating" },
        "needInfo": { "target": "WaitingOnCustomer" }
      }
    }
  }
}
```

- States come from Statuses linked to the definition
- Transitions come from Transitions with `from`/`to` Status references
- Events come from EventType names on Transitions
- Guards become XState guard references (name string, implementation external)
- Moore actions (verb on Status) → `entry` actions
- Mealy actions (verb on Transition) → transition `actions`
- Callbacks from verb definitions → `meta.callback` (state.do pattern)

### Agent Tool Schemas

Each EventType on a Transition becomes a tool the agent can invoke:

```json
{
  "name": "triage",
  "description": "Move SupportRequest from Received to Triaging",
  "parameters": {
    "type": "object",
    "properties": {
      "priority": { "type": "string", "enum": ["low", "medium", "high", "urgent"] }
    }
  }
}
```

Tool parameters come from readings that reference the event's domain context. If "Agent triages SupportRequest with Priority" is a reading, `priority` is a parameter on the `triage` tool.

### System Prompt

Generated from readings as natural language domain description:

```
You are a support agent for auto.dev.

## Domain Model
- A Customer submits a SupportRequest
- A SupportRequest has a Subject, Description, and Priority
- A SupportRequest arrives via a Channel (Slack or Email)
- A SupportRequest concerns an APIProduct
...

## Current State: {injected at runtime}

## Available Actions: {derived from current state's outgoing transitions}

## Constraints
- All responses require human approval before being sent to customers
- ...
```

The prompt template is static (generated once), but `Current State` and `Available Actions` sections are filled at runtime based on the machine's current state.

### Output Format

```
output.files: {
  'state-machines/support-request-lifecycle.json': '{ "id": "support-request-lifecycle", ... }',
  'agents/support-agent-tools.json': '[{ "name": "triage", ... }]',
  'agents/support-agent-prompt.md': 'You are a support agent...',
}
```

### Core (ship first)

- XState JSON generation from StateMachineDefinitions → Statuses → Transitions
- Basic tool schemas from EventTypes

### Iterate toward

- System prompt generation from readings
- Runtime state injection pattern
- Guard implementation stubs
- Callback URL templates for state.do integration

## Implementation Order

1. Payload TS exporter (core field mapping)
2. Remove `payloadCollections` block, update tests
3. XState JSON generation
4. Agent tool schema generation
5. System prompt generation

Items 1-2 are one unit. Items 3-5 are one unit. No dependencies between the two units — they can be developed in parallel.

## Key Decision

No intermediate JSON representation for Payload collections. The JSON Schema produced by the existing OpenAPI generation is the single source of truth. The exporter reads it and emits TypeScript directly.
