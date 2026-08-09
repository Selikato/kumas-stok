-- Para birimi meta (hesaplar her zaman TRY)
alter table public.stock_movements
  add column if not exists currency text default 'TRY',
  add column if not exists fx_rate numeric default 1,
  add column if not exists original_unit_price numeric;

alter table public.account_entries
  add column if not exists currency text default 'TRY',
  add column if not exists fx_rate numeric default 1,
  add column if not exists original_amount numeric;

comment on column public.stock_movements.currency is 'TRY | USD — tutarlar TRY cinsinden saklanır';
comment on column public.stock_movements.fx_rate is '1 USD = fx_rate TRY (TRY için 1)';
comment on column public.stock_movements.original_unit_price is 'Girilen birim fiyat (orijinal para birimi)';
