import type { ReactNode } from 'react'

type Tone = 'neutral' | 'ok' | 'out' | 'danger' | 'accent'

const tones: Record<Tone, string> = {
  neutral: 'bg-paper-deep text-ink-soft',
  ok: 'bg-ok-soft text-ok',
  out: 'bg-out-soft text-out',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent/10 text-accent',
}

export default function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
