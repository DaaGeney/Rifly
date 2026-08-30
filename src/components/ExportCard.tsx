import { forwardRef } from 'react'
import type { GridNumber } from './NumberGrid'
import {
  pad2,
  DRAW_DATE,
  PRIZE,
  TICKET_PRICE,
  CONTACT_LABEL,
  BREB_LABEL,
  formatCOP,
} from '../lib/types'

/**
 * Tarjeta con la estética del afiche para exportar como PNG.
 * Se renderiza fuera de pantalla con tamaño fijo (900px) para que
 * la imagen salga igual en cualquier dispositivo.
 */
const ExportCard = forwardRef<HTMLDivElement, { numbers: GridNumber[] }>(
  function ExportCard({ numbers }, ref) {
    const sold = numbers.filter((n) => n.status !== 'available').length
    return (
      <div
        ref={ref}
        style={{ width: 900, fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif" }}
        className="bg-cream p-10"
      >
        <div className="text-center mb-2">
          <span className="inline-block bg-plum text-cream text-2xl font-bold tracking-[0.3em] rounded-xl px-8 py-2 uppercase">
            Rifa Solidaria
          </span>
        </div>
        <h1 className="text-center text-6xl font-black text-ink tracking-tight mb-1">
          OREO Y PANDA 🐾
        </h1>
        <p className="text-center text-plum text-2xl font-semibold mb-6">
          Premio {formatCOP(PRIZE)} · Número {formatCOP(TICKET_PRICE)}
        </p>

        <div className="bg-white rounded-2xl border-2 border-plum/20 p-6 mb-6">
          <div className="grid grid-cols-10 gap-2">
            {numbers.map((n) => {
              const isSold = n.status !== 'available'
              return (
                <div
                  key={n.number}
                  className={`aspect-square rounded-lg flex items-center justify-center text-2xl font-bold border-2
                    ${isSold ? 'bg-plum text-cream border-plum' : 'bg-cream text-plum border-plum/30'}`}
                >
                  {pad2(n.number)}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-center gap-10 text-xl font-semibold text-ink mb-4">
          <span className="flex items-center gap-2">
            <span className="inline-block w-6 h-6 rounded-md bg-cream border-2 border-plum/40" />
            Disponible
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-6 h-6 rounded-md bg-plum" />
            Vendido
          </span>
          <span className="text-plum">{100 - sold} disponibles</span>
        </div>

        <p className="text-center text-plum-dark text-xl font-bold">{DRAW_DATE}</p>
        <p className="text-center text-ink text-xl font-bold mt-2">📲 {CONTACT_LABEL}</p>
        <p className="text-center text-plum text-xl font-bold mt-1">💸 {BREB_LABEL}</p>
        <p className="text-center text-blush text-lg font-semibold mt-1">
          ¡Gracias por ayudarnos a seguir a su lado! ♥
        </p>
      </div>
    )
  }
)

export default ExportCard
