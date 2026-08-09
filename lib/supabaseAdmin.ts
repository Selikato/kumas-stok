import { createClient } from '@supabase/supabase-js'

/** Server-only client with service role (bypasses RLS). */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env missing')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
