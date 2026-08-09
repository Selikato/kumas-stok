'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Fabric } from '@/app/page'
import AddFabricModal from './AddFabricModal'
import StockOutModal from './StockOutModal'
import ToastContainer, { type ToastData } from './Toast'

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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-5 min-w-0">
              <Link href="/" className="text-base font-semibold text-gray-900 tracking-tight shrink-0">
                Kumaş Stok
              </Link>
              <nav className="hidden md:flex items-center gap-0.5 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-2.5 py-1.5 rounded-md transition-colors ${
                      navActive(item.href)
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {showActions && (
                <>
                  <button
                    onClick={() => setStockInOpen(true)}
                    className="inline-flex items-center bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                  >
                    Stok girişi
                  </button>
                  <button
                    onClick={() => setStockOutOpen(true)}
                    className="inline-flex items-center bg-white hover:bg-gray-50 text-gray-900 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 transition-colors"
                  >
                    Stok çıkışı
                  </button>
                </>
              )}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-sm text-gray-500 hover:text-gray-800 px-2 py-2 disabled:opacity-50"
                title="Oturumu kapat"
              >
                {loggingOut ? '…' : 'Oturumu kapat'}
              </button>
            </div>
          </div>

          <nav className="md:hidden flex gap-1 pb-3 overflow-x-auto text-sm -mx-1 px-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  navActive(item.href)
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-500'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

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
