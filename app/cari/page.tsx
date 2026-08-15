import PageShell from '@/components/ui/PageShell'
import CariClient from '@/components/CariClient'
import { fetchParties } from '@/lib/queries'
import { supabase } from '@/lib/supabaseClient'
import type { AccountEntry } from '@/lib/cari'

export const revalidate = 0

async function fetchEntries(): Promise<AccountEntry[]> {
  const full = await supabase
    .from('account_entries')
    .select('id, occurred_at, party_id, entry_type, amount, voucher_number, notes, movement_id, payment_method')
    .order('occurred_at', { ascending: false })
    .limit(1000)

  if (!full.error) {
    return ((full.data ?? []) as AccountEntry[]).map((e) => ({
      ...e,
      amount: Number(e.amount),
      payment_method: e.payment_method ?? null,
    }))
  }

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
    payment_method: null,
  }))
}

export default async function CariPage() {
  const [parties, entries] = await Promise.all([fetchParties(), fetchEntries()])

  return (
    <PageShell
      title="Cari hesaplar"
      subtitle="Tedarikçi borçları, müşteri alacakları · borç ve alacak kaydı"
    >
      <CariClient parties={parties} entries={entries} />
    </PageShell>
  )
}
