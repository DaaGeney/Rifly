import { useState } from 'react'
import type { Donation } from '../lib/types'
import {
  pad2,
  formatCOP,
  formatDate,
  normalize,
  thanksLink,
  DONATION_LABEL,
  sumDonations,
} from '../lib/types'
import WhatsAppIcon from './WhatsAppIcon'

interface Props {
  donations: Donation[]
  onAdd: () => void
  onEdit: (donation: Donation) => void
}

/** Cuántos aportes se ven antes de tener que desplegar la lista. */
const PREVIEW = 4

/**
 * Plata que entra por fuera de los números: donaciones de quien no quiere
 * boleta y lo que la gente paga de más. Se suma al total recibido.
 */
export default function DonationsPanel({ donations, onAdd, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false)

  const total = sumDonations(donations)
  const people = new Set(donations.map((d) => normalize(d.name))).size
  const visible = expanded ? donations : donations.slice(0, PREVIEW)

  return (
    <section className="rounded-2xl border border-blush/40 bg-white overflow-hidden shadow-sm">
      {/* El título va solo en su línea: en la columna lateral no cabe al lado
          del total, y partido en dos se lee mal. */}
      <header className="px-3 py-3 bg-gradient-to-r from-blush/25 to-blush/5">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-blush text-white text-lg shadow-sm">
            ♥
          </span>
          <h2 className="min-w-0 font-bold text-plum-dark leading-tight text-sm truncate">
            Aportes y donaciones
          </h2>
        </div>
        <div className="flex items-end justify-between gap-2 mt-1 pl-[2.9rem]">
          <p className="min-w-0 truncate text-xs text-plum-light">
            {donations.length === 0
              ? 'Lo que entra sin número'
              : `${donations.length} aporte${donations.length === 1 ? '' : 's'} · ${people} persona${
                  people === 1 ? '' : 's'
                }`}
          </p>
          <span className="shrink-0 text-lg font-black text-plum leading-none">
            {formatCOP(total)}
          </span>
        </div>
      </header>

      {donations.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-sm text-plum-light mb-3">
            Aquí llevas la cuenta de quien te dona sin llevar boleta o te paga de más.
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="bg-blush text-white font-bold rounded-xl px-5 py-2.5 hover:brightness-105"
          >
            + Registrar aporte
          </button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-blush/20">
            {visible.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2.5 px-3 hover:bg-blush/5 transition"
              >
                <button
                  type="button"
                  onClick={() => onEdit(d)}
                  className="min-w-0 flex-1 flex items-center gap-2.5 py-2.5 text-left"
                >
                  <span
                    className={`grid place-items-center w-8 h-8 shrink-0 rounded-full text-sm font-black ${
                      d.kind === 'donation'
                        ? 'bg-blush/25 text-blush'
                        : 'bg-tangerine/25 text-tangerine'
                    }`}
                  >
                    {d.name.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink text-sm">
                      {d.name}
                    </span>
                    {/* Corto a propósito: en la columna lateral, «Pago extra en
                        el 03» se cortaba justo en el número, que es el dato. */}
                    <span className="block truncate text-xs text-plum-light">
                      {d.kind === 'extra'
                        ? `Extra${d.number != null ? ` nº${pad2(d.number)}` : ''}`
                        : DONATION_LABEL.donation}
                      {' · '}
                      {formatDate(d.created_at)}
                      {d.note && ` · ${d.note}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-plum text-sm">
                    +{formatCOP(d.amount)}
                  </span>
                </button>
                {d.phone && (
                  <a
                    href={thanksLink(d.phone, d.name, d.amount)}
                    target="_blank"
                    rel="noreferrer"
                    title={`Agradecer a ${d.name} por WhatsApp`}
                    aria-label={`Agradecer a ${d.name} por WhatsApp`}
                    className="shrink-0 grid place-items-center w-9 h-9 rounded-lg text-[#25D366] hover:bg-[#25D366]/10"
                  >
                    <WhatsAppIcon />
                  </a>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-blush/20 bg-blush/5">
            <button
              type="button"
              onClick={onAdd}
              className="flex-1 sm:flex-none sm:px-6 bg-blush text-white font-bold rounded-lg py-2 text-sm hover:brightness-105"
            >
              + Registrar aporte
            </button>
            {donations.length > PREVIEW && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="shrink-0 sm:ml-auto rounded-lg border border-plum/25 text-plum font-semibold px-3 py-2 text-sm hover:bg-white"
              >
                {expanded ? 'Ver menos' : `Ver los ${donations.length}`}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}

