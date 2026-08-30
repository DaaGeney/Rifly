import type { RaffleNumber } from '../lib/types'
import { pad2, otherSeller } from '../lib/types'

interface Props {
  numbers: RaffleNumber[]
  onSelect: (n: number) => void
  highlight?: Set<number>
}

/**
 * Listado de números vendidos con su comprador. Solo se muestra en
 * pantallas grandes (tablet/escritorio); en celular no cabe sin apretar.
 */
export default function BuyersList({ numbers, onSelect, highlight }: Props) {
  const sold = numbers.filter((n) => n.status !== 'available')

  return (
    <aside className="hidden lg:block">
      <div className="bg-white rounded-xl border border-plum/15 overflow-hidden">
        <div className="px-3 py-2 bg-plum text-cream font-bold text-sm">
          Compradores ({sold.length})
        </div>
        <div className="max-h-[65vh] overflow-y-auto divide-y divide-plum/10">
          {sold.length === 0 && (
            <p className="px-3 py-4 text-sm text-plum-light">Aún no hay números vendidos.</p>
          )}
          {sold.map((n) => {
            const dimmed = highlight && highlight.size > 0 && !highlight.has(n.number)
            return (
              <button
                key={n.number}
                type="button"
                onClick={() => onSelect(n.number)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-cream transition ${
                  dimmed ? 'opacity-30' : ''
                }`}
              >
                <span
                  className={`shrink-0 w-8 text-center rounded-md py-0.5 text-sm font-bold ${
                    n.status === 'paid'
                      ? 'bg-plum text-cream'
                      : 'bg-tangerine text-plum-dark'
                  }`}
                >
                  {pad2(n.number)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink text-sm">
                    {n.buyer_name}
                  </span>
                  {otherSeller(n.buyer_name, n.sold_by) && (
                    <span className="block truncate text-xs text-plum-light">
                      vende {n.sold_by}
                    </span>
                  )}
                </span>
                {n.status === 'reserved' && (
                  <span className="shrink-0 text-xs font-bold text-tangerine">debe</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
