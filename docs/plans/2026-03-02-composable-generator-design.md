# Composable Generator Design

> Refactor the monolithic Generator into composable, single-purpose generators with a self-relationship. Each generator row is one transform step with a defined input and output.

## New Fields

Two new fields on the Generator collection:

1. **`outputFormat`** — select: `openapi` (default), `payload`, `xstate`
2. **`sourceGenerator`** — relationship to `generators` (self-ref, optional)

## Behavior by Type

| outputFormat | Source | Produces | Default if no source |
|---|---|---|---|
| `openapi` | none | OpenAPI/JSON Schema in `output` | — |
| `payload` | openapi generator | `output.files` with .ts CollectionConfigs | Auto-find latest openapi generator |
| `xstate` | none | `output.files` with machine JSON + tools JSON + prompt markdown | — |

## Hook Dispatch

The beforeChange hook checks `data.outputFormat` and dispatches:

```
openapi (or undefined) → generateOpenAPI() — existing logic, unchanged
payload                → generatePayloadFiles(sourceOutput, nouns, constraintSpans)
xstate                 → generateXStateFiles(stateMachineDefinitions, nouns, readings)
```

When `outputFormat` requires a source:
1. If `sourceGenerator` is set, load its output
2. If not, auto-find the most recent generator with the right outputFormat (e.g., payload auto-finds latest openapi)
3. If nothing found, return early with an error message in output

## Extraction

The monolithic hook gets broken into three functions:

- `generateOpenAPI(payload, data, nouns, graphSchemas, constraintSpans, ...)` — existing ~900 lines, moved into a function, not modified
- `generatePayloadFiles(sourceOutput, nouns, constraintSpans, graphSchemas)` — extracted from current post-processing block
- `generateXStateFiles(payload, stateMachineDefinitions, nouns)` — extracted from current post-processing block, includes agent tools + prompt generation

## Example Pipeline

What you'd see in admin:

| Title | Output Format | Source | Output |
|-------|--------------|--------|--------|
| Support API Schema | openapi | — | OpenAPI spec with JSON Schemas |
| Support Collections | payload | → Support API Schema | collections/support-requests.ts, etc. |
| Support Lifecycle | xstate | — | state-machines/*.json, agents/*-tools.json, agents/*-prompt.md |

## Backwards Compatibility

- Existing generators with no `outputFormat` behave exactly as before (openapi is default)
- The `databaseEngine` field stays for OpenAPI generation (controls Payload-specific query schemas)
- No data migration needed
