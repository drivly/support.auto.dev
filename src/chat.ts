import type { Env, SupportRequestData, SupportMessage } from './types'
import { composeSystemPrompt } from './prompt'
import { getAvailableTools, executeToolCall, formatToolsForLLM, getQueryGraphTool, executeGraphQuery } from './tools'
import { addToIndex } from './requests'
import { verify, type ClaimWarning } from './verify'

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


async function getBusinessRules(kv: KVNamespace): Promise<string[]> {
  const raw = await kv.get('business-rules')
  return raw ? JSON.parse(raw) : []
}

async function addBusinessRule(kv: KVNamespace, rule: string) {
  const rules = await getBusinessRules(kv)
  if (!rules.includes(rule)) {
    rules.push(rule)
    await kv.put('business-rules', JSON.stringify(rules))
  }
  return rules
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
  const businessRules = await getBusinessRules(env.SUPPORT_KV)
  const allRules = [...businessRules, ...(extraRules || [])]

  const systemPrompt = await composeSystemPrompt(env, customerContext, allRules)

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

  // Load or initialize the support request
  let requestData: SupportRequestData
  if (!isNewRequest) {
    const raw = await env.SUPPORT_KV.get(`support:${requestId}`)
    requestData = raw ? JSON.parse(raw) : null
  }
  requestData ??= {
    customerId: customerId || 'anonymous',
    subject: message.slice(0, 120),
    status: 'sent',
    createdAt: now,
    updatedAt: now,
    messages: [],
  }

  // Append user message
  requestData.messages.push({ role: 'user', content: message, timestamp: now })

  // Fetch customer context — use verified identity
  const customerContext: Record<string, unknown> = { email: customerId }
  if (plan) {
    customerContext.plan = plan
  }
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

  // Generate draft, verify against constraints, and auto-redraft on violations
  let result!: DraftResult
  let warnings: ClaimWarning[] = []
  const MAX_VERIFY_ROUNDS = 2

  for (let verifyRound = 0; verifyRound <= MAX_VERIFY_ROUNDS; verifyRound++) {
    const constraintRules = warnings.map(w =>
      `CONSTRAINT VIOLATION — you MUST fix this: "${w.reading}"${w.instance ? ` (you wrote: '${w.instance}')` : ''}${w.claim ? ` — ${w.claim}` : ''}`
    )

    try {
      result = await generateDraft(env, requestData.messages, customerContext, subscriptionId, customerId, constraintRules.length ? constraintRules : undefined)
    } catch (err) {
      return json({ error: 'LLM call failed', detail: String(err) }, 502)
    }

    try {
      warnings = await verify(env, result.draft, 'support')
    } catch {
      warnings = []
    }

    if (!warnings.length) break
  }

  // Append agent message
  requestData.messages.push({
    role: 'agent',
    content: result.escalationReason
      ? `${result.draft}\n\n[Escalation reason: ${result.escalationReason}]`
      : result.draft,
    timestamp: new Date().toISOString(),
    ...(result.toolResults.length ? { toolCalls: result.toolResults } : {}),
    ...(warnings.length ? { warnings } : {}),
  })
  const status = result.escalated ? 'escalated' as const : 'sent' as const
  requestData.status = status
  requestData.updatedAt = new Date().toISOString()

  // Persist
  await env.SUPPORT_KV.put(`support:${requestId}`, JSON.stringify(requestData))
  if (isNewRequest) {
    await addToIndex(env.SUPPORT_KV, 'support-all', requestId)
    if (customerId) {
      await addToIndex(env.SUPPORT_KV, `support-by-customer:${customerId}`, requestId)
    }
  }

  return json({ requestId, draft: result.draft, toolCalls: result.toolResults.length ? result.toolResults : undefined, customerContext, status, warnings: warnings.length ? warnings : undefined })
}

// Assign from Slack — decodes contact form data, stores in KV, auto-drafts, redirects to admin UI
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

  const requestData: SupportRequestData = {
    customerId: email,
    subject,
    status: 'sent',
    createdAt: now,
    updatedAt: now,
    messages: [{ role: 'user', content: userContent, timestamp: now }],
  }

  // Auto-draft a response with constraint verification loop
  const customerContext: Record<string, unknown> = { email }
  let draft: string | null = null
  let draftEscalated = false
  let warnings: ClaimWarning[] = []
  try {
    let result: DraftResult | undefined
    for (let verifyRound = 0; verifyRound <= 2; verifyRound++) {
      const constraintRules = warnings.map(w =>
        `CONSTRAINT VIOLATION — you MUST fix this: "${w.reading}"${w.instance ? ` (you wrote: '${w.instance}')` : ''}${w.claim ? ` — ${w.claim}` : ''}`
      )
      result = await generateDraft(env, requestData.messages, customerContext, undefined, email, constraintRules.length ? constraintRules : undefined)

      try {
        warnings = await verify(env, result.draft, 'support')
      } catch {
        warnings = []
      }
      if (!warnings.length) break
    }

    draftEscalated = result!.escalated
    draft = result!.draft

    requestData.messages.push({
      role: 'agent',
      content: result!.escalationReason
        ? `${result!.draft}\n\n[Escalation reason: ${result!.escalationReason}]`
        : result!.draft,
      timestamp: new Date().toISOString(),
      ...(result!.toolResults.length ? { toolCalls: result!.toolResults } : {}),
      ...(warnings.length ? { warnings } : {}),
    })
    requestData.status = draftEscalated ? 'escalated' : 'sent'
  } catch {
    // Store without draft — admin can reply manually
    requestData.status = 'escalated'
  }

  requestData.updatedAt = new Date().toISOString()
  await env.SUPPORT_KV.put(`support:${requestId}`, JSON.stringify(requestData))
  await addToIndex(env.SUPPORT_KV, 'support-all', requestId)
  await addToIndex(env.SUPPORT_KV, `support-by-customer:${email}`, requestId)

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

  const raw = await env.SUPPORT_KV.get(`support:${id}`)
  if (!raw) return json({ error: 'Not found' }, 404)

  const body: any = await request.json()
  const { reason } = body

  // Store as permanent business rule only if a reason is provided
  const allRules = reason
    ? await addBusinessRule(env.SUPPORT_KV, reason)
    : await getBusinessRules(env.SUPPORT_KV)

  const requestData: SupportRequestData = JSON.parse(raw)

  // Remove the last agent message (the draft being replaced)
  let lastAgentIdx = -1
  for (let i = requestData.messages.length - 1; i >= 0; i--) {
    if (requestData.messages[i].role === 'agent') { lastAgentIdx = i; break }
  }
  let previousDraft: string | undefined
  if (lastAgentIdx >= 0) {
    previousDraft = requestData.messages[lastAgentIdx].content
    requestData.messages.splice(lastAgentIdx, 1)
  }

  // Re-generate with all business rules (including the new one), verify against constraints
  const customerContext: Record<string, unknown> = { email: requestData.customerId }
  let result!: DraftResult
  let warnings: ClaimWarning[] = []

  for (let verifyRound = 0; verifyRound <= 2; verifyRound++) {
    const constraintRules = [
      ...allRules,
      ...warnings.map(w =>
        `CONSTRAINT VIOLATION — you MUST fix this: "${w.reading}"${w.instance ? ` (you wrote: '${w.instance}')` : ''}${w.claim ? ` — ${w.claim}` : ''}`
      ),
    ]
    try {
      result = await generateDraft(env, requestData.messages, customerContext, undefined, requestData.customerId, constraintRules)
    } catch (err) {
      return json({ error: 'Re-draft failed', detail: String(err) }, 502)
    }

    try {
      warnings = await verify(env, result.draft, 'support')
    } catch {
      warnings = []
    }
    if (!warnings.length) break
  }

  const status = result.escalated ? 'escalated' : 'sent'

  requestData.messages.push({
    role: 'agent',
    content: result.escalationReason
      ? `${result.draft}\n\n[Escalation reason: ${result.escalationReason}]`
      : result.draft,
    timestamp: new Date().toISOString(),
    ...(result.toolResults.length ? { toolCalls: result.toolResults } : {}),
    ...(warnings.length ? { warnings } : {}),
  })
  requestData.status = status
  requestData.updatedAt = new Date().toISOString()

  await env.SUPPORT_KV.put(`support:${id}`, JSON.stringify(requestData))

  return json({ draft: result.draft, previousDraft, ruleAdded: reason || null, totalRules: allRules.length, status, warnings: warnings.length ? warnings : undefined })
}
