/**
 * Seed all auto.dev-graphdl domain readings into a running GraphDL ORM instance.
 *
 * Usage: GRAPHDL_URL=http://localhost:3000 npx tsx scripts/seed-auto-dev.ts
 *
 * Reads domain/*.md and state-machines/*.md files directly — the markdown
 * IS the source of truth. No hand-maintained data arrays.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BASE_URL = process.env.GRAPHDL_URL || 'http://localhost:3000'
const API_KEY = process.env.GRAPHDL_API_KEY || ''
const authHeaders: Record<string, string> = API_KEY
  ? { 'Content-Type': 'application/json', 'Authorization': `users API-Key ${API_KEY}` }
  : { 'Content-Type': 'application/json' }

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
    await fetch(`${BASE_URL}/api/nouns?limit=1`)
  } catch {
    console.error(`Cannot reach ${BASE_URL}. Is graphdl-orm running?`)
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

    const res = await fetch(`${BASE_URL}/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  // Run generators
  const outDir = path.resolve(ROOT, 'generated')
  fs.mkdirSync(outDir, { recursive: true })

  console.log('\nRunning OpenAPI generator...')
  const genRes = await fetch(`${BASE_URL}/api/generators`, {
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
  const xstateRes = await fetch(`${BASE_URL}/api/generators`, {
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

  console.log('\nDone!')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
