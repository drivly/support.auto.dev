# Generator Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the intermediate `payloadCollections` JSON with a TypeScript file exporter that derives Payload CollectionConfig files directly from JSON Schema, and add XState + agent tool generation from StateMachineDefinition collections.

**Architecture:** The Generator beforeChange hook already produces OpenAPI/JSON Schema output and has access to all noun metadata. We remove the `payloadCollections` block (lines 268-391) and replace it with two new functions: (1) `generatePayloadFiles` that walks `components.schemas` + nouns to emit `.ts` strings, and (2) `generateStateMachineFiles` that walks StateMachineDefinitions → Statuses → Transitions to emit XState JSON + tool schemas. Both write to `output.files`.

**Tech Stack:** TypeScript, Payload CMS 3.12.0, Vitest, MongoDB in-memory, XState 4.x JSON format

---

### Task 1: Add `output.files` to Generator and write a minimal exporter test

**Files:**
- Modify: `src/collections/Generator.ts` (lines 1058-1062, output assembly)
- Modify: `test/collections/z-payload-generator.test.ts`

**Step 1: Write the failing test**

Update `test/collections/z-payload-generator.test.ts` — add a new test that asserts `output.files` exists and contains a `.ts` file for `support-requests`:

```typescript
it('should generate .ts collection files in output.files', () => {
  expect(output.files).toBeDefined()
  expect(typeof output.files).toBe('object')
  expect(output.files['collections/support-requests.ts']).toBeDefined()
  expect(typeof output.files['collections/support-requests.ts']).toBe('string')
})
```

**Step 2: Run test to verify it fails**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/z-payload-generator.test.ts`
Expected: FAIL — `output.files` is undefined

**Step 3: Add minimal `output.files` to Generator output assembly**

In `src/collections/Generator.ts`, at line 1058 (the post-processing region), add after `const parsedOutput = JSON.parse(output)`:

```typescript
// Generate Payload collection TypeScript files
const files: Record<string, string> = {}
if (databaseEngine === 'Payload') {
  for (const [slug, collection] of Object.entries(payloadCollections) as [string, Record<string, unknown>][]) {
    const collectionFields = collection.fields as Record<string, unknown>[]
    files[`collections/${slug}.ts`] = generateCollectionTypeScript(slug, collection, collectionFields)
  }
}
parsedOutput.files = Object.keys(files).length ? files : undefined
```

And add a stub function after the `export default Generator` line:

```typescript
function generateCollectionTypeScript(
  slug: string,
  collection: Record<string, unknown>,
  fields: Record<string, unknown>[],
): string {
  const pascalName = slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
  return `import type { CollectionConfig } from 'payload'\n\nexport const ${pascalName}: CollectionConfig = ${JSON.stringify(collection, null, 2)}\n`
}
```

**Step 4: Run test to verify it passes**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/z-payload-generator.test.ts`
Expected: PASS

**Step 5: Run full test suite for regressions**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/collections/Generator.ts test/collections/z-payload-generator.test.ts
git commit -m "feat: add output.files with stub TypeScript collection exporter"
```

---

### Task 2: Generate proper TypeScript (not just JSON.stringify)

The stub uses `JSON.stringify` which produces valid but ugly output. Replace with a proper serializer that emits idiomatic TypeScript.

**Files:**
- Modify: `src/collections/Generator.ts` (the `generateCollectionTypeScript` function)
- Modify: `test/collections/z-payload-generator.test.ts`

**Step 1: Write failing tests for TypeScript quality**

Add to the test file:

```typescript
it('should generate valid TypeScript with proper imports and structure', () => {
  const tsContent = output.files['collections/support-requests.ts']
  expect(tsContent).toContain("import type { CollectionConfig } from 'payload'")
  expect(tsContent).toContain('export const SupportRequests: CollectionConfig')
  expect(tsContent).toContain("slug: 'support-requests'")
  expect(tsContent).toContain("type: 'text'")
  expect(tsContent).toContain("type: 'select'")
  expect(tsContent).toContain("type: 'relationship'")
})

it('should generate .ts files for all entity nouns with permissions', () => {
  expect(output.files['collections/support-requests.ts']).toBeDefined()
  expect(output.files['collections/feature-requests.ts']).toBeDefined()
  expect(output.files['collections/customers.ts']).toBeDefined()
  expect(output.files['collections/api-products.ts']).toBeDefined()
})

it('should include access control in generated TypeScript', () => {
  const tsContent = output.files['collections/support-requests.ts']
  expect(tsContent).toContain('access:')
  expect(tsContent).toContain("create: ({ req: { user } }) => Boolean(user)")
})

it('should include auth config for login collections', () => {
  const tsContent = output.files['collections/customers.ts']
  expect(tsContent).toContain('auth: true')
})
```

**Step 2: Run tests to verify they fail**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/z-payload-generator.test.ts`
Expected: FAIL — current stub uses JSON.stringify, doesn't produce proper TypeScript syntax

**Step 3: Replace `generateCollectionTypeScript` with a proper serializer**

Replace the `generateCollectionTypeScript` function in `src/collections/Generator.ts`:

```typescript
function generateCollectionTypeScript(
  slug: string,
  collection: Record<string, unknown>,
  _fields: Record<string, unknown>[],
): string {
  const pascalName = slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
  const lines: string[] = []
  lines.push("import type { CollectionConfig } from 'payload'")
  lines.push('')
  lines.push(`export const ${pascalName}: CollectionConfig = ${objectToTS(collection, 0)}`)
  lines.push('')
  return lines.join('\n')
}

function objectToTS(obj: unknown, indent: number): string {
  const pad = '  '.repeat(indent)
  const inner = '  '.repeat(indent + 1)

  if (obj === null || obj === undefined) return String(obj)
  if (typeof obj === 'boolean' || typeof obj === 'number') return String(obj)
  if (typeof obj === 'string') return quote(obj)

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    const items = obj.map(item => `${inner}${objectToTS(item, indent + 1)}`)
    return `[\n${items.join(',\n')},\n${pad}]`
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'
    const props = entries.map(([key, value]) => {
      // Access control functions need special handling
      if (key === 'access' && typeof value === 'object' && value !== null) {
        return `${inner}access: ${accessToTS(value as Record<string, string>, indent + 1)}`
      }
      const k = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : quote(key)
      return `${inner}${k}: ${objectToTS(value, indent + 1)}`
    })
    return `{\n${props.join(',\n')},\n${pad}}`
  }

  return String(obj)
}

function accessToTS(access: Record<string, string>, indent: number): string {
  const pad = '  '.repeat(indent)
  const inner = '  '.repeat(indent + 1)
  const entries = Object.entries(access).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return '{}'
  const props = entries.map(([key, _value]) => {
    return `${inner}${key}: ({ req: { user } }) => Boolean(user)`
  })
  return `{\n${props.join(',\n')},\n${pad}}`
}

function quote(s: string): string {
  if (s.includes("'")) return `'${s.replace(/'/g, "\\'")}'`
  return `'${s}'`
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/z-payload-generator.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/collections/Generator.ts test/collections/z-payload-generator.test.ts
git commit -m "feat: generate proper TypeScript for Payload collection files"
```

---

### Task 3: Remove `payloadCollections` from output, derive from JSON Schema

Currently the TS exporter reads from the `payloadCollections` object which was built separately from the schema. Refactor so the exporter reads directly from `components.schemas` + noun metadata, then remove the `payloadCollections` block.

**Files:**
- Modify: `src/collections/Generator.ts` (remove lines 268-391, rewrite file generation)
- Modify: `test/collections/z-payload-generator.test.ts` (update assertions)

**Step 1: Update tests — remove `payloadCollections` assertions, keep `output.files` assertions**

Replace the existing tests that reference `collections` (which is `output.payloadCollections`) with tests that only assert on `output.files`. Remove:

```typescript
// Remove these test variables:
// let collections: any  (line 7)
// collections = output.payloadCollections  (line 28)

// Remove these tests entirely:
// 'should generate payloadCollections in output'
// 'should generate collections for seeded entity nouns'
// 'should set correct slugs and labels'
// 'should produce all expected Payload field types'
// 'should include access control based on permissions'
// 'should include auth config when login permission is set'
// 'should set admin useAsTitle on all collections'
```

Keep the OpenAPI test. The `output.files` tests from Tasks 1 and 2 now serve as the validation layer.

Add a test to verify `payloadCollections` is NOT in the output:

```typescript
it('should not include intermediate payloadCollections in output', () => {
  expect(output.payloadCollections).toBeUndefined()
})
```

**Step 2: Run tests to verify the removal test fails**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/z-payload-generator.test.ts`
Expected: FAIL — `payloadCollections` is still present

**Step 3: Rewrite file generation to derive from JSON Schema**

In `src/collections/Generator.ts`:

1. Remove lines 268-391 (the entire `payloadCollections` block and join field second pass)
2. Remove lines 1059-1061 (`parsedOutput.payloadCollections = payloadCollections`)
3. Replace the file generation block (currently reads from `payloadCollections`) with a new function that reads from the parsed OpenAPI schemas:

```typescript
// In the post-processing region, after parsedOutput is created:
const files: Record<string, string> = {}
if (databaseEngine === 'Payload') {
  const componentSchemas = parsedOutput.components?.schemas || {}
  for (const noun of nouns.filter((n) => (n as Noun).permissions?.length)) {
    const key = nameToKey(noun.name || '')
    const slug = ((noun as Noun).plural || noun.name + 's')?.toLowerCase().replace(/ /g, '-')

    // Merge properties from schema variants
    const allProperties: Record<string, Schema> = {
      ...(componentSchemas['Update' + key]?.properties || {}),
      ...(componentSchemas['New' + key]?.properties || {}),
      ...(componentSchemas[key]?.properties || {}),
    }
    if (!Object.keys(allProperties).length) continue

    const required = [
      ...(componentSchemas['Update' + key]?.required || []),
      ...(componentSchemas['New' + key]?.required || []),
      ...(componentSchemas[key]?.required || []),
    ]

    const fields: Record<string, unknown>[] = []
    for (const [propName, propDef] of Object.entries(allProperties) as [string, Schema][]) {
      const field: Record<string, unknown> = { name: propName }

      if (propDef.enum) {
        field.type = 'select'
        field.options = (propDef.enum as unknown[]).filter((v) => v !== null).map((v) => String(v))
      } else if (propDef.type === 'boolean') {
        field.type = 'checkbox'
      } else if (propDef.type === 'number' || propDef.type === 'integer') {
        field.type = 'number'
      } else if (propDef.type === 'array') {
        const items = propDef.items as Schema | undefined
        if (items?.$ref) {
          const refTarget = items.$ref.split('/').pop() || ''
          const refNoun = nouns.find((n) => nameToKey(n.name || '') === refTarget)
          field.type = 'relationship'
          field.relationTo = ((refNoun as Noun)?.plural || refTarget)?.toLowerCase().replace(/ /g, '-')
          field.hasMany = true
        } else {
          field.type = 'json'
        }
      } else if (propDef.oneOf) {
        const refSchema = (propDef.oneOf as Schema[]).find((s) => s.$ref)
        if (refSchema?.$ref) {
          const refTarget = refSchema.$ref.split('/').pop() || ''
          const refNoun = nouns.find((n) => nameToKey(n.name || '') === refTarget)
          field.type = 'relationship'
          field.relationTo = ((refNoun as Noun)?.plural || refTarget)?.toLowerCase().replace(/ /g, '-')
        } else {
          field.type = 'text'
        }
      } else if (propDef.format === 'email') {
        field.type = 'email'
      } else if (propDef.format === 'date-time' || propDef.format === 'date') {
        field.type = 'date'
      } else {
        field.type = 'text'
      }

      if (required.includes(propName)) field.required = true
      if (propDef.description?.includes('is uniquely identified by')) field.unique = true
      fields.push(field)
    }

    // Add join fields for reverse relationships
    for (const cs of constraintSpans.filter((cs) => (cs.roles as Role[])?.length === 1)) {
      const constrainedRole = (cs.roles as Role[])[0]
      const nestedGs = constrainedRole.graphSchema as GraphSchema
      const gs = graphSchemas.find((s) => s.id === nestedGs?.id) || nestedGs
      if (!gs || (gs.roles?.docs?.length || 0) !== 2) continue

      const objectRole = gs.roles?.docs?.find((r) => (r as Role).id !== constrainedRole.id) as Role
      if (!objectRole) continue

      const subjectNoun = constrainedRole.noun?.value as Noun | GraphSchema
      const objectNoun = objectRole.noun?.value as Noun | GraphSchema
      if (!subjectNoun?.name || !objectNoun?.name) continue

      const subjectSlug = ((subjectNoun as Noun).plural || subjectNoun.name + 's')?.toLowerCase().replace(/ /g, '-')
      const objectSlug = ((objectNoun as Noun).plural || objectNoun.name + 's')?.toLowerCase().replace(/ /g, '-')

      if (objectSlug !== slug) continue
      const relField = fields.find((f) => f.type === 'relationship' && f.relationTo === objectSlug)
      // Only add if the constrained side has a relationship field pointing here
      const constrainedNounKey = nameToKey(subjectNoun.name || '')
      const constrainedProps = componentSchemas['Update' + constrainedNounKey]?.properties || {}
      const hasRelToUs = Object.values(constrainedProps).some((p: any) =>
        p.oneOf?.some((s: any) => s.$ref?.endsWith('/' + key)) ||
        (p.items as any)?.$ref?.endsWith('/' + key)
      )
      if (!hasRelToUs) continue

      const existingJoin = fields.find((f) => f.type === 'join' && f.collection === subjectSlug)
      if (!existingJoin) {
        // Find the field name on the constrained side that references us
        const relFieldName = Object.entries(constrainedProps).find(([, p]: [string, any]) =>
          p.oneOf?.some((s: any) => s.$ref?.endsWith('/' + key)) ||
          (p.items as any)?.$ref?.endsWith('/' + key)
        )?.[0]
        if (relFieldName) {
          fields.push({
            name: subjectSlug,
            type: 'join',
            collection: subjectSlug,
            on: relFieldName,
          })
        }
      }
    }

    const refSchemeField = fields.find((f) => f.unique) || fields[0]
    const permissions = (noun as Noun).permissions || []
    const access: Record<string, string> = {}
    if (permissions.includes('create')) access.create = 'authenticated'
    if (permissions.includes('read')) access.read = 'authenticated'
    if (permissions.includes('update')) access.update = 'authenticated'
    if (permissions.includes('delete')) access.delete = 'authenticated'

    const collection: Record<string, unknown> = {
      slug,
      labels: { singular: noun.name, plural: (noun as Noun).plural || noun.name + 's' },
      admin: { useAsTitle: (refSchemeField?.name as string) || 'id' },
      timestamps: true,
      fields,
    }
    if (Object.keys(access).length) collection.access = access
    if (permissions.includes('login')) collection.auth = true

    files[`collections/${slug}.ts`] = generateCollectionTypeScript(slug, collection)
  }
}
parsedOutput.files = Object.keys(files).length ? files : undefined
data.output = parsedOutput
```

Note: the field mapping logic is the same as the old `payloadCollections` block — it just reads from `componentSchemas` (the parsed OpenAPI output) instead of the pre-flattened `schemas` variable. The key difference: `schemas` was a local variable with `$ref` strings, while `componentSchemas` has flattened properties (since allOf was already resolved at line 220-248).

**Step 4: Run tests to verify they pass**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/z-payload-generator.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/collections/Generator.ts test/collections/z-payload-generator.test.ts
git commit -m "refactor: derive Payload TS files from JSON Schema, remove payloadCollections"
```

---

### Task 4: Seed state machine test data and write failing XState test

**Files:**
- Modify: `test/helpers/seed.ts` (add `seedStateMachine` helper)
- Create: `test/collections/xstate-generator.test.ts`

**Step 1: Write the state machine seed helper**

Add to `test/helpers/seed.ts`:

```typescript
export async function seedStateMachine(payload: Payload) {
  // Create the SupportRequest noun (if not already present)
  let supportRequest = (await payload.find({
    collection: 'nouns',
    where: { name: { equals: 'SupportRequest' } },
  })).docs[0]
  if (!supportRequest) {
    supportRequest = await payload.create({
      collection: 'nouns',
      data: { name: 'SupportRequest', plural: 'support-requests', objectType: 'entity', permissions: ['create', 'read', 'update', 'list'] },
    })
  }

  // Create state machine definition
  const definition = await payload.create({
    collection: 'state-machine-definitions',
    data: { noun: { relationTo: 'nouns', value: supportRequest.id } },
  })

  // Create statuses
  const received = await payload.create({
    collection: 'statuses',
    data: { name: 'Received', stateMachineDefinition: definition.id },
  })
  const triaging = await payload.create({
    collection: 'statuses',
    data: { name: 'Triaging', stateMachineDefinition: definition.id },
  })
  const investigating = await payload.create({
    collection: 'statuses',
    data: { name: 'Investigating', stateMachineDefinition: definition.id },
  })
  const waitingOnCustomer = await payload.create({
    collection: 'statuses',
    data: { name: 'WaitingOnCustomer', stateMachineDefinition: definition.id },
  })
  const resolved = await payload.create({
    collection: 'statuses',
    data: { name: 'Resolved', stateMachineDefinition: definition.id },
  })

  // Create event types
  const triage = await payload.create({
    collection: 'event-types',
    data: { name: 'triage' },
  })
  const investigate = await payload.create({
    collection: 'event-types',
    data: { name: 'investigate' },
  })
  const requestInfo = await payload.create({
    collection: 'event-types',
    data: { name: 'requestInfo' },
  })
  const customerRespond = await payload.create({
    collection: 'event-types',
    data: { name: 'customerRespond' },
  })
  const resolve = await payload.create({
    collection: 'event-types',
    data: { name: 'resolve' },
  })

  // Create transitions
  await payload.create({
    collection: 'transitions',
    data: { from: received.id, to: triaging.id, eventType: triage.id },
  })
  await payload.create({
    collection: 'transitions',
    data: { from: triaging.id, to: investigating.id, eventType: investigate.id },
  })
  await payload.create({
    collection: 'transitions',
    data: { from: investigating.id, to: waitingOnCustomer.id, eventType: requestInfo.id },
  })
  await payload.create({
    collection: 'transitions',
    data: { from: waitingOnCustomer.id, to: investigating.id, eventType: customerRespond.id },
  })
  await payload.create({
    collection: 'transitions',
    data: { from: investigating.id, to: resolved.id, eventType: resolve.id },
  })
  await payload.create({
    collection: 'transitions',
    data: { from: triaging.id, to: resolved.id, eventType: resolve.id },
  })

  return { definition, statuses: { received, triaging, investigating, waitingOnCustomer, resolved } }
}
```

**Step 2: Write the failing test**

Create `test/collections/xstate-generator.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { initPayload } from '../helpers/initPayload'
import { seedStateMachine } from '../helpers/seed'

let payload: any
let output: any

describe('XState Generator', () => {
  beforeAll(async () => {
    payload = await initPayload()
    await payload.db.connection.dropDatabase()

    await seedStateMachine(payload)

    const generator = await payload.create({
      collection: 'generators',
      data: {
        title: 'Support State Machines',
        version: '1.0.0',
        databaseEngine: 'Payload',
      },
    })

    output = generator.output
  }, 120_000)

  it('should generate state machine files in output.files', () => {
    expect(output.files).toBeDefined()
    const smFiles = Object.keys(output.files).filter(f => f.startsWith('state-machines/'))
    expect(smFiles.length).toBeGreaterThan(0)
  })

  it('should generate valid XState config with id and initial state', () => {
    const smFile = Object.entries(output.files).find(([k]) => k.startsWith('state-machines/'))?.[1] as string
    expect(smFile).toBeDefined()
    const config = JSON.parse(smFile)
    expect(config.id).toBeDefined()
    expect(config.initial).toBe('Received')
  })

  it('should include all states', () => {
    const smFile = Object.entries(output.files).find(([k]) => k.startsWith('state-machines/'))?.[1] as string
    const config = JSON.parse(smFile)
    expect(config.states.Received).toBeDefined()
    expect(config.states.Triaging).toBeDefined()
    expect(config.states.Investigating).toBeDefined()
    expect(config.states.WaitingOnCustomer).toBeDefined()
    expect(config.states.Resolved).toBeDefined()
  })

  it('should include transitions as events on states', () => {
    const smFile = Object.entries(output.files).find(([k]) => k.startsWith('state-machines/'))?.[1] as string
    const config = JSON.parse(smFile)
    expect(config.states.Received.on.triage).toBeDefined()
    expect(config.states.Triaging.on.investigate).toBeDefined()
    expect(config.states.Triaging.on.resolve).toBeDefined()
    expect(config.states.Investigating.on.requestInfo).toBeDefined()
    expect(config.states.Investigating.on.resolve).toBeDefined()
    expect(config.states.WaitingOnCustomer.on.customerRespond).toBeDefined()
  })

  it('should set correct transition targets', () => {
    const smFile = Object.entries(output.files).find(([k]) => k.startsWith('state-machines/'))?.[1] as string
    const config = JSON.parse(smFile)
    expect(config.states.Received.on.triage.target).toBe('Triaging')
    expect(config.states.WaitingOnCustomer.on.customerRespond.target).toBe('Investigating')
  })
}, 120_000)
```

**Step 3: Run test to verify it fails**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/xstate-generator.test.ts`
Expected: FAIL — no state machine files in output

**Step 4: Commit**

```bash
git add test/helpers/seed.ts test/collections/xstate-generator.test.ts
git commit -m "test: add failing tests for XState generation from StateMachineDefinitions"
```

---

### Task 5: Implement XState JSON generation in Generator

**Files:**
- Modify: `src/collections/Generator.ts` (data loading + file generation)

**Step 1: Add StateMachineDefinition data loading**

In the `#region Retrieve data` section (around line 105), add to the `Promise.all`:

```typescript
payload
  .find({
    collection: 'state-machine-definitions',
    pagination: false,
    depth: 0,
  })
  .then((s) => s.docs),
```

And update the destructuring and type annotation to include the new result:

```typescript
const [graphSchemas, nouns, constraintSpans, examples, jsons, stateMachineDefinitions] = ...
```

**Step 2: Add state machine file generation**

In the post-processing region, after the Payload file generation block, add:

```typescript
// Generate XState state machine files
for (const smDef of stateMachineDefinitions) {
  // Load full definition with statuses
  const fullDef = await payload.findByID({
    collection: 'state-machine-definitions',
    id: smDef.id,
    depth: 2,
  })
  const statuses = (fullDef.statuses?.docs || []) as any[]
  if (!statuses.length) continue

  // Load transitions for each status
  const allTransitions: any[] = []
  for (const status of statuses) {
    const statusWithTransitions = await payload.findByID({
      collection: 'statuses',
      id: status.id,
      depth: 2,
    })
    const transitions = (statusWithTransitions.transitions?.docs || []) as any[]
    for (const t of transitions) {
      const toStatus = typeof t.to === 'string'
        ? statuses.find((s: any) => s.id === t.to)
        : t.to
      const eventType = typeof t.eventType === 'string'
        ? await payload.findByID({ collection: 'event-types', id: t.eventType })
        : t.eventType
      allTransitions.push({
        from: status.name,
        to: toStatus?.name,
        event: eventType?.name,
      })
    }
  }

  // Build XState config
  const states: Record<string, any> = {}
  for (const status of statuses) {
    const outgoing = allTransitions.filter(t => t.from === status.name)
    const on: Record<string, any> = {}
    for (const t of outgoing) {
      if (t.event && t.to) {
        on[t.event] = { target: t.to }
      }
    }
    states[status.name] = Object.keys(on).length ? { on } : {}
  }

  const nounRef = fullDef.noun
  const nounValue = typeof nounRef?.value === 'string'
    ? nouns.find(n => n.id === nounRef.value)
    : nounRef?.value
  const machineName = (nounValue?.name || 'unknown').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')

  const xstateConfig = {
    id: machineName,
    initial: statuses[0].name,
    states,
  }

  files[`state-machines/${machineName}.json`] = JSON.stringify(xstateConfig, null, 2)
}
```

**Step 3: Run tests to verify they pass**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/xstate-generator.test.ts`
Expected: PASS

**Step 4: Run full test suite**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/collections/Generator.ts
git commit -m "feat: generate XState JSON configs from StateMachineDefinitions"
```

---

### Task 6: Generate agent tool schemas from state machine events

**Files:**
- Modify: `src/collections/Generator.ts`
- Modify: `test/collections/xstate-generator.test.ts`

**Step 1: Write failing tests**

Add to `test/collections/xstate-generator.test.ts`:

```typescript
it('should generate agent tool schemas', () => {
  const toolsFile = Object.entries(output.files).find(([k]) => k.startsWith('agents/') && k.endsWith('-tools.json'))?.[1] as string
  expect(toolsFile).toBeDefined()
  const tools = JSON.parse(toolsFile)
  expect(Array.isArray(tools)).toBe(true)
  expect(tools.length).toBeGreaterThan(0)
})

it('should create a tool for each unique event type', () => {
  const toolsFile = Object.entries(output.files).find(([k]) => k.startsWith('agents/') && k.endsWith('-tools.json'))?.[1] as string
  const tools = JSON.parse(toolsFile)
  const toolNames = tools.map((t: any) => t.name)
  expect(toolNames).toContain('triage')
  expect(toolNames).toContain('investigate')
  expect(toolNames).toContain('requestInfo')
  expect(toolNames).toContain('customerRespond')
  expect(toolNames).toContain('resolve')
})

it('should include source and target states in tool descriptions', () => {
  const toolsFile = Object.entries(output.files).find(([k]) => k.startsWith('agents/') && k.endsWith('-tools.json'))?.[1] as string
  const tools = JSON.parse(toolsFile)
  const triageTool = tools.find((t: any) => t.name === 'triage')
  expect(triageTool.description).toContain('Received')
  expect(triageTool.description).toContain('Triaging')
})
```

**Step 2: Run tests to verify they fail**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/xstate-generator.test.ts`
Expected: FAIL — no agents/ files

**Step 3: Add tool schema generation**

In the state machine generation block (inside the `for (const smDef of stateMachineDefinitions)` loop), after writing the XState JSON file, add:

```typescript
// Generate agent tool schemas from unique events
const uniqueEvents = new Map<string, { from: string[], to: string[] }>()
for (const t of allTransitions) {
  if (!t.event) continue
  if (!uniqueEvents.has(t.event)) {
    uniqueEvents.set(t.event, { from: [], to: [] })
  }
  const entry = uniqueEvents.get(t.event)!
  if (!entry.from.includes(t.from)) entry.from.push(t.from)
  if (!entry.to.includes(t.to)) entry.to.push(t.to)
}

const tools = Array.from(uniqueEvents.entries()).map(([event, { from, to }]) => ({
  name: event,
  description: `Transition from ${from.join(' or ')} to ${to.join(' or ')}`,
  parameters: {
    type: 'object' as const,
    properties: {},
  },
}))

files[`agents/${machineName}-tools.json`] = JSON.stringify(tools, null, 2)
```

**Step 4: Run tests to verify they pass**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/xstate-generator.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/collections/Generator.ts test/collections/xstate-generator.test.ts
git commit -m "feat: generate agent tool schemas from state machine event types"
```

---

### Task 7: Generate system prompt from readings

**Files:**
- Modify: `src/collections/Generator.ts`
- Modify: `test/collections/xstate-generator.test.ts`

**Step 1: Write failing tests**

Add to `test/collections/xstate-generator.test.ts`. First, update the seed to also include readings by calling `seedSupportDomain` before `seedStateMachine`:

Update `beforeAll`:
```typescript
beforeAll(async () => {
  payload = await initPayload()
  await payload.db.connection.dropDatabase()

  // Seed domain readings AND state machine
  const { seedSupportDomain } = await import('../helpers/seed')
  await seedSupportDomain(payload)
  await seedStateMachine(payload)

  const generator = await payload.create({
    collection: 'generators',
    data: {
      title: 'Support State Machines',
      version: '1.0.0',
      databaseEngine: 'Payload',
    },
  })

  output = generator.output
}, 120_000)
```

Add tests:

```typescript
it('should generate a system prompt file', () => {
  const promptFile = Object.entries(output.files).find(([k]) => k.startsWith('agents/') && k.endsWith('-prompt.md'))?.[1] as string
  expect(promptFile).toBeDefined()
  expect(typeof promptFile).toBe('string')
})

it('should include domain model from readings in prompt', () => {
  const promptFile = Object.entries(output.files).find(([k]) => k.startsWith('agents/') && k.endsWith('-prompt.md'))?.[1] as string
  expect(promptFile).toContain('SupportRequest')
  expect(promptFile).toContain('Customer')
})

it('should include state machine context in prompt', () => {
  const promptFile = Object.entries(output.files).find(([k]) => k.startsWith('agents/') && k.endsWith('-prompt.md'))?.[1] as string
  expect(promptFile).toContain('Received')
  expect(promptFile).toContain('triage')
})
```

**Step 2: Run tests to verify they fail**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/xstate-generator.test.ts`
Expected: FAIL — no prompt file

**Step 3: Add prompt generation**

In the state machine generation block, after the tool schema generation, add:

```typescript
// Generate system prompt from readings + state machine
const readings = await payload.find({
  collection: 'readings',
  pagination: false,
}).then((r: any) => r.docs)

const readingTexts = readings.map((r: any) => r.text).filter(Boolean)
const stateNames = statuses.map((s: any) => s.name)
const eventNames = Array.from(uniqueEvents.keys())

const prompt = [
  `# ${nounValue?.name || 'Agent'} Agent`,
  '',
  '## Domain Model',
  ...readingTexts.map((r: string) => `- ${r}`),
  '',
  '## State Machine',
  `States: ${stateNames.join(', ')}`,
  '',
  '## Available Actions',
  ...eventNames.map(e => {
    const { from, to } = uniqueEvents.get(e)!
    return `- **${e}**: ${from.join('/')} → ${to.join('/')}`
  }),
  '',
  '## Current State: {{currentState}}',
  '',
  '## Instructions',
  'You operate within the domain model above. Use the available actions to transition the state machine. Do not take actions outside the defined transitions for the current state.',
  '',
].join('\n')

files[`agents/${machineName}-prompt.md`] = prompt
```

**Step 4: Run tests to verify they pass**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/xstate-generator.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/collections/Generator.ts test/collections/xstate-generator.test.ts
git commit -m "feat: generate agent system prompt from readings and state machine"
```
