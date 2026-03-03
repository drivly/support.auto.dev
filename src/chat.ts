import type { Env } from './types'
import { composeSystemPrompt } from './prompt'
import { getAvailableTools, executeToolCall, formatToolsForLLM } from './tools'

export async function handleChat(request: Request, env: Env) {
  const body: any = await request.json()
  const { message, customerId, subscriptionId } = body

  if (!message) {
    return new Response(JSON.stringify({ error: 'message required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch customer context
  const customerContext: Record<string, unknown> = { email: customerId }
  if (subscriptionId) {
    const stateRes = await fetch(
      `${env.AUTO_DEV_API_URL}/state/Subscription/${subscriptionId}`,
      { headers: { 'X-API-Key': env.AUTO_DEV_API_KEY } },
    )
    if (stateRes.ok) {
      const stateData: any = await stateRes.json()
      customerContext.subscriptionState = stateData.currentState
      customerContext.plan = stateData.currentState
    }
  }

  // Compose system prompt from readings + constraints
  const systemPrompt = await composeSystemPrompt(env, customerContext)

  // Build tools from available state machine events
  const allTools = [
    ...(subscriptionId ? await getAvailableTools(env, 'Subscription', subscriptionId) : []),
    ...(customerId ? await getAvailableTools(env, 'SupportRequest', customerId) : []),
  ]

  // Call LLM via apis/ proxy
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
      messages: [{ role: 'user', content: message }],
      ...(allTools.length ? { tools: formatToolsForLLM(allTools) } : {}),
    }),
  })

  if (!llmRes.ok) {
    const err = await llmRes.text()
    return new Response(JSON.stringify({ error: 'LLM call failed', detail: err }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const llmData: any = await llmRes.json()

  // Process tool calls if any
  const toolResults: Array<Record<string, unknown>> = []
  const contentBlocks = llmData.content || []

  for (const block of contentBlocks) {
    if (block.type === 'tool_use') {
      const result = await executeToolCall(
        env,
        block.name,
        subscriptionId || customerId,
        block.input || {},
      )
      toolResults.push({ tool: block.name, result })
    }
  }

  // Extract text response
  const draft = contentBlocks
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')

  return new Response(JSON.stringify({
    draft,
    toolCalls: toolResults.length ? toolResults : undefined,
    customerContext,
    status: 'pending_review',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
