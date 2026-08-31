-- Actualiza el trigger de notificaciones (0003) al nuevo nombre y dominio
-- de la app: Rifa Pro Fondos, https://dtohe.netlify.app
--
-- Nuevo tema (memoriza esto, reemplaza al de 0003):
-- Tema: rifa-pro-fondos-e439306b

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
      'topic', 'rifa-pro-fondos-e439306b',
      'title', 'Nueva solicitud en la rifa 💰',
      'message', new.name || ' pidió el número ' || lpad(new.number::text, 2, '0'),
      'priority', 4,
      'tags', jsonb_build_array('raised_hand'),
      'click', 'https://dtohe.netlify.app'
    )
  );
  return new;
end;
$$;
