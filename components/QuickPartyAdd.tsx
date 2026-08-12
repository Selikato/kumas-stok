'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Party, PartyKind } from '@/lib/cari'
import { inputCls } from '@/lib/stockHelpers'
import Button from '@/components/ui/Button'

type Props = {
  kind: Extract<PartyKind, 'tedarikci' | 'musteri'>
  disabled?: boolean
  onCreated: (party: Party) => void
}

export default function QuickPartyAdd({ kind, disabled, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = kind === 'tedarikci' ? 'tedarikçi' : 'müşteri'

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) { setError('İsim zorunlu.'); return }

    setLoading(true)
    setError(null)
    const { data, error: insertErr } = await supabase
      .from('parties')
      .insert({ name: trimmed, kind })
      .select('id, name, kind, phone, notes, opening_balance')
      .single()
    setLoading(false)

    if (insertErr?.message?.includes('opening_balance')) {
      const fb = await supabase
        .from('parties')
        .insert({ name: trimmed, kind })
        .select('id, name, kind, phone, notes')
        .single()
      if (fb.error) {
        setError(
          fb.error.message.includes('unique') || fb.error.code === '23505'
            ? 'Bu isimde cari zaten var.'
            : fb.error.message
        )
        return
      }
      onCreated({ ...(fb.data as Party), opening_balance: 0 })
      setName('')
      setOpen(false)
      return
    }

    if (insertErr) {
      setError(
        insertErr.message.includes('unique') || insertErr.code === '23505'
          ? 'Bu isimde cari zaten var.'
          : insertErr.message
      )
      return
    }

    onCreated({ ...(data as Party), opening_balance: Number((data as Party).opening_balance) || 0 })
    setName('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="text-[11px] text-accent hover:text-accent-hover font-medium disabled:opacity-50"
      >
        + Yeni {label}
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-line bg-paper/50 p-2.5 space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleAdd()
            }
          }}
          placeholder={`Yeni ${label} adı`}
          className={inputCls}
          disabled={loading || disabled}
          autoFocus
        />
        <Button
          type="button"
          variant="primary"
          disabled={loading || disabled}
          className="!py-2 !text-xs shrink-0"
          onClick={() => void handleAdd()}
        >
          Ekle
        </Button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setOpen(false)
            setError(null)
            setName('')
          }}
          className="shrink-0 px-2 py-2 text-xs text-muted hover:text-ink"
        >
          Vazgeç
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
