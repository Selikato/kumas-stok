'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Party, PartyKind } from '@/lib/cari'
import { inputCls } from '@/lib/stockHelpers'

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
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
        setError(fb.error.message.includes('unique') || fb.error.code === '23505'
          ? 'Bu isimde cari zaten var.'
          : fb.error.message)
        return
      }
      onCreated({ ...(fb.data as Party), opening_balance: 0 })
      setName('')
      setOpen(false)
      return
    }

    if (insertErr) {
      setError(insertErr.message.includes('unique') || insertErr.code === '23505'
        ? 'Bu isimde cari zaten var.'
        : insertErr.message)
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
        className="text-[11px] text-teal-700 hover:text-teal-900 font-medium disabled:opacity-50"
      >
        + Yeni {label}
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Yeni ${label} adı`}
          className={inputCls}
          disabled={loading || disabled}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || disabled}
          className="shrink-0 px-3 py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-lg disabled:opacity-50"
        >
          Ekle
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => { setOpen(false); setError(null); setName('') }}
          className="shrink-0 px-2 py-2 text-xs text-gray-500 hover:text-gray-800"
        >
          Vazgeç
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
