import type { RaffleNumber, BoardStatus } from '../lib/types'
import { pad2 } from '../lib/types'

export type GridNumber = { number: number; status: BoardStatus } & Partial<
  Pick<RaffleNumber, 'buyer_name' | 'buyer_phone' | 'sold_by'>
>

interface Props {
  numbers: GridNumber[]
  onSelect?: (n: number) => void
  /** En vista pública, apartado y pagado se muestran igual (vendido). */
  publicView?: boolean
  highlight?: Set<number>
  /** Números marcados por el visitante antes de enviar la solicitud. */
  selected?: Set<number>
}

export default function NumberGrid({
  numbers,
  onSelect,
  publicView,
  highlight,
  selected,
}: Props) {
  return (
    <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
      {numbers.map((n) => {
        const pending = n.status === 'pending'
        const sold = n.status !== 'available' && !pending
        const isSelected = selected?.has(n.number)
        const cls = publicView
          ? sold
            ? 'bg-plum text-cream border-plum'
            : pending
              ? 'bg-blush/30 text-plum border-blush border-dashed'
              : isSelected
                ? 'bg-tangerine text-plum-dark border-tangerine ring-2 ring-plum scale-105'
                : 'bg-white text-plum border-plum/30'
          : n.status === 'paid'
            ? 'bg-plum text-cream border-plum'
            : n.status === 'reserved'
              ? 'bg-tangerine text-plum-dark border-tangerine'
              : 'bg-white text-plum border-plum/30'
        // En el tablero público solo se pueden pedir los números libres
        const clickable = onSelect && (!publicView || n.status === 'available')
        const searching = highlight && highlight.size > 0
        const dimmed = searching && !highlight.has(n.number)
        // El resultado no solo se queda encendido: se le marca el borde para
        // que salte a la vista entre los cien números
        const hit = searching && highlight.has(n.number)
        return (
          <button
            key={n.number}
            type="button"
            onClick={clickable ? () => onSelect!(n.number) : undefined}
            disabled={!clickable}
            title={
              publicView
                ? pending
                  ? 'Solicitado, pendiente de confirmar'
                  : undefined
                : n.buyer_name
                  ? n.buyer_name + (n.sold_by ? ` · vende ${n.sold_by}` : '')
                  : undefined
            }
            className={`aspect-square rounded-lg border text-sm sm:text-base font-bold flex items-center justify-center transition
              ${cls} ${dimmed ? 'opacity-20' : ''}
              ${hit ? 'ring-2 ring-ink ring-offset-2 ring-offset-cream scale-105 shadow-md' : ''}
              ${clickable ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'cursor-default'}`}
          >
            {pad2(n.number)}
          </button>
        )
      })}
    </div>
  )
}
