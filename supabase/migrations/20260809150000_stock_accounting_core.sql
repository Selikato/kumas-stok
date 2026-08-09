-- Stok + muhasebe çekirdeği

-- Cari kartlar
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('tedarikci', 'musteri', 'her_ikisi')),
  phone text,
  notes text,
  created_at timestamptz default now()
);

create unique index if not exists parties_name_unique on public.parties (lower(trim(name)));

alter table public.parties enable row level security;
drop policy if exists "Allow all for parties" on public.parties;
create policy "Allow all for parties" on public.parties for all using (true) with check (true);

-- Fiş sıra numaraları
create table if not exists public.voucher_sequences (
  year int not null,
  kind text not null check (kind in ('GIR', 'CIK', 'CAR')),
  last_value int not null default 0,
  primary key (year, kind)
);

alter table public.voucher_sequences enable row level security;
drop policy if exists "Allow all for voucher_sequences" on public.voucher_sequences;
create policy "Allow all for voucher_sequences" on public.voucher_sequences for all using (true) with check (true);

-- Stok hareketleri genişletme
alter table public.stock_movements add column if not exists voucher_number text;
alter table public.stock_movements add column if not exists party_id uuid references public.parties(id) on delete set null;
alter table public.stock_movements add column if not exists unit_price numeric;
alter table public.stock_movements add column if not exists unit_cost numeric;
alter table public.stock_movements add column if not exists line_total numeric;

create index if not exists stock_movements_occurred_at_idx on public.stock_movements (occurred_at desc);
create index if not exists stock_movements_voucher_idx on public.stock_movements (voucher_number);

-- Cari hesap hareketleri
create table if not exists public.account_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  occurred_at date not null default current_date,
  party_id uuid not null references public.parties(id) on delete restrict,
  entry_type text not null check (entry_type in ('borc', 'alacak', 'odeme', 'tahsilat')),
  amount numeric not null check (amount > 0),
  voucher_number text,
  notes text,
  movement_id uuid references public.stock_movements(id) on delete set null
);

create index if not exists account_entries_party_idx on public.account_entries (party_id);
create index if not exists account_entries_occurred_at_idx on public.account_entries (occurred_at desc);

alter table public.account_entries enable row level security;
drop policy if exists "Allow all for account_entries" on public.account_entries;
create policy "Allow all for account_entries" on public.account_entries for all using (true) with check (true);

-- Mevcut lot_number değerlerinden tedarikçi seed
insert into public.parties (name, kind)
select distinct trim(r.lot_number), 'tedarikci'
from public.rolls r
where r.lot_number is not null
  and trim(r.lot_number) <> ''
  and not exists (
    select 1 from public.parties p
    where lower(p.name) = lower(trim(r.lot_number))
  );
