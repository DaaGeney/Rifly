import type { RaffleNumber } from '../lib/types'
import { TICKET_PRICE, formatCOP } from '../lib/types'

interface Props {
  numbers: RaffleNumber[]
  /** Donaciones y pagos extra: entran al total aunque no vengan de un número. */
  extra?: number
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export default function StatsBar({ numbers, extra = 0 }: Props) {
  const total = numbers.length
  const paid = numbers.filter((n) => n.status === 'paid').length
  const reserved = numbers.filter((n) => n.status === 'reserved').length
  const sold = paid + reserved
  const free = total - sold

  const inTickets = paid * TICKET_PRICE
  const received = inTickets + extra
  const owed = reserved * TICKET_PRICE

  const pct = (n: number) => (total ? (n / total) * 100 : 0)

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-1 gap-2 sm:gap-3">
        {/* La plata que ya está en el bolsillo va sola y más grande: es el dato
            que más se consulta, y necesita espacio para desglosar los aportes. */}
        <Tile
          className="col-span-2 sm:col-span-1"
          label="Recibido"
          value={formatCOP(received)}
          accent="text-green-700"
        >
          {extra > 0 ? (
            <>
              {formatCOP(inTickets)} en boletas ·{' '}
              <span className="text-blush">♥ {formatCOP(extra)} en aportes</span>
            </>
          ) : (
            plural(paid, 'boleta pagada', 'boletas pagadas')
          )}
        </Tile>

        <Tile label="Me deben" value={formatCOP(owed)} accent="text-tangerine">
          {plural(reserved, 'boleta', 'boletas')} sin pagar
        </Tile>

        <Tile label="Total esperado" value={formatCOP(received + owed)} accent="text-plum">
          {plural(sold, 'vendida', 'vendidas')}
          {extra > 0 && ' + aportes'}
        </Tile>
      </div>

      <div className="mt-2 sm:mt-3 bg-white rounded-xl border border-plum/15 px-3 py-2.5 shadow-sm">
        <div className="flex h-2.5 rounded-full overflow-hidden bg-cream-dark mb-2">
          <div className="bg-plum transition-all" style={{ width: `${pct(paid)}%` }} />
          <div className="bg-tangerine transition-all" style={{ width: `${pct(reserved)}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-plum">
          <Legend color="bg-plum" label={`${paid} pagadas`} />
          <Legend color="bg-tangerine" label={`${reserved} deben`} />
          <Legend color="bg-cream-dark" label={`${free} libres`} />
        </div>
      </div>
    </div>
  )
}

function Tile({
  label,
  value,
  accent,
  className = '',
  children,
}: {
  label: string
  value: string
  accent: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={`flex flex-col bg-white rounded-xl border border-plum/15 px-3 py-2.5 shadow-sm ${className}`}
    >
      <div className="text-xs uppercase tracking-wide text-plum-light font-semibold">
        {label}
      </div>
      <div className={`text-lg sm:text-xl font-bold ${accent}`}>{value}</div>
      {children && (
        <div className="mt-auto pt-0.5 text-[11px] leading-tight text-plum-light font-semibold">
          {children}
        </div>
      )}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}
