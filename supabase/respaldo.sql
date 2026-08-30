-- RESPALDO antes de ejecutar solicitudes.sql / notificaciones.sql
-- Copia los datos reales a tablas espejo dentro de la misma base.
-- Pegar completo en el SQL Editor y ejecutar. Se puede correr varias
-- veces (borra y rehace el respaldo del día).

drop table if exists public.respaldo_raffle_numbers;
drop table if exists public.respaldo_raffle_history;

create table public.respaldo_raffle_numbers as
  select *, now() as respaldado_en from public.raffle_numbers;

create table public.respaldo_raffle_history as
  select *, now() as respaldado_en from public.raffle_history;

-- Que los respaldos no queden expuestos por la API
alter table public.respaldo_raffle_numbers enable row level security;
alter table public.respaldo_raffle_history enable row level security;
revoke all on public.respaldo_raffle_numbers from anon, authenticated;
revoke all on public.respaldo_raffle_history from anon, authenticated;

-- Verificación: ambas cuentas deben coincidir con las tablas originales
select
  (select count(*) from public.raffle_numbers)          as numeros_original,
  (select count(*) from public.respaldo_raffle_numbers) as numeros_respaldo,
  (select count(*) from public.raffle_history)          as historial_original,
  (select count(*) from public.respaldo_raffle_history) as historial_respaldo;

-- ============================================================
-- RESTAURAR (solo si algo sale mal — NO ejecutar junto con lo de arriba):
--
--   update public.raffle_numbers n
--   set buyer_name = r.buyer_name,
--       buyer_phone = r.buyer_phone,
--       sold_by = r.sold_by,
--       status = r.status,
--       updated_at = r.updated_at
--   from public.respaldo_raffle_numbers r
--   where r.number = n.number;
--
-- Y para descartar el respaldo cuando ya no haga falta:
--
--   drop table public.respaldo_raffle_numbers;
--   drop table public.respaldo_raffle_history;
-- ============================================================
