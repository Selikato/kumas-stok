import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  padded?: boolean
}

export default function Panel({ children, className = '', padded = true }: Props) {
  return (
    <div
      className={`bg-surface border border-line rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,28,46,0.04)] ${padded ? '' : ''} ${className}`}
    >
      {padded ? <div className="p-4 sm:p-5">{children}</div> : children}
    </div>
  )
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-line bg-surface">
      <div className="min-w-0">
        <h2 className="font-display text-lg text-ink leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
