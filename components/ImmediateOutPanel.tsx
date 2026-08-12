'use client'

import type { ReactNode } from 'react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion'

const ITEM_ID = 'immediate-out'

type Props = {
  enabled: boolean
  onToggle: (v: boolean) => void
  children?: ReactNode
}

/** Stok girişi formunda opsiyonel “hemen çık” accordion bölümü */
export default function ImmediateOutPanel({ enabled, onToggle, children }: Props) {
  return (
    <Accordion
      value={enabled ? ITEM_ID : null}
      onValueChange={(v) => onToggle(v === ITEM_ID)}
      className="mt-6"
    >
      <AccordionItem value={ITEM_ID} tone="out">
        <AccordionTrigger>
          <div>
            <p className="font-semibold text-ink">Hemen çık</p>
            <p className="text-xs text-muted mt-0.5 font-normal">
              Mal depoya girmeden doğrudan müşteriye çıkış · opsiyonel
            </p>
          </div>
        </AccordionTrigger>

        <AccordionContent className="space-y-4">
          <p className="text-xs text-muted leading-relaxed -mt-1">
            Giriş ve çıkış aynı işlemde kaydedilir. Çıkış miktarı boş bırakılırsa girişin tamamı çıkar.
          </p>
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
