'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Party, PartyKind } from '@/lib/cari'
import { inputCls } from '@/lib/stockHelpers'

type Props = {
  kind: Extract<PartyKind, 'tedarikci' | 'musteri'>
  title: string
  subtitle: string
  initialParties: Party[]
}

function matchesKind(party: Party, kind: 'tedarikci' | 'musteri') {
  return party.kind === kind || party.kind === 'her_ikisi'
}

export default function PartyKindSettings({ kind, title, subtitle, initialParties }: Props) {
  const [parties, setParties] = useState(initialParties)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setParties(initialParties)
  }, [initialParties])

  const rows = useMemo(
    () =>
      parties
        .filter((p) => matchesKind(p, kind))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [parties, kind]
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('İsim zorunlu.'); return }

    setLoading(true)
    setError(null)
    setMessage(null)

    const { data, error: insertErr } = await supabase
      .from('parties')
      .insert({
        name: trimmed,
        kind,
        phone: phone.trim() || null,
      })
      .select('id, name, kind, phone, notes')
      .single()

    setLoading(false)
    if (insertErr) {
      setError(
        insertErr.message.includes('unique') || insertErr.code === '23505'
          ? 'Bu isimde cari zaten var.'
          : insertErr.message
      )
      return
    }

    setParties((prev) => [...prev, data as Party])
    setName('')
    setPhone('')
    setMessage(`“${trimmed}” eklendi.`)
  }

  async function handleDelete(p: Party) {
    setError(null)
    setMessage(null)
    setLoading(true)
    const { error: delErr } = await supabase.from('parties').delete().eq('id', p.id)
    setLoading(false)
    if (delErr) {
      setError(
        delErr.message.includes('foreign') || delErr.code === '23503'
          ? `“${p.name}” kullanımda; silinemez.`
          : delErr.message
      )
      return
    }
    setParties((prev) => prev.filter((x) => x.id !== p.id))
    setMessage(`“${p.name}” silindi.`)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>

      <form onSubmit={handleAdd} className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-gray-100">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="İsim"
          className={inputCls}
          disabled={loading}
        />
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefon"
          className={inputCls}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg"
        >
          Ekle
        </button>
      </form>

      {(error || message) && (
        <div className="px-5 py-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          {message && !error && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{message}</p>
          )}
        </div>
      )}

      <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="px-5 py-8 text-sm text-gray-400 text-center">Henüz kayıt yok.</li>
        ) : (
          rows.map((p) => (
            <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="text-[11px] text-gray-400">
                  {p.kind === 'her_ikisi' ? 'Tedarikçi & Müşteri' : null}
                  {p.phone ? `${p.kind === 'her_ikisi' ? ' · ' : ''}${p.phone}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(p)}
                disabled={loading}
                className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Sil
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
