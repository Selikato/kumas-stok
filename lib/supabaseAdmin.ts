import { createClient } from '@supabase/supabase-js'

/** Server-only client with service role (bypasses RLS). */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL eksik')
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY eksik. Vercel/hosting ortam değişkenlerine ekleyin (veya yerel için .env.local + restart).'
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
