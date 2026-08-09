-- Kumaş tipleri (ayarlar)
create table if not exists public.fabric_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

alter table public.fabric_types enable row level security;

drop policy if exists "Allow all for fabric_types" on public.fabric_types;
create policy "Allow all for fabric_types"
  on public.fabric_types
  for all
  using (true)
  with check (true);

-- Hareket ve giriş tarihleri
alter table public.stock_movements
  add column if not exists occurred_at date not null default current_date;

alter table public.rolls
  add column if not exists received_at date;

-- Mevcut fabric_type değerlerini seed et
insert into public.fabric_types (name)
select distinct trim(fabric_type)
from public.fabrics
where fabric_type is not null and trim(fabric_type) <> ''
on conflict (name) do nothing;
