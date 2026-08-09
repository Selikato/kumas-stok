'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { inputCls } from '@/lib/stockHelpers'

export type FabricType = {
  id: string
  name: string
}

type Props = {
  initialTypes: FabricType[]
}

export default function FabricTypesSettings({ initialTypes }: Props) {
  const [types, setTypes] = useState(initialTypes)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setTypes(initialTypes)
  }, [initialTypes])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Tip adı zorunludur.')
      return
    }
    if (types.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Bu tip zaten mevcut.')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    const { data, error: insertErr } = await supabase
      .from('fabric_types')
      .insert({ name: trimmed })
      .select('id, name')
      .single()

    setLoading(false)

    if (insertErr) {
      setError(insertErr.message)
      return
    }

    setTypes((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'tr')))
    setName('')
    setMessage(`“${trimmed}” eklendi.`)
  }

  async function handleDelete(type: FabricType) {
    setError(null)
    setMessage(null)

    const { count } = await supabase
      .from('fabrics')
      .select('id', { count: 'exact', head: true })
      .eq('fabric_type', type.name)

    if ((count ?? 0) > 0) {
      setError(`“${type.name}” kullanan ${count} kumaş var. Önce kumaş tipini değiştirin veya silmeyin.`)
      return
    }

    setLoading(true)
    const { error: delErr } = await supabase.from('fabric_types').delete().eq('id', type.id)
    setLoading(false)

    if (delErr) {
      setError(delErr.message)
      return
    }

    setTypes((prev) => prev.filter((t) => t.id !== type.id))
    setMessage(`“${type.name}” silindi.`)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Kumaş Tipleri</h2>
        <p className="text-xs text-gray-400 mt-0.5">Yeni kayıt eklerken seçilecek tipler</p>
      </div>

      <form onSubmit={handleAdd} className="px-5 py-4 flex gap-2 border-b border-gray-100">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ör. Dokuma, Örme…"
          className={inputCls}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          Ekle
        </button>
      </form>

      {(error || message) && (
        <div className="px-5 py-3">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          {message && !error && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{message}</p>
          )}
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {types.length === 0 ? (
          <li className="px-5 py-8 text-sm text-gray-400 text-center">Henüz tip yok. Yukarıdan ekleyin.</li>
        ) : (
          types.map((t) => (
            <li key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-900">{t.name}</span>
              <button
                type="button"
                onClick={() => handleDelete(t)}
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
