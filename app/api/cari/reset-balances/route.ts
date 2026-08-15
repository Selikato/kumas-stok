import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/apiAuth'

/** Seçili carilerin hareketlerini siler, başlangıç bakiyelerini sıfırlar. */
export async function POST(request: Request) {
  const denied = await requireSession()
  if (denied) return denied

  let body: { partyIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const partyIds = [...new Set((body.partyIds ?? []).filter((id) => typeof id === 'string' && id.trim()))]
  if (partyIds.length === 0) {
    return NextResponse.json({ error: 'En az bir cari seçiniz.' }, { status: 400 })
  }

  try {
    const sb = createServiceClient()

    const { count, error: countErr } = await sb
      .from('account_entries')
      .select('*', { count: 'exact', head: true })
      .in('party_id', partyIds)
    if (countErr) throw countErr

    const { error: delErr } = await sb.from('account_entries').delete().in('party_id', partyIds)
    if (delErr) throw delErr

    const { error: upErr } = await sb
      .from('parties')
      .update({ opening_balance: 0 })
      .in('id', partyIds)
    if (upErr) throw upErr

    return NextResponse.json({
      ok: true,
      deletedEntries: count ?? 0,
      resetParties: partyIds.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Bakiyeler sıfırlanamadı.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
