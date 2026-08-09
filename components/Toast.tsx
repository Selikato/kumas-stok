'use client'

import { useEffect } from 'react'

export type ToastType = 'success' | 'error'

export type ToastData = {
  id: number
  message: string
  type: ToastType
}

type Props = {
  toasts: ToastData[]
  onRemove: (id: number) => void
}

export default function ToastContainer({ toasts, onRemove }: Props) {
  return (
    <div className="fixed bottom-24 right-5 z-[100] flex flex-col gap-2 pointer-events-none md:bottom-5">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: ToastData; onRemove: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3500)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <div
      className={`ts-toast-enter pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium border shadow-[0_4px_16px_rgba(15,28,46,0.1)] max-w-sm
        ${
          toast.type === 'success'
            ? 'bg-surface border-line text-ink'
            : 'bg-danger-soft border-danger/25 text-danger'
        }`}
    >
      {toast.type === 'success' ? (
        <svg className="w-4 h-4 text-ok shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-danger shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className="min-w-0 break-words">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-auto text-muted hover:text-ink transition-colors shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
