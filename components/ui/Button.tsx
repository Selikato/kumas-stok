import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  children: ReactNode
  fullWidth?: boolean
}

const styles: Record<Variant, string> = {
  primary:
    'bg-ink text-surface hover:bg-ink-soft border border-ink',
  accent:
    'bg-accent text-white hover:bg-accent-hover border border-accent',
  secondary:
    'bg-surface text-ink hover:bg-paper-deep border border-line',
  danger:
    'bg-danger text-white hover:opacity-90 border border-danger',
  ghost:
    'bg-transparent text-muted hover:text-ink hover:bg-paper-deep/60 border border-transparent',
}

export default function Button({
  variant = 'primary',
  children,
  fullWidth,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none ${styles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
