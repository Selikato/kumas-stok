import { supabase } from '@/lib/supabaseClient'
import type { Party } from '@/lib/cari'
import type { MovementRow } from '@/lib/movements'

export async function fetchParties(): Promise<Party[]> {
  const { data, error } = await supabase
    .from('parties')
    .select('id, name, kind, phone, notes')
    .order('name')
  if (error) {
    console.error('parties:', error.message)
    return []
  }
  return (data as Party[]) ?? []
}

export async function fetchMovements(opts?: {
  from?: string
  to?: string
  type?: string
}): Promise<MovementRow[]> {
  let q = supabase
    .from('stock_movements')
    .select(`
      id,
      roll_id,
      occurred_at,
      movement_type,
      amount,
      notes,
      voucher_number,
      unit_price,
      unit_cost,
      line_total,
      party_id,
      parties ( name ),
      rolls (
        roll_number,
        variants (
          fabrics ( name, unit )
        )
      )
    `)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (opts?.from) q = q.gte('occurred_at', opts.from)
  if (opts?.to) q = q.lte('occurred_at', opts.to)
  if (opts?.type) q = q.eq('movement_type', opts.type)

  const { data, error } = await q
  if (error) {
    console.error('movements:', error.message)
    return []
  }

  type Raw = {
    id: string
    roll_id: string
    occurred_at: string
    movement_type: string
    amount: number
    notes: string | null
    voucher_number: string | null
    unit_price: number | null
    unit_cost: number | null
    line_total: number | null
    party_id: string | null
    parties: { name: string } | { name: string }[] | null
    rolls: {
      roll_number: string | null
      variants: {
        fabrics: { name: string; unit: string | null } | { name: string; unit: string | null }[] | null
      } | { fabrics: unknown }[] | null
    } | null
  }

  return ((data as unknown as Raw[]) ?? []).map((row) => {
    const party = Array.isArray(row.parties) ? row.parties[0] : row.parties
    const roll = row.rolls
    const variant = roll?.variants
      ? Array.isArray(roll.variants) ? roll.variants[0] : roll.variants
      : null
    const fabricRaw = variant?.fabrics
    const fabric = fabricRaw
      ? Array.isArray(fabricRaw) ? fabricRaw[0] : fabricRaw
      : null

    return {
      id: row.id,
      roll_id: row.roll_id,
      occurred_at: row.occurred_at,
      movement_type: row.movement_type,
      amount: Number(row.amount),
      notes: row.notes,
      voucher_number: row.voucher_number,
      unit_price: row.unit_price != null ? Number(row.unit_price) : null,
      unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
      line_total: row.line_total != null ? Number(row.line_total) : null,
      party_id: row.party_id,
      party_name: party?.name ?? null,
      fabric_name: fabric?.name ?? null,
      fabric_unit: fabric?.unit ?? null,
      roll_number: roll?.roll_number ?? null,
    }
  })
}
