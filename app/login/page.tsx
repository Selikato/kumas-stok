'use client'

import { FormEvent, useState, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { inputCls } from '@/lib/stockHelpers'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Giriş başarısız.')
        return
      }
      const next = searchParams.get('next') || '/'
      router.replace(next)
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface/95 border border-line rounded-xl p-6 space-y-4 shadow-[0_1px_2px_rgba(15,28,46,0.06)] ts-modal-enter"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Oturum</p>
        <p className="text-sm text-muted mt-1">Hesabınızla devam edin</p>
      </div>

      <Field label="Kullanıcı adı" required>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputCls}
          disabled={loading}
          autoFocus
        />
      </Field>

      <Field label="Şifre" required>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
          disabled={loading}
        />
      </Field>

      {error && (
        <p className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button type="submit" variant="accent" fullWidth disabled={loading}>
        {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen linen-pattern flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(26,107,92,0.12), transparent 55%)',
        }}
      />
      <div className="relative w-full max-w-sm space-y-8">
        <div className="text-center space-y-4">
          <Image
            src="/trust-stock-logo-clear.png"
            alt="Trust Stock"
            width={360}
            height={82}
            className="h-16 sm:h-20 w-auto mx-auto"
            priority
            unoptimized
          />
          <p className="font-display text-2xl sm:text-3xl text-ink tracking-tight">
            Trust Stock
          </p>
          <p className="text-sm text-muted">Kumaş stok · hareket · cari</p>
        </div>
        <Suspense
          fallback={
            <div className="bg-surface border border-line rounded-xl p-6 text-sm text-muted">
              Yükleniyor…
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
