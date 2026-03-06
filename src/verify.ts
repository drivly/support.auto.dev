import type { Env } from './types'

export interface ClaimWarning {
  reading: string
  instance?: string
  claim?: string
  span?: [number, number]
  method: 'deterministic' | 'semantic'
  confidence?: number
}

export async function verify(env: Env, text: string, domain: string): Promise<ClaimWarning[]> {
  // Stage 1: Deterministic extraction
  const extractRes = await fetch(`${env.AUTO_DEV_API_URL}/graphdl/extract`, {
    method: 'POST',
    headers: {
      'X-API-Key': env.AUTO_DEV_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, domain }),
  })

  if (!extractRes.ok) return [] // fail open

  const { matches, unmatchedConstraints } = await extractRes.json() as {
    matches: Array<{ factType: string; instance: string; span: [number, number] }>
    unmatchedConstraints: string[]
  }

  // Stage 2: Semantic extraction for unmatched constraints
  let claims: Array<{ factType: string; claim: string; confidence: number; span: [number, number] }> = []
  if (unmatchedConstraints.length) {
    const semanticRes = await fetch(`${env.AUTO_DEV_API_URL}/graphdl/extract/semantic`, {
      method: 'POST',
      headers: {
        'X-API-Key': env.AUTO_DEV_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, constraints: unmatchedConstraints }),
    })
    if (semanticRes.ok) {
      const data = await semanticRes.json() as { claims: typeof claims }
      claims = data.claims || []
    }
  }

  // Stage 3: Constraint checker
  const checkRes = await fetch(`${env.AUTO_DEV_API_URL}/graphdl/check`, {
    method: 'POST',
    headers: {
      'X-API-Key': env.AUTO_DEV_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ matches, claims }),
  })

  if (!checkRes.ok) {
    // Fall back to deterministic matches only
    return matches.map((m) => ({
      reading: m.factType,
      instance: m.instance,
      span: m.span,
      method: 'deterministic' as const,
    }))
  }

  const { warnings } = await checkRes.json() as { warnings: ClaimWarning[] }
  return warnings
}
