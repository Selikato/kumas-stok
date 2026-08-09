'use client'

import type { ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  loading?: boolean
  children: ReactNode
  footer?: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg'
}

const maxMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export default function ModalFrame({
  open,
  title,
  subtitle,
  onClose,
  loading,
  children,
  footer,
  maxWidth = 'md',
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
        onClick={() => !loading && onClose()}
      />
      <div
        className={`relative bg-surface border border-line rounded-xl shadow-[0_8px_30px_rgba(15,28,46,0.12)] w-full ${maxMap[maxWidth]} max-h-[90vh] overflow-y-auto ts-modal-enter`}
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line sticky top-0 bg-surface z-10">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-ink leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-muted hover:text-ink disabled:opacity-50 p-1 rounded-md hover:bg-paper-deep transition-colors"
            aria-label="Kapat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 space-y-4">{children}</div>
        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-line bg-paper/50 sticky bottom-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
