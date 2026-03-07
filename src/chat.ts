import type { Env, SupportMessage } from './types'
import { composeSystemPrompt } from './prompt'
import { getAvailableTools, executeToolCall, formatToolsForLLM, getQueryGraphTool, executeGraphQuery } from './tools'
import { syncStateAfterDraft } from './requests'
import { verify, type ClaimWarning } from './verify'
import { createRequest, addMessage, findRequest, getMessages } from './facts'
import type { FactMessage } from './facts'

async function reasonToReading(env: Env, reason: string): Promise<string> {
  const res = await fetch(`${env.AUTO_DEV_API_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'X-API-Key': env.AUTO_DEV_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: `You convert admin feedback into a single ORM constraint reading. The reading must use deontic language (must, must not, is obligated to, is prohibited from, is permitted to). Output ONLY the reading text, nothing else.\n\nExamples:\n- "don't quote prices without checking" → "Agent must not quote specific prices without first querying the knowledge graph"\n- "always mention the plan name" → "Agent is obligated to mention the customer Plan name in every response"\n- "stop saying we have a free tier" → "Agent must not claim that a free tier exists"`,
      messages: [{ role: 'user', content: reason }],
    }),
  })
  if (!res.ok) return `Agent must ${reason}`
  const data: any = await res.json()
  return data.content || `Agent must ${reason}`
}

async function addReadingToSupport(env: Env, readingText: string): Promise<void> {
  const headers = { 'Content-Type': 'application/json', 'X-API-Key': env.AUTO_DEV_API_KEY }
  const base = `${env.AUTO_DEV_API_URL}/graphdl/raw`
  const SUPPORT_DOMAIN_ID = '69ab7cf4a5ce5e411ed3c3da'

  // Create graph-schema for this reading
  const name = readingText.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  const schemaRes = await fetch(`${base}/graph-schemas`, {
    method: 'POST', headers,
    body: JSON.stringify({ name, domain: SUPPORT_DOMAIN_ID }),
  })
  if (!schemaRes.ok) return
  const schema = await schemaRes.json().then((r: any) => r.doc)

  // Create reading linked to graph-schema and domain
  await fetch(`${base}/readings`, {
    method: 'POST', headers,
    body: JSON.stringify({ text: readingText, graphSchema: schema.id, domain: SUPPORT_DOMAIN_ID }),
  })
}

const ESCALATE_TOOL = {
  name: 'escalate_to_human',
  description: 'Escalate this conversation to a human support agent. Use this when: you are uncertain about the answer, the customer needs an account-level action you cannot verify, or the question is outside your domain knowledge. Provide a reason so the human reviewer has context.',
  input_schema: {
    type: 'object' as const,
    properties: {
      reason: {
        type: 'string' as const,
        description: 'Why this needs human review',
      },
    },
    required: ['reason'],
  },
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}


interface DraftResult {
  draft: string
  toolResults: Array<{ tool: string; result: unknown }>
  escalated: boolean
  escalationReason?: string
}

async function generateDraft(
  env: Env,
  messages: SupportMessage[],
  customerContext: Record<string, unknown>,
  subscriptionId?: string,
  customerId?: string,
  extraRules?: string[],
): Promise<DraftResult> {
  const systemPrompt = await composeSystemPrompt(env, customerContext, extraRules)

  const llmMessages: Array<{ role: string; content: any }> = messages
    .filter(m => m.role === 'user' || m.role === 'agent')
    .map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content as any }))

  const stateTools = [
    ...(subscriptionId ? await getAvailableTools(env, 'Subscription', subscriptionId) : []),
    ...(customerId ? await getAvailableTools(env, 'SupportRequest', customerId) : []),
  ]
  const llmTools = [...formatToolsForLLM(stateTools), getQueryGraphTool(), ESCALATE_TOOL]

  const toolResults: Array<{ tool: string; result: unknown }> = []
  let escalated = false
  let escalationReason: string | undefined
  let currentMessages = [...llmMessages]
  let finalContent = ''

  // Tool use loop — keep calling LLM until it produces a text response
  for (let round = 0; round < 5; round++) {
    const llmRes = await fetch(`${env.AUTO_DEV_API_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'X-API-Key': env.AUTO_DEV_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: currentMessages,
        tools: llmTools,
      }),
    })

    if (!llmRes.ok) {
      const err = await llmRes.text()
      throw new Error(`LLM call failed: ${err}`)
    }

    const llmData: any = await llmRes.json()

    if (llmData.content) finalContent = llmData.content

    if (!llmData.toolCalls?.length) break

    // Build assistant message with tool use blocks and collect results
    const toolUseBlocks: any[] = []
    const toolResultBlocks: any[] = []

    for (const tc of llmData.toolCalls) {
      const name = tc.toolName || tc.name
      const args = tc.args || tc.input || {}
      const toolUseId = tc.toolCallId || tc.id || `tool_${round}_${toolUseBlocks.length}`

      toolUseBlocks.push({ type: 'tool_use', id: toolUseId, name, input: args })

      if (name === 'escalate_to_human') {
        escalated = true
        escalationReason = args.reason || 'Agent requested human review'
        toolResultBlocks.push({ type: 'tool_result', tool_use_id: toolUseId, content: 'Escalated to human reviewer.' })
        continue
      }

      let result: unknown
      if (name === 'query_graph') {
        result = await executeGraphQuery(env, args.query as string, customerContext?.email as string, customerContext?.role as string)
      } else {
        result = await executeToolCall(env, name, subscriptionId || customerId || '', args)
      }
      toolResults.push({ tool: name, result })
      toolResultBlocks.push({ type: 'tool_result', tool_use_id: toolUseId, content: JSON.stringify(result) })
    }

    // Append assistant tool use + user tool results to conversation
    currentMessages.push({
      role: 'assistant',
      content: [
        ...(llmData.content ? [{ type: 'text', text: llmData.content }] : []),
        ...toolUseBlocks,
      ],
    })
    currentMessages.push({ role: 'user', content: toolResultBlocks })
  }

  return {
    draft: finalContent,
    toolResults,
    escalated,
    escalationReason,
  }
}

export async function handleChat(request: Request, env: Env) {
  const body: any = await request.json()
  const { message, customerId, subscriptionId, plan, requestId: existingRequestId, role: callerRole } = body

  if (!message) return json({ error: 'message required' }, 400)

  const requestId = existingRequestId || crypto.randomUUID()
  const isNewRequest = !existingRequestId
  const now = new Date().toISOString()

  // Find or create the request resource
  let resourceId: string
  let messages: FactMessage[]

  if (!isNewRequest) {
    const found = await findRequest(env, requestId)
    if (!found) return json({ error: 'Request not found' }, 404)
    resourceId = found.resourceId
    messages = await getMessages(env, resourceId)
  } else {
    resourceId = await createRequest(env, requestId, customerId || 'anonymous', message.slice(0, 120))
    messages = []
  }

  // Store user message as a fact
  const userMsg: FactMessage = { role: 'user', content: message, timestamp: now }
  await addMessage(env, resourceId, userMsg)
  messages.push(userMsg)

  // Fetch customer context — authenticated users default to Starter
  const customerContext: Record<string, unknown> = { email: customerId }
  if (plan) customerContext.plan = plan
  else if (customerId && customerId !== 'anonymous') customerContext.plan = 'Starter'
  if (subscriptionId) {
    const stateRes = await fetch(
      `${env.AUTO_DEV_API_URL}/state/Subscription/${subscriptionId}`,
      { headers: { 'X-API-Key': env.AUTO_DEV_API_KEY } },
    )
    if (stateRes.ok) {
      const stateData: any = await stateRes.json()
      customerContext.subscriptionState = stateData.currentState
      if (!plan) customerContext.plan = stateData.currentState
    }
  }
  if (callerRole) customerContext.role = callerRole

  // Generate draft with constraint verification
  let result!: DraftResult
  let warnings: ClaimWarning[] = []

  for (let verifyRound = 0; verifyRound <= 2; verifyRound++) {
    const constraintRules = warnings.map(w =>
      `CONSTRAINT VIOLATION — you MUST fix this: "${w.reading}"${w.instance ? ` (you wrote: '${w.instance}')` : ''}${w.claim ? ` — ${w.claim}` : ''}`
    )
    try {
      result = await generateDraft(env, messages as SupportMessage[], customerContext, subscriptionId, customerId, constraintRules.length ? constraintRules : undefined)
    } catch (err) {
      return json({ error: 'LLM call failed', detail: String(err) }, 502)
    }
    try { warnings = await verify(env, result.draft, 'support') } catch { warnings = [] }
    if (!warnings.length) break
  }

  // Store agent message as a fact
  const agentMsg: FactMessage = {
    role: 'agent',
    content: result.draft,
    timestamp: new Date().toISOString(),
    ...(result.toolResults.length ? { toolCalls: result.toolResults } : {}),
    ...(warnings.length ? { warnings } : {}),
    ...(result.escalationReason ? { escalationReason: result.escalationReason } : {}),
  }
  await addMessage(env, resourceId, agentMsg)

  // Advance state machine for new requests
  let status = 'Investigating'
  if (isNewRequest) {
    status = await syncStateAfterDraft(env, requestId, result.escalated)
  }

  return json({ requestId, draft: result.draft, toolCalls: result.toolResults.length ? result.toolResults : undefined, customerContext, status, warnings: warnings.length ? warnings : undefined })
}

// Assign from Slack — decodes contact form data, stores as facts, auto-drafts, redirects to admin UI
export async function handleContactAssign(request: Request, env: Env) {
  const url = new URL(request.url)
  const encoded = url.searchParams.get('data')
  if (!encoded) return json({ error: 'data parameter required' }, 400)

  let formData: { name?: string; email: string; company?: string; issueType?: string; apiReference?: string; message: string }
  try {
    formData = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return json({ error: 'Invalid data parameter' }, 400)
  }

  const { name, email, company, issueType, apiReference, message } = formData
  if (!email || !message) return json({ error: 'Invalid contact data' }, 400)

  const requestId = crypto.randomUUID()
  const now = new Date().toISOString()

  const subject = issueType
    ? `[${issueType}] ${message.slice(0, 100)}`
    : message.slice(0, 120)

  const userContent = [
    message,
    '',
    `---`,
    name && `Name: ${name}`,
    `Email: ${email}`,
    company && `Company: ${company}`,
    issueType && `Issue Type: ${issueType}`,
    apiReference && `API: ${apiReference}`,
  ].filter(Boolean).join('\n')

  // Create request and user message as facts
  const resourceId = await createRequest(env, requestId, email, subject)
  const userMsg: FactMessage = { role: 'user', content: userContent, timestamp: now }
  await addMessage(env, resourceId, userMsg)

  // Auto-draft a response with constraint verification loop
  const customerContext: Record<string, unknown> = { email, plan: 'Starter' }
  let draft: string | null = null
  let draftEscalated = false
  let warnings: ClaimWarning[] = []
  const messages: FactMessage[] = [userMsg]
  try {
    let result: DraftResult | undefined
    for (let verifyRound = 0; verifyRound <= 2; verifyRound++) {
      const constraintRules = warnings.map(w =>
        `CONSTRAINT VIOLATION — you MUST fix this: "${w.reading}"${w.instance ? ` (you wrote: '${w.instance}')` : ''}${w.claim ? ` — ${w.claim}` : ''}`
      )
      result = await generateDraft(env, messages as SupportMessage[], customerContext, undefined, email, constraintRules.length ? constraintRules : undefined)
      try { warnings = await verify(env, result.draft, 'support') } catch { warnings = [] }
      if (!warnings.length) break
    }

    draftEscalated = result!.escalated
    draft = result!.draft

    await addMessage(env, resourceId, {
      role: 'agent',
      content: result!.draft,
      timestamp: new Date().toISOString(),
      ...(result!.toolResults.length ? { toolCalls: result!.toolResults } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(result!.escalationReason ? { escalationReason: result!.escalationReason } : {}),
    })
  } catch {
    draftEscalated = true
  }

  // Advance state machine
  await syncStateAfterDraft(env, requestId, draftEscalated)

  // Post the draft back to Slack
  if (env.SLACK_WEBHOOK_URL && draft) {
    const reviewUrl = `https://chat.auto.dev?request=${requestId}`
    const slackBlocks = [
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `${draftEscalated ? ':warning: *Escalated* — ' : ':robot_face: '}AI-drafted reply for *${name || email}*`,
        }],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: draft.length > 2900 ? draft.slice(0, 2900) + '...' : draft },
      },
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Send to Customer' },
            style: 'primary',
            url: reviewUrl,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Review & Edit' },
            url: reviewUrl,
          },
        ],
      },
    ]
    if (warnings.length) {
      slackBlocks.splice(1, 0, {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `:warning: ${warnings.length} constraint violation${warnings.length > 1 ? 's' : ''} found\n${warnings.map((w) =>
            `• ${w.reading}${w.instance ? ` '${w.instance}'` : ''}${w.claim ? `: ${w.claim}` : ''}`
          ).join('\n')}`,
        }],
      })
    }
    // Fire and forget — don't block the redirect
    fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: slackBlocks }),
    }).catch(() => {})
  }

  // Redirect to admin UI with the request open
  return new Response(null, {
    status: 302,
    headers: { Location: `https://chat.auto.dev?request=${requestId}` },
  })
}

// Re-draft: takes a reason (becomes a permanent business rule), regenerates the last agent message
interface IRequest extends Request {
  params: Record<string, string>
}

export async function handleRedraft(request: IRequest, env: Env) {
  const { id } = request.params

  const found = await findRequest(env, id)
  if (!found) return json({ error: 'Not found' }, 404)

  const body: any = await request.json()
  const { reason } = body

  // Convert reason to a constraint reading and persist in the domain model
  let readingText: string | undefined
  if (reason) {
    readingText = await reasonToReading(env, reason)
    await addReadingToSupport(env, readingText)
  }

  // Get messages, strip all previous agent drafts before sending to LLM
  const allMessages = await getMessages(env, found.resourceId)
  const messages = allMessages.filter(m => m.role !== 'agent')

  // Re-generate — readings are now in the domain model, fetched by composeSystemPrompt
  const customerId = found.value.customerId
  const customerContext: Record<string, unknown> = { email: customerId }
  if (customerId && customerId !== 'anonymous') customerContext.plan = 'Starter'
  let result!: DraftResult
  let warnings: ClaimWarning[] = []

  for (let verifyRound = 0; verifyRound <= 2; verifyRound++) {
    const constraintRules = warnings.map(w =>
      `CONSTRAINT VIOLATION — you MUST fix this: "${w.reading}"${w.instance ? ` (you wrote: '${w.instance}')` : ''}${w.claim ? ` — ${w.claim}` : ''}`
    )
    try {
      result = await generateDraft(env, messages as SupportMessage[], customerContext, undefined, found.value.customerId, constraintRules.length ? constraintRules : undefined)
    } catch (err) {
      return json({ error: 'Re-draft failed', detail: String(err) }, 502)
    }
    try { warnings = await verify(env, result.draft, 'support') } catch { warnings = [] }
    if (!warnings.length) break
  }

  // Store new draft as a fact
  await addMessage(env, found.resourceId, {
    role: 'agent',
    content: result.draft,
    timestamp: new Date().toISOString(),
    ...(result.toolResults.length ? { toolCalls: result.toolResults } : {}),
    ...(warnings.length ? { warnings } : {}),
    ...(result.escalationReason ? { escalationReason: result.escalationReason } : {}),
  })

  return json({ draft: result.draft, readingAdded: readingText || null, status: found.value.status, warnings: warnings.length ? warnings : undefined })
}
