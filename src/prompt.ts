import type { Env } from './types'

async function fetchReadings(env: Env, domain: string): Promise<string[]> {
  const res = await fetch(
    `${env.AUTO_DEV_API_URL}/graphdl/raw/readings?where[domain][equals]=${encodeURIComponent(domain)}&depth=0&pagination=false`,
    { headers: { 'X-API-Key': env.AUTO_DEV_API_KEY } },
  )
  if (!res.ok) return []
  const data: any = await res.json()
  return (data.docs || []).map((r: any) => r.text).filter(Boolean)
}

const DEONTIC_CONSTRAINTS = [
  'Support response must not reference internal team structure',
  'Support response must not use emdashes',
  'Support response must not name data source providers (Autolist, AutoNation, AutoTrader, Carfax, CarStory, Carvana, CarMax, Edmunds, Marketcheck)',
  'Support response must not reference the ingestion pipeline architecture (src.do, load.src.do, ClickHouse)',
  'Plan change must require explicit Customer confirmation',
  'Customer who has had a Subscription in Trialing state is prohibited from entering Trialing again',
  'Support may remove an accidental Subscription from Trialing if Customer did not intend to start a trial',
  'Listing must have VDP to appear in API results',
  'Photo must not be returned without an active Listing',
]

const DOMAINS = ['support', 'plans-subscriptions', 'customer-auth', 'listings', 'vehicle-data']

export async function composeSystemPrompt(
  env: Env,
  customerContext: Record<string, unknown>,
): Promise<string> {
  const domainSections: string[] = []

  for (const domain of DOMAINS) {
    const readings = await fetchReadings(env, domain)
    if (readings.length) {
      domainSections.push(`### ${domain}\n${readings.map(r => `- ${r}`).join('\n')}`)
    }
  }

  return `# Support Agent

You are a support agent for auto.dev, a vehicle data API platform.

## Domain Model
${domainSections.join('\n\n')}

## Constraints
You MUST follow these rules in every response:
${DEONTIC_CONSTRAINTS.map(c => `- ${c}`).join('\n')}

## Customer Context
- Email: ${customerContext.email || 'unknown'}
- Plan: ${customerContext.plan || 'unknown'}
- Subscription State: ${customerContext.subscriptionState || 'unknown'}

## Communication Style
- Use paragraph prose, not bullet lists
- Be concise and helpful
- Email only, never offer calls
- VIN decoding is global, all other products are North America only
- Specs are Edmunds-backed, consumer vehicles only
- Photos only available for active dealer listings
- Year minimum: 1981 (VIN standard adoption)

## Your Tools
You have access to state machine events for managing subscriptions and support requests. Use them when the customer's request requires a state change. Always confirm with the customer before making changes.

## IMPORTANT
Your responses are DRAFTS for human review. A team member will review and may edit before sending. Write as if composing the email that will be sent to the customer.`
}
