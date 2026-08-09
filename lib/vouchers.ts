import { supabase } from '@/lib/supabaseClient'

export type VoucherKind = 'GIR' | 'CIK' | 'CAR'

function fallbackVoucher(kind: VoucherKind): string {
  const year = new Date().getFullYear()
  const stamp = Date.now().toString().slice(-6)
  return `${kind}-${year}-${stamp}`
}

/** Tek kullanıcılı MVP fiş no üretici. Tablo yoksa zaman damgalı fallback. */
export async function nextVoucherNumber(kind: VoucherKind): Promise<string> {
  const year = new Date().getFullYear()

  const { data: existing, error: fetchErr } = await supabase
    .from('voucher_sequences')
    .select('last_value')
    .eq('year', year)
    .eq('kind', kind)
    .maybeSingle()

  if (fetchErr) {
    console.warn('voucher_sequences:', fetchErr.message)
    return fallbackVoucher(kind)
  }

  const next = (existing?.last_value ?? 0) + 1

  if (existing) {
    const { error } = await supabase
      .from('voucher_sequences')
      .update({ last_value: next })
      .eq('year', year)
      .eq('kind', kind)
      .eq('last_value', existing.last_value)
    if (error) return fallbackVoucher(kind)
  } else {
    const { error } = await supabase
      .from('voucher_sequences')
      .insert({ year, kind, last_value: next })
    if (error) {
      const { data: again } = await supabase
        .from('voucher_sequences')
        .select('last_value')
        .eq('year', year)
        .eq('kind', kind)
        .maybeSingle()
      const retry = (again?.last_value ?? 0) + 1
      const { error: upErr } = await supabase
        .from('voucher_sequences')
        .update({ last_value: retry })
        .eq('year', year)
        .eq('kind', kind)
      if (upErr) return fallbackVoucher(kind)
      return `${kind}-${year}-${String(retry).padStart(5, '0')}`
    }
  }

  return `${kind}-${year}-${String(next).padStart(5, '0')}`
}
