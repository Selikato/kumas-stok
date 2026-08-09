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
  const dest = body.destination?.trim()
  const occurredAt = body.occurredAt
  const partyId = body.partyId || null
  const sale = body.salePrice != null ? Number(body.salePrice) : null
  const lines = body.lines || []

  if (!dest) return NextResponse.json({ error: 'Nereye gitti zorunlu.' }, { status: 400 })
  if (!occurredAt) return NextResponse.json({ error: 'Tarih zorunlu.' }, { status: 400 })
  if (lines.length === 0) return NextResponse.json({ error: 'En az bir stok kaydı seçiniz.' }, { status: 400 })
  if (partyId && (sale == null || Number.isNaN(sale) || sale < 0)) {
    return NextResponse.json({ error: 'Cari alacak için satış fiyatı zorunlu.' }, { status: 400 })
  }

  const sb = createServiceClient()
  const succeeded: string[] = []
  const failed: string[] = []
  let totalCost = 0
  let totalSale = 0
  let totalAmt = 0
  let lastVoucher = ''

  for (const line of lines) {
    const amt = Number(line.amount)
    if (!line.rollId || !(amt > 0)) {
      failed.push(line.rollId || '?')
      continue
    }

    const { data: fresh, error: fetchErr } = await sb
      .from('rolls')
      .select('quantity, unit_price')
      .eq('id', line.rollId)
      .single()

    if (fetchErr || !fresh) {
      failed.push(line.rollId)
      continue
    }

    const currentQty = Number(fresh.quantity)
    if (amt > currentQty) {
      failed.push(line.rollId)
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
      .select('id')
      .maybeSingle()

    if (updateErr || !updated) {
      failed.push(line.rollId)
      continue
    }

    try {
      const mv = await insertMovement(
        {
          roll_id: line.rollId,
          movement_type: 'CIKIS',
          amount: amt,
          occurred_at: occurredAt,
          notes: `Çıkış | Nereye: ${dest}${sale != null ? ` | Satış: ₺${sale}` : ''}`,
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
      console.error('stock out line failed', err)
      failed.push(line.rollId)
    }
  }

  if (succeeded.length === 0) {
    return NextResponse.json(
      { error: 'Hiçbir çıkış yapılamadı. Stoklar güncellenmiş olabilir.' },
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
    failed: failed.length,
    destination: dest,
    fabricName,
  })
}
