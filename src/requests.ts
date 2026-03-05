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

export { addToIndex }
