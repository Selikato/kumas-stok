export const AUTH_COOKIE = 'kumas_stok_session'

const USERNAME = 'admin'
const PASSWORD = 'password'

function getSecret(): string {
  return process.env.AUTH_SECRET || 'kumas-stok-dev-secret-change-me'
}

export function verifyCredentials(username: string, password: string): boolean {
  return username === USERNAME && password === PASSWORD
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacSign(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return toBase64Url(sig)
}

export async function createSessionToken(): Promise<string> {
  const payload = `admin:${Date.now()}`
  const sig = await hmacSign(payload)
  return toBase64Url(new TextEncoder().encode(`${payload}.${sig}`))
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  try {
    const raw = new TextDecoder().decode(fromBase64Url(token))
    const lastDot = raw.lastIndexOf('.')
    if (lastDot <= 0) return false
    const payload = raw.slice(0, lastDot)
    const sig = raw.slice(lastDot + 1)
    const expected = await hmacSign(payload)
    if (sig.length !== expected.length) return false
    let diff = 0
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
    if (diff !== 0) return false
    const [user] = payload.split(':')
    return user === USERNAME
  } catch {
    return false
  }
}
