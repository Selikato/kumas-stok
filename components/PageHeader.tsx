'use client'

import { useState, useCallback } from 'react'
import AddFabricModal from './AddFabricModal'
import ToastContainer, { type ToastData } from './Toast'

export default function PageHeader() {
  const [open, setOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastData[]>([])

  const addToast = useCallback((message: string, type: ToastData['type']) => {
    setToasts((prev) => [...prev, { id: Date.now(), message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            Kumaş Stok Takibi
          </h1>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4" />
            </svg>
            Yeni Kayıt Ekle
          </button>
        </div>
      </header>

      <AddFabricModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={(msg) => addToast(msg, 'success')}
        onError={(msg) => addToast(msg, 'error')}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}
