import type { Env } from './types'

// Noun IDs from the support domain in graphdl-orm
const NOUNS = {
  SupportRequest: '69ab7cf4a5ce5e411ed3c400',
  Message: '69ab7cf4a5ce5e411ed3c408',
}

async function graphdl(env: Env, path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${env.AUTO_DEV_API_URL}/graphdl/raw${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.AUTO_DEV_API_KEY,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GraphDL ${method} ${path} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<any>
}

export interface FactMessage {
  role: 'user' | 'agent' | 'admin'
  content: string
  timestamp: string
  escalationReason?: string
  toolCalls?: Array<{ tool: string; result: unknown }>
  warnings?: Array<{ reading: string; claim?: string; instance?: string }>
}

export interface FactRequest {
  id: string           // Payload resource ID
  requestId: string    // External UUID (used in URLs, state machine)
  customerId: string
  subject: string
  status: string
  createdAt: string
  updatedAt: string
  messages: FactMessage[]
}

// Create a SupportRequest resource, returns the Payload resource ID
export async function createRequest(env: Env, requestId: string, customerId: string, subject: string): Promise<string> {
  const data = await graphdl(env, '/resources', 'POST', {
    type: NOUNS.SupportRequest,
    value: JSON.stringify({ requestId, customerId, subject, createdAt: new Date().toISOString() }),
  })
  return data.doc.id
}

// Add a message to a SupportRequest
export async function addMessage(env: Env, requestResourceId: string, message: FactMessage): Promise<string> {
  const data = await graphdl(env, '/resources', 'POST', {
    type: NOUNS.Message,
    value: JSON.stringify(message),
    reference: [{ relationTo: 'resources', value: requestResourceId }],
  })
  return data.doc.id
}

// Find a SupportRequest resource by external requestId
export async function findRequest(env: Env, requestId: string): Promise<{ resourceId: string; value: any } | null> {
  // Search resources of type SupportRequest whose value contains the requestId
  const data = await graphdl(env, `/resources?where[type][equals]=${NOUNS.SupportRequest}&where[value][contains]=${encodeURIComponent(requestId)}&depth=0&limit=1`)
  const doc = data.docs?.[0]
  if (!doc) return null
  return { resourceId: doc.id, value: JSON.parse(doc.value) }
}

// Get all messages for a SupportRequest resource, ordered by creation time
export async function getMessages(env: Env, requestResourceId: string): Promise<FactMessage[]> {
  const data = await graphdl(env, `/resources?where[type][equals]=${NOUNS.Message}&where[reference.value][equals]=${requestResourceId}&depth=0&limit=100&sort=createdAt`)
  return data.docs.map((doc: any) => JSON.parse(doc.value) as FactMessage)
}

// List all SupportRequest resources for a customer (or all)
export async function listRequests(env: Env, customerId?: string): Promise<Array<{ id: string; requestId: string; customerId: string; subject: string; status: string; createdAt: string; updatedAt: string }>> {
  let query = `where[type][equals]=${NOUNS.SupportRequest}&depth=0&limit=100&sort=-createdAt`
  if (customerId) {
    query += `&where[value][contains]=${encodeURIComponent(customerId)}`
  }
  const data = await graphdl(env, `/resources?${query}`)
  return data.docs.flatMap((doc: any) => {
    try {
      const val = JSON.parse(doc.value)
      if (!val.requestId) return []
      return [{
        id: doc.id,
        requestId: val.requestId,
        customerId: val.customerId,
        subject: val.subject,
        status: val.status || 'Investigating',
        createdAt: val.createdAt || doc.createdAt,
        updatedAt: doc.updatedAt,
      }]
    } catch { return [] }
  })
}

// Update the SupportRequest resource value (e.g. status change)
export async function updateRequest(env: Env, requestResourceId: string, updates: Record<string, unknown>): Promise<void> {
  // Read current value, merge updates
  const data = await graphdl(env, `/resources/${requestResourceId}?depth=0`)
  const current = JSON.parse(data.value)
  const merged = { ...current, ...updates }
  await graphdl(env, `/resources/${requestResourceId}`, 'PATCH', {
    value: JSON.stringify(merged),
  })
}
