-- Anon/authenticated için stok ve cari yazma politikaları
-- (DELETE/UPDATE sessizce başarısız oluyordu)

-- stock_movements
alter table public.stock_movements enable row level security;
drop policy if exists "stock_movements_all" on public.stock_movements;
create policy "stock_movements_all" on public.stock_movements
  for all using (true) with check (true);

-- rolls
alter table public.rolls enable row level security;
drop policy if exists "rolls_all" on public.rolls;
create policy "rolls_all" on public.rolls
  for all using (true) with check (true);

-- variants / fabrics (girişte lazım)
alter table public.fabrics enable row level security;
drop policy if exists "fabrics_all" on public.fabrics;
create policy "fabrics_all" on public.fabrics
  for all using (true) with check (true);

alter table public.variants enable row level security;
drop policy if exists "variants_all" on public.variants;
create policy "variants_all" on public.variants
  for all using (true) with check (true);
