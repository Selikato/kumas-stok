import { type SupabaseClient } from '@supabase/supabase-js'
import { nextVoucherNumber } from '@/lib/vouchers'
import { supabase as browserClient } from '@/lib/supabaseClient'

function clientOrDefault(client?: SupabaseClient) {
  return client ?? browserClient
}

export async function insertRoll(
  row: {
    variant_id: string
    roll_number: string
    lot_number: string
    quantity: number
    unit_price: number
    location: string
    received_at: string
  },
  client?: SupabaseClient
): Promise<{ id: string }> {
  const sb = clientOrDefault(client)
  const withDate = await sb.from('rolls').insert(row).select('id').single()
  if (!withDate.error && withDate.data) return withDate.data

  if (withDate.error?.message?.includes('received_at')) {
    const { received_at: _, ...rest } = row
    const fallback = await sb.from('rolls').insert(rest).select('id').single()
    if (fallback.error) throw new Error(fallback.error.message)
    return fallback.data
  }

  throw new Error(withDate.error?.message || 'Roll insert failed')
}

type MovementInsert = {
  roll_id: string
  movement_type: 'GIRIS' | 'CIKIS'
  amount: number
  occurred_at: string
  notes: string
  party_id?: string | null
  unit_price?: number | null
  unit_cost?: number | null
  line_total?: number | null
  voucher_number?: string
}

export async function insertMovement(
  row: MovementInsert,
  client?: SupabaseClient
): Promise<{ id: string; voucher_number: string }> {
  const sb = clientOrDefault(client)
  const voucher =
    row.voucher_number ||
    (await nextVoucherNumber(row.movement_type === 'GIRIS' ? 'GIR' : 'CIK', sb))

  const payload = {
    roll_id: row.roll_id,
    movement_type: row.movement_type,
    amount: row.amount,
    occurred_at: row.occurred_at,
    notes: row.notes,
    party_id: row.party_id ?? null,
    unit_price: row.unit_price ?? null,
    unit_cost: row.unit_cost ?? null,
    line_total: row.line_total ?? null,
    voucher_number: voucher,
  }

  const { data, error } = await sb
    .from('stock_movements')
    .insert(payload)
    .select('id, voucher_number')
    .single()

  if (!error && data) {
    return { id: data.id, voucher_number: data.voucher_number || voucher }
  }

  if (
    error?.message?.includes('occurred_at') ||
    error?.message?.includes('voucher_number') ||
    error?.message?.includes('party_id') ||
    error?.message?.includes('unit_price') ||
    error?.message?.includes('unit_cost') ||
    error?.message?.includes('line_total')
  ) {
    const tryFull = await sb
      .from('stock_movements')
      .insert({
        roll_id: row.roll_id,
        movement_type: row.movement_type,
        amount: row.amount,
        occurred_at: row.occurred_at,
        notes: `Fiş: ${voucher} | ${row.notes}`,
      })
      .select('id')
      .single()

    if (!tryFull.error && tryFull.data) {
      return { id: tryFull.data.id, voucher_number: voucher }
    }

    const fallback = await sb
      .from('stock_movements')
      .insert({
        roll_id: row.roll_id,
        movement_type: row.movement_type,
        amount: row.amount,
        notes: `Tarih: ${row.occurred_at} | Fiş: ${voucher} | ${row.notes}`,
      })
      .select('id')
      .single()
    if (fallback.error) throw new Error(fallback.error.message)
    return { id: fallback.data.id, voucher_number: voucher }
  }

  throw new Error(error?.message || 'Movement insert failed')
}

export async function insertAccountEntry(
  row: {
    party_id: string
    entry_type: 'borc' | 'alacak' | 'odeme' | 'tahsilat'
    amount: number
    occurred_at: string
    notes?: string
    movement_id?: string | null
    voucher_number?: string
    payment_method?: string | null
  },
  client?: SupabaseClient
): Promise<{ id: string; voucher_number: string }> {
  const sb = clientOrDefault(client)
  const voucher = row.voucher_number || (await nextVoucherNumber('CAR', sb))

  const payload: Record<string, unknown> = {
    party_id: row.party_id,
    entry_type: row.entry_type,
    amount: row.amount,
    occurred_at: row.occurred_at,
    notes: row.notes ?? null,
    movement_id: row.movement_id ?? null,
    voucher_number: voucher,
  }
  if (row.payment_method) payload.payment_method = row.payment_method

  const { data, error } = await sb
    .from('account_entries')
    .insert(payload)
    .select('id, voucher_number')
    .single()

  if (!error && data) {
    return { id: data.id, voucher_number: data.voucher_number || voucher }
  }

  // Kolon henüz yoksa notes içine yazarak devam et
  if (error?.message?.includes('payment_method') && row.payment_method) {
    const noteParts = [row.notes?.trim(), `Ödeme şekli: ${row.payment_method}`].filter(Boolean)
    const fallback = await sb
      .from('account_entries')
      .insert({
        party_id: row.party_id,
        entry_type: row.entry_type,
        amount: row.amount,
        occurred_at: row.occurred_at,
        notes: noteParts.join(' · ') || null,
        movement_id: row.movement_id ?? null,
        voucher_number: voucher,
      })
      .select('id, voucher_number')
      .single()
    if (fallback.error) throw new Error(fallback.error.message)
    return { id: fallback.data.id, voucher_number: fallback.data.voucher_number || voucher }
  }

  throw new Error(error?.message || 'Cari kayıt yazılamadı')
}

/**
 * Hareket sil: bağlı cari kayıtlarını kaldır, stok miktarını geri al, hareketi sil.
 * Giriş silinirken mevcut top miktarı yetersizse (sonradan çıkış yapılmışsa) hata verir.
 */
export async function deleteMovement(
  movementId: string,
  client?: SupabaseClient
): Promise<{ voucher_number: string | null }> {
  const sb = clientOrDefault(client)

  const { data: mv, error: fetchErr } = await sb
    .from('stock_movements')
    .select('id, roll_id, movement_type, amount, voucher_number')
    .eq('id', movementId)
    .single()

  if (fetchErr || !mv) throw new Error(fetchErr?.message || 'Hareket bulunamadı.')

  const amount = Number(mv.amount)
  const type = String(mv.movement_type).toUpperCase()
  const isIn = type === 'GIRIS' || type === 'IN'
  const isOut = type === 'CIKIS' || type === 'OUT'

  const { data: roll, error: rollErr } = await sb
    .from('rolls')
    .select('id, quantity')
    .eq('id', mv.roll_id)
    .single()

  if (rollErr || !roll) throw new Error(rollErr?.message || 'İlgili stok kaydı bulunamadı.')

  const currentQty = Number(roll.quantity)

  if (isIn && currentQty + 1e-9 < amount) {
    throw new Error(
      `Bu giriş silinemez: topta yalnızca ${currentQty} kaldı (hareket ${amount}). Önce bu toptan yapılan çıkışları silin.`
    )
  }

  const { error: cariErr } = await sb
    .from('account_entries')
    .delete()
    .eq('movement_id', movementId)

  if (cariErr) throw new Error(`Cari kayıtları silinemedi: ${cariErr.message}`)

  const newQty = isIn ? currentQty - amount : isOut ? currentQty + amount : currentQty

  const { data: updatedRoll, error: qtyErr } = await sb
    .from('rolls')
    .update({ quantity: newQty })
    .eq('id', mv.roll_id)
    .select('id, quantity')
    .maybeSingle()

  if (qtyErr) throw new Error(`Stok geri alınamadı: ${qtyErr.message}`)
  if (!updatedRoll) {
    throw new Error(
      'Stok güncellenemedi (yetki/RLS). SQL politikalarını uygulayın veya service role kullanın.'
    )
  }

  const { data: deleted, error: delErr } = await sb
    .from('stock_movements')
    .delete()
    .eq('id', movementId)
    .select('id')
    .maybeSingle()

  if (delErr) {
    await sb.from('rolls').update({ quantity: currentQty }).eq('id', mv.roll_id)
    throw new Error(`Hareket silinemedi: ${delErr.message}`)
  }

  if (!deleted) {
    await sb.from('rolls').update({ quantity: currentQty }).eq('id', mv.roll_id)
    throw new Error(
      'Hareket silinemedi (yetki/RLS). Silme politikası eksik olabilir.'
    )
  }

  // Bu topa ait başka hareket kalmadıysa top kaydını sil
  const { count } = await sb
    .from('stock_movements')
    .select('id', { count: 'exact', head: true })
    .eq('roll_id', mv.roll_id)

  if ((count ?? 0) === 0) {
    await sb.from('rolls').delete().eq('id', mv.roll_id)
  } else if (newQty <= 0) {
    await sb.from('rolls').update({ quantity: 0 }).eq('id', mv.roll_id)
  }

  return { voucher_number: mv.voucher_number }
}

/** Browser-safe delete via API (service role). */
export async function deleteMovementViaApi(movementId: string): Promise<void> {
  const res = await fetch('/api/movements/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: movementId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Silinemedi.')
}
