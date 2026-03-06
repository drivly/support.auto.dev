/**
 * Seed all auto.dev-graphdl domain readings via the api.auto.dev GraphDL proxy.
 *
 * Usage: npx tsx scripts/seed-auto-dev.ts
 *
 * Environment variables (set in .env or shell):
 *   AUTO_DEV_API_KEY  - api.auto.dev API key (required)
 *   AUTO_DEV_API_URL  - API base URL (default: https://api.auto.dev)
 *
 * Reads domain/*.md and state-machines/*.md files directly — the markdown
 * IS the source of truth. No hand-maintained data arrays.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Load .env file from project root (no external deps needed)
const envPath = path.join(ROOT, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const BASE_URL = process.env.AUTO_DEV_API_URL || 'https://api.auto.dev'
const API_KEY = process.env.AUTO_DEV_API_KEY || ''

if (!API_KEY) {
  console.error('AUTO_DEV_API_KEY is required. Set it in .env or pass in shell.')
  process.exit(1)
}

const authHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
}

// State machine filename → entity noun name
const SM_ENTITY_MAP: Record<string, string> = {
  'connect-session.md': 'ConnectSession',
  'domain-change.md': 'DomainChange',
  'error-monitoring.md': 'ErrorPattern',
  'feature-request-lifecycle.md': 'FeatureRequest',
  'plan-change.md': 'Plan',
  'subscription-lifecycle.md': 'Subscription',
  'support-request-lifecycle.md': 'SupportRequest',
}

async function main() {
  console.log(`Seeding GraphDL ORM at ${BASE_URL}...\n`)

  // Verify server is reachable
  try {
    const check = await fetch(`${BASE_URL}/graphdl/raw/nouns?limit=1`, { headers: { 'X-API-Key': API_KEY } })
    if (!check.ok) throw new Error(`HTTP ${check.status}`)
  } catch (err) {
    console.error(`Cannot reach ${BASE_URL}/graphdl/raw/. Check AUTO_DEV_API_KEY.`, err)
    process.exit(1)
  }

  // Read all domain files
  const domainDir = path.join(ROOT, 'domains')
  const domainFiles = fs.readdirSync(domainDir).filter((f) => f.endsWith('.md'))

  // Read all state machine files
  const smDir = path.join(ROOT, 'state-machines')
  const smFiles = fs.readdirSync(smDir).filter((f) => f.endsWith('.md'))

  const files = [
    ...domainFiles.map((f) => ({
      markdown: fs.readFileSync(path.join(domainDir, f), 'utf-8'),
      type: 'domain' as const,
      domain: f.replace('.md', ''),
    })),
    ...smFiles.map((f) => ({
      markdown: fs.readFileSync(path.join(smDir, f), 'utf-8'),
      type: 'state-machine' as const,
      entityNoun: SM_ENTITY_MAP[f],
    })),
  ]

  console.log(`Seeding ${domainFiles.length} domain files + ${smFiles.length} state machine files...\n`)

  let totalNouns = 0, totalReadings = 0, totalStateMachines = 0, totalSkipped = 0, totalErrors = 0
  const allErrors: string[] = []

  // Send one file at a time to avoid timeouts on small machines
  for (const file of files) {
    const label = (file as any).domain || (file as any).entityNoun || 'unknown'
    process.stdout.write(`  ${file.type}: ${label}...`)

    const res = await fetch(`${BASE_URL}/graphdl/seed`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(file),
    })

    if (!res.ok) {
      console.log(` FAILED (${res.status})`)
      allErrors.push(`${label}: HTTP ${res.status}`)
      totalErrors++
      continue
    }

    const result = await res.json()
    const r = result.files[0]
    totalNouns += r.nouns
    totalReadings += r.readings
    totalStateMachines += r.stateMachines
    totalSkipped += r.skipped
    totalErrors += r.errors.length
    for (const err of r.errors) allErrors.push(`${label}: ${err}`)

    console.log(` ${r.nouns}n ${r.readings}r ${r.stateMachines}sm ${r.skipped}skip`)
  }

  console.log(`\nNouns:          ${totalNouns}`)
  console.log(`Readings:       ${totalReadings}`)
  console.log(`State Machines: ${totalStateMachines}`)
  console.log(`Skipped:        ${totalSkipped}`)
  console.log(`Errors:         ${totalErrors}`)

  if (allErrors.length) {
    console.log('\nErrors:')
    for (const err of allErrors) console.log(`  ${err}`)
  }

  const outDir = path.resolve(ROOT, 'generated')
  fs.mkdirSync(outDir, { recursive: true })

  console.log('\nRunning OpenAPI generator...')
  const genRes = await fetch(`${BASE_URL}/graphdl/raw/generators`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'auto.dev Full API', version: '1.0.0', databaseEngine: 'Payload' }),
  })
  if (!genRes.ok) {
    console.log(`  Failed: ${genRes.status}`)
  } else {
    const gen = await genRes.json().then((r: any) => r.doc)
    const schemaCount = gen?.output?.components?.schemas ? Object.keys(gen.output.components.schemas).length : 0
    console.log(`  OpenAPI: ${schemaCount} schemas`)
    fs.writeFileSync(path.join(outDir, 'openapi.json'), JSON.stringify(gen.output, null, 2))
  }

  console.log('\nRunning XState generator...')
  const xstateRes = await fetch(`${BASE_URL}/graphdl/raw/generators`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'auto.dev State Machines', version: '1.0.0', databaseEngine: 'Payload', outputFormat: 'xstate' }),
  })
  if (!xstateRes.ok) {
    console.log(`  Failed: ${xstateRes.status}`)
  } else {
    const xstate = await xstateRes.json().then((r: any) => r.doc)
    const xstateFiles = xstate?.output?.files ? Object.keys(xstate.output.files) : []
    console.log(`  XState: ${xstateFiles.length} files`)
    for (const [filePath, content] of Object.entries(xstate?.output?.files || {})) {
      const fullPath = path.join(outDir, filePath)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, content as string)
    }
  }

  // Run iLayer generator per domain
  console.log('\nRunning iLayer generators...')
  const domainsRes = await fetch(`${BASE_URL}/graphdl/raw/domains?limit=100`, { headers: authHeaders })
  if (!domainsRes.ok) {
    console.log(`  Failed to fetch domains: ${domainsRes.status}`)
  } else {
    const domainsData = await domainsRes.json() as any
    const domains = domainsData.docs || []
    for (const domain of domains) {
      const slug = domain.domainSlug || domain.id
      process.stdout.write(`  iLayer (${slug})...`)
      const ilayerRes = await fetch(`${BASE_URL}/graphdl/raw/generators`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: `${slug} ilayer`,
          outputFormat: 'ilayer',
          domain: domain.id,
          domains: [domain.id],
          databaseEngine: 'Payload',
        }),
      })
      if (!ilayerRes.ok) {
        console.log(` Failed (${ilayerRes.status})`)
      } else {
        const ilayer = await ilayerRes.json().then((r: any) => r.doc)
        const layerFiles = ilayer?.output?.files ? Object.keys(ilayer.output.files) : []
        console.log(` ${layerFiles.length} layers`)
        fs.writeFileSync(path.join(outDir, `ilayer-${slug}.json`), JSON.stringify(ilayer.output, null, 2))
      }
    }
  }

  console.log('\nDone!')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
