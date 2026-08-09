import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/apiAuth'
import { generateFabricCode, generateRollNumber } from '@/lib/helpers'
import { insertRoll, insertMovement, insertAccountEntry } from '@/lib/dbWrites'
import { fxNote, toTry, type MoneyCurrency } from '@/lib/money'

export async function POST(request: Request) {
  const denied = await requireSession()
  if (denied) return denied

  let body: {
    fabricId?: string | null
    name?: string
    unit?: string
    quantity?: number
    unitPrice?: number
    partyId?: string | null
    source?: string
    warehouse?: string
    occurredAt?: string
    currency?: MoneyCurrency
    fxRate?: number | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const name = body.name?.trim()
  const qty = Number(body.quantity)
  const originalPrice = Number(body.unitPrice)
  const occurredAt = body.occurredAt
  const warehouse = body.warehouse?.trim() || 'Depo'
  const partyId = body.partyId || null
  const currency: MoneyCurrency = body.currency === 'USD' ? 'USD' : 'TRY'

  if (!name) return NextResponse.json({ error: 'Kumaş adı zorunlu.' }, { status: 400 })
  if (!(qty > 0)) return NextResponse.json({ error: 'Geçerli miktar giriniz.' }, { status: 400 })
  if (!(originalPrice >= 0) || Number.isNaN(originalPrice)) {
    return NextResponse.json({ error: 'Geçerli fiyat giriniz.' }, { status: 400 })
  }
  if (!occurredAt) return NextResponse.json({ error: 'Tarih zorunlu.' }, { status: 400 })
  if (!partyId) return NextResponse.json({ error: 'Tedarikçi seçiniz.' }, { status: 400 })

  let price: number
  let fxRate: number
  try {
    const converted = toTry(originalPrice, currency, body.fxRate)
    price = converted.tryAmount
    fxRate = converted.fxRate
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Kur hatası.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: party, error: partyErr } = await sb
    .from('parties')
    .select('id, name, kind')
    .eq('id', partyId)
    .single()
  if (partyErr || !party) {
    return NextResponse.json({ error: 'Tedarikçi bulunamadı.' }, { status: 400 })
  }
  if (party.kind !== 'tedarikci' && party.kind !== 'her_ikisi') {
    return NextResponse.json({ error: 'Seçilen cari tedarikçi değil.' }, { status: 400 })
  }
  const resolvedSource = party.name
  const lineTotal = qty * price
  const fxSuffix = fxNote(currency, fxRate, originalPrice)

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
        lot_number: resolvedSource,
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
          notes: [`Giriş | Nereden: ${resolvedSource} | Depo: ${warehouse}`, fxSuffix]
            .filter(Boolean)
            .join(' · '),
          party_id: partyId,
          unit_price: price,
          unit_cost: null,
          line_total: lineTotal,
          currency,
          fx_rate: fxRate,
          original_unit_price: originalPrice,
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
            notes: [`${name} alış · ${voucher}`, fxSuffix].filter(Boolean).join(' · '),
            movement_id: movementId,
            voucher_number: voucher,
            currency,
            fx_rate: fxRate,
            original_amount: qty * originalPrice,
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
