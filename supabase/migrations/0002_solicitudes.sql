-- Solicitudes de números desde el tablero público.
-- Equivale al antiguo supabase/solicitudes.sql.

create table if not exists public.number_requests (
  id bigint generated always as identity primary key,
  number int not null references public.raffle_numbers(number),
  name text not null,
  phone text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- Un número no puede tener dos solicitudes pendientes a la vez
create unique index if not exists number_requests_one_pending
  on public.number_requests (number)
  where status = 'pending';

alter table public.number_requests enable row level security;

-- Solo el admin ve y resuelve las solicitudes (los teléfonos nunca son públicos)
drop policy if exists "admin lee solicitudes" on public.number_requests;
create policy "admin lee solicitudes" on public.number_requests
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'diegoassia@gmail.com');

drop policy if exists "admin actualiza solicitudes" on public.number_requests;
create policy "admin actualiza solicitudes" on public.number_requests
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'diegoassia@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'diegoassia@gmail.com');

revoke all on public.number_requests from anon;

-- Única puerta de entrada para el público: valida y crea la solicitud.
-- Al ser security definer, quien la llama NO obtiene acceso a la tabla.
create or replace function public.request_number(
  p_number int,
  p_name text,
  p_phone text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_number is null or p_number < 0 or p_number > 99 then
    raise exception 'Número inválido';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Escribe tu nombre';
  end if;
  -- el teléfono es obligatorio: sin él no hay forma de confirmar
  if p_phone is null or length(regexp_replace(p_phone, '\D', '', 'g')) < 7 then
    raise exception 'Escribe un teléfono válido';
  end if;
  if exists (
    select 1 from raffle_numbers
    where number = p_number and status <> 'available'
  ) then
    raise exception 'Ese número ya está vendido';
  end if;
  if exists (
    select 1 from number_requests
    where number = p_number and status = 'pending'
  ) then
    raise exception 'Ese número ya tiene una solicitud pendiente';
  end if;

  insert into number_requests (number, name, phone)
  values (p_number, trim(p_name), trim(p_phone));
end;
$$;

grant execute on function public.request_number(int, text, text) to anon, authenticated;

-- El tablero público ahora marca como 'pending' los números solicitados,
-- para que nadie más los elija. Sigue sin exponer nombres ni teléfonos.
create or replace view public.public_board
  with (security_invoker = false) as
  select
    n.number,
    case
      when n.status <> 'available' then n.status
      when r.id is not null then 'pending'
      else 'available'
    end as status
  from public.raffle_numbers n
  left join public.number_requests r
    on r.number = n.number and r.status = 'pending';

grant select on public.public_board to anon, authenticated;
