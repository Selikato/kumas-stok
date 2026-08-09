-- Ödeme / tahsilat şekli (EFT, çek, nakit…)
alter table public.account_entries
  add column if not exists payment_method text;

comment on column public.account_entries.payment_method is
  'odeme/tahsilat için: nakit, eft, havale, cek, kart, diger';
