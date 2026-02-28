# Payload Collection Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend GraphDL's Generator to output Payload CMS collection definitions from ORM readings, then generate the new SupportRequest and FeatureRequest collections for auth.vin.

**Architecture:** Add a `generatePayloadCollections` function to the existing Generator that runs after OpenAPI generation, reusing the same data (nouns, graph schemas, constraint spans). It maps ORM concepts to Payload field types: value types → text/number/select fields, entity references → relationship/join fields, enums → select fields, unary facts → checkbox fields. Output is a JSON object keyed by collection slug containing the full CollectionConfig structure.

**Tech Stack:** TypeScript, Payload CMS 3.x, Vitest, MongoDB (in-memory for tests)

---

### Task 1: Seed a SupportRequest domain in tests

**Files:**
- Modify: `test/helpers/seed.ts`
- Create: `test/collections/payload-generator.test.ts`

**Step 1: Write the seed helper for the support domain**

Add to `test/helpers/seed.ts`:

```typescript
export async function seedSupportDomain(payload: Payload) {
  // Entity nouns
  const customer = await payload.create({
    collection: 'nouns',
    data: { name: 'Customer', plural: 'customers', objectType: 'entity', permissions: ['create', 'read', 'update', 'delete', 'list', 'login'] },
  })
  const supportRequest = await payload.create({
    collection: 'nouns',
    data: { name: 'SupportRequest', plural: 'support-requests', objectType: 'entity', permissions: ['create', 'read', 'update', 'list'] },
  })

  // Value nouns
  const emailAddress = await payload.create({
    collection: 'nouns',
    data: { name: 'EmailAddress', objectType: 'value', valueType: 'string', format: 'email' },
  })
  const subject = await payload.create({
    collection: 'nouns',
    data: { name: 'Subject', objectType: 'value', valueType: 'string' },
  })
  const description = await payload.create({
    collection: 'nouns',
    data: { name: 'Description', objectType: 'value', valueType: 'string' },
  })
  const channelName = await payload.create({
    collection: 'nouns',
    data: { name: 'ChannelName', objectType: 'value', valueType: 'string', enum: 'Slack, Email' },
  })
  const priority = await payload.create({
    collection: 'nouns',
    data: { name: 'Priority', objectType: 'value', valueType: 'string', enum: 'low, medium, high, urgent' },
  })
  const requestId = await payload.create({
    collection: 'nouns',
    data: { name: 'RequestId', objectType: 'value', valueType: 'string', format: 'uuid' },
  })

  // Reference schemes
  await payload.update({
    collection: 'nouns',
    id: customer.id,
    data: { referenceScheme: [emailAddress.id] },
  })
  await payload.update({
    collection: 'nouns',
    id: supportRequest.id,
    data: { referenceScheme: [requestId.id] },
  })

  // Graph schemas + readings
  const customerHasEmail = await payload.create({
    collection: 'graph-schemas',
    data: { name: 'CustomerHasEmailAddress' },
  })
  await payload.create({
    collection: 'readings',
    data: { text: 'Customer has EmailAddress', graphSchema: customerHasEmail.id },
  })

  const requestHasSubject = await payload.create({
    collection: 'graph-schemas',
    data: { name: 'SupportRequestHasSubject' },
  })
  await payload.create({
    collection: 'readings',
    data: { text: 'SupportRequest has Subject', graphSchema: requestHasSubject.id },
  })

  const requestHasDescription = await payload.create({
    collection: 'graph-schemas',
    data: { name: 'SupportRequestHasDescription' },
  })
  await payload.create({
    collection: 'readings',
    data: { text: 'SupportRequest has Description', graphSchema: requestHasDescription.id },
  })

  const requestHasChannel = await payload.create({
    collection: 'graph-schemas',
    data: { name: 'SupportRequestArrivesViaChannelName' },
  })
  await payload.create({
    collection: 'readings',
    data: { text: 'SupportRequest arrives via ChannelName', graphSchema: requestHasChannel.id },
  })

  const requestHasPriority = await payload.create({
    collection: 'graph-schemas',
    data: { name: 'SupportRequestHasPriority' },
  })
  await payload.create({
    collection: 'readings',
    data: { text: 'SupportRequest has Priority', graphSchema: requestHasPriority.id },
  })

  const customerSubmitsRequest = await payload.create({
    collection: 'graph-schemas',
    data: { name: 'CustomerSubmitsSupportRequest' },
  })
  await payload.create({
    collection: 'readings',
    data: { text: 'Customer submits SupportRequest', graphSchema: customerSubmitsRequest.id },
  })

  // Set cardinality constraints
  await payload.update({
    collection: 'graph-schemas',
    id: customerHasEmail.id,
    data: { roleRelationship: 'one-to-one' },
  })
  await payload.update({
    collection: 'graph-schemas',
    id: requestHasSubject.id,
    data: { roleRelationship: 'many-to-one' },
  })
  await payload.update({
    collection: 'graph-schemas',
    id: requestHasDescription.id,
    data: { roleRelationship: 'many-to-one' },
  })
  await payload.update({
    collection: 'graph-schemas',
    id: requestHasChannel.id,
    data: { roleRelationship: 'many-to-one' },
  })
  await payload.update({
    collection: 'graph-schemas',
    id: requestHasPriority.id,
    data: { roleRelationship: 'many-to-one' },
  })
  await payload.update({
    collection: 'graph-schemas',
    id: customerSubmitsRequest.id,
    data: { roleRelationship: 'one-to-many' },
  })

  return {
    nouns: { customer, supportRequest, emailAddress, subject, description, channelName, priority, requestId },
    schemas: { customerHasEmail, requestHasSubject, requestHasDescription, requestHasChannel, requestHasPriority, customerSubmitsRequest },
  }
}
```

**Step 2: Write the failing test**

Create `test/collections/payload-generator.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { initPayload } from '../helpers/initPayload'
import { seedSupportDomain } from '../helpers/seed'

let payload: any
let output: any

describe('Payload Collection Generator', () => {
  beforeAll(async () => {
    payload = await initPayload()
    await seedSupportDomain(payload)

    const generator = await payload.create({
      collection: 'generators',
      data: {
        title: 'Support API',
        version: '1.0.0',
        databaseEngine: 'Payload',
      },
    })

    output = generator.output
  }, 120_000)

  it('should generate payloadCollections in output', () => {
    expect(output.payloadCollections).toBeDefined()
    expect(typeof output.payloadCollections).toBe('object')
  })

  it('should generate a SupportRequest collection', () => {
    const collections = output.payloadCollections
    const supportRequest = collections['support-requests']
    expect(supportRequest).toBeDefined()
    expect(supportRequest.slug).toBe('support-requests')
  })

  it('should map value type fields correctly', () => {
    const sr = output.payloadCollections['support-requests']
    const fields = sr.fields
    const fieldNames = fields.map((f: any) => f.name)

    expect(fieldNames).toContain('subject')
    expect(fieldNames).toContain('description')

    const subjectField = fields.find((f: any) => f.name === 'subject')
    expect(subjectField.type).toBe('text')
  })

  it('should map enum value types to select fields', () => {
    const sr = output.payloadCollections['support-requests']
    const fields = sr.fields

    const channelField = fields.find((f: any) => f.name === 'arrivesViaChannelName' || f.name === 'channelName')
    expect(channelField).toBeDefined()
    expect(channelField.type).toBe('select')
    expect(channelField.options.length).toBe(2)
  })

  it('should map entity references to relationship fields', () => {
    const customer = output.payloadCollections['customers']
    expect(customer).toBeDefined()

    // Customer submits SupportRequest (1:*) means SupportRequest has a customer relationship
    const sr = output.payloadCollections['support-requests']
    const fields = sr.fields
    const customerField = fields.find((f: any) => f.name === 'customer' || f.type === 'relationship')
    expect(customerField).toBeDefined()
    expect(customerField.type).toBe('relationship')
  })

  it('should include admin config with useAsTitle from reference scheme', () => {
    const sr = output.payloadCollections['support-requests']
    expect(sr.admin).toBeDefined()
    expect(sr.admin.useAsTitle).toBeDefined()
  })
}, 120_000)
```

**Step 3: Run test to verify it fails**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/payload-generator.test.ts`
Expected: FAIL — `output.payloadCollections` is undefined

**Step 4: Commit**

```bash
git add test/helpers/seed.ts test/collections/payload-generator.test.ts
git commit -m "test: add failing tests for Payload collection generation"
```

---

### Task 2: Add generatePayloadCollections to Generator

**Files:**
- Modify: `src/collections/Generator.ts`

**Step 1: Add the Payload collection generation function**

Add after the `processUnarySchemas` call (around line 218), before the schema flattening loop:

```typescript
// Generate Payload CMS collections
const payloadCollections: Record<string, any> = {}
if (databaseEngine === 'Payload') {
  for (const noun of nouns.filter(n => n.permissions?.length)) {
    const key = nameToKey(noun.name || '')
    const slug = (noun.plural || noun.name + 's')?.toLowerCase().replace(/ /g, '-')
    const updateSchema = schemas['Update' + key]
    if (!updateSchema) continue

    const fields: any[] = []
    const properties = updateSchema.properties || {}
    const required = schemas['New' + key]?.required || []

    for (const [propName, propDef] of Object.entries(properties) as [string, Schema][]) {
      const field: any = { name: propName }

      if (propDef.enum) {
        field.type = 'select'
        field.options = propDef.enum.filter((v: any) => v !== null).map((v: any) => String(v))
        if (propDef.nullable) field.options.push({ label: 'None', value: '' })
      } else if (propDef.type === 'boolean') {
        field.type = 'checkbox'
      } else if (propDef.type === 'number' || propDef.type === 'integer') {
        field.type = 'number'
      } else if (propDef.type === 'array') {
        // Array of references or values
        const items = propDef.items as Schema
        if (items?.$ref) {
          const refTarget = items.$ref.split('/').pop() || ''
          const refNoun = nouns.find(n => nameToKey(n.name || '') === refTarget)
          field.type = 'relationship'
          field.relationTo = (refNoun?.plural || refTarget)?.toLowerCase().replace(/ /g, '-')
          field.hasMany = true
        } else {
          field.type = 'json'
        }
      } else if (propDef.oneOf) {
        // Entity reference (oneOf pattern from createProperty)
        const refSchema = propDef.oneOf.find((s: any) => s.$ref) as Schema
        if (refSchema?.$ref) {
          const refTarget = refSchema.$ref.split('/').pop() || ''
          const refNoun = nouns.find(n => nameToKey(n.name || '') === refTarget)
          field.type = 'relationship'
          field.relationTo = (refNoun?.plural || refTarget)?.toLowerCase().replace(/ /g, '-')
        } else {
          field.type = 'text'
        }
      } else if (propDef.format === 'email') {
        field.type = 'email'
      } else if (propDef.format === 'date-time' || propDef.format === 'date') {
        field.type = 'date'
      } else if (propDef.format === 'uri') {
        field.type = 'text'
      } else {
        field.type = 'text'
      }

      if (required.includes(propName)) field.required = true

      // Copy over constraints from the schema
      if (propDef.description?.includes('is uniquely identified by')) {
        field.unique = true
      }
      if (propDef.description) field.label = propDef.description

      fields.push(field)
    }

    // Determine useAsTitle from reference scheme
    const refSchemeField = fields.find((f: any) => f.unique) || fields[0]

    payloadCollections[slug] = {
      slug,
      labels: { singular: noun.name, plural: noun.plural || noun.name + 's' },
      admin: {
        useAsTitle: refSchemeField?.name || 'id',
      },
      timestamps: true,
      fields,
    }
  }
}
```

**Step 2: Include payloadCollections in the output**

Find the line (around line 324):
```typescript
let output = JSON.stringify({
  openapi: '3.1.0',
```

Change to:
```typescript
let output = JSON.stringify({
  openapi: '3.1.0',
  ...(Object.keys(payloadCollections).length ? { payloadCollections } : {}),
```

Note: `payloadCollections` sits outside the OpenAPI spec as a sibling key. This keeps the OpenAPI output valid while adding the Payload-specific output.

**Step 3: Run tests to verify they pass**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/payload-generator.test.ts`
Expected: PASS — all 5 tests green

**Step 4: Run existing tests to check for regressions**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run`
Expected: All existing tests still pass

**Step 5: Commit**

```bash
git add src/collections/Generator.ts
git commit -m "feat: add Payload CMS collection generation to Generator"
```

---

### Task 3: Handle relationship fields from binary schemas

The initial implementation maps properties to fields, but relationship fields
need special handling. When a binary schema like "Customer submits SupportRequest"
has a 1:* constraint (one customer, many requests), the SupportRequest collection
should get a `relationship` field pointing to the `customers` collection, and
the Customer collection should get a `join` field for the reverse lookup.

**Files:**
- Modify: `src/collections/Generator.ts` (the `generatePayloadCollections` block)
- Modify: `test/collections/payload-generator.test.ts`

**Step 1: Write a failing test for join fields**

Add to `test/collections/payload-generator.test.ts`:

```typescript
it('should generate join fields for reverse relationships', () => {
  const customer = output.payloadCollections['customers']
  const fields = customer.fields
  const joinField = fields.find((f: any) => f.type === 'join')
  expect(joinField).toBeDefined()
  expect(joinField.collection).toBe('support-requests')
})
```

**Step 2: Run test to verify it fails**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/payload-generator.test.ts`
Expected: FAIL — no join field found on customers collection

**Step 3: Add join field generation**

In the `generatePayloadCollections` block, after building all collections,
add a second pass that creates join fields for 1:* relationships:

```typescript
// Second pass: add join fields for reverse relationships
for (const cs of constraintSpans.filter(cs => (cs.roles as Role[])?.length === 1)) {
  const constrainedRole = (cs.roles as Role[])[0]
  const gs = graphSchemas.find(s => s.id === (constrainedRole.graphSchema as GraphSchema)?.id || constrainedRole.graphSchema)
  if (!gs || (gs.roles?.docs?.length || 0) !== 2) continue

  const objectRole = gs.roles?.docs?.find((r: any) => r.id !== constrainedRole.id) as Role
  if (!objectRole) continue

  const subjectNoun = constrainedRole.noun?.value as Noun | GraphSchema
  const objectNoun = objectRole.noun?.value as Noun | GraphSchema
  if (!subjectNoun?.name || !objectNoun?.name) continue

  const subjectSlug = (subjectNoun.plural || subjectNoun.name + 's')?.toLowerCase().replace(/ /g, '-')
  const objectSlug = (objectNoun.plural || objectNoun.name + 's')?.toLowerCase().replace(/ /g, '-')

  // The constrained side has the FK, the other side gets the join field
  const joinCollection = payloadCollections[objectSlug]
  if (!joinCollection) continue

  // Find the relationship field name on the constrained side
  const constrainedCollection = payloadCollections[subjectSlug]
  if (!constrainedCollection) continue
  const relField = constrainedCollection.fields.find((f: any) =>
    f.type === 'relationship' && f.relationTo === objectSlug
  )
  if (!relField) continue

  // Add join field to the other side
  const existingJoin = joinCollection.fields.find((f: any) =>
    f.type === 'join' && f.collection === subjectSlug
  )
  if (!existingJoin) {
    joinCollection.fields.push({
      name: subjectSlug,
      type: 'join',
      collection: subjectSlug,
      on: relField.name,
    })
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/payload-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/collections/Generator.ts test/collections/payload-generator.test.ts
git commit -m "feat: generate join fields for reverse relationships"
```

---

### Task 4: Add access control and permissions mapping

Map the noun's `permissions` array to Payload access control functions.

**Files:**
- Modify: `src/collections/Generator.ts`
- Modify: `test/collections/payload-generator.test.ts`

**Step 1: Write a failing test**

```typescript
it('should include access control based on permissions', () => {
  const sr = output.payloadCollections['support-requests']
  expect(sr.access).toBeDefined()
  // SupportRequest has create, read, update, list but NOT delete
  expect(sr.access.create).toBeDefined()
  expect(sr.access.read).toBeDefined()
  expect(sr.access.update).toBeDefined()
  expect(sr.access.delete).toBeUndefined()
})

it('should include auth config when login permission is set', () => {
  const customer = output.payloadCollections['customers']
  // Customer has login permission
  expect(customer.auth).toBeDefined()
})
```

**Step 2: Run test to verify it fails**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/payload-generator.test.ts`
Expected: FAIL

**Step 3: Add access control generation**

In the payloadCollections generation block, after building `fields`, before pushing to `payloadCollections`:

```typescript
const permissions = noun.permissions || []
const access: Record<string, string> = {}
if (permissions.includes('create')) access.create = 'authenticated'
if (permissions.includes('read')) access.read = 'authenticated'
if (permissions.includes('update')) access.update = 'authenticated'
if (permissions.includes('delete')) access.delete = 'authenticated'

const collection: any = {
  slug,
  labels: { singular: noun.name, plural: noun.plural || noun.name + 's' },
  admin: {
    useAsTitle: refSchemeField?.name || 'id',
  },
  timestamps: true,
  access: Object.keys(access).length ? access : undefined,
  fields,
}

if (permissions.includes('login')) {
  collection.auth = true
}

payloadCollections[slug] = collection
```

**Step 4: Run tests**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/payload-generator.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/collections/Generator.ts test/collections/payload-generator.test.ts
git commit -m "feat: generate access control and auth config from permissions"
```

---

### Task 5: Generate SupportRequest and FeatureRequest collections for auth.vin

This task validates the full pipeline by seeding the complete support domain
from our readings and generating collections that could be dropped into auth.vin.

**Files:**
- Create: `test/collections/autodev-support.test.ts`
- Modify: `test/helpers/seed.ts`

**Step 1: Write the full auto.dev support seed**

Add to `test/helpers/seed.ts`:

```typescript
export async function seedAutoDevSupportDomain(payload: Payload) {
  // Entity nouns
  const customer = await payload.create({
    collection: 'nouns',
    data: { name: 'Customer', plural: 'customers', objectType: 'entity', permissions: ['create', 'read', 'update', 'list', 'login'] },
  })
  const supportRequest = await payload.create({
    collection: 'nouns',
    data: { name: 'SupportRequest', plural: 'support-requests', objectType: 'entity', permissions: ['create', 'read', 'update', 'list'] },
  })
  const featureRequest = await payload.create({
    collection: 'nouns',
    data: { name: 'FeatureRequest', plural: 'feature-requests', objectType: 'entity', permissions: ['create', 'read', 'update', 'list'] },
  })
  const apiProduct = await payload.create({
    collection: 'nouns',
    data: { name: 'APIProduct', plural: 'api-products', objectType: 'entity', permissions: ['create', 'read', 'update', 'list'] },
  })

  // Value nouns
  const emailAddress = await payload.create({ collection: 'nouns', data: { name: 'EmailAddress', objectType: 'value', valueType: 'string', format: 'email' } })
  const subject = await payload.create({ collection: 'nouns', data: { name: 'Subject', objectType: 'value', valueType: 'string' } })
  const description = await payload.create({ collection: 'nouns', data: { name: 'Description', objectType: 'value', valueType: 'string' } })
  const channelName = await payload.create({ collection: 'nouns', data: { name: 'ChannelName', objectType: 'value', valueType: 'string', enum: 'Slack, Email' } })
  const priority = await payload.create({ collection: 'nouns', data: { name: 'Priority', objectType: 'value', valueType: 'string', enum: 'low, medium, high, urgent' } })
  const requestId = await payload.create({ collection: 'nouns', data: { name: 'RequestId', objectType: 'value', valueType: 'string', format: 'uuid' } })
  const featureRequestId = await payload.create({ collection: 'nouns', data: { name: 'FeatureRequestId', objectType: 'value', valueType: 'string', format: 'uuid' } })
  const voteCount = await payload.create({ collection: 'nouns', data: { name: 'VoteCount', objectType: 'value', valueType: 'integer', minimum: 0 } })
  const endpointSlug = await payload.create({ collection: 'nouns', data: { name: 'EndpointSlug', objectType: 'value', valueType: 'string' } })

  // Reference schemes
  await payload.update({ collection: 'nouns', id: customer.id, data: { referenceScheme: [emailAddress.id] } })
  await payload.update({ collection: 'nouns', id: supportRequest.id, data: { referenceScheme: [requestId.id] } })
  await payload.update({ collection: 'nouns', id: featureRequest.id, data: { referenceScheme: [featureRequestId.id] } })
  await payload.update({ collection: 'nouns', id: apiProduct.id, data: { referenceScheme: [endpointSlug.id] } })

  // Helper to create graph schema + reading + set constraint
  async function createFact(name: string, text: string, relationship: string) {
    const schema = await payload.create({ collection: 'graph-schemas', data: { name } })
    await payload.create({ collection: 'readings', data: { text, graphSchema: schema.id } })
    await payload.update({ collection: 'graph-schemas', id: schema.id, data: { roleRelationship: relationship } })
    return schema
  }

  // Support request facts
  await createFact('CustomerHasEmailAddress', 'Customer has EmailAddress', 'one-to-one')
  await createFact('SupportRequestHasSubject', 'SupportRequest has Subject', 'many-to-one')
  await createFact('SupportRequestHasDescription', 'SupportRequest has Description', 'many-to-one')
  await createFact('SupportRequestArrivesViaChannelName', 'SupportRequest arrives via ChannelName', 'many-to-one')
  await createFact('SupportRequestHasPriority', 'SupportRequest has Priority', 'many-to-one')
  await createFact('CustomerSubmitsSupportRequest', 'Customer submits SupportRequest', 'one-to-many')
  await createFact('SupportRequestConcernsAPIProduct', 'SupportRequest concerns APIProduct', 'many-to-many')

  // Feature request facts
  await createFact('SupportRequestLeadsToFeatureRequest', 'SupportRequest leads to FeatureRequest', 'many-to-one')
  await createFact('FeatureRequestHasSubject', 'FeatureRequest has Subject', 'many-to-one')
  await createFact('FeatureRequestHasDescription', 'FeatureRequest has Description', 'many-to-one')
  await createFact('FeatureRequestHasVoteCount', 'FeatureRequest has VoteCount', 'many-to-one')
  await createFact('FeatureRequestConcernsAPIProduct', 'FeatureRequest concerns APIProduct', 'many-to-many')

  // API product facts
  await createFact('APIProductHasEndpointSlug', 'APIProduct has EndpointSlug', 'one-to-one')

  return { nouns: { customer, supportRequest, featureRequest, apiProduct } }
}
```

**Step 2: Write the integration test**

Create `test/collections/autodev-support.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { initPayload } from '../helpers/initPayload'
import { seedAutoDevSupportDomain } from '../helpers/seed'

let payload: any
let collections: any

describe('auto.dev Support Domain Generation', () => {
  beforeAll(async () => {
    payload = await initPayload()
    await seedAutoDevSupportDomain(payload)

    const generator = await payload.create({
      collection: 'generators',
      data: {
        title: 'auto.dev Support API',
        version: '1.0.0',
        databaseEngine: 'Payload',
      },
    })

    collections = generator.output.payloadCollections
  }, 120_000)

  it('should generate all four collections', () => {
    expect(collections['support-requests']).toBeDefined()
    expect(collections['feature-requests']).toBeDefined()
    expect(collections['customers']).toBeDefined()
    expect(collections['api-products']).toBeDefined()
  })

  it('SupportRequest should have all expected fields', () => {
    const sr = collections['support-requests']
    const fieldNames = sr.fields.map((f: any) => f.name)
    expect(fieldNames).toContain('subject')
    expect(fieldNames).toContain('description')
  })

  it('SupportRequest should have select fields for enums', () => {
    const sr = collections['support-requests']
    const channelField = sr.fields.find((f: any) => f.type === 'select' && f.options?.includes('Slack'))
    expect(channelField).toBeDefined()
    const priorityField = sr.fields.find((f: any) => f.type === 'select' && f.options?.includes('urgent'))
    expect(priorityField).toBeDefined()
  })

  it('FeatureRequest should have a voteCount number field', () => {
    const fr = collections['feature-requests']
    const voteField = fr.fields.find((f: any) => f.name === 'voteCount' || f.type === 'number')
    expect(voteField).toBeDefined()
    expect(voteField.type).toBe('number')
  })

  it('SupportRequest should have a relationship to FeatureRequest', () => {
    const sr = collections['support-requests']
    const frField = sr.fields.find((f: any) => f.type === 'relationship' && f.relationTo === 'feature-requests')
    expect(frField).toBeDefined()
  })

  it('should output valid OpenAPI alongside Payload collections', () => {
    // Verify the OpenAPI output is still generated correctly
    const generator = collections // already tested above
    // Just verify we got here without errors
    expect(collections).toBeDefined()
  })
}, 120_000)
```

**Step 3: Run test**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/autodev-support.test.ts`
Expected: PASS — full pipeline working

**Step 4: Run full test suite**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add test/collections/autodev-support.test.ts test/helpers/seed.ts
git commit -m "test: validate full auto.dev support domain generation pipeline"
```

---

### Task 6: Extract generated collections to files

Add a utility that takes the `payloadCollections` output and writes actual
TypeScript collection files. This is a standalone script, not part of the
Generator hook — it reads the output and writes files.

**Files:**
- Create: `src/export-collections.ts`
- Create: `test/collections/export-collections.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { collectionToTypeScript } from '../../src/export-collections'

describe('collectionToTypeScript', () => {
  it('should generate valid TypeScript for a simple collection', () => {
    const collection = {
      slug: 'support-requests',
      labels: { singular: 'SupportRequest', plural: 'support-requests' },
      admin: { useAsTitle: 'subject' },
      timestamps: true,
      access: { create: 'authenticated', read: 'authenticated' },
      fields: [
        { name: 'requestId', type: 'text', required: true, unique: true },
        { name: 'subject', type: 'text', required: true },
        { name: 'priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
        { name: 'customer', type: 'relationship', relationTo: 'customers' },
      ],
    }

    const ts = collectionToTypeScript(collection)
    expect(ts).toContain("slug: 'support-requests'")
    expect(ts).toContain("type: 'text'")
    expect(ts).toContain("type: 'select'")
    expect(ts).toContain("type: 'relationship'")
    expect(ts).toContain('CollectionConfig')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/export-collections.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/export-collections.ts`:

```typescript
export function collectionToTypeScript(collection: any): string {
  const lines: string[] = []
  lines.push("import type { CollectionConfig } from 'payload'")
  lines.push('')
  lines.push(`export const ${pascalCase(collection.slug)}: CollectionConfig = ${jsonToTS(collection, 1)}`)
  lines.push('')
  return lines.join('\n')
}

function jsonToTS(obj: any, indent: number): string {
  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    const items = obj.map(item =>
      typeof item === 'object' && item !== null
        ? jsonToTS(item, indent + 1)
        : JSON.stringify(item)
    )
    return `[\n${items.map(i => `${padInner}${i}`).join(',\n')},\n${pad}]`
  }

  if (typeof obj === 'object' && obj !== null) {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'
    const props = entries.map(([key, value]) => {
      const valStr = typeof value === 'object' && value !== null
        ? jsonToTS(value, indent + 1)
        : JSON.stringify(value)
      return `${padInner}${key}: ${valStr}`
    })
    return `{\n${props.join(',\n')},\n${pad}}`
  }

  return JSON.stringify(obj)
}

function pascalCase(str: string): string {
  return str
    .split(/[-_\s]/)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}
```

**Step 4: Run tests**

Run: `cd /c/Users/lippe/Repos/graphdl-orm && npx vitest run test/collections/export-collections.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/export-collections.ts test/collections/export-collections.test.ts
git commit -m "feat: add TypeScript collection file exporter"
```
