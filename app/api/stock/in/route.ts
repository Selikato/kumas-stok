import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/apiAuth'
import { generateFabricCode, generateRollNumber } from '@/lib/helpers'
import { insertRoll, insertMovement, insertAccountEntry } from '@/lib/dbWrites'

export async function POST(request: Request) {
  const denied = await requireSession()
  if (denied) return denied

  let body: {
    fabricId?: string | null
    name?: string
    fabricType?: string
    unit?: string
    quantity?: number
    unitPrice?: number
    partyId?: string | null
    source?: string
    warehouse?: string
    occurredAt?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const name = body.name?.trim()
  const qty = Number(body.quantity)
  const price = Number(body.unitPrice)
  const occurredAt = body.occurredAt
  const source = body.source?.trim()
  const warehouse = body.warehouse?.trim() || 'Depo'
  const partyId = body.partyId || null

  if (!name) return NextResponse.json({ error: 'Kumaş adı zorunlu.' }, { status: 400 })
  if (!(qty > 0)) return NextResponse.json({ error: 'Geçerli miktar giriniz.' }, { status: 400 })
  if (!(price >= 0) || Number.isNaN(price)) {
    return NextResponse.json({ error: 'Geçerli fiyat giriniz.' }, { status: 400 })
  }
  if (!occurredAt) return NextResponse.json({ error: 'Tarih zorunlu.' }, { status: 400 })
  if (!source) return NextResponse.json({ error: 'Nereden geldi zorunlu.' }, { status: 400 })

  const sb = createServiceClient()
  const lineTotal = qty * price

  try {
    let fabricId: string
    let fabricUnit: string | null = null

    if (body.fabricId) {
      const { data: fabric, error } = await sb
        .from('fabrics')
        .select('id, unit')
        .eq('id', body.fabricId)
        .single()
      if (error || !fabric) throw new Error('Kumaş bulunamadı.')
      fabricId = fabric.id
      fabricUnit = fabric.unit
    } else {
      if (!body.fabricType) throw new Error('Kumaş tipi zorunlu.')
      if (!body.unit) throw new Error('Birim zorunlu.')

      const { data: existing } = await sb
        .from('fabrics')
        .select('id, unit')
        .eq('name', name)
        .maybeSingle()

      if (existing) {
        fabricId = existing.id
        fabricUnit = existing.unit
      } else {
        const { data: created, error } = await sb
          .from('fabrics')
          .insert({
            name,
            fabric_code: generateFabricCode(name),
            fabric_type: body.fabricType,
            unit: body.unit,
          })
          .select('id, unit')
          .single()
        if (error || !created) throw new Error(error?.message || 'Kumaş oluşturulamadı.')
        fabricId = created.id
        fabricUnit = created.unit
      }
    }

    // getOrCreateVariant uses browser client — do it with admin here
    const { data: existingVariant } = await sb
      .from('variants')
      .select('id')
      .eq('fabric_id', fabricId)
      .eq('color_name', 'Genel')
      .maybeSingle()

    let variantId = existingVariant?.id
    if (!variantId) {
      const { data: createdVar, error: varErr } = await sb
        .from('variants')
        .insert({ fabric_id: fabricId, color_name: 'Genel' })
        .select('id')
        .single()
      if (varErr || !createdVar) throw new Error(varErr?.message || 'Varyant oluşturulamadı.')
      variantId = createdVar.id
    }

    const newRoll = await insertRoll(
      {
        variant_id: variantId,
        roll_number: generateRollNumber(),
        lot_number: source,
        quantity: qty,
        unit_price: price,
        location: warehouse,
        received_at: occurredAt,
      },
      sb
    )

    let movementId: string
    let voucher: string
    try {
      const mv = await insertMovement(
        {
          roll_id: newRoll.id,
          movement_type: 'GIRIS',
          amount: qty,
          occurred_at: occurredAt,
          notes: `Giriş | Nereden: ${source} | Depo: ${warehouse}`,
          party_id: partyId,
          unit_price: price,
          unit_cost: null,
          line_total: lineTotal,
        },
        sb
      )
      movementId = mv.id
      voucher = mv.voucher_number
    } catch (err) {
      await sb.from('rolls').delete().eq('id', newRoll.id)
      throw err
    }

    if (partyId && lineTotal > 0) {
      try {
        await insertAccountEntry(
          {
            party_id: partyId,
            entry_type: 'borc',
            amount: lineTotal,
            occurred_at: occurredAt,
            notes: `${name} alış · ${voucher}`,
            movement_id: movementId,
            voucher_number: voucher,
          },
          sb
        )
      } catch (cariErr) {
        console.error('cari borc:', cariErr)
      }
    }

    return NextResponse.json({
      ok: true,
      voucher_number: voucher,
      name,
      quantity: qty,
      unit: fabricUnit,
      lineTotal,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Giriş kaydedilemedi.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
