import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/apiAuth'
import { insertMovement, insertAccountEntry } from '@/lib/dbWrites'

type Line = { rollId: string; amount: number }

export async function POST(request: Request) {
  const denied = await requireSession()
  if (denied) return denied

  let body: {
    fabricName?: string
    destination?: string
    occurredAt?: string
    partyId?: string | null
    salePrice?: number | null
    lines?: Line[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const fabricName = body.fabricName?.trim() || 'Kumaş'
  const occurredAt = body.occurredAt
  const partyId = body.partyId || null
  const sale =
    body.salePrice != null && !Number.isNaN(Number(body.salePrice))
      ? Number(body.salePrice)
      : null
  const lines = body.lines || []

  if (!occurredAt) return NextResponse.json({ error: 'Tarih zorunlu.' }, { status: 400 })
  if (lines.length === 0) return NextResponse.json({ error: 'En az bir stok kaydı seçiniz.' }, { status: 400 })
  if (!partyId) return NextResponse.json({ error: 'Müşteri seçiniz.' }, { status: 400 })
  if (sale == null || Number.isNaN(sale) || sale < 0) {
    return NextResponse.json({ error: 'Satış fiyatı zorunlu.' }, { status: 400 })
  }

  let sb
  try {
    sb = createServiceClient()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sunucu yapılandırma hatası'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const { data: party, error: partyErr } = await sb
    .from('parties')
    .select('id, name, kind')
    .eq('id', partyId)
    .single()
  if (partyErr || !party) {
    return NextResponse.json({ error: 'Müşteri bulunamadı.' }, { status: 400 })
  }
  if (party.kind !== 'musteri' && party.kind !== 'her_ikisi') {
    return NextResponse.json({ error: 'Seçilen cari müşteri değil.' }, { status: 400 })
  }
  const resolvedDest = party.name

  const succeeded: string[] = []
  const failures: string[] = []
  let totalCost = 0
  let totalSale = 0
  let totalAmt = 0
  let lastVoucher = ''

  for (const line of lines) {
    const amt = Number(line.amount)
    if (!line.rollId || !(amt > 0)) {
      failures.push('Geçersiz satır')
      continue
    }

    const { data: fresh, error: fetchErr } = await sb
      .from('rolls')
      .select('id, quantity, unit_price, roll_number')
      .eq('id', line.rollId)
      .single()

    if (fetchErr || !fresh) {
      failures.push(`Kayıt okunamadı: ${fetchErr?.message || line.rollId}`)
      continue
    }

    const label = fresh.roll_number || line.rollId.slice(0, 8)
    const currentQty = Number(fresh.quantity)
    if (amt > currentQty) {
      failures.push(`${label}: stok yetersiz (${currentQty})`)
      continue
    }

    const unitCost = Number(fresh.unit_price ?? 0)
    const newQty = currentQty - amt
    const costTotal = amt * unitCost
    const saleTotal = sale != null ? amt * sale : null

    const { data: updated, error: updateErr } = await sb
      .from('rolls')
      .update({ quantity: newQty })
      .eq('id', line.rollId)
      .gte('quantity', amt)
      .select('id, quantity')
      .maybeSingle()

    if (updateErr) {
      failures.push(`${label}: stok güncellenemedi (${updateErr.message})`)
      continue
    }
    if (!updated) {
      failures.push(`${label}: stok güncellenemedi (0 satır). RLS veya eşzamanlı işlem.`)
      continue
    }

    try {
      const mv = await insertMovement(
        {
          roll_id: line.rollId,
          movement_type: 'CIKIS',
          amount: amt,
          occurred_at: occurredAt,
          notes: `Çıkış | Nereye: ${resolvedDest} | Satış: ₺${sale}`,
          party_id: partyId,
          unit_price: sale,
          unit_cost: unitCost,
          line_total: saleTotal ?? costTotal,
        },
        sb
      )
      lastVoucher = mv.voucher_number
      totalCost += costTotal
      totalAmt += amt
      if (saleTotal != null) totalSale += saleTotal

      if (partyId && saleTotal != null && saleTotal > 0) {
        try {
          await insertAccountEntry(
            {
              party_id: partyId,
              entry_type: 'alacak',
              amount: saleTotal,
              occurred_at: occurredAt,
              notes: `${fabricName} satış · ${mv.voucher_number}`,
              movement_id: mv.id,
              voucher_number: mv.voucher_number,
            },
            sb
          )
        } catch (cariErr) {
          console.error('cari alacak:', cariErr)
        }
      }

      succeeded.push(line.rollId)
    } catch (err) {
      await sb.from('rolls').update({ quantity: currentQty }).eq('id', line.rollId)
      const msg = err instanceof Error ? err.message : 'hareket yazılamadı'
      failures.push(`${label}: ${msg}`)
    }
  }

  if (succeeded.length === 0) {
    return NextResponse.json(
      {
        error: failures.length
          ? `Çıkış yapılamadı: ${failures.join(' · ')}`
          : 'Hiçbir çıkış yapılamadı. Stoklar güncellenmiş olabilir.',
        failures,
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    voucher_number: lastVoucher,
    totalAmt,
    totalCost,
    totalSale,
    succeeded: succeeded.length,
    failed: failures.length,
    failures,
    destination: resolvedDest,
    fabricName,
  })
}
