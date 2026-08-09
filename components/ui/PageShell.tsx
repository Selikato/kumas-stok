import type { ReactNode } from 'react'
import PageHeader from '@/components/PageHeader'
import type { Fabric } from '@/app/page'

type Props = {
  children: ReactNode
  title?: string
  subtitle?: string
  fabrics?: Fabric[]
  showActions?: boolean
  narrow?: boolean
  action?: ReactNode
}

export default function PageShell({
  children,
  title,
  subtitle,
  fabrics,
  showActions = false,
  narrow = false,
  action,
}: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader fabrics={fabrics} showActions={showActions} />
      <main
        className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 space-y-7 ${
          narrow ? 'max-w-4xl' : 'max-w-7xl'
        } ${showActions ? 'pb-24 md:pb-9' : ''}`}
      >
        {(title || action) && (
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              {title && (
                <h1 className="font-display text-3xl sm:text-4xl text-ink tracking-tight">{title}</h1>
              )}
              {subtitle && <p className="text-sm text-muted mt-1.5 max-w-2xl">{subtitle}</p>}
            </div>
            {action}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
