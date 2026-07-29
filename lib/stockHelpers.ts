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
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition'
