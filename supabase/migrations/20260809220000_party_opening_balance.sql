-- Cari başlangıç bakiyesi (işaretli: + alacak, − borç)
alter table public.parties
  add column if not exists opening_balance numeric not null default 0;

comment on column public.parties.opening_balance is
  'Başlangıç bakiyesi. Pozitif = alacak (onlar bize borçlu), negatif = borç (biz onlara borçluyuz).';
