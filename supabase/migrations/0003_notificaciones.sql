-- Notificación push (vía ntfy.sh) cada vez que alguien solicita un número.
-- Requiere tener la app ntfy en el celular, suscrito al tema de abajo.
-- Equivale al antiguo supabase/notificaciones.sql.
--
-- El tema funciona como contraseña: quien lo conozca puede leer estas
-- notificaciones. Por eso lleva un sufijo aleatorio y el mensaje no
-- incluye el teléfono del solicitante (ese se ve solo en tu panel).
-- Tema: rifa-oreo-panda-831650f6

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_request()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://ntfy.sh',
    body := jsonb_build_object(
      'topic', 'rifa-oreo-panda-831650f6',
      'title', 'Nueva solicitud en la rifa 🐾',
      'message', new.name || ' pidió el número ' || lpad(new.number::text, 2, '0'),
      'priority', 4,
      'tags', jsonb_build_array('raised_hand'),
      'click', 'https://pandaoreo.netlify.app'
    )
  );
  return new;
end;
$$;

drop trigger if exists number_requests_notify on public.number_requests;
create trigger number_requests_notify
  after insert on public.number_requests
  for each row
  execute function public.notify_new_request();
