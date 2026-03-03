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
