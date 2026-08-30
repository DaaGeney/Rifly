import { useMemo, useState } from 'react'
import type { HistoryEntry } from '../lib/store'
import type { RaffleNumber } from '../lib/types'
import {
  pad2,
  formatDateTime,
  normalize,
  formatCOP,
  otherSeller,
  TICKET_PRICE,
} from '../lib/types'

type Kind = 'paid' | 'reserved' | 'released' | 'edit'

interface Move {
  kind: Kind
  title: string
  detail?: string
}

/** Traduce una fila del historial a lenguaje humano. */
function describe(h: HistoryEntry): Move {
  const nuevo = h.new_buyer?.trim() || 'Alguien'
  const viejo = h.old_buyer?.trim()

  // El trigger también dispara al cambiar "vendido por", pero la tabla solo
  // guarda estado y comprador: esas filas se ven idénticas y hay que nombrarlas.
  if (h.old_status === h.new_status && h.old_buyer === h.new_buyer) {
    return { kind: 'edit', title: 'Datos actualizados', detail: viejo || undefined }
  }
  if (h.new_status === 'available') {
    return {
      kind: 'released',
      title: 'Liberado',
      detail: viejo ? `Estaba a nombre de ${viejo}` : undefined,
    }
  }
  // Si el número cambió de dueño, eso pesa más que el cambio de estado
  const cambioDeDueno = viejo && viejo !== h.new_buyer?.trim() ? `Antes: ${viejo}` : undefined

  if (h.new_status === 'paid') {
    return {
      kind: 'paid',
      title: `${nuevo} pagó`,
      detail:
        cambioDeDueno ??
        (h.old_status === 'reserved' ? 'Antes estaba apartado' : 'Venta directa'),
    }
  }
  if (h.new_status === 'reserved') {
    return h.old_status === 'paid'
      ? {
          kind: 'reserved',
          title: `Volvió a apartado — ${nuevo}`,
          detail: cambioDeDueno ?? 'Antes estaba pagado',
        }
      : { kind: 'reserved', title: `${nuevo} apartó`, detail: cambioDeDueno }
  }
  return {
    kind: 'edit',
    title: viejo ? `Cambió de ${viejo} a ${nuevo}` : `Ahora a nombre de ${nuevo}`,
  }
}

// Clases literales: Tailwind no puede resolverlas si se interpolan
const STYLE: Record<Kind, { icon: string; chip: string; bar: string }> = {
  paid: { icon: '💰', chip: 'bg-plum text-cream', bar: 'bg-plum' },
  reserved: { icon: '🤝', chip: 'bg-tangerine text-plum-dark', bar: 'bg-tangerine' },
  released: { icon: '↩️', chip: 'bg-blush text-cream', bar: 'bg-blush' },
  edit: { icon: '✏️', chip: 'bg-cream-dark text-plum', bar: 'bg-plum/25' },
}

/** Los estados del tablero, para la pestaña «Ahora». */
type Estado = 'reserved' | 'paid' | 'available'

const ESTADOS: { key: Estado; label: string }[] = [
  { key: 'reserved', label: 'Apartados' },
  { key: 'paid', label: 'Pagados' },
  { key: 'available', label: 'Libres' },
]

interface Props {
  entries: HistoryEntry[]
  /** El tablero actual: la pestaña «Ahora» sale de aquí, no del historial. */
  numbers: RaffleNumber[]
  loading: boolean
  error: boolean
  onClose: () => void
  onSelectNumber: (n: number) => void
}

export default function HistoryModal({
  entries,
  numbers,
  loading,
  error,
  onClose,
  onSelectNumber,
}: Props) {
  // Abre en «Ahora»: preguntarse quién debe es más frecuente que revisar
  // el historial, y era justo lo que el filtro viejo no sabía responder.
  const [tab, setTab] = useState<'ahora' | 'historial'>('ahora')
  const [estado, setEstado] = useState<Estado>('reserved')
  const [q, setQ] = useState('')

  const cuenta = useMemo(
    () => ({
      reserved: numbers.filter((n) => n.status === 'reserved').length,
      paid: numbers.filter((n) => n.status === 'paid').length,
      available: numbers.filter((n) => n.status === 'available').length,
    }),
    [numbers]
  )

  const enEstado = useMemo(
    () => numbers.filter((n) => n.status === estado),
    [numbers, estado]
  )

  // El historial vuelve a ser una lista plana: solo se acota por texto
  const rows = useMemo(() => {
    const nq = normalize(q)
    return entries
      .map((h) => ({ h, move: describe(h) }))
      .filter(({ h }) => {
        if (!nq) return true
        const porNumero =
          String(h.number).includes(nq) || pad2(h.number).includes(nq)
        const porNombre =
          normalize(h.new_buyer ?? '').includes(nq) ||
          normalize(h.old_buyer ?? '').includes(nq)
        return porNumero || porNombre
      })
  }, [entries, q])

  const abrir = (n: number) => {
    onSelectNumber(n)
    onClose()
  }

  return (
    <div
      data-modal
      className="fixed inset-0 bg-ink/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="movimientos-titulo"
        className="bg-cream w-full h-svh sm:h-auto sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl sm:shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-plum/15">
          <h2 id="movimientos-titulo" className="text-lg font-black text-plum">
            🕘 Movimientos
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg px-2 py-1 text-2xl leading-none text-plum-light hover:text-plum"
          >
            ×
          </button>
        </header>

        {/* Dos cosas distintas que antes se mezclaban: cómo está el tablero
            hoy, y qué se ha ido haciendo con él. */}
        <div className="shrink-0 grid grid-cols-2 border-b border-plum/15">
          {(
            [
              ['ahora', 'Estado'],
              ['historial', 'Historial'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`py-2.5 text-sm font-bold border-b-2 -mb-px transition ${
                tab === key
                  ? 'border-plum text-plum'
                  : 'border-transparent text-plum-light hover:text-plum'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'ahora' ? (
          <div className="shrink-0 px-4 py-3 border-b border-plum/10">
            <div className="flex gap-1.5">
              {ESTADOS.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => setEstado(e.key)}
                  className={`flex-1 rounded-full px-1 py-1.5 text-[13px] font-semibold whitespace-nowrap ${
                    estado === e.key
                      ? 'bg-plum text-cream'
                      : 'bg-white text-plum border border-plum/20 hover:bg-cream-dark'
                  }`}
                >
                  {e.label} ({cuenta[e.key]})
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="shrink-0 px-4 py-3 border-b border-plum/10">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre o número…"
                inputMode="search"
                className="w-full rounded-xl border border-plum/25 bg-white px-3 py-2 pr-9 outline-none focus:border-plum"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-plum-light hover:text-plum px-1 text-lg"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'ahora' && (
          <>
            {estado === 'available' ? (
              <div className="flex-1 overflow-y-auto overscroll-contain bg-white p-3">
                {enEstado.length === 0 ? (
                  <p className="py-6 text-center text-sm text-plum-light">
                    ¡No queda ninguno libre!
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {enEstado.map((n) => (
                      <button
                        key={n.number}
                        type="button"
                        onClick={() => abrir(n.number)}
                        className="rounded-md border border-plum/30 bg-white px-2 py-1 text-sm font-bold text-plum hover:bg-cream"
                      >
                        {pad2(n.number)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto overscroll-contain divide-y divide-plum/10 bg-white">
                {enEstado.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-plum-light">
                    {estado === 'reserved'
                      ? 'Nadie te debe nada. 🎉'
                      : 'Todavía no hay números pagados.'}
                  </li>
                )}
                {enEstado.map((n) => (
                  <li key={n.number}>
                    <button
                      type="button"
                      onClick={() => abrir(n.number)}
                      className="w-full flex items-center gap-2.5 px-3 py-3 text-left hover:bg-cream"
                    >
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 font-bold text-sm ${
                          estado === 'paid'
                            ? 'bg-plum text-cream'
                            : 'bg-tangerine text-plum-dark'
                        }`}
                      >
                        {pad2(n.number)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">
                          {n.buyer_name ?? 'Sin nombre'}
                        </span>
                        {otherSeller(n.buyer_name, n.sold_by) && (
                          <span className="block truncate text-xs text-plum-light">
                            vende {n.sold_by}
                          </span>
                        )}
                      </span>
                      {estado === 'reserved' && (
                        <span className="shrink-0 text-xs font-bold text-tangerine">
                          debe
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="shrink-0 px-4 py-2.5 border-t border-plum/10 bg-cream/60 text-sm font-semibold text-plum">
              {enEstado.length} número{enEstado.length === 1 ? '' : 's'}
              {estado !== 'available' &&
                ` · ${formatCOP(enEstado.length * TICKET_PRICE)}`}
              {estado === 'reserved' && ' por cobrar'}
            </div>
          </>
        )}

        {tab === 'historial' && (

        <ul className="flex-1 overflow-y-auto overscroll-contain divide-y divide-plum/10 bg-white">
          {loading &&
            Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="px-3 py-3.5">
                <div className="h-4 w-2/3 rounded bg-cream-dark animate-pulse" />
              </li>
            ))}

          {!loading && error && (
            <li className="px-4 py-4 text-sm font-semibold text-red-800 bg-red-100">
              ⚠️ No se pudo cargar el historial. Desliza hacia abajo en el panel para
              reintentar.
            </li>
          )}

          {!loading && !error && entries.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-plum-light">
              Aún no hay cambios registrados.
            </li>
          )}

          {!loading && !error && entries.length > 0 && rows.length === 0 && (
            <li className="px-4 py-6 text-center">
              <p className="text-sm text-plum-light mb-3">
                Ningún movimiento coincide con «{q.trim()}».
              </p>
              <button
                type="button"
                onClick={() => setQ('')}
                className="border border-plum/30 text-plum font-semibold rounded-xl px-4 py-2 hover:bg-cream"
              >
                Ver todos
              </button>
            </li>
          )}

          {!loading &&
            !error &&
            rows.map(({ h, move }) => {
              const s = STYLE[move.kind]
              return (
                <li key={h.id} className="flex gap-2.5 px-3 py-3">
                  <span className={`w-1 shrink-0 rounded-full ${s.bar}`} />
                  <span
                    className={`shrink-0 h-fit rounded-md px-2 py-0.5 font-bold text-sm ${s.chip}`}
                  >
                    {pad2(h.number)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">
                      {s.icon} {move.title}
                    </p>
                    <p className="text-xs text-plum-light">
                      {move.detail ? `${move.detail} · ` : ''}
                      {formatDateTime(h.changed_at)}
                    </p>
                  </div>
                </li>
              )
            })}
        </ul>
        )}
      </div>
    </div>
  )
}
