# Claim Extraction Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a three-stage claim extraction pipeline that verifies support agent drafts against the domain model's deontic constraints, with deterministic matching in graphdl-orm and semantic extraction in apis/.

**Architecture:** Stage 1 (graphdl-orm) builds regex matchers from deontic constraint instance populations and scans text. Stage 2 (apis/) sends unmatched semantic constraints to the LLM for claim extraction. Stage 3 (graphdl-orm) validates extracted claims against the live constraint graph. The support worker chains all three and surfaces warnings in Slack.

**Tech Stack:** TypeScript, Payload CMS 3.x (graphdl-orm), Cloudflare Workers + itty-router (apis/, support.auto.dev), Anthropic Claude via /ai/chat gateway.

---

### Task 1: Parse Deontic Constraint Instance Facts in graphdl-orm

The parser currently extracts "Fact Types with Deontic Mandatory Constraints" as plain strings but ignores the "Deontic Mandatory Constraint Instance Facts" two-column tables. Fix the parser to extract both.

**Files:**
- Modify: `C:/Users/lippe/Repos/graphdl-orm/src/seed/parser.ts:35-41` (DomainParseResult type)
- Modify: `C:/Users/lippe/Repos/graphdl-orm/src/seed/parser.ts:159-164` (deontic section parsing)

**Step 1: Write the failing test**

Create test file `C:/Users/lippe/Repos/graphdl-orm/src/seed/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseDomainMarkdown } from './parser'

describe('parseDomainMarkdown', () => {
  it('parses deontic constraint instance facts', () => {
    const markdown = `# Test Domain

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| SupportResponse | ResponseId | |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| ResponseId | string | format: uuid |

## Readings

| Reading | Multiplicity |
|---------|-------------|
| SupportResponse has ResponseId | *:1 |

## Fact Types with Deontic Mandatory Constraints

| Constraint |
|-----------|
| SupportResponse must not contain ProhibitedPunctuation |
| SupportResponse must not name ListingSource |

## Deontic Mandatory Constraint Instance Facts

| Constraint | Instance |
|-----------|----------|
| SupportResponse must not contain ProhibitedPunctuation | --- |
| SupportResponse must not contain ProhibitedPunctuation | -- |
| SupportResponse must not name ListingSource | Edmunds |
| SupportResponse must not name ListingSource | Carfax |
`
    const result = parseDomainMarkdown(markdown)

    expect(result.deonticConstraints).toEqual([
      'SupportResponse must not contain ProhibitedPunctuation',
      'SupportResponse must not name ListingSource',
    ])
    expect(result.deonticConstraintInstances).toEqual([
      { constraint: 'SupportResponse must not contain ProhibitedPunctuation', instance: '---' },
      { constraint: 'SupportResponse must not contain ProhibitedPunctuation', instance: '--' },
      { constraint: 'SupportResponse must not name ListingSource', instance: 'Edmunds' },
      { constraint: 'SupportResponse must not name ListingSource', instance: 'Carfax' },
    ])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd C:/Users/lippe/Repos/graphdl-orm && npx vitest run src/seed/parser.test.ts`
Expected: FAIL — `deonticConstraintInstances` does not exist on DomainParseResult

**Step 3: Implement the parser changes**

In `parser.ts`, add the type:

```typescript
// Add to DomainParseResult (line ~35):
export interface DeonticConstraintInstanceDef {
  constraint: string
  instance: string
}

export interface DomainParseResult {
  entityTypes: EntityTypeDef[]
  valueTypes: ValueTypeDef[]
  readings: ReadingDef[]
  instanceFacts: string[]
  deonticConstraints: string[]
  deonticConstraintInstances: DeonticConstraintInstanceDef[]
}
```

In `parseDomainMarkdown`, add after the existing deontic constraint parsing (after line ~164):

```typescript
  // Deontic Constraint Instance Facts
  const instanceConstraintLines = findSection(lines, 'Deontic Mandatory Constraint Instance Facts')
  const instanceConstraintRows = parseTableRows(instanceConstraintLines)
  const deonticConstraintInstances: DeonticConstraintInstanceDef[] = instanceConstraintRows
    .filter((row) => row.length >= 2 && row[0] !== 'Constraint')
    .map((row) => ({ constraint: row[0], instance: row[1] }))

  return { entityTypes, valueTypes, readings, instanceFacts, deonticConstraints, deonticConstraintInstances }
```

**Step 4: Run test to verify it passes**

Run: `cd C:/Users/lippe/Repos/graphdl-orm && npx vitest run src/seed/parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd C:/Users/lippe/Repos/graphdl-orm
git add src/seed/parser.ts src/seed/parser.test.ts
git commit -m "feat: parse deontic mandatory constraint instance facts from domain markdown"
```

---

### Task 2: Seed Deontic Constraints with Modality in graphdl-orm

Currently `seedDomain` seeds deontic constraints as plain readings. Instead, create them as readings AND create corresponding Constraint records with `modality: 'Deontic'`. Also seed the instance facts as Graphs linked to those readings.

**Files:**
- Modify: `C:/Users/lippe/Repos/graphdl-orm/src/seed/handler.ts:80-175` (seedDomain function)

**Step 1: Write the failing test**

Add to the parser test file or create `C:/Users/lippe/Repos/graphdl-orm/src/seed/handler.test.ts`. This test depends on Payload running, so it will be an integration test. For now, add a unit test for the constraint instance grouping logic.

Create `C:/Users/lippe/Repos/graphdl-orm/src/seed/deontic.ts`:

```typescript
import type { DeonticConstraintInstanceDef } from './parser'

export interface DeonticConstraintGroup {
  constraintText: string
  instances: string[]
}

export function groupDeonticInstances(
  constraints: string[],
  instances: DeonticConstraintInstanceDef[],
): DeonticConstraintGroup[] {
  return constraints.map((text) => ({
    constraintText: text,
    instances: instances
      .filter((i) => i.constraint === text)
      .map((i) => i.instance),
  }))
}
```

Create `C:/Users/lippe/Repos/graphdl-orm/src/seed/deontic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { groupDeonticInstances } from './deontic'

describe('groupDeonticInstances', () => {
  it('groups instance facts by constraint text', () => {
    const constraints = [
      'SupportResponse must not contain ProhibitedPunctuation',
      'SupportResponse must not name ListingSource',
    ]
    const instances = [
      { constraint: 'SupportResponse must not contain ProhibitedPunctuation', instance: '---' },
      { constraint: 'SupportResponse must not contain ProhibitedPunctuation', instance: '--' },
      { constraint: 'SupportResponse must not name ListingSource', instance: 'Edmunds' },
    ]

    const result = groupDeonticInstances(constraints, instances)

    expect(result).toEqual([
      { constraintText: 'SupportResponse must not contain ProhibitedPunctuation', instances: ['---', '--'] },
      { constraintText: 'SupportResponse must not name ListingSource', instances: ['Edmunds'] },
    ])
  })

  it('returns empty instances for constraints with no instance facts', () => {
    const constraints = ['SupportResponse must not offer ProhibitedChannel']
    const result = groupDeonticInstances(constraints, [])
    expect(result).toEqual([
      { constraintText: 'SupportResponse must not offer ProhibitedChannel', instances: [] },
    ])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd C:/Users/lippe/Repos/graphdl-orm && npx vitest run src/seed/deontic.test.ts`
Expected: FAIL — module not found

**Step 3: Create deontic.ts with the implementation above**

**Step 4: Run test to verify it passes**

Run: `cd C:/Users/lippe/Repos/graphdl-orm && npx vitest run src/seed/deontic.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd C:/Users/lippe/Repos/graphdl-orm
git add src/seed/deontic.ts src/seed/deontic.test.ts
git commit -m "feat: add deontic constraint instance grouping"
```

---

### Task 3: Build the Deterministic Extractor in graphdl-orm

New Next.js API route that queries deontic constraints + instances from the database, builds regex matchers, and checks text.

**Files:**
- Create: `C:/Users/lippe/Repos/graphdl-orm/src/extract/matcher.ts`
- Create: `C:/Users/lippe/Repos/graphdl-orm/src/extract/matcher.test.ts`
- Create: `C:/Users/lippe/Repos/graphdl-orm/src/app/extract/route.ts`

**Step 1: Write the failing test**

Create `C:/Users/lippe/Repos/graphdl-orm/src/extract/matcher.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildMatchers, matchText } from './matcher'

describe('buildMatchers', () => {
  it('builds regex matchers from constraint groups', () => {
    const groups = [
      {
        constraintText: 'SupportResponse must not contain ProhibitedPunctuation',
        instances: ['\u2014', '\u2013'],
      },
      {
        constraintText: 'SupportResponse must not name ListingSource',
        instances: ['Edmunds', 'Carfax', 'AutoTrader'],
      },
    ]

    const matchers = buildMatchers(groups)
    expect(matchers).toHaveLength(2)
    expect(matchers[0].constraintText).toBe('SupportResponse must not contain ProhibitedPunctuation')
    expect(matchers[0].regex).toBeInstanceOf(RegExp)
    expect(matchers[1].constraintText).toBe('SupportResponse must not name ListingSource')
  })
})

describe('matchText', () => {
  it('finds prohibited punctuation', () => {
    const groups = [
      {
        constraintText: 'SupportResponse must not contain ProhibitedPunctuation',
        instances: ['\u2014', '\u2013'],
      },
    ]
    const matchers = buildMatchers(groups)
    const result = matchText('I understand your frustration \u2014 let me help', matchers)

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].factType).toBe('SupportResponse must not contain ProhibitedPunctuation')
    expect(result.matches[0].instance).toBe('\u2014')
    expect(result.matches[0].span[0]).toBe(30)
  })

  it('finds prohibited names with word boundaries', () => {
    const groups = [
      {
        constraintText: 'SupportResponse must not name ListingSource',
        instances: ['Edmunds', 'Carfax', 'AutoTrader'],
      },
    ]
    const matchers = buildMatchers(groups)
    const result = matchText('Our Edmunds data shows that Carfax reports are available', matchers)

    expect(result.matches).toHaveLength(2)
    expect(result.matches[0].instance).toBe('Edmunds')
    expect(result.matches[1].instance).toBe('Carfax')
  })

  it('returns unmatched constraints for groups with no instances', () => {
    const groups = [
      {
        constraintText: 'SupportResponse must not offer to perform APIRequest on behalf of Customer',
        instances: [],
      },
    ]
    const matchers = buildMatchers(groups)
    const result = matchText('I can look that up for you', matchers)

    expect(result.matches).toHaveLength(0)
    expect(result.unmatchedConstraints).toEqual([
      'SupportResponse must not offer to perform APIRequest on behalf of Customer',
    ])
  })

  it('handles case-insensitive matching for names', () => {
    const groups = [
      {
        constraintText: 'SupportResponse must not name ListingSource',
        instances: ['Edmunds'],
      },
    ]
    const matchers = buildMatchers(groups)
    const result = matchText('the edmunds API provides specs', matchers)

    expect(result.matches).toHaveLength(1)
  })

  it('does not match partial words for name-like instances', () => {
    const groups = [
      {
        constraintText: 'SupportResponse must not name ListingSource',
        instances: ['Car'],
      },
    ]
    const matchers = buildMatchers(groups)
    // "Car" should not match inside "Carfax" if we use word boundaries
    const result = matchText('The Carfax report is clean', matchers)
    // This SHOULD match "Car" is not inside "Carfax" since \bCar\b won't match "Carfax"
    expect(result.matches).toHaveLength(0)
  })

  it('matches literal punctuation without word boundaries', () => {
    const groups = [
      {
        constraintText: 'SupportResponse must not contain ProhibitedPunctuation',
        instances: ['\u2014'],
      },
    ]
    const matchers = buildMatchers(groups)
    const result = matchText('hello\u2014world', matchers)

    expect(result.matches).toHaveLength(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd C:/Users/lippe/Repos/graphdl-orm && npx vitest run src/extract/matcher.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the matcher**

Create `C:/Users/lippe/Repos/graphdl-orm/src/extract/matcher.ts`:

```typescript
import type { DeonticConstraintGroup } from '../seed/deontic'

export interface ConstraintMatcher {
  constraintText: string
  instances: string[]
  regex: RegExp | null
}

export interface MatchResult {
  factType: string
  instance: string
  span: [number, number]
}

export interface MatchOutput {
  matches: MatchResult[]
  unmatchedConstraints: string[]
}

function isAlphanumeric(s: string): boolean {
  return /^[a-zA-Z0-9]/.test(s)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildMatchers(groups: DeonticConstraintGroup[]): ConstraintMatcher[] {
  return groups.map((g) => {
    if (g.instances.length === 0) {
      return { constraintText: g.constraintText, instances: [], regex: null }
    }

    // Sort longest-first to avoid partial matches
    const sorted = [...g.instances].sort((a, b) => b.length - a.length)

    const patterns = sorted.map((inst) => {
      const escaped = escapeRegex(inst)
      // Use word boundaries for alphanumeric instances, literal match for punctuation
      return isAlphanumeric(inst) ? `\\b${escaped}\\b` : escaped
    })

    const regex = new RegExp(`(${patterns.join('|')})`, 'gi')
    return { constraintText: g.constraintText, instances: g.instances, regex }
  })
}

export function matchText(text: string, matchers: ConstraintMatcher[]): MatchOutput {
  const matches: MatchResult[] = []
  const unmatchedConstraints: string[] = []

  for (const matcher of matchers) {
    if (!matcher.regex) {
      unmatchedConstraints.push(matcher.constraintText)
      continue
    }

    matcher.regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = matcher.regex.exec(text)) !== null) {
      // Find which instance was matched (case-insensitive comparison)
      const matchedText = match[0]
      const instance = matcher.instances.find(
        (inst) => inst.toLowerCase() === matchedText.toLowerCase()
      ) || matchedText

      matches.push({
        factType: matcher.constraintText,
        instance,
        span: [match.index, match.index + match[0].length],
      })
    }
  }

  return { matches, unmatchedConstraints }
}
```

**Step 4: Run test to verify it passes**

Run: `cd C:/Users/lippe/Repos/graphdl-orm && npx vitest run src/extract/matcher.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd C:/Users/lippe/Repos/graphdl-orm
git add src/extract/matcher.ts src/extract/matcher.test.ts
git commit -m "feat: deterministic claim extractor using regex matchers from deontic constraint instances"
```

---

### Task 4: Expose the Deterministic Extractor as an API Route

Wire the matcher to a Next.js API route that queries deontic constraints from the database.

**Files:**
- Create: `C:/Users/lippe/Repos/graphdl-orm/src/app/extract/route.ts`

**Step 1: Implement the route**

```typescript
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { groupDeonticInstances } from '../../seed/deontic'
import { buildMatchers, matchText } from '../../extract/matcher'
import { parseDomainMarkdown } from '../../seed/parser'

export const POST = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const body = await request.json()
  const { text, domain } = body

  if (!text) return Response.json({ error: 'text required' }, { status: 400 })
  if (!domain) return Response.json({ error: 'domain required' }, { status: 400 })

  // Find the domain
  const domainDoc = await payload.find({
    collection: 'domains',
    where: { domainSlug: { equals: domain } },
    limit: 1,
  })
  if (!domainDoc.docs.length) {
    return Response.json({ error: `domain "${domain}" not found` }, { status: 404 })
  }
  const domainId = domainDoc.docs[0].id

  // Fetch all readings in this domain that look like deontic constraints
  // Deontic constraints follow the pattern "must not" or "must" + "conform"
  const allReadings = await payload.find({
    collection: 'readings',
    where: { domain: { equals: domainId } },
    pagination: false,
  })

  // Separate deontic constraint fact types from regular readings
  // Deontic constraints contain "must not" or "must" followed by a normative verb
  const deonticReadings = allReadings.docs.filter((r: any) =>
    /\bmust\b/.test(r.text || '')
  )

  // For each deontic reading, find instance facts that match the pattern:
  // "ConstraintText | InstanceValue" stored as separate readings
  // Instance facts are readings whose text starts with a deontic constraint text
  // and contains a quoted or trailing value
  //
  // Alternative approach: query the constraint + instance structure directly.
  // For now, we use the domain markdown source via a simpler approach:
  // fetch all readings, identify constraints, find instances.

  // Build groups: constraint text -> instance values
  // Instance facts for deontic constraints are stored as readings with text like:
  // "SupportResponse must not contain ProhibitedPunctuation '---'"
  // or matched from the Deontic Mandatory Constraint Instance Facts table
  // which were seeded as separate readings.
  //
  // Since the current seed flow stores these as plain readings, we need
  // to match them. A reading is an instance of a deontic constraint if
  // a deontic constraint text is a prefix of another reading's text.

  const constraintTexts = deonticReadings.map((r: any) => r.text as string)
  const allTexts = allReadings.docs.map((r: any) => r.text as string)

  const groups = constraintTexts.map((ct) => {
    const instances = allTexts
      .filter((t) => t !== ct && t.startsWith(ct))
      .map((t) => {
        // Extract the instance value after the constraint text
        const remainder = t.slice(ct.length).trim()
        // Remove surrounding quotes if present
        return remainder.replace(/^['"]|['"]$/g, '')
      })
      .filter((v) => v.length > 0)

    return { constraintText: ct, instances }
  })

  const matchers = buildMatchers(groups)
  const result = matchText(text, matchers)

  return Response.json(result)
}
```

**Step 2: Test manually via curl once graphdl-orm is running**

Run: `curl -X POST http://localhost:8000/extract -H "Content-Type: application/json" -d '{"text":"I understand your frustration --- let me check Edmunds","domain":"support"}'`
Expected: JSON with matches for ProhibitedPunctuation and ListingSource

**Step 3: Commit**

```bash
cd C:/Users/lippe/Repos/graphdl-orm
git add src/app/extract/route.ts
git commit -m "feat: expose deterministic extractor as POST /extract endpoint"
```

---

### Task 5: Proxy the Extract Endpoint Through apis/

The apis/ worker already proxies graphdl-orm at `/graphdl/raw/*`. Add a proxy for `/graphdl/extract`.

**Files:**
- Modify: `C:/Users/lippe/Repos/apis/` — find the graphdl proxy route and add extract

**Step 1: Find the existing graphdl proxy route**

Search `C:/Users/lippe/Repos/apis/src` for the `/graphdl/raw` route handler. The extract endpoint follows the same pattern.

**Step 2: Add the extract proxy**

Add a route that proxies `POST /graphdl/extract` to `graphdl.fly.dev/extract`:

```typescript
// Same pattern as the /graphdl/raw/* proxy
router.post('/graphdl/extract', withAPIKey, async (request, env) => {
  const body = await request.json()
  const res = await fetch(`${env.GRAPHDL_URL}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res
})
```

Exact file paths and variable names depend on the apis/ codebase structure — check the existing graphdl proxy for the pattern.

**Step 3: Commit**

```bash
cd C:/Users/lippe/Repos/apis
git add -A
git commit -m "feat: proxy /graphdl/extract to graphdl-orm deterministic extractor"
```

---

### Task 6: Build the Semantic Extractor Route in apis/

New route in apis/ that takes text + unmatched constraints, calls the LLM for structured claim extraction.

**Files:**
- Create or add to: `C:/Users/lippe/Repos/apis/` — new route at `/graphdl/extract/semantic`

**Step 1: Implement the semantic extractor route**

```typescript
router.post('/graphdl/extract/semantic', withAPIKey, async (request, env) => {
  const body = await request.json()
  const { text, constraints } = body

  if (!text || !constraints?.length) {
    return json({ claims: [] })
  }

  const systemPrompt = `You are a claim extractor. You identify claims in text that would violate deontic constraints.

Given:
- A piece of text (a drafted support email)
- A list of deontic constraint fact types (rules the text must not violate)

For each constraint, determine if the text contains any claim that would violate it. Return structured JSON.

Rules:
- Only flag genuine violations, not tangential mentions
- Include the specific text span that constitutes the violation
- Confidence: 0.0-1.0 reflecting how certain you are this is a real violation
- If no violations found for a constraint, omit it from results`

  const userMessage = `Text to check:
"""
${text}
"""

Deontic constraints to check against:
${constraints.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}

Return JSON array of violations found:
[{"factType": "the constraint text", "claim": "what the text asserts that violates it", "confidence": 0.0-1.0, "span": [startChar, endChar]}]

If no violations found, return [].`

  const llmRes = await fetch(`${env.AI_GATEWAY_URL || 'https://api.auto.dev'}/ai/chat`, {
    method: 'POST',
    headers: {
      'X-API-Key': env.AUTO_DEV_API_KEY || env.API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!llmRes.ok) {
    return json({ claims: [], error: 'LLM call failed' }, 502)
  }

  const llmData = await llmRes.json()
  const content = llmData.content || ''

  // Extract JSON from response
  let claims = []
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      claims = JSON.parse(jsonMatch[0])
    }
  } catch {
    // LLM didn't return valid JSON — no claims extracted
  }

  return json({ claims })
})
```

**Step 2: Test manually**

Run: `curl -X POST https://api.auto.dev/graphdl/extract/semantic -H "X-API-Key: $AUTO_DEV_API_KEY" -H "Content-Type: application/json" -d '{"text":"I can look up that VIN data for you right now","constraints":["SupportResponse must not offer to perform APIRequest on behalf of Customer"]}'`
Expected: JSON with claims array containing the violation

**Step 3: Commit**

```bash
cd C:/Users/lippe/Repos/apis
git add -A
git commit -m "feat: add semantic claim extractor route at /graphdl/extract/semantic"
```

---

### Task 7: Build the Constraint Checker Route in graphdl-orm

Validates that extracted claims actually violate live deontic constraints in the current model.

**Files:**
- Create: `C:/Users/lippe/Repos/graphdl-orm/src/app/check/route.ts`

**Step 1: Implement the route**

```typescript
import configPromise from '@payload-config'
import { getPayload } from 'payload'

export const POST = async (request: Request) => {
  const payload = await getPayload({ config: configPromise })
  const body = await request.json()
  const { matches = [], claims = [] } = body

  // Fetch all deontic constraint readings
  const allReadings = await payload.find({
    collection: 'readings',
    pagination: false,
  })
  const deonticTexts = new Set(
    allReadings.docs
      .filter((r: any) => /\bmust\b/.test(r.text || ''))
      .map((r: any) => r.text)
  )

  const warnings = []

  // Validate deterministic matches
  for (const match of matches) {
    if (deonticTexts.has(match.factType)) {
      warnings.push({
        reading: match.factType,
        instance: match.instance,
        span: match.span,
        method: 'deterministic' as const,
      })
    }
  }

  // Validate semantic claims
  for (const claim of claims) {
    if (deonticTexts.has(claim.factType)) {
      warnings.push({
        reading: claim.factType,
        claim: claim.claim,
        span: claim.span,
        method: 'semantic' as const,
        confidence: claim.confidence,
      })
    }
  }

  return Response.json({ warnings })
}
```

**Step 2: Proxy through apis/**

Same pattern as Task 5 — add `POST /graphdl/check` proxy in apis/.

**Step 3: Commit**

```bash
cd C:/Users/lippe/Repos/graphdl-orm
git add src/app/check/route.ts
git commit -m "feat: expose constraint checker as POST /check endpoint"
```

---

### Task 8: Wire the Pipeline into the Support Worker

Chain stages 1-2-3 in the support worker, add warnings to the message type, update Slack posting.

**Files:**
- Create: `C:/Users/lippe/Repos/support.auto.dev/src/verify.ts`
- Modify: `C:/Users/lippe/Repos/support.auto.dev/src/types.ts:8-13` (SupportMessage)
- Modify: `C:/Users/lippe/Repos/support.auto.dev/src/chat.ts:123-196` (handleChat)
- Modify: `C:/Users/lippe/Repos/support.auto.dev/src/chat.ts:200-317` (handleContactAssign)
- Modify: `C:/Users/lippe/Repos/support.auto.dev/src/chat.ts:324-375` (handleRedraft)

**Step 1: Create the verify module**

Create `C:/Users/lippe/Repos/support.auto.dev/src/verify.ts`:

```typescript
import type { Env } from './types'

export interface ClaimWarning {
  reading: string
  instance?: string
  claim?: string
  span?: [number, number]
  method: 'deterministic' | 'semantic'
  confidence?: number
}

export async function verify(env: Env, text: string, domain: string): Promise<ClaimWarning[]> {
  // Stage 1: Deterministic extraction
  const extractRes = await fetch(`${env.AUTO_DEV_API_URL}/graphdl/extract`, {
    method: 'POST',
    headers: {
      'X-API-Key': env.AUTO_DEV_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, domain }),
  })

  if (!extractRes.ok) return [] // fail open — don't block drafts

  const { matches, unmatchedConstraints } = await extractRes.json() as {
    matches: Array<{ factType: string; instance: string; span: [number, number] }>
    unmatchedConstraints: string[]
  }

  // Stage 2: Semantic extraction for unmatched constraints
  let claims: Array<{ factType: string; claim: string; confidence: number; span: [number, number] }> = []
  if (unmatchedConstraints.length) {
    const semanticRes = await fetch(`${env.AUTO_DEV_API_URL}/graphdl/extract/semantic`, {
      method: 'POST',
      headers: {
        'X-API-Key': env.AUTO_DEV_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, constraints: unmatchedConstraints }),
    })
    if (semanticRes.ok) {
      const data = await semanticRes.json() as { claims: typeof claims }
      claims = data.claims || []
    }
  }

  // Stage 3: Constraint checker
  const checkRes = await fetch(`${env.AUTO_DEV_API_URL}/graphdl/check`, {
    method: 'POST',
    headers: {
      'X-API-Key': env.AUTO_DEV_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ matches, claims }),
  })

  if (!checkRes.ok) {
    // Fall back to just the deterministic matches if checker is down
    return matches.map((m) => ({
      reading: m.factType,
      instance: m.instance,
      span: m.span,
      method: 'deterministic' as const,
    }))
  }

  const { warnings } = await checkRes.json() as { warnings: ClaimWarning[] }
  return warnings
}
```

**Step 2: Update SupportMessage type**

In `C:/Users/lippe/Repos/support.auto.dev/src/types.ts`, add warnings:

```typescript
import type { ClaimWarning } from './verify'

export interface SupportMessage {
  role: 'user' | 'agent' | 'admin'
  content: string
  timestamp: string
  toolCalls?: Array<{ tool: string; result: unknown }>
  warnings?: ClaimWarning[]
}
```

**Step 3: Update handleChat to verify after drafting**

In `chat.ts`, after `generateDraft` returns and before persisting, add:

```typescript
  // Verify draft against deontic constraints
  let warnings: ClaimWarning[] = []
  try {
    warnings = await verify(env, result.draft, 'support')
  } catch {
    // fail open
  }
```

Add `warnings` to the agent message and the response JSON.

**Step 4: Update handleContactAssign — only post to Slack on first assign, include warnings**

The Slack posting block (lines 271-309) stays in `handleContactAssign` but NOT in `handleChat` or `handleRedraft`. Add warnings to the Slack blocks:

```typescript
  // Add warning context block if violations found
  if (warnings.length) {
    slackBlocks.splice(1, 0, {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `:warning: ${warnings.length} constraint violation${warnings.length > 1 ? 's' : ''} found\n${warnings.map((w) =>
          `- ${w.reading}${w.instance ? ` '${w.instance}'` : ''}${w.claim ? `: ${w.claim}` : ''}`
        ).join('\n')}`,
      }],
    })
  }
```

**Step 5: Update handleRedraft — no Slack posting, still verify**

`handleRedraft` already doesn't post to Slack. Just add verification:

```typescript
  const warnings = await verify(env, result.draft, 'support').catch(() => [])
```

Include warnings in the response and on the stored message.

**Step 6: Commit**

```bash
cd C:/Users/lippe/Repos/support.auto.dev
git add src/verify.ts src/types.ts src/chat.ts
git commit -m "feat: wire claim extraction pipeline into support worker with Slack warnings"
```

---

### Task 9: Update Domain Markdown to Use Correct Section Headings

The parser now expects "Deontic Mandatory Constraint Instance Facts" as a section heading. Verify the 12 domain files use this exact heading for the two-column constraint+instance tables.

**Files:**
- Check and fix all files in: `C:/Users/lippe/Repos/support.auto.dev/domains/*.md`

**Step 1: Grep for the section heading**

Run: `grep -l "Deontic Mandatory Constraint Instance Facts" C:/Users/lippe/Repos/support.auto.dev/domains/*.md`

Verify: `support.md`, `api-products.md`, `listings.md`, `business-metrics.md` should all match.

**Step 2: Verify consistent format**

Each file's instance facts table should have exactly:
```markdown
## Deontic Mandatory Constraint Instance Facts

| Constraint | Instance |
|-----------|----------|
| ... | ... |
```

Fix any that don't match.

**Step 3: Commit if any changes**

```bash
cd C:/Users/lippe/Repos/support.auto.dev
git add domains/
git commit -m "fix: normalize deontic constraint instance facts section headings"
```

---

### Task 10: End-to-End Test

Test the full pipeline from draft to warnings.

**Step 1: Ensure graphdl-orm is running locally or deployed**

Run: `curl https://graphdl.fly.dev/api/nouns?limit=1` — should return JSON

**Step 2: Seed the domain model**

Run the seed script from `support.auto.dev/scripts/seed-auto-dev.ts` if not already seeded.

**Step 3: Test deterministic extraction**

```bash
curl -X POST https://api.auto.dev/graphdl/extract \
  -H "X-API-Key: $AUTO_DEV_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"I understand your frustration \u2014 our Edmunds data team is looking into this. In summary, we can offer a custom pricing arrangement.","domain":"support"}'
```

Expected: Matches for em dash, "Edmunds", "In summary", "custom pricing"

**Step 4: Test semantic extraction**

```bash
curl -X POST https://api.auto.dev/graphdl/extract/semantic \
  -H "X-API-Key: $AUTO_DEV_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"I can pull up that VIN decode for you right now","constraints":["SupportResponse must not offer to perform APIRequest on behalf of Customer"]}'
```

Expected: Claims array with high-confidence violation

**Step 5: Test full pipeline via support worker**

```bash
curl -X POST https://support-auto-dev.<account>.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Can you look up VIN WBAJB0C51JB084264 for me? I need the specs.","customerId":"test@example.com"}'
```

Expected: Response includes `warnings` array if agent draft violates any constraints

**Step 6: Commit any fixes**

```bash
git add -A && git commit -m "fix: end-to-end pipeline adjustments"
```
