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

  console.log(`Sending ${domainFiles.length} domain files + ${smFiles.length} state machine files...\n`)

  const res = await fetch(`${BASE_URL}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  })

  if (!res.ok) {
    console.error(`Seed failed: ${res.status} ${await res.text()}`)
    process.exit(1)
  }

  const result = await res.json()
  console.log(`Nouns:          ${result.totalNouns}`)
  console.log(`Readings:       ${result.totalReadings}`)
  console.log(`State Machines: ${result.totalStateMachines}`)
  console.log(`Skipped:        ${result.totalSkipped}`)
  console.log(`Errors:         ${result.totalErrors}`)

  if (result.totalErrors > 0) {
    console.log('\nErrors:')
    for (const file of result.files) {
      for (const err of file.errors) {
        console.log(`  ${file.domain || 'unknown'}: ${err}`)
      }
    }
  }

  // Run generators
  console.log('\nRunning OpenAPI generator...')
  const genRes = await fetch(`${BASE_URL}/api/generators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'auto.dev Full API', version: '1.0.0', databaseEngine: 'Payload' }),
  })
  const gen = await genRes.json().then((r: any) => r.doc)
  const schemaCount = gen.output?.components?.schemas ? Object.keys(gen.output.components.schemas).length : 0
  console.log(`  OpenAPI: ${schemaCount} schemas`)

  console.log('\nRunning XState generator...')
  const xstateRes = await fetch(`${BASE_URL}/api/generators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'auto.dev State Machines', version: '1.0.0', databaseEngine: 'Payload', outputFormat: 'xstate' }),
  })
  const xstate = await xstateRes.json().then((r: any) => r.doc)
  const xstateFiles = xstate.output?.files ? Object.keys(xstate.output.files) : []
  console.log(`  XState: ${xstateFiles.length} files`)

  // Write output to disk
  const outDir = path.resolve(ROOT, 'generated')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'openapi.json'), JSON.stringify(gen.output, null, 2))
  console.log(`\nWrote generated/openapi.json`)

  if (xstate.output?.files) {
    for (const [filePath, content] of Object.entries(xstate.output.files)) {
      const fullPath = path.join(outDir, filePath)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, content as string)
    }
    console.log(`Wrote ${xstateFiles.length} state machine files to generated/`)
  }

  console.log('\nDone!')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
