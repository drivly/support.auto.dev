import type { Env } from './types'
import { findRequest, getMessages, addMessage, listRequests as factListRequests, updateRequest } from './facts'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Send an event to the state machine runtime, return the new state
export async function sendStateEvent(env: Env, requestId: string, event: string): Promise<string | null> {
  try {
    const res = await fetch(`${env.AUTO_DEV_API_URL}/state/SupportRequest/${requestId}/${event}`, {
      method: 'POST',
      headers: { 'X-API-Key': env.AUTO_DEV_API_KEY },
    })
    if (!res.ok) return null
    const data: any = await res.json()
    return data.currentState || null
  } catch {
    return null
  }
}

// Advance state machine for a new request and return final state
export async function syncStateAfterDraft(env: Env, requestId: string, escalated: boolean): Promise<string> {
  let state = await sendStateEvent(env, requestId, 'acknowledge') || 'Triaging'
  if (!escalated) {
    state = await sendStateEvent(env, requestId, 'assign') || 'Investigating'
  }
  return state
}

// Fetch current state from state machine
async function fetchState(env: Env, requestId: string): Promise<string> {
  try {
    const res = await fetch(`${env.AUTO_DEV_API_URL}/state/SupportRequest/${requestId}`, {
      headers: { 'X-API-Key': env.AUTO_DEV_API_KEY },
    })
    if (!res.ok) return 'Investigating'
    const data: any = await res.json()
    return data.currentState || 'Investigating'
  } catch {
    return 'Investigating'
  }
}

// itty-router v5 attaches route params directly to the request object
interface IRequest extends Request {
  params: Record<string, string>
}

export async function listRequests(request: IRequest, env: Env) {
  const url = new URL(request.url)
  const customerId = url.searchParams.get('customerId')
  const all = url.searchParams.get('all')

  if (!all && !customerId) {
    return json({ error: 'customerId or all=true required' }, 400)
  }

  const requests = await factListRequests(env, all === 'true' ? undefined : (customerId || undefined))
  // Enrich with state machine status
  const enriched = await Promise.all(requests.map(async (r) => {
    if (r.status === 'merged') return { id: r.requestId, customerId: r.customerId, subject: r.subject, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt }
    const state = await fetchState(env, r.requestId)
    return { id: r.requestId, customerId: r.customerId, subject: r.subject, status: state, createdAt: r.createdAt, updatedAt: r.updatedAt }
  }))

  return json(enriched)
}

export async function getRequest(request: IRequest, env: Env) {
  const { id } = request.params
  const found = await findRequest(env, id)
  if (!found) return json({ error: 'Not found' }, 404)

  const messages = await getMessages(env, found.resourceId)
  const status = found.value.status === 'merged' ? 'merged' : await fetchState(env, id)

  return json({
    id,
    customerId: found.value.customerId,
    subject: found.value.subject,
    status,
    createdAt: found.value.createdAt,
    updatedAt: found.value.updatedAt || found.value.createdAt,
    messages,
  })
}

export async function adminReply(request: IRequest, env: Env) {
  const { id } = request.params
  const found = await findRequest(env, id)
  if (!found) return json({ error: 'Not found' }, 404)

  const body: any = await request.json()
  if (!body.message) return json({ error: 'message required' }, 400)

  await addMessage(env, found.resourceId, {
    role: 'admin',
    content: body.message,
    timestamp: new Date().toISOString(),
  })

  return json({ ok: true })
}

export async function resolveRequest(request: IRequest, env: Env) {
  const { id } = request.params
  const found = await findRequest(env, id)
  if (!found) return json({ error: 'Not found' }, 404)

  await sendStateEvent(env, id, 'resolve')
  return json({ ok: true })
}

export async function reopenRequest(request: IRequest, env: Env) {
  const { id } = request.params
  const found = await findRequest(env, id)
  if (!found) return json({ error: 'Not found' }, 404)

  await sendStateEvent(env, id, 'reopen')
  return json({ ok: true })
}

export async function mergeRequests(request: IRequest, env: Env) {
  const { id: primaryId } = request.params
  const body: any = await request.json()
  const sourceIds: string[] = body.sourceIds

  if (!sourceIds?.length) return json({ error: 'sourceIds required' }, 400)

  const primary = await findRequest(env, primaryId)
  if (!primary) return json({ error: 'Primary request not found' }, 404)

  const mergedIds: string[] = []
  for (const sourceId of sourceIds) {
    if (sourceId === primaryId) continue
    const source = await findRequest(env, sourceId)
    if (!source) continue

    // Copy source messages to primary
    const sourceMessages = await getMessages(env, source.resourceId)
    for (const msg of sourceMessages) {
      await addMessage(env, primary.resourceId, msg)
    }

    // Mark source as merged
    await updateRequest(env, source.resourceId, { status: 'merged', mergedInto: primaryId })
    mergedIds.push(sourceId)
  }

  return json({ ok: true, primaryId, mergedIds })
}
