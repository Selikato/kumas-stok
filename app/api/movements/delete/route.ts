import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabaseAdmin'
import { deleteMovement } from '@/lib/dbWrites'
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth/session'

export async function POST(request: Request) {
  const jar = await cookies()
  const token = jar.get(AUTH_COOKIE)?.value
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  let body: { id?: string }
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
    const result = await deleteMovement(body.id, admin)
    return NextResponse.json({ ok: true, voucher_number: result.voucher_number })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Silinemedi.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
