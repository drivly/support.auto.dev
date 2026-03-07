import type { Env, SupportRequestData } from './types'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function addToIndex(kv: KVNamespace, key: string, requestId: string) {
  const raw = await kv.get(key)
  const list: string[] = raw ? JSON.parse(raw) : []
  if (!list.includes(requestId)) {
    list.unshift(requestId)
    await kv.put(key, JSON.stringify(list))
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

  const indexKey = all === 'true' ? 'support-all' : `support-by-customer:${customerId}`
  if (!all && !customerId) {
    return json({ error: 'customerId or all=true required' }, 400)
  }

  const raw = await env.SUPPORT_KV.get(indexKey)
  const ids: string[] = raw ? JSON.parse(raw) : []

  const requests: Array<Omit<SupportRequestData, 'messages'> & { id: string }> = []
  for (const id of ids) {
    const data = await env.SUPPORT_KV.get(`support:${id}`)
    if (data) {
      const parsed: SupportRequestData = JSON.parse(data)
      const { messages: _, ...summary } = parsed
      requests.push({ id, ...summary })
    }
  }

  return json(requests)
}

export async function getRequest(request: IRequest, env: Env) {
  const { id } = request.params
  const raw = await env.SUPPORT_KV.get(`support:${id}`)
  if (!raw) return json({ error: 'Not found' }, 404)

  const data: SupportRequestData = JSON.parse(raw)
  return json({ id, ...data })
}

export async function adminReply(request: IRequest, env: Env) {
  const { id } = request.params
  const raw = await env.SUPPORT_KV.get(`support:${id}`)
  if (!raw) return json({ error: 'Not found' }, 404)

  const body: any = await request.json()
  if (!body.message) return json({ error: 'message required' }, 400)

  const data: SupportRequestData = JSON.parse(raw)
  data.messages.push({
    role: 'admin',
    content: body.message,
    timestamp: new Date().toISOString(),
  })
  data.updatedAt = new Date().toISOString()

  await env.SUPPORT_KV.put(`support:${id}`, JSON.stringify(data))
  return json({ ok: true })
}

export async function resolveRequest(request: IRequest, env: Env) {
  const { id } = request.params
  const raw = await env.SUPPORT_KV.get(`support:${id}`)
  if (!raw) return json({ error: 'Not found' }, 404)

  const data: SupportRequestData = JSON.parse(raw)
  data.status = 'resolved'
  data.updatedAt = new Date().toISOString()

  await env.SUPPORT_KV.put(`support:${id}`, JSON.stringify(data))
  return json({ ok: true })
}

export async function mergeRequests(request: IRequest, env: Env) {
  const { id: primaryId } = request.params
  const body: any = await request.json()
  const sourceIds: string[] = body.sourceIds

  if (!sourceIds?.length) return json({ error: 'sourceIds required' }, 400)

  // Load primary request
  const primaryRaw = await env.SUPPORT_KV.get(`support:${primaryId}`)
  if (!primaryRaw) return json({ error: 'Primary request not found' }, 404)
  const primary: SupportRequestData = JSON.parse(primaryRaw)

  // Load and merge each source
  const mergedIds: string[] = []
  for (const sourceId of sourceIds) {
    if (sourceId === primaryId) continue
    const sourceRaw = await env.SUPPORT_KV.get(`support:${sourceId}`)
    if (!sourceRaw) continue

    const source: SupportRequestData = JSON.parse(sourceRaw)

    // Copy messages into primary, tagged with source
    for (const msg of source.messages) {
      primary.messages.push(msg)
    }

    // Mark source as merged
    source.status = 'merged'
    source.mergedInto = primaryId
    source.updatedAt = new Date().toISOString()
    await env.SUPPORT_KV.put(`support:${sourceId}`, JSON.stringify(source))
    mergedIds.push(sourceId)
  }

  // Sort all messages by timestamp
  primary.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  primary.updatedAt = new Date().toISOString()
  await env.SUPPORT_KV.put(`support:${primaryId}`, JSON.stringify(primary))

  return json({ ok: true, primaryId, mergedIds })
}

export { addToIndex }
