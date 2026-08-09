import { supabase } from '@/lib/supabaseClient'

export async function getOrCreateVariant(fabricId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('variants')
    .select('id')
    .eq('fabric_id', fabricId)
    .eq('color_name', 'Genel')
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('variants')
    .insert({ fabric_id: fabricId, color_name: 'Genel' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return created.id
}

export const inputCls =
  'w-full px-3 py-2.5 text-sm bg-surface border border-line rounded-lg text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent transition'
