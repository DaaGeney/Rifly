import { useEffect, useRef, useState } from 'react'
import { fetchPublicBoard } from '../lib/store'
import { shareCardPng } from '../lib/exportImage'
import type { GridNumber } from '../components/NumberGrid'
import NumberGrid from '../components/NumberGrid'
import ExportCard from '../components/ExportCard'
import RequestModal from '../components/RequestModal'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import {
  DRAW_DATE,
  PRIZE,
  TICKET_PRICE,
  CONTACT_LABEL,
  BREB_LABEL,
  formatCOP,
  pad2,
} from '../lib/types'

const REFRESH_MS = 30_000

export default function PublicBoard() {
  const [numbers, setNumbers] = useState<GridNumber[]>([])
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  // Lista congelada al abrir el formulario: la selección puede auto-limpiarse
  // cuando el tablero se refresca, pero el modal debe seguir abierto
  const [requesting, setRequesting] = useState<number[] | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const reload = () => fetchPublicBoard().then(setNumbers).catch(() => {})

  const toggle = (n: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  // Si un número marcado deja de estar libre (lo tomó alguien más
  // o llegó un refresco), se quita solo de la selección
  useEffect(() => {
    if (numbers.length === 0) return
    setSelected((prev) => {
      const next = new Set(
        [...prev].filter((n) => numbers[n]?.status === 'available')
      )
      return next.size === prev.size ? prev : next
    })
  }, [numbers])

  const downloadImage = async () => {
    if (!exportRef.current) return
    setExporting(true)
    try {
      await shareCardPng(exportRef.current)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const load = () => fetchPublicBoard().then(setNumbers).catch(() => {})
    load()
    const interval = setInterval(load, REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const { pulling, refreshing } = usePullToRefresh(reload)

  const available = numbers.filter((n) => n.status === 'available').length

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6">
      <PullToRefreshIndicator pulling={pulling} refreshing={refreshing} />
      <div className="text-center mb-5">
        <span className="inline-block bg-plum text-cream text-sm sm:text-base font-bold tracking-[0.25em] rounded-lg px-4 py-1 uppercase mb-2">
          Rifa Solidaria
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-ink tracking-tight">
          OREO Y PANDA 🐾
        </h1>
        <p className="text-plum font-semibold mt-1">
          Premio {formatCOP(PRIZE)} · Número {formatCOP(TICKET_PRICE)}
        </p>
      </div>

      <p className="text-center text-plum font-semibold mb-2">
        👇 Toca los números libres que quieras apartar
      </p>

      <div className="bg-white rounded-2xl border-2 border-plum/15 p-3 sm:p-5 shadow-sm">
        <NumberGrid numbers={numbers} publicView onSelect={toggle} selected={selected} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-sm font-semibold text-plum mt-3">
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-white border border-plum/30" /> Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded border border-dashed border-blush bg-blush/30" />{' '}
          Solicitado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-plum" /> Vendido
        </span>
        {numbers.length > 0 && <span>{available} disponibles</span>}
      </div>

      <button
        type="button"
        onClick={downloadImage}
        disabled={exporting || numbers.length === 0}
        className="block mx-auto mt-5 bg-plum text-cream font-bold rounded-xl px-6 py-3 hover:brightness-110 disabled:opacity-50"
      >
        {exporting ? 'Generando…' : '📲 Compartir números'}
      </button>

      <p className="text-center text-plum-dark font-bold mt-5">{DRAW_DATE}</p>
      <p className="text-center text-ink font-bold mt-2">📲 {CONTACT_LABEL}</p>
      <p className="text-center text-plum font-bold mt-1">💸 {BREB_LABEL}</p>
      <p className="text-center text-blush font-semibold mt-1">
        Escríbeme para apartar tu número · ¡Gracias por tu apoyo! ♥
      </p>

      {/* Barra flotante con la selección lista para enviar */}
      {selected.size > 0 && requesting === null && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto bg-plum text-cream rounded-2xl shadow-xl flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold truncate">
                {[...selected].sort((a, b) => a - b).map((n) => pad2(n)).join(' · ')}
              </p>
              <p className="text-sm text-cream/80">
                {selected.size} número{selected.size === 1 ? '' : 's'} ·{' '}
                {formatCOP(selected.size * TICKET_PRICE)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="shrink-0 text-cream/80 hover:text-cream font-bold px-2 py-1"
              aria-label="Limpiar selección"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => setRequesting([...selected].sort((a, b) => a - b))}
              className="shrink-0 bg-tangerine text-plum-dark font-bold rounded-xl px-4 py-2.5 hover:brightness-105"
            >
              Apartar
            </button>
          </div>
        </div>
      )}

      {requesting !== null && (
        <RequestModal
          numbers={requesting}
          onClose={() => setRequesting(null)}
          onDone={reload}
        />
      )}

      {/* Tarjeta off-screen para la exportación PNG */}
      <div className="fixed -left-[3000px] top-0" aria-hidden="true">
        <ExportCard ref={exportRef} numbers={numbers} />
      </div>
    </div>
  )
}
