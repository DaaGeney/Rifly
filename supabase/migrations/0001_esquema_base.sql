-- Tablero de la rifa: los 100 números, su historial y la vista pública.
-- Equivale al antiguo supabase/schema.sql.

create table if not exists public.raffle_numbers (
  number int primary key check (number between 0 and 99),
  buyer_name text,
  buyer_phone text,
  sold_by text,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'paid')),
  updated_at timestamptz not null default now()
);

-- Sembrar los 100 números. El "on conflict" deja correr esto de nuevo sin
-- tocar los datos que ya existan.
insert into public.raffle_numbers (number)
select generate_series(0, 99)
on conflict (number) do nothing;

alter table public.raffle_numbers enable row level security;

-- Solo el admin (por email) puede leer y escribir la tabla completa
drop policy if exists "admin lee todo" on public.raffle_numbers;
create policy "admin lee todo" on public.raffle_numbers
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'diegoassia@gmail.com');

drop policy if exists "admin actualiza" on public.raffle_numbers;
create policy "admin actualiza" on public.raffle_numbers
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'diegoassia@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'diegoassia@gmail.com');

-- Historial de cambios (respaldo ante equivocaciones).
-- Lo llena automáticamente un trigger en cada actualización.
create table if not exists public.raffle_history (
  id bigint generated always as identity primary key,
  number int not null,
  old_status text,
  new_status text,
  old_buyer text,
  new_buyer text,
  changed_at timestamptz not null default now()
);

alter table public.raffle_history enable row level security;

drop policy if exists "admin lee historial" on public.raffle_history;
create policy "admin lee historial" on public.raffle_history
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'diegoassia@gmail.com');

create or replace function public.log_raffle_change()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.raffle_history (number, old_status, new_status, old_buyer, new_buyer)
  values (old.number, old.status, new.status, old.buyer_name, new.buyer_name);
  return new;
end;
$$;

drop trigger if exists raffle_numbers_audit on public.raffle_numbers;
create trigger raffle_numbers_audit
  after update on public.raffle_numbers
  for each row
  when (old.status is distinct from new.status
        or old.buyer_name is distinct from new.buyer_name
        or old.buyer_phone is distinct from new.buyer_phone
        or old.sold_by is distinct from new.sold_by)
  execute function public.log_raffle_change();

-- Vista pública: solo número y estado, sin datos personales.
-- security_definer para que pueda leer la tabla aunque anon no tenga acceso.
create or replace view public.public_board
  with (security_invoker = false) as
  select number, status from public.raffle_numbers;

revoke all on public.raffle_numbers from anon;
revoke all on public.raffle_history from anon;
grant select on public.public_board to anon, authenticated;
