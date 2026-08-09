import type { ReactNode } from 'react'

type Props = {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
  className?: string
}

export default function Field({ label, required, hint, children, className = '' }: Props) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted mb-1.5">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted/80 mt-1">{hint}</p>}
    </div>
  )
}
