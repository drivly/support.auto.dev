# KV Removal, Seed Dedup & UI Readings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove GRAPHDL_USERS KV from the apis worker, prevent duplicate state machine definitions on reseed, and model the chat.auto.dev UI as domain model readings.

**Architecture:** Three independent workstreams: (B) seed dedup in graphdl-orm, (A) KV removal in apis (depends on B's StateMachines.ts fix), (C) domain model reading files in support.auto.dev. Task B includes fixing the StateMachines.ts `relationTo` bug.

**Tech Stack:** Cloudflare Workers (apis), Payload CMS 3.x (graphdl-orm), Vitest (tests), Markdown domain files (support.auto.dev)

---

## Task 1: Fix StateMachines.ts relationTo Bug

**Files:**
- Modify: `graphdl-orm/src/collections/StateMachines.ts:29`

**Step 1: Fix the bug**

In `C:\Users\lippe\Repos\graphdl-orm\src\collections\StateMachines.ts`, line 29, change:

```typescript
// BEFORE (line 29):
relationTo: 'state-machines',

// AFTER:
relationTo: 'state-machine-definitions',
```

**Step 2: Verify no other self-references exist**

Run: `cd C:/Users/lippe/Repos/graphdl-orm && grep -rn "relationTo: 'state-machines'" src/`

Expected: No matches (the only one was just fixed).

**Step 3: Commit**

```bash
cd C:/Users/lippe/Repos/graphdl-orm
git add src/collections/StateMachines.ts
git commit -m "fix: StateMachines.stateMachineType should reference state-machine-definitions, not itself"
```

---

## Task 2: Add Seed Dedup for State Machine Definitions

**Files:**
- Modify: `graphdl-orm/src/seed/handler.ts:666-770`
- Modify: `graphdl-orm/test/seed/handler.test.ts`

**Step 1: Write the failing test**

Add to `C:\Users\lippe\Repos\graphdl-orm\test\seed\handler.test.ts`, after the existing "should seed a state machine" test (line 86):

```typescript
it('should be idempotent on state machine re-seed', async () => {
  const parsed = parseStateMachineMarkdown(SUPPORT_SM)
  const result = await seedStateMachine(payload, 'SupportRequest', parsed, 'support')

  // Should succeed without errors (dedup, not duplicate)
  expect(result.stateMachines).toBe(1)
  expect(result.errors).toHaveLength(0)

  // Verify only ONE definition exists for SupportRequest
  const defs = await payload.find({
    collection: 'state-machine-definitions',
    pagination: false,
  })
  const supportDefs = defs.docs.filter((d: any) => {
    const nounId = typeof d.noun?.value === 'string' ? d.noun.value : d.noun?.value?.id
    return nounId != null
  })
  // There should be exactly 1 definition with SupportRequest noun
  // (the billing test also creates one, so filter by checking noun)
  const allStatuses = await payload.find({
    collection: 'statuses',
    where: { stateMachineDefinition: { equals: supportDefs[0]?.id } },
    pagination: false,
  })
  // Should be exactly 3 statuses (Received, Investigating, Resolved), not 6
  expect(allStatuses.docs.length).toBe(3)
})
```

**Step 2: Run test to verify it fails**

Run: `cd C:/Users/lippe/Repos/graphdl-orm && npx vitest run test/seed/handler.test.ts --reporter=verbose`

Expected: FAIL — the re-seed creates duplicate definition and 6 statuses instead of 3.

**Step 3: Add ensure* helpers to handler.ts**

In `C:\Users\lippe\Repos\graphdl-orm\src\seed\handler.ts`, after the existing `ensureEventType` function (after line 70), add:

```typescript
async function ensureStateMachineDefinition(
  payload: Payload,
  nounId: string,
  domainData: Record<string, any>,
): Promise<any> {
  const existing = await payload.find({
    collection: 'state-machine-definitions',
    where: { 'noun.value': { equals: nounId } },
    limit: 1,
  })
  if (existing.docs.length) return existing.docs[0]
  return payload.create({
    collection: 'state-machine-definitions',
    data: { noun: { relationTo: 'nouns', value: nounId }, ...domainData },
  })
}

async function ensureStatus(
  payload: Payload,
  name: string,
  definitionId: string,
): Promise<any> {
  const existing = await payload.find({
    collection: 'statuses',
    where: {
      name: { equals: name },
      stateMachineDefinition: { equals: definitionId },
    },
    limit: 1,
  })
  if (existing.docs.length) return existing.docs[0]
  return payload.create({
    collection: 'statuses',
    data: { name, stateMachineDefinition: definitionId },
  })
}

async function ensureTransition(
  payload: Payload,
  fromId: string,
  toId: string,
  eventTypeId: string,
): Promise<any> {
  const existing = await payload.find({
    collection: 'transitions',
    where: {
      from: { equals: fromId },
      to: { equals: toId },
      eventType: { equals: eventTypeId },
    },
    limit: 1,
  })
  if (existing.docs.length) return existing.docs[0]
  return payload.create({
    collection: 'transitions',
    data: { from: fromId, to: toId, eventType: eventTypeId },
  })
}

async function ensureGuard(
  payload: Payload,
  transitionId: string,
  name: string,
): Promise<any> {
  const existing = await payload.find({
    collection: 'guards',
    where: {
      transition: { equals: transitionId },
      name: { equals: name },
    },
    limit: 1,
  })
  if (existing.docs.length) return existing.docs[0]
  return payload.create({
    collection: 'guards',
    data: { name, transition: transitionId },
  })
}
```

**Step 4: Update seedStateMachine() to use ensure* helpers**

Replace the body of `seedStateMachine()` (lines ~694-770). The key changes:

1. Line ~694: `payload.create({ collection: 'state-machine-definitions' ...})` → `ensureStateMachineDefinition(payload, noun.docs[0].id, domainData)`
2. Lines ~700-706: `payload.create({ collection: 'statuses' ...})` → `ensureStatus(payload, s, definition.id)`
3. Lines ~716-728: `payload.create({ collection: 'transitions' ...})` → `ensureTransition(payload, statusMap.get(t.from)!, statusMap.get(t.to)!, eventTypeCache.get(t.event)!)`
4. Lines ~750-760: `payload.create({ collection: 'guards' ...})` → `ensureGuard(payload, matchingTransitions.docs[0].id, guardText)`

Full replacement for the try block inside `seedStateMachine()`:

```typescript
  try {
    const noun = await payload.find({
      collection: 'nouns',
      where: { name: { equals: entityNounName } },
      limit: 1,
    })
    if (!noun.docs.length) {
      result.errors.push(`entity noun "${entityNounName}" not found — create domain readings first`)
      return result
    }

    const definition = await ensureStateMachineDefinition(payload, noun.docs[0].id, domainData)

    const statusMap = new Map<string, string>()
    await batch(parsed.states, async (s) => {
      const status = await ensureStatus(payload, s, definition.id)
      statusMap.set(s, status.id)
    })

    const uniqueEvents = [...new Set(parsed.transitions.map((t) => t.event))]
    const eventTypeCache = new Map<string, string>()
    await batch(uniqueEvents, async (event) => {
      const et = await ensureEventType(payload, event)
      eventTypeCache.set(event, et.id)
    })

    const transitionsByEvent = new Map<string, string[]>()
    await batch(parsed.transitions, async (t) => {
      const transition = await ensureTransition(
        payload,
        statusMap.get(t.from)!,
        statusMap.get(t.to)!,
        eventTypeCache.get(t.event)!,
      )
      const existing = transitionsByEvent.get(t.event) || []
      existing.push(transition.id)
      transitionsByEvent.set(t.event, existing)
    })

    const transitionsWithGuards = parsed.transitions.filter((t) => t.guard)
    if (transitionsWithGuards.length) {
      await batch(transitionsWithGuards, async (t) => {
        const fromId = statusMap.get(t.from)
        const toId = statusMap.get(t.to)
        const eventId = eventTypeCache.get(t.event)

        const matchingTransitions = await payload.find({
          collection: 'transitions',
          where: {
            from: { equals: fromId },
            to: { equals: toId },
            eventType: { equals: eventId },
          },
          limit: 1,
        })

        if (matchingTransitions.docs.length) {
          const guardTexts = t.guard!.split(';').map((g: string) => g.trim()).filter(Boolean)
          for (const guardText of guardTexts) {
            await ensureGuard(payload, matchingTransitions.docs[0].id, guardText)
          }
        }
      })
    }

    await wireVerbsAndFunctions(payload, uniqueEvents, transitionsByEvent, result)

    result.stateMachines++
  } catch (err: any) {
    result.errors.push(`state machine for ${entityNounName}: ${err.message}`)
  }
```

**Step 5: Run tests to verify they pass**

Run: `cd C:/Users/lippe/Repos/graphdl-orm && npx vitest run test/seed/handler.test.ts --reporter=verbose`

Expected: All tests PASS, including the new idempotency test.

**Step 6: Commit**

```bash
cd C:/Users/lippe/Repos/graphdl-orm
git add src/seed/handler.ts test/seed/handler.test.ts
git commit -m "feat: add dedup for state machine definitions, statuses, transitions, and guards on reseed"
```

---

## Task 3: Remove GRAPHDL_USERS KV from apis Worker

**Files:**
- Modify: `apis/graphdl/with-graphdl-user.ts`
- Modify: `apis/state/helpers.ts`
- Modify: `apis/graphdl/helpers.ts`
- Modify: `apis/wrangler.jsonc`

**Step 1: Remove KV cache from withGraphDLUser**

Replace the entire file `C:\Users\lippe\Repos\apis\graphdl\with-graphdl-user.ts`:

```typescript
import type { ApiRequest } from '@/types/api.types'

export async function withGraphDLUser(request: ApiRequest, env: Env) {
  const email = request.user?.email
  if (!email) return

  // Provision: check if user exists on graphdl-orm
  const findRes = await fetch(
    `${env.GRAPHDL_URL}/api/users?where[email][equals]=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `users API-Key ${env.GRAPHDL_API_KEY}` } },
  )

  if (!findRes.ok) {
    throw new Error(`GraphDL user lookup failed: ${findRes.status}`)
  }

  const findData: any = await findRes.json()

  // Payload doesn't auto-generate API keys — we must set them explicitly
  const newApiKey = crypto.randomUUID()
  let apiKey: string

  if (findData.docs?.length > 0) {
    // User exists — set/rotate API key
    const userId = findData.docs[0].id
    const patchRes = await fetch(`${env.GRAPHDL_URL}/api/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `users API-Key ${env.GRAPHDL_API_KEY}`,
      },
      body: JSON.stringify({ enableAPIKey: true, apiKey: newApiKey }),
    })
    if (!patchRes.ok) throw new Error(`GraphDL API key provision failed: ${patchRes.status}`)
    const patchData: any = await patchRes.json()
    apiKey = patchData.doc?.apiKey
  } else {
    // User doesn't exist — create with API key
    const createRes = await fetch(`${env.GRAPHDL_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `users API-Key ${env.GRAPHDL_API_KEY}`,
      },
      body: JSON.stringify({
        email,
        password: crypto.randomUUID(),
        enableAPIKey: true,
        apiKey: newApiKey,
      }),
    })
    if (!createRes.ok) throw new Error(`GraphDL user creation failed: ${createRes.status}`)
    const createData: any = await createRes.json()
    apiKey = createData.doc?.apiKey
  }

  if (!apiKey) throw new Error('Failed to obtain GraphDL API key for user')

  console.info(`[GraphDL] Provisioned user ${email} (${findData.docs?.length ? 'existing' : 'new'})`)
  request.graphdlApiKey = apiKey
}
```

**Step 2: Replace getInstance/putInstance in helpers.ts with graphdl-orm API calls**

In `C:\Users\lippe\Repos\apis\state\helpers.ts`, replace `getInstance` and `putInstance` (lines 100-115):

```typescript
/**
 * Instance state is stored in the graphdl-orm `state-machines` collection.
 * Queried via the raw API using the service account key.
 */
export async function getInstance(env: Env, machineType: string, instanceId: string, apiKey: string) {
  const params = new URLSearchParams()
  params.set('where[name][equals]', instanceId)
  params.set('depth', '1')
  params.set('limit', '1')
  const data = await graphdlGet(env, `state-machines?${params}`, apiKey)
  const doc = data.docs?.[0]
  if (!doc) return null
  return {
    id: doc.id,
    currentStatusId: typeof doc.stateMachineStatus === 'object' ? doc.stateMachineStatus.id : doc.stateMachineStatus,
    currentStatusName: typeof doc.stateMachineStatus === 'object' ? doc.stateMachineStatus.name : null,
    definitionId: typeof doc.stateMachineType === 'object' ? doc.stateMachineType.id : doc.stateMachineType,
  }
}

export async function putInstance(
  env: Env,
  instanceId: string,
  data: { currentStatusId: string; definitionId: string },
  apiKey: string,
  existingDocId?: string,
) {
  if (existingDocId) {
    // Update existing instance
    const res = await fetch(`${env.GRAPHDL_URL}/api/state-machines/${existingDocId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `users API-Key ${apiKey}`,
      },
      body: JSON.stringify({ stateMachineStatus: data.currentStatusId }),
    })
    if (!res.ok) throw new Error(`Failed to update state machine instance: ${res.status}`)
    return res.json()
  } else {
    // Create new instance
    const res = await fetch(`${env.GRAPHDL_URL}/api/state-machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `users API-Key ${apiKey}`,
      },
      body: JSON.stringify({
        name: instanceId,
        stateMachineType: data.definitionId,
        stateMachineStatus: data.currentStatusId,
      }),
    })
    if (!res.ok) throw new Error(`Failed to create state machine instance: ${res.status}`)
    return res.json()
  }
}
```

**Step 3: Update runtime.ts to use the new signatures**

In `C:\Users\lippe\Repos\apis\state\runtime.ts`, update all `getInstance` and `putInstance` calls:

Line 45 — change:
```typescript
// BEFORE:
const instance = await getInstance(env, machineType!, instanceId!)
// AFTER:
const instance = await getInstance(env, machineType!, instanceId!, apiKey)
```

Line 92 — change:
```typescript
// BEFORE:
let instance = await getInstance(env, machineType!, instanceId!)
// AFTER:
let instance = await getInstance(env, machineType!, instanceId!, apiKey)
```

Line 110 — change:
```typescript
// BEFORE:
await putInstance(env, machineType!, instanceId!, instance)
// AFTER:
await putInstance(env, instanceId!, { currentStatusId: initialStatus.id, definitionId: definition.id }, apiKey)
// Also simplify the instance object (no need for currentStatusName — it's stored in the collection):
instance = {
  currentStatusId: initialStatus.id,
  currentStatusName: initialStatus.name,
  definitionId: definition.id,
}
```

Lines 166-170 — change:
```typescript
// BEFORE:
await putInstance(env, machineType!, instanceId!, {
  currentStatusId: targetStatus.id,
  currentStatusName: targetStatus.name,
  definitionId: instance.definitionId,
})
// AFTER:
await putInstance(
  env,
  instanceId!,
  { currentStatusId: targetStatus.id, definitionId: instance.definitionId },
  apiKey,
  instance.id,
)
```

**Step 4: Remove GRAPHDL_USERS from Env type**

In `C:\Users\lippe\Repos\apis\graphdl\helpers.ts`, remove the `GRAPHDL_USERS` line:

```typescript
// BEFORE:
declare global {
  interface Env {
    GRAPHDL_URL: string
    GRAPHDL_API_KEY: string
    GRAPHDL_USERS: KVNamespace
  }
}

// AFTER:
declare global {
  interface Env {
    GRAPHDL_URL: string
    GRAPHDL_API_KEY: string
  }
}
```

**Step 5: Remove GRAPHDL_USERS KV binding from wrangler.jsonc**

In `C:\Users\lippe\Repos\apis\wrangler.jsonc`, remove the GRAPHDL_USERS binding from the `kv_namespaces` array:

```jsonc
// BEFORE:
"kv_namespaces": [
  {
    "binding": "REDIRECTS",
    "id": "fbf35fc28b9749b585c396d16843b0c9"
  },
  {
    "binding": "GRAPHDL_USERS",
    "id": "4d450b16969243b4838b49599fc03159"
  }
],

// AFTER:
"kv_namespaces": [
  {
    "binding": "REDIRECTS",
    "id": "fbf35fc28b9749b585c396d16843b0c9"
  }
],
```

**Step 6: Verify build succeeds**

Run: `cd C:/Users/lippe/Repos/apis && npx wrangler deploy --dry-run`

Expected: Build completes with no TypeScript errors about `GRAPHDL_USERS`.

**Step 7: Commit**

```bash
cd C:/Users/lippe/Repos/apis
git add graphdl/with-graphdl-user.ts state/helpers.ts state/runtime.ts graphdl/helpers.ts wrangler.jsonc
git commit -m "refactor: remove GRAPHDL_USERS KV, use graphdl-orm state-machines collection for instance state"
```

---

## Task 4: Simplify Feature Request Lifecycle

**Files:**
- Modify: `support.auto.dev/state-machines/feature-request-lifecycle.md`

**Step 1: Update the state machine**

Replace the entire file `C:\Users\lippe\Repos\support.auto.dev\state-machines\feature-request-lifecycle.md`:

```markdown
# Feature Request Lifecycle

## States

Proposed, Investigating, Approved, InProgress, Shipped

## Transitions

| From | To | Event |
|------|-----|-------|
| Proposed | Investigating | investigate |
| Investigating | Approved | approve |
| Investigating | Proposed | defer |
| Approved | InProgress | startWork |
| InProgress | Shipped | deploy |
```

**Step 2: Commit**

```bash
cd C:/Users/lippe/Repos/support.auto.dev
git add state-machines/feature-request-lifecycle.md
git commit -m "simplify: remove Closed state from feature request lifecycle, Shipped is terminal"
```

---

## Task 5: Add Admin Subtype and EmailDomain to customer-auth.md

**Files:**
- Modify: `support.auto.dev/domains/customer-auth.md`

**Step 1: Add EmailDomain value type and Admin readings**

In `C:\Users\lippe\Repos\support.auto.dev\domains\customer-auth.md`:

Add to Value Types table:
```
| EmailDomain | string | |
```

Add to Readings table:
```
| Admin is a subtype of Customer | subtype |
| Customer has EmailDomain | \*:1 |
```

Add a new Instance Facts section after Readings:
```markdown
## Instance Facts

| Fact |
|------|
| Customer with EmailDomain 'driv.ly' has UserRole 'ADMIN' |
| Customer with EmailDomain 'repo.do' has UserRole 'ADMIN' |
```

**Step 2: Commit**

```bash
cd C:/Users/lippe/Repos/support.auto.dev
git add domains/customer-auth.md
git commit -m "feat: add Admin subtype, EmailDomain, and admin role detection instance facts"
```

---

## Task 6: Add Admin Fact Types and SupportResponse Subtype to support.md

**Files:**
- Modify: `support.auto.dev/domains/support.md`

**Step 1: Add SupportResponse subtype and Admin fact types**

In `C:\Users\lippe\Repos\support.auto.dev\domains\support.md`:

Add to Entity Types table:
```
| Admin | EmailAddress | Subtype of Customer |
```

Add value type:
```
| Reason | string | |
```

Add to Readings table (after existing readings):
```
| SupportResponse is a subtype of Message | subtype |
| Admin redrafts SupportResponse with Reason | \*:\* |
| Admin resolves SupportRequest | \*:\* |
| Admin reopens SupportRequest | \*:\* |
| Admin merges SupportRequest into SupportRequest | \*:\* |
| Admin adds Constraint to SupportResponse | \*:\* |
```

**Step 2: Commit**

```bash
cd C:/Users/lippe/Repos/support.auto.dev
git add domains/support.md
git commit -m "feat: add Admin fact types as implicit permissions, SupportResponse subtype of Message"
```

---

## Task 7: Create SupportResponse Lifecycle State Machine

**Files:**
- Create: `support.auto.dev/state-machines/support-response-lifecycle.md`

**Step 1: Create the file**

```markdown
# Support Response Lifecycle

## States

Draft, Sent

## Transitions

| From | To | Event |
|------|-----|-------|
| Draft | Sent | send |
```

**Step 2: Commit**

```bash
cd C:/Users/lippe/Repos/support.auto.dev
git add state-machines/support-response-lifecycle.md
git commit -m "feat: add SupportResponse lifecycle state machine (Draft -> Sent) for draft visibility"
```

---

## Task 8: Create UI Domain for Display Properties

**Files:**
- Create: `support.auto.dev/domains/ui.md`

**Step 1: Create the domain file**

```markdown
# UI

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| DisplayColor | ColorName | Visual status indicator |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| ColorName | string | enum: green, amber, red, blue, violet, gray |

## Readings

| Reading | Multiplicity |
|---------|-------------|
| Status has DisplayColor | \*:1 |

## Instance Facts

| Fact |
|------|
| Status 'Received' has DisplayColor 'blue' |
| Status 'Triaging' has DisplayColor 'amber' |
| Status 'Investigating' has DisplayColor 'violet' |
| Status 'WaitingOnCustomer' has DisplayColor 'amber' |
| Status 'Resolved' has DisplayColor 'green' |
| Status 'Draft' has DisplayColor 'gray' |
| Status 'Sent' has DisplayColor 'green' |
| Status 'Proposed' has DisplayColor 'blue' |
| Status 'Approved' has DisplayColor 'green' |
| Status 'InProgress' has DisplayColor 'violet' |
| Status 'Shipped' has DisplayColor 'green' |
```

**Step 2: Commit**

```bash
cd C:/Users/lippe/Repos/support.auto.dev
git add domains/ui.md
git commit -m "feat: add UI domain with DisplayColor readings and status color instance facts"
```

---

## Task 9: Enrich Feature Requests Domain

**Files:**
- Modify: `support.auto.dev/domains/feature-requests.md`

**Step 1: Add votes and priority readings**

In `C:\Users\lippe\Repos\support.auto.dev\domains\feature-requests.md`:

Add to Readings table:
```
| Customer votes on FeatureRequest | \*:\* |
| FeatureRequest has Priority | \*:1 |
```

Note: `Priority` value type is already defined in support.md (enum: low, medium, high, urgent).

**Step 2: Commit**

```bash
cd C:/Users/lippe/Repos/support.auto.dev
git add domains/feature-requests.md
git commit -m "feat: add customer votes and priority to feature requests domain"
```

---

## Task 10: Push All Changes

**Step 1: Push graphdl-orm**

```bash
cd C:/Users/lippe/Repos/graphdl-orm && git push
```

**Step 2: Push apis**

```bash
cd C:/Users/lippe/Repos/apis && git push
```

**Step 3: Push support.auto.dev**

```bash
cd C:/Users/lippe/Repos/support.auto.dev && git push
```

**Step 4: Deploy apis worker**

```bash
cd C:/Users/lippe/Repos/apis && npx wrangler deploy
```
