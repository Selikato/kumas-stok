/**
 * Applies schema migration when SUPABASE_SERVICE_ROLE_KEY is available.
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/apply-migration.mjs
 *
 * Prefer: paste supabase/migrations/20260804220000_fabric_types_and_dates.sql
 * into Supabase Dashboard → SQL Editor → Run.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const envPath = resolve(root, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim()
  }
}

const sql = readFileSync(
  resolve(root, 'supabase/migrations/20260804220000_fabric_types_and_dates.sql'),
  'utf8'
)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const projectRef = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!projectRef || !serviceKey) {
  console.error(`
Migration could not be applied automatically (no SUPABASE_SERVICE_ROLE_KEY).

1. Open: https://supabase.com/dashboard/project/${projectRef || 'YOUR_PROJECT'}/sql/new
2. Paste contents of: supabase/migrations/20260804220000_fabric_types_and_dates.sql
3. Click Run
`)
  process.exit(1)
}

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const text = await res.text()
if (!res.ok) {
  console.error('Failed:', res.status, text)
  process.exit(1)
}
console.log('Migration applied:', text)
