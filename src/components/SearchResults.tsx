import type { RaffleNumber } from '../lib/types'
import { pad2, formatCOP, TICKET_PRICE, sumDonations } from '../lib/types'
import type { PersonHit } from '../lib/search'

interface Props {
  query: string
  people: PersonHit[]
  /** Nombres parecidos, para cuando la búsqueda no encontró nada. */
  suggestions: string[]
  onSelectNumber: (n: number) => void
  onPickSuggestion: (name: string) => void
}

/**
 * Lo que encontró la búsqueda, explicado: quién es, cuáles números tiene,
 * cuánto pagó y cuánto debe. Se ve también en celular, donde la lista
 * lateral de compradores no cabe.
 */
export default function SearchResults({
  query,
  people,
  suggestions,
  onSelectNumber,
  onPickSuggestion,
}: Props) {
  if (!query.trim()) return null

  if (people.length === 0) {
    return (
      <div className="rounded-xl border border-plum/20 bg-white px-4 py-4 text-center mb-4">
        <p className="text-plum font-semibold">
          No encontré a nadie con «{query.trim()}».
        </p>
        {suggestions.length > 0 && (
          <>
            <p className="text-sm text-plum-light mt-2 mb-2">¿Quisiste decir…?</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onPickSuggestion(name)}
                  className="rounded-full border border-plum/30 bg-cream px-3 py-1.5 text-sm font-bold text-plum hover:bg-white"
                >
                  {name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // Un número que alguien tiene y otro vendió sale en dos tarjetas, pero en el
  // resumen se cuenta una sola vez.
  const found = new Map<number, RaffleNumber>()
  for (const p of people) for (const n of [...p.owned, ...p.soldByThem]) found.set(n.number, n)
  const matched = [...found.values()]
  const paid = matched.filter((n) => n.status === 'paid').length
  const reserved = matched.filter((n) => n.status === 'reserved').length

  const summary = [
    paid > 0 && `${paid} pagado${paid === 1 ? '' : 's'} · ${formatCOP(paid * TICKET_PRICE)} recibido`,
    reserved > 0 && `${reserved} sin pagar`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="rounded-xl border border-plum/20 bg-white overflow-hidden mb-4">
      <div className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-plum text-cream text-sm font-bold">
        <span>
          {people.length} persona{people.length === 1 ? '' : 's'}
        </span>
        {matched.length > 0 && (
          <span className="font-semibold text-cream/80">
            · {matched.length} número{matched.length === 1 ? '' : 's'}
          </span>
        )}
        {reserved > 0 && (
          <span className="ml-auto font-semibold text-tangerine">
            sin pagar {formatCOP(reserved * TICKET_PRICE)}
          </span>
        )}
      </div>

      <div className="divide-y divide-plum/10 max-h-[60vh] overflow-y-auto">
        {people.map((p) => (
          <PersonCard key={p.key} person={p} onSelectNumber={onSelectNumber} />
        ))}
      </div>

      {summary && (
        <div className="px-3 py-2 bg-cream/60 text-xs font-semibold text-plum-light">
          {summary}
        </div>
      )}
    </div>
  )
}

function PersonCard({
  person,
  onSelectNumber,
}: {
  person: PersonHit
  onSelectNumber: (n: number) => void
}) {
  const debt = person.owned.filter((n) => n.status === 'reserved').length
  const aportes = sumDonations(person.donations)

  return (
    <div className="px-3 py-3">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="min-w-0 flex-1 font-bold text-ink truncate">{person.name}</span>
        {person.phone && (
          <span className="shrink-0 text-xs text-plum-light">{person.phone}</span>
        )}
      </div>

      {person.owned.length > 0 && (
        <Section
          label={`Sus números (${person.owned.length})`}
          numbers={person.owned}
          onSelectNumber={onSelectNumber}
        />
      )}

      {person.soldByThem.length > 0 && (
        <Section
          label={`Vendió (${person.soldByThem.length})`}
          numbers={person.soldByThem}
          onSelectNumber={onSelectNumber}
        />
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs font-semibold">
        {debt > 0 ? (
          <span className="text-tangerine">
            Debe {formatCOP(debt * TICKET_PRICE)}
          </span>
        ) : (
          person.owned.length > 0 && <span className="text-green-700">Está al día</span>
        )}
        {aportes > 0 && (
          <span className="text-blush">♥ Aportó {formatCOP(aportes)}</span>
        )}
        {person.owned.length === 0 && person.soldByThem.length === 0 && aportes > 0 && (
          <span className="text-plum-light">Sin números, solo aportes</span>
        )}
      </div>
    </div>
  )
}

function Section({
  label,
  numbers,
  onSelectNumber,
}: {
  label: string
  numbers: RaffleNumber[]
  onSelectNumber: (n: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-1">
      <span className="text-xs font-semibold text-plum-light mr-0.5">{label}</span>
      {[...numbers]
        .sort((a, b) => a.number - b.number)
        .map((n) => (
          <button
            key={n.number}
            type="button"
            onClick={() => onSelectNumber(n.number)}
            title={n.status === 'paid' ? 'Pagado' : 'Apartado (debe)'}
            className={`rounded-md px-2 py-0.5 text-sm font-bold hover:brightness-110 ${
              n.status === 'paid'
                ? 'bg-plum text-cream'
                : 'bg-tangerine text-plum-dark'
            }`}
          >
            {pad2(n.number)}
          </button>
        ))}
    </div>
  )
}
