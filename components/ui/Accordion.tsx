'use client'

import {
  createContext,
  useContext,
  useId,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react'

type AccordionContextValue = {
  value: string | null
  onValueChange: (value: string | null) => void
}

type AccordionItemContextValue = {
  value: string
  open: boolean
  triggerId: string
  contentId: string
  tone: AccordionTone
}

type AccordionTone = 'default' | 'out'

const AccordionContext = createContext<AccordionContextValue | null>(null)
const AccordionItemContext = createContext<AccordionItemContextValue | null>(null)

function useAccordion() {
  const ctx = useContext(AccordionContext)
  if (!ctx) throw new Error('Accordion bileşenleri Accordion içinde kullanılmalıdır.')
  return ctx
}

function useAccordionItem() {
  const ctx = useContext(AccordionItemContext)
  if (!ctx) throw new Error('AccordionTrigger/Content bir AccordionItem içinde olmalıdır.')
  return ctx
}

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

function Chevron({ open, tone }: { open: boolean; tone: AccordionTone }) {
  return (
    <svg
      className={cn(
        'w-5 h-5 shrink-0 text-muted transition-transform duration-300 ease-out',
        open && (tone === 'out' ? 'rotate-180 text-out' : 'rotate-180 text-accent')
      )}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

type AccordionProps = {
  value: string | null
  onValueChange: (value: string | null) => void
  children: ReactNode
  className?: string
}

export function Accordion({ value, onValueChange, children, className }: AccordionProps) {
  return (
    <AccordionContext.Provider value={{ value, onValueChange }}>
      <div className={cn('space-y-3', className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

type AccordionItemProps = {
  value: string
  children: ReactNode
  className?: string
  tone?: AccordionTone
}

export function AccordionItem({ value, children, className, tone = 'default' }: AccordionItemProps) {
  const { value: selected } = useAccordion()
  const open = selected === value
  const baseId = useId()
  const triggerId = `${baseId}-trigger`
  const contentId = `${baseId}-content`

  const openStyles =
    tone === 'out'
      ? 'border-2 border-out/50 shadow-[0_2px_8px_rgba(181,71,8,0.1)]'
      : 'border-2 border-accent shadow-[0_2px_8px_rgba(26,107,92,0.08)]'

  const focusStyles =
    tone === 'out'
      ? 'has-[:focus-visible]:border-2 has-[:focus-visible]:border-out/50 has-[:focus-visible]:shadow-[0_2px_8px_rgba(181,71,8,0.1)]'
      : 'has-[:focus-visible]:border-2 has-[:focus-visible]:border-accent has-[:focus-visible]:shadow-[0_2px_8px_rgba(26,107,92,0.08)]'

  return (
    <AccordionItemContext.Provider value={{ value, open, triggerId, contentId, tone }}>
      <div
        data-state={open ? 'open' : 'closed'}
        className={cn(
          'group/item rounded-xl bg-surface overflow-hidden transition-all duration-200',
          open ? openStyles : 'border border-line shadow-[0_1px_2px_rgba(15,28,46,0.04)] hover:border-ink/15',
          focusStyles,
          className
        )}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
}

type AccordionTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  hideChevron?: boolean
}

export function AccordionTrigger({
  children,
  className,
  hideChevron = false,
  ...rest
}: AccordionTriggerProps) {
  const { value, open, triggerId, contentId, tone } = useAccordionItem()
  const { onValueChange } = useAccordion()

  return (
    <button
      type="button"
      id={triggerId}
      aria-expanded={open}
      aria-controls={contentId}
      onClick={() => onValueChange(open ? null : value)}
      className={cn(
        'w-full flex items-center gap-4 px-4 sm:px-5 py-4 text-left',
        tone === 'out'
          ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-out/20 focus-visible:ring-inset'
          : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-inset',
        className
      )}
      {...rest}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {!hideChevron && <Chevron open={open} tone={tone} />}
    </button>
  )
}

type AccordionContentProps = {
  children: ReactNode
  className?: string
}

export function AccordionContent({ children, className }: AccordionContentProps) {
  const { open, triggerId, contentId, tone } = useAccordionItem()

  return (
    <div
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      aria-hidden={!open}
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            'border-t border-line/80 px-4 sm:px-5 pb-4 pt-3',
            tone === 'out' && open && 'bg-out-soft/30',
            open && 'ts-toast-enter',
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
