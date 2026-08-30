# Rifa Oreo y Panda 🐾

App para llevar el control de la rifa solidaria: quién tiene cada número (00–99),
quién pagó y quién debe, con tablero público para compartir y exportación de
imagen estilo afiche.

También lleva los **aportes**: la plata que entra por fuera del precio del número,
sea una donación de quien no quiere boleta o lo que alguien paga de más. Todo se
suma a «Recibido» y al «Total esperado», así que el resumen de arriba siempre
cuadra con lo que hay en el bolsillo.

## Correr en local

```bash
npm install
npm run dev
```

Sin configurar nada corre en **modo demo** (datos guardados en el navegador),
perfecto para probar. Rutas:

- `/` — panel de administración
- `/tablero` — tablero público (solo disponible/vendido, sin nombres)

## Conectar Supabase (datos en la nube + login)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. Copia `.env.example` a `.env` y llena `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API), más `DATABASE_URL`
   (Project Settings → Database → Connection string → URI).
3. Crea las tablas: `npm run migrate` (ver [Migraciones](#migraciones)).
4. Crea tu usuario admin: **Authentication → Users → Add user**, con el correo
   `diegoassia@gmail.com` y una contraseña (marca "Auto confirm user").
5. Desactiva el registro de extraños: **Authentication → Sign In / Up →
   Allow new users to sign up → OFF**.
6. Reinicia `npm run dev`.

Solo el email `diegoassia@gmail.com` puede administrar (definido en las
políticas de las migraciones y en `src/lib/supabase.ts`); aunque alguien
creara otra cuenta, RLS le bloquea lecturas y escrituras.

## Migraciones

El esquema vive en [`supabase/migrations/`](supabase/migrations), numerado y en
orden. Cada archivo se aplica **una sola vez** y queda anotado en la tabla
`schema_migrations`; cada uno corre dentro de una transacción, así que si falla
a la mitad la base queda como estaba antes de empezarlo.

```bash
npm run migrate          # aplica lo que falte
npm run migrate:status   # qué hay aplicado y qué falta (no toca nada)
```

Necesitan `DATABASE_URL`. **Sin esa variable el comando no hace nada y termina
bien**, para que un `npm run build` local nunca intente tocar una base.

> En Supabase (Project Settings → Database → Connection string) usa la **URI
> directa o el _Session pooler_, puerto 5432**. El _Transaction pooler_ (6543)
> no sirve aquí: reparte cada consulta por una conexión distinta y rompe el
> candado que evita que dos despliegues se pisen.

### Saber qué migraciones ya corriste

Pega esto en el **SQL Editor** de Supabase. Solo consulta, no cambia nada:

```sql
select
  to_regclass('public.raffle_numbers')  is not null as "0001_esquema_base",
  to_regclass('public.number_requests') is not null as "0002_solicitudes",
  exists (select 1 from pg_trigger
          where tgname = 'number_requests_notify')  as "0003_notificaciones",
  to_regclass('public.donations')       is not null as "0004_aportes";
```

La última que salga en `true` es tu `--upto`.

### Si tu base ya existía (creada a mano en el SQL Editor)

Hay que decirle al sistema qué migraciones ya corriste, para que no las vuelva a
ejecutar. Mientras no lo hagas, `npm run migrate` **se niega a tocar la base** y
te lo advierte.

```bash
npm run migrate:baseline -- --upto=0003_notificaciones
```

Eso las marca como aplicadas **sin ejecutar nada**. Después, `npm run migrate`
aplica solo lo que de verdad falta (hoy: `0004_aportes`).

Ajusta el `--upto` a lo último que hayas corrido: `0001_esquema_base` (el
tablero), `0002_solicitudes` (solicitudes públicas) o `0003_notificaciones`
(avisos por ntfy).

### Al desplegar

`npm run build` ejecuta las migraciones antes de compilar (script `prebuild`).
Para que corran en el despliegue, define `DATABASE_URL` en el hosting.

> **Importante:** defínela solo en el entorno de **producción**. Si la pones
> también en los *preview* de Vercel, cada rama que subas migraría la base real.

## Deploy en Vercel

1. Sube el proyecto a un repo de GitHub y conéctalo en [vercel.com](https://vercel.com)
   (framework: Vite), o usa `npx vercel` desde la terminal.
2. Agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Agrega `DATABASE_URL`
   solo si quieres que el deploy migre la base (ver arriba).
3. El link público para compartir será `https://tu-app.vercel.app/tablero`.

> Nota: para que `/tablero` funcione al entrar directo, Vercel ya reescribe las
> rutas de SPA automáticamente con la config de [`vercel.json`](vercel.json).
