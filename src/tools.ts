import type { Env } from './types'

interface StateTool {
  name: string
  description: string
}

export async function getAvailableTools(
  env: Env,
  machineType: string,
  instanceId: string,
): Promise<StateTool[]> {
  const res = await fetch(
    `${env.AUTO_DEV_API_URL}/state/${machineType}/${instanceId}`,
    { headers: { 'X-API-Key': env.AUTO_DEV_API_KEY } },
  )
  if (!res.ok) return []
  const data: any = await res.json()

  const transitions = data.availableTransitions || []
  return transitions.map((t: any) => ({
    name: `${machineType}_${t.event}`,
    description: `Transition ${machineType} from ${data.currentState} to ${t.target}${t.guards?.length ? `. Requires: ${t.guards.join('; ')}` : ''}`,
  }))
}

export async function executeToolCall(
  env: Env,
  toolName: string,
  instanceId: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const parts = toolName.split('_')
  const event = parts.pop()!
  const machineType = parts.join('_')

  const res = await fetch(
    `${env.AUTO_DEV_API_URL}/state/${machineType}/${instanceId}/${event}`,
    {
      method: 'POST',
      headers: {
        'X-API-Key': env.AUTO_DEV_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    },
  )
  return res.json()
}

export function formatToolsForLLM(tools: StateTool[]) {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  }))
}

const QUERY_GRAPH_TOOL = {
  name: 'query_graph',
  description: 'Query any fact in the knowledge graph using a natural language fact pattern. Use vocabulary from the domain model readings in your system prompt. Examples: "Customer lippertz@gmail.com has Plan", "Plan Growth has MonthlyFee", "APIProduct listings has EndpointPath".',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string' as const,
        description: 'A fact pattern in natural language using domain vocabulary',
      },
    },
    required: ['query'],
  },
}

export function getQueryGraphTool() {
  return QUERY_GRAPH_TOOL
}

export async function executeGraphQuery(
  env: Env,
  query: string,
  callerEmail?: string,
  callerRole?: string,
): Promise<{ facts: string[]; error?: string }> {
  // Non-admin users can only query their own customer facts
  const mentionsCustomer = /customer/i.test(query)
  const mentionsOtherCustomer = mentionsCustomer && callerEmail && callerRole !== 'ADMIN' &&
    !query.toLowerCase().includes(callerEmail.toLowerCase())
  if (mentionsOtherCustomer) {
    return { facts: [], error: 'Permission denied: you can only query your own customer data' }
  }

  const searchRes = await fetch(
    `${env.AUTO_DEV_API_URL}/graphdl/raw/readings?where[text][like]=${encodeURIComponent(query)}&pagination=false&depth=0`,
    { headers: { 'X-API-Key': env.AUTO_DEV_API_KEY } },
  )

  if (!searchRes.ok) {
    return { facts: [], error: `Graph query failed: ${searchRes.status}` }
  }

  const data: any = await searchRes.json()
  const facts = (data.docs || []).map((r: any) => r.text).filter(Boolean)

  // If query involves customer-specific subscription/plan data, verify against auth.vin
  const isCustomerQuery = /customer|subscription|plan/i.test(query) && callerEmail
  if (isCustomerQuery && env.AUTH_VIN_API_KEY) {
    try {
      const authRes = await fetch(`https://auth.vin/api/internal/users/${encodeURIComponent(callerEmail)}`, {
        headers: { Authorization: `users API-Key ${env.AUTH_VIN_API_KEY}` },
      })
      if (authRes.ok) {
        const authData: any = await authRes.json()
        const authFacts: string[] = []
        if (authData.plan) authFacts.push(`Customer '${callerEmail}' is on Plan '${authData.plan}'`)
        if (authData.subscriptionStatus) authFacts.push(`Customer '${callerEmail}' subscription status is '${authData.subscriptionStatus}'`)
        if (authData.trialEnd) authFacts.push(`Customer '${callerEmail}' has TrialEnd '${authData.trialEnd}'`)
        return { facts: [...facts, ...authFacts] }
      }
    } catch {
      // Fail open — return graph facts without auth.vin verification
    }
  }

  return { facts }
}
