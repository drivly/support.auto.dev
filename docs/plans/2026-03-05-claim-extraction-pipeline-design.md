# Claim Extraction Pipeline

Formal verification of support agent drafts against the domain model's deontic constraints.

## Problem

The support agent drafts responses constrained by deontic mandatory constraints expressed as atomic fact types with instance populations. Currently these constraints are injected into the system prompt as text. The LLM is trusted to follow them. There is no verification.

## Architecture

Three independent stages. Each does one thing. Each is independently useful. The support worker pipes them together.

```
draft text
  -> deterministic extractor (graphdl-orm)
  -> semantic extractor (apis/)
  -> constraint checker (graphdl-orm)
  -> warnings
```

## Stage 1: Deterministic Extractor

Location: graphdl-orm, endpoint `POST /api/extract`

Takes text and a domain slug. Queries all deontic constraint fact types for that domain, fetches their instance populations, builds regex matchers (same nounRegex pattern from Readings.ts), returns matches.

### Input

```json
{
  "text": "I understand your frustration -- let me check with our Edmunds team...",
  "domain": "support"
}
```

### Output

```json
{
  "matches": [
    {
      "factType": "SupportResponse must not contain ProhibitedPunctuation",
      "instance": "--",
      "span": [29, 31]
    },
    {
      "factType": "SupportResponse must not name ListingSource",
      "instance": "Edmunds",
      "span": [55, 62]
    }
  ],
  "unmatchedConstraints": [
    "SupportResponse must not offer to perform APIRequest on behalf of Customer",
    "SupportResponse pricing claim must conform to PricingModel"
  ]
}
```

### How it works

1. Query readings where `domain.domainSlug = :domain` and constraint modality is deontic
2. For each deontic reading, query its instance facts
3. Build regex from instances (longest-first, word-boundary where appropriate, literal match for punctuation)
4. Scan text, return matches with character spans
5. Return unmatched constraints: deontic fact types with no string-matchable instances

### Precedent

The nounRegex pattern in `Readings.ts:43-57` and `Generator.ts:2591-2626` already does this at the schema level, tokenizing reading text by splitting on known Noun names. The deterministic extractor applies the same algorithm at the instance level, splitting draft text on known constraint instance values.

```typescript
const nounRegex = new RegExp(
  '\\b(' +
    entities
      .map((e) => e.name)
      .sort((a, b) => (b?.length || 0) - (a?.length || 0))
      .join('|') +
    ')\\b',
)
```

Gets more powerful every time an instance fact is added to a deontic constraint. No code change required.

## Stage 2: Semantic Extractor

Location: apis/, route `POST /graphdl/extract/semantic`

Takes text and a list of unmatched constraint fact types (from stage 1). Uses the LLM to extract candidate claims grounded in those fact types.

### Input

```json
{
  "text": "I can pull that VIN data for you right now...",
  "constraints": [
    "SupportResponse must not offer to perform APIRequest on behalf of Customer"
  ]
}
```

### Output

```json
{
  "claims": [
    {
      "factType": "SupportResponse must not offer to perform APIRequest on behalf of Customer",
      "claim": "offers to perform VIN decode on behalf of customer",
      "confidence": 0.92,
      "span": [0, 43]
    }
  ]
}
```

### How it works

- Focused system prompt: extract claims from text that would violate the given deontic constraint fact types
- Calls `/ai/chat` with structured output
- No domain knowledge beyond what is passed in
- Pure function: text + constraints in, claims out

## Stage 3: Constraint Checker

Location: graphdl-orm, endpoint `POST /api/check`

Takes combined matches from stages 1 and 2. Confirms each deontic mandatory constraint exists in the current model and the absence is mandatory. Returns warnings.

### Input

```json
{
  "matches": [],
  "claims": []
}
```

### Output

```json
{
  "warnings": [
    {
      "reading": "SupportResponse must not contain ProhibitedPunctuation",
      "instance": "--",
      "span": [29, 31],
      "method": "deterministic"
    },
    {
      "reading": "SupportResponse must not offer to perform APIRequest on behalf of Customer",
      "claim": "offers to perform VIN decode on behalf of customer",
      "span": [0, 43],
      "method": "semantic",
      "confidence": 0.92
    }
  ]
}
```

### Why separate

The checker validates that the constraint is actually deontic mandatory in the current model. Constraints can be added, removed, or have their modality changed. The checker is the authority -- it reads the graph at check time, not a cached copy.

## Support Worker Integration

### Draft verification

After `generateDraft()` returns, before persisting and posting to Slack:

```typescript
const result = await generateDraft(env, messages, customerContext, ...)
const warnings = await verify(env, result.draft, 'support')
```

The `verify` function chains stages 1 -> 2 -> 3.

### Warning storage

Warnings stored on the SupportMessage alongside existing toolCalls:

```typescript
interface SupportMessage {
  role: 'user' | 'agent' | 'admin'
  content: string
  timestamp: string
  toolCalls?: Array<{ tool: string; result: unknown }>
  warnings?: ClaimWarning[]
}
```

### Slack notification change

Slack posting fires only on first contact assignment (`handleContactAssign`), not on re-drafts. Warnings appear as a context block above the draft:

```
:warning: 2 constraint violations found
- SupportResponse must not contain ProhibitedPunctuation '--'
- SupportResponse must not name ListingSource 'Edmunds'
```

## Changes by Repo

| Repo | Change |
|------|--------|
| graphdl-orm | `POST /api/extract` -- deterministic matcher |
| graphdl-orm | `POST /api/check` -- constraint validator |
| apis/ | `POST /graphdl/extract/semantic` -- LLM claim extraction |
| support.auto.dev | `verify()` function chaining three stages |
| support.auto.dev | `ClaimWarning` type on SupportMessage |
| support.auto.dev | Slack blocks include warnings |
| support.auto.dev | Slack notification only on contact assign |
| chat.auto.dev | Show warnings in request detail view |

## Domain Model Additions

New readings for the support domain:

| Reading | Multiplicity |
|---------|-------------|
| SupportResponse has Claim | 1:* |
| Claim is instance of Reading | *:1 |
| Claim has TextSpan | *:1 |
| Claim has ExtractionMethod | *:1 |

New value types:

| Value | Type | Constraints |
|-------|------|------------|
| ClaimText | string | |
| TextSpan | string | character offset range |
| ExtractionMethod | string | enum: deterministic, semantic |

Warnings are not modeled as entities. A warning is the detection that an extracted Claim populates a role whose absence is deontically mandatory. The constraint system already defines what is wrong and why.

## Design Principles

- Each stage is independently useful and independently deployable
- The deterministic extractor has no LLM dependency
- The semantic extractor has no domain knowledge beyond what is passed in
- The constraint checker reads the live graph, not cached state
- The model IS the detection rules: adding instance facts makes detection more powerful without code changes
- Deontic modality means warnings, not rejections: the admin can override
