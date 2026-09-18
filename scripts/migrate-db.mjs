#!/usr/bin/env node
/**
 * migrate-db.mjs — one-shot data migration between two Postgres databases
 * (e.g. Neon -> Nhost) for the hostel management system.
 *
 * What it does:
 *   1. Applies the Prisma schema to the TARGET database (prisma db push)
 *   2. Copies every table in foreign-key-safe order, preserving all IDs
 *      (sessions included, so nobody gets logged out)
 *   3. Verifies row counts on both sides and reports any mismatch
 *
 * Usage (Git Bash, from the project root):
 *   SOURCE_DATABASE_URL="postgres://…old…" \
 *   TARGET_DATABASE_URL="postgres://…new…" \
 *   node scripts/migrate-db.mjs
 *
 * Tips:
 *   - Prefer the DIRECT connection (port 5432) for the target while migrating;
 *     save the POOLED one (port 6543, add &pgbouncer=true) for Vercel.
 *   - If a run fails halfway, re-run the same command with CLEAN=1 to wipe the
 *     target tables first and start fresh.
 */
import { createRequire } from 'module'
import { execSync } from 'child_process'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')

// Copy order is FK-safe: parents before children.
// [prisma delegate, rows per insert batch]
const TABLES = [
  ['branch', 100],
  ['room', 100],
  ['student', 100],
  ['user', 100],
  ['session', 200],
  ['payment', 200],
  ['complaint', 200],
  ['visitor', 200],
  ['notice', 100],
  ['messMenu', 1], // base64 payloads can be ~MBs each — one row per batch
  ['expense', 200],
]

const SOURCE = process.env.SOURCE_DATABASE_URL
const TARGET = process.env.TARGET_DATABASE_URL

if (!SOURCE || !TARGET) {
  console.error('Missing env vars. Set both and retry:')
  console.error('  SOURCE_DATABASE_URL  old database (e.g. Neon)')
  console.error('  TARGET_DATABASE_URL  new database (e.g. Nhost)')
  process.exit(1)
}
if (SOURCE === TARGET) {
  console.error('Source and target are the same URL — refusing to run.')
  process.exit(1)
}

console.log('[1/3] Applying Prisma schema to the target database…')
execSync('npx prisma db push --skip-generate', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: TARGET },
})

const source = new PrismaClient({ datasources: { db: { url: SOURCE } } })
const target = new PrismaClient({ datasources: { db: { url: TARGET } } })

async function main() {
  // Optional clean slate (e.g. after a failed half-run)
  if (process.env.CLEAN === '1') {
    console.log('[2/3] CLEAN=1 — clearing target tables (reverse FK order)…')
    for (const [table] of [...TABLES].reverse()) {
      await target[table].deleteMany({})
    }
  } else {
    const existing = await target.branch.count()
    if (existing > 0) {
      console.error(
        `Target already has ${existing} branch row(s) — refusing to double-copy.\n` +
          'If you are SURE you want to overwrite, re-run with CLEAN=1.'
      )
      process.exit(1)
    }
  }

  console.log('[3/3] Copying data…\n')
  let failed = false
  for (const [table, size] of TABLES) {
    const rows = await source[table].findMany()
    for (let i = 0; i < rows.length; i += size) {
      await target[table].createMany({ data: rows.slice(i, i + size) })
    }
    const targetCount = await target[table].count()
    const ok = rows.length === targetCount
    if (!ok) failed = true
    console.log(
      `  ${ok ? 'ok ' : 'MISMATCH'} ${table.padEnd(10)} ${String(targetCount).padStart(6)} copied / ${rows.length} in source`
    )
  }

  if (failed) {
    console.error('\nSome tables did not match — check the output above.')
    process.exit(1)
  }
  console.log('\nAll tables copied and verified. Next: point Vercel DATABASE_URL at the new database.')
}

main()
  .catch((e) => {
    console.error('\nMigration failed:', e.message)
    console.error('Fix the issue, then re-run with CLEAN=1 to start fresh.')
    process.exit(1)
  })
  .finally(async () => {
    await source.$disconnect()
    await target.$disconnect()
  })
