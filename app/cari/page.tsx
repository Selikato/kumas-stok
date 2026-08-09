import PageHeader from '@/components/PageHeader'
import CariClient from '@/components/CariClient'
import { fetchParties } from '@/lib/queries'
import { supabase } from '@/lib/supabaseClient'
import type { AccountEntry } from '@/lib/cari'

export const revalidate = 0

async function fetchEntries(): Promise<AccountEntry[]> {
  const { data, error } = await supabase
    .from('account_entries')
    .select('id, occurred_at, party_id, entry_type, amount, voucher_number, notes, movement_id')
    .order('occurred_at', { ascending: false })
    .limit(1000)

  if (error) {
    console.error('account_entries:', error.message)
    return []
  }
  return ((data ?? []) as AccountEntry[]).map((e) => ({
    ...e,
    amount: Number(e.amount),
  }))
}

export default async function CariPage() {
  const [parties, entries] = await Promise.all([fetchParties(), fetchEntries()])

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cari hesaplar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tedarikçi borçları, müşteri alacakları, ödeme ve tahsilat
          </p>
        </div>
        <CariClient parties={parties} entries={entries} />
      </main>
    </div>
  )
}
