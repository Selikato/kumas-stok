'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Fabric } from '@/app/page'
import AddFabricModal from './AddFabricModal'
import StockOutModal from './StockOutModal'
import ToastContainer, { type ToastData } from './Toast'
import Button from '@/components/ui/Button'

type Props = {
  fabrics?: Fabric[]
  showActions?: boolean
}

const NAV = [
  { href: '/', label: 'Stok' },
  { href: '/hareketler', label: 'Hareketler' },
  { href: '/cari', label: 'Cari' },
  { href: '/ayarlar', label: 'Ayarlar' },
]

export default function PageHeader({ fabrics = [], showActions = false }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [stockInOpen, setStockInOpen] = useState(false)
  const [stockOutOpen, setStockOutOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastData[]>([])
  const [loggingOut, setLoggingOut] = useState(false)

  const addToast = useCallback((message: string, type: ToastData['type']) => {
    setToasts((prev) => [...prev, { id: Date.now(), message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.replace('/login')
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  function navActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname?.startsWith(href)
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-6 min-w-0">
              <Link
                href="/"
                className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
              >
                <Image
                  src="/trust-stock-logo-clear.png"
                  alt="Trust Stock"
                  width={160}
                  height={36}
                  className="h-9 w-auto"
                  priority
                  unoptimized
                />
              </Link>
              <nav className="hidden md:flex items-center gap-0.5 text-sm">
                {NAV.map((item) => {
                  const active = navActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative px-3 py-2 rounded-md transition-colors ${
                        active
                          ? 'text-ink font-medium ts-nav-active'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {showActions && (
                <div className="hidden md:flex items-center gap-2">
                  <Button variant="accent" onClick={() => setStockInOpen(true)}>
                    Stok girişi
                  </Button>
                  <Button variant="secondary" onClick={() => setStockOutOpen(true)}>
                    Stok çıkışı
                  </Button>
                </div>
              )}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-sm text-muted hover:text-ink px-2 py-2 disabled:opacity-50 transition-colors"
                title="Oturumu kapat"
              >
                {loggingOut ? '…' : <span className="hidden sm:inline">Çıkış</span>}
                <span className="sm:hidden" aria-label="Oturumu kapat">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                </span>
              </button>
            </div>
          </div>

          <nav className="md:hidden flex gap-1 pb-3 overflow-x-auto text-sm -mx-1 px-1">
            {NAV.map((item) => {
              const active = navActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-ink text-surface font-medium'
                      : 'text-muted hover:bg-paper-deep'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {showActions && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-2 max-w-7xl mx-auto">
            <Button variant="accent" fullWidth onClick={() => setStockInOpen(true)}>
              Giriş
            </Button>
            <Button variant="danger" fullWidth onClick={() => setStockOutOpen(true)}>
              Çıkış
            </Button>
          </div>
        </div>
      )}

      {showActions && (
        <>
          <AddFabricModal
            open={stockInOpen}
            fabrics={fabrics}
            onClose={() => setStockInOpen(false)}
            onSuccess={(msg) => addToast(msg, 'success')}
            onError={(msg) => addToast(msg, 'error')}
          />
          <StockOutModal
            open={stockOutOpen}
            fabrics={fabrics}
            onClose={() => setStockOutOpen(false)}
            onSuccess={(msg) => addToast(msg, 'success')}
            onError={(msg) => addToast(msg, 'error')}
          />
        </>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}
