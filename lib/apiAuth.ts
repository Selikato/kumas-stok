import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth/session'

export async function requireSession(): Promise<NextResponse | null> {
  const jar = await cookies()
  const token = jar.get(AUTH_COOKIE)?.value
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }
  return null
}
