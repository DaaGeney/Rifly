#!/usr/bin/env node
/**
 * Migraciones de la base de datos.
 *
 *   npm run migrate            aplica lo que falte
 *   npm run migrate:status     muestra qué hay aplicado y qué falta (no toca nada)
 *   npm run migrate:baseline -- --upto=0003_notificaciones
 *                              marca como aplicadas las migraciones que ya
 *                              corriste a mano, SIN ejecutarlas
 *
 * Se conecta con DATABASE_URL. Si no está definida no hace nada y termina
 * bien, para que un build local o un entorno sin credenciales no falle.
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = process.env.MIGRATIONS_DIR ?? join(ROOT, 'supabase', 'migrations')
// Fijo y arbitrario: si dos despliegues coinciden, el segundo espera al primero
const LOCK_KEY = 427199301

const args = process.argv.slice(2)
const command = args.find((a) => !a.startsWith('--')) ?? 'up'
const flag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}

const log = (msg = '') => console.log(msg)
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  log('· Migraciones: sin DATABASE_URL, no hay base que actualizar. Se continúa.')
  process.exit(0)
}

let pg
try {
  pg = (await import('pg')).default
} catch {
  fail('Falta la dependencia "pg". Ejecuta: npm install')
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url)
const client = new pg.Client({
  connectionString: url,
  // Supabase exige TLS. Se verifica el certificado salvo que se pida lo
  // contrario, que hace falta con algunos poolers de certificado propio.
  ssl: isLocal ? false : process.env.DATABASE_SSL_NO_VERIFY === '1'
    ? { rejectUnauthorized: false }
    : true,
})

const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort()
const versions = files.map((f) => f.replace(/\.sql$/, ''))
if (versions.length === 0) fail(`No hay migraciones en ${DIR}`)

try {
  await client.connect()
} catch (e) {
  fail(
    `No se pudo conectar a la base: ${e.message}\n` +
      '  Revisa DATABASE_URL. Si el error es de certificado, prueba con DATABASE_SSL_NO_VERIFY=1.'
  )
}

try {
  await client.query('select pg_advisory_lock($1)', [LOCK_KEY])

  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const { rows } = await client.query('select version from public.schema_migrations')
  const applied = new Set(rows.map((r) => r.version))
  const pending = versions.filter((v) => !applied.has(v))

  // Una base que ya tiene el tablero pero ningún registro de migraciones es la
  // que se creó a mano. Aplicarle la migración base podría pisarle cosas, así
  // que se para en seco y se pide marcarla primero.
  const { rows: [check] } = await client.query(
    "select to_regclass('public.raffle_numbers') is not null as existe"
  )
  const sinRegistrar = applied.size === 0 && check.existe

  if (command === 'status') {
    log(`\nMigraciones en ${DIR}\n`)
    for (const v of versions) log(`  ${applied.has(v) ? '✓ aplicada ' : '· pendiente'}  ${v}`)
    log(`\n  ${applied.size} aplicadas · ${pending.length} pendientes`)
    if (sinRegistrar)
      log('\n  ⚠ Esta base ya tiene el tablero pero no está registrada.\n' +
          '    Márcala primero con: npm run migrate:baseline -- --upto=<versión>')
    log()
  } else if (command === 'baseline') {
    const upto = flag('upto')
    if (!upto)
      fail(
        'Falta --upto=<versión>: hasta dónde ya corriste a mano.\n' +
          `  Versiones: ${versions.join(', ')}\n` +
          '  Ejemplo: npm run migrate:baseline -- --upto=0003_notificaciones'
      )
    const corte = versions.indexOf(upto)
    if (corte < 0) fail(`No existe la migración "${upto}". Versiones: ${versions.join(', ')}`)

    const marcar = versions.slice(0, corte + 1)
    log(`\nMarcando como aplicadas (sin ejecutar nada):\n`)
    for (const v of marcar) {
      await client.query(
        'insert into public.schema_migrations (version) values ($1) on conflict do nothing',
        [v]
      )
      log(`  ✓ ${v}`)
    }
    const quedan = versions.slice(corte + 1)
    log(
      quedan.length
        ? `\n  Quedan pendientes: ${quedan.join(', ')}\n  Aplícalas con: npm run migrate\n`
        : '\n  No queda ninguna pendiente.\n'
    )
  } else if (command === 'up') {
    if (sinRegistrar)
      fail(
        'Esta base ya tiene el tablero creado pero no está registrada en el\n' +
          '  sistema de migraciones, así que NO se va a tocar.\n\n' +
          '  Marca primero lo que ya corriste a mano:\n' +
          '    npm run migrate:baseline -- --upto=<versión>\n\n' +
          `  Versiones: ${versions.join(', ')}`
      )

    if (pending.length === 0) {
      log('· Migraciones: la base ya está al día.')
    } else {
      log(`\nAplicando ${pending.length} migración(es):\n`)
      for (const version of pending) {
        const sql = await readFile(join(DIR, `${version}.sql`), 'utf8')
        await client.query('begin')
        try {
          await client.query(sql)
          await client.query('insert into public.schema_migrations (version) values ($1)', [
            version,
          ])
          await client.query('commit')
          log(`  ✓ ${version}`)
        } catch (e) {
          await client.query('rollback')
          fail(
            `La migración ${version} falló y se revirtió completa (la base quedó\n` +
              `  como estaba antes de empezarla):\n\n  ${e.message}`
          )
        }
      }
      log('\n  Base al día.\n')
    }
  } else {
    fail(`Comando desconocido "${command}". Usa: up | status | baseline`)
  }
} finally {
  await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {})
  await client.end().catch(() => {})
}
