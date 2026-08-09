import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseAdmin'
import { updateMovement } from '@/lib/dbWrites'
import { requireSession } from '@/lib/apiAuth'

export async function POST(request: Request) {
  const denied = await requireSession()
  if (denied) return denied

  let body: {
    id?: string
    occurred_at?: string
    notes?: string | null
    unit_price?: number | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'Hareket id gerekli.' }, { status: 400 })
  }

  try {
    const admin = createServiceClient()
    const result = await updateMovement(
      body.id,
      {
        occurred_at: body.occurred_at,
        notes: body.notes,
        unit_price: body.unit_price,
      },
      admin
    )
    return NextResponse.json({ ok: true, voucher_number: result.voucher_number })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Güncellenemedi.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
