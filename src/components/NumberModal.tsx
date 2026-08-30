import { useState } from 'react'
import type { RaffleNumber } from '../lib/types'
import {
  pad2,
  formatCOP,
  formatThousands,
  TICKET_PRICE,
  whatsappLink,
  paidLink,
} from '../lib/types'
import AutocompleteInput, { type Suggestion } from './AutocompleteInput'
import WhatsAppIcon from './WhatsAppIcon'

interface Props {
  entry: RaffleNumber
  /**
   * @param extra Lo que pagó de más: se registra como aporte junto al número.
   * @param alsoPaid Otros números de la misma persona que se cobran a la vez.
   */
  onSave: (updated: RaffleNumber, extra?: number, alsoPaid?: number[]) => Promise<void>
  onClose: () => void
  buyerOptions: Suggestion[]
  sellerOptions: Suggestion[]
  /** Los otros números que esta misma persona todavía debe. */
  pendingSiblings?: RaffleNumber[]
}

export default function NumberModal({
  entry,
  onSave,
  onClose,
  buyerOptions,
  sellerOptions,
  pendingSiblings = [],
}: Props) {
  const [name, setName] = useState(entry.buyer_name ?? '')
  const [phone, setPhone] = useState(entry.buyer_phone ?? '')
  const [soldBy, setSoldBy] = useState(entry.sold_by ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmStatus, setConfirmStatus] = useState<RaffleNumber['status'] | null>(null)
  // Un número ya vendido se abre bloqueado: hay que tocar «Editar» para cambiarlo
  const [editing, setEditing] = useState(entry.status === 'available')

  // Cuando alguien paga varios números juntos se cobran de una, sin abrir uno
  // por uno. Empieza vacío: quien paga solo este no tiene que tocar nada.
  const [alsoPaid, setAlsoPaid] = useState<Set<number>>(new Set())
  const paidCount = 1 + alsoPaid.size
  const dueTotal = paidCount * TICKET_PRICE

  // Cuánto entregó. Arranca en el precio de lo que se está cobrando: si se deja
  // así no pasa nada raro, y si pone de más la diferencia se guarda como aporte.
  const [paidDigits, setPaidDigits] = useState(String(TICKET_PRICE))
  const handed = Number(paidDigits || 0)
  const extra = Math.max(0, handed - dueTotal)
  const missing = Math.max(0, dueTotal - handed)

  /** Al marcar o desmarcar un número, el monto vuelve a lo que suman todos. */
  const toggleSibling = (number: number) => {
    const next = new Set(alsoPaid)
    if (!next.delete(number)) next.add(number)
    setAlsoPaid(next)
    setPaidDigits(String((1 + next.size) * TICKET_PRICE))
  }

  const toggleAllSiblings = () => {
    const next =
      alsoPaid.size === pendingSiblings.length
        ? new Set<number>()
        : new Set(pendingSiblings.map((s) => s.number))
    setAlsoPaid(next)
    setPaidDigits(String((1 + next.size) * TICKET_PRICE))
  }

  // El mensaje de WhatsApp nombra todos los números que se están cobrando
  const messageNumbers = [entry.number, ...alsoPaid].sort((a, b) => a - b)

  // A quien ya pagó se le agradece; a quien debe se le manda la llave para cobrar
  const whatsapp = entry.buyer_phone
    ? (entry.status === 'paid' ? paidLink : whatsappLink)(
        entry.buyer_phone,
        messageNumbers,
        entry.buyer_name ?? ''
      )
    : null

  const save = async (status: RaffleNumber['status']) => {
    if (status !== 'available' && !name.trim()) {
      setError('Escribe el nombre de quien toma el número.')
      return
    }
    // Un número PAGADO no se degrada sin doble confirmación
    if (entry.status === 'paid' && status !== 'paid' && confirmStatus !== status) {
      setConfirmStatus(status)
      setError(null)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(
        {
          number: entry.number,
          buyer_name: status === 'available' ? null : name.trim(),
          buyer_phone: status === 'available' ? null : phone.trim() || null,
          sold_by: status === 'available' ? null : soldBy.trim() || null,
          status,
        },
        // El excedente y los acompañantes solo cuentan cuando se está cobrando
        status === 'paid' ? extra : 0,
        status === 'paid' ? [...alsoPaid] : []
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div
      data-modal
      className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-cream rounded-2xl shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-plum">
            Número <span className="bg-plum text-cream rounded-lg px-2 py-0.5">{pad2(entry.number)}</span>
          </h2>
          <span className="text-sm text-plum-light font-semibold">{formatCOP(TICKET_PRICE)}</span>
        </div>

        {!editing && (
          <>
            <div className="bg-white rounded-xl border border-plum/15 divide-y divide-plum/10 mb-4">
              <Row label="Estado" value={<StatusBadge status={entry.status} />} />
              <Row label="Nombre" value={entry.buyer_name ?? '—'} />
              <Row label="Teléfono" value={entry.buyer_phone ?? '—'} />
              <Row label="Vendido por" value={entry.sold_by ?? '—'} />
            </div>

            {entry.status === 'reserved' && (
              <>
                {pendingSiblings.length > 0 && (
                  <SiblingPicker
                    siblings={pendingSiblings}
                    selected={alsoPaid}
                    onToggle={toggleSibling}
                    onToggleAll={toggleAllSiblings}
                    current={entry.number}
                  />
                )}

                <PaidAmount
                  label={paidCount > 1 ? `¿Cuánto pagó por los ${paidCount}?` : '¿Cuánto pagó?'}
                  digits={paidDigits}
                  onChange={setPaidDigits}
                  exact={dueTotal}
                  extra={extra}
                  missing={missing}
                  who={entry.buyer_name ?? ''}
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save('paid')}
                  className="w-full rounded-lg bg-plum text-cream font-bold py-2.5 mb-2 hover:brightness-110 disabled:opacity-50"
                >
                  {saving
                    ? 'Guardando…'
                    : `💰 ${
                        paidCount > 1
                          ? `Marcar los ${paidCount} como pagados`
                          : 'Marcar como pagado'
                      }${extra > 0 ? ' + aporte' : ''}`}
                </button>
              </>
            )}

            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#25D366] text-white font-bold py-2.5 mb-2 hover:brightness-105"
              >
                <WhatsAppIcon />
                {entry.status === 'paid' ? 'Escribir por WhatsApp' : 'Cobrar por WhatsApp'}
              </a>
            ) : (
              entry.status !== 'available' && (
                <p className="text-xs text-plum-light text-center mb-2">
                  Sin teléfono guardado para escribirle por WhatsApp.
                </p>
              )
            )}

            {error && <p className="text-sm text-red-700 mb-2">{error}</p>}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-plum/30 text-plum font-semibold py-2.5 hover:bg-white"
              >
                ✏️ Editar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-plum/30 text-plum font-semibold py-2.5 hover:bg-white"
              >
                Cerrar
              </button>
            </div>
          </>
        )}

        {editing && (
          <>
        <AutocompleteInput
          label="Nombre"
          value={name}
          onChange={setName}
          onPick={(s) => {
            // Solo rellena el teléfono si la sugerencia trae uno:
            // nunca borra lo que ya se escribió
            if (s.hint) setPhone(s.hint)
          }}
          suggestions={buyerOptions}
          placeholder="¿Quién toma este número?"
          autoFocus
        />
        <label className="block mb-3">
          <span className="text-sm font-semibold text-plum">Teléfono (opcional)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="300 123 4567"
            inputMode="tel"
            className="mt-1 w-full rounded-lg border border-plum/30 bg-white px-3 py-2 outline-none focus:border-plum"
          />
        </label>
        <div className="mb-1">
          <AutocompleteInput
            label="Vendido por (opcional)"
            value={soldBy}
            onChange={setSoldBy}
            suggestions={sellerOptions}
            placeholder="¿Quién hizo esta venta?"
          />
        </div>

        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

        {confirmStatus && (
          <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            ⚠️ Este número ya está <strong>PAGADO</strong>
            {entry.buyer_name ? ` por ${entry.buyer_name}` : ''}. Toca de nuevo{' '}
            «{confirmStatus === 'available' ? 'Liberar' : 'Apartar'}» para confirmar.
          </p>
        )}

        {entry.status !== 'paid' && (
          <PaidAmount
            label="¿Cuánto pagó?"
            digits={paidDigits}
            onChange={setPaidDigits}
            exact={dueTotal}
            extra={extra}
            missing={missing}
            who={name.trim()}
          />
        )}

        {entry.status === 'available' ? (
          // Venta nueva: hay que decir en qué estado queda
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => save('reserved')}
              className="rounded-lg bg-tangerine text-plum-dark font-bold py-2.5 hover:brightness-105 disabled:opacity-50"
            >
              Apartar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => save('paid')}
              className="rounded-lg bg-plum text-cream font-bold py-2.5 hover:brightness-110 disabled:opacity-50"
            >
              Marcar como pagado
            </button>
          </div>
        ) : (
          <>
            {/* Ya está vendido: lo normal aquí es corregir un dato, no cambiarle
                el estado. Guardar deja el número como está. */}
            <button
              type="button"
              disabled={saving}
              onClick={() => save(entry.status)}
              className="w-full rounded-lg bg-plum text-cream font-bold py-2.5 hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : '💾 Guardar cambios'}
            </button>

            <p className="text-xs font-semibold text-plum-light mt-3 mb-1.5">
              O cambiarle el estado:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {entry.status === 'paid' ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save('reserved')}
                  className="rounded-lg bg-tangerine text-plum-dark font-bold py-2 text-sm hover:brightness-105 disabled:opacity-50"
                >
                  Volver a apartado
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save('paid')}
                  className="rounded-lg bg-plum text-cream font-bold py-2 text-sm hover:brightness-110 disabled:opacity-50"
                >
                  Marcar como pagado
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => save('available')}
                className="rounded-lg border border-plum/30 text-plum font-semibold py-2 text-sm hover:bg-white disabled:opacity-50"
              >
                Liberar
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 rounded-lg border border-plum/30 text-plum font-semibold py-2 hover:bg-white"
        >
          Cancelar
        </button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Los demás números que la misma persona debe. Marcarlos aquí evita tener que
 * abrir uno por uno cuando paga varios juntos, que es lo normal.
 */
function SiblingPicker({
  siblings,
  selected,
  onToggle,
  onToggleAll,
  current,
}: {
  siblings: RaffleNumber[]
  selected: Set<number>
  onToggle: (n: number) => void
  onToggleAll: () => void
  current: number
}) {
  const all = selected.size === siblings.length

  return (
    <div className="bg-white rounded-xl border border-plum/15 px-3 py-2.5 mb-2">
      <div className="flex items-baseline justify-between gap-2">
        {/* Sin repetir el nombre: está en la ficha, justo encima */}
        <span className="min-w-0 text-sm font-semibold text-plum">
          También debe {siblings.length} número{siblings.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onToggleAll}
          className="shrink-0 text-xs font-bold text-plum-light hover:text-plum"
        >
          {all ? 'Ninguno' : 'Todos'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {/* El número abierto siempre va incluido: se muestra fijo, sin poder quitarlo */}
        <span className="rounded-md bg-plum text-cream px-2 py-1 text-sm font-bold opacity-60">
          {pad2(current)}
        </span>
        {siblings.map((s) => {
          const on = selected.has(s.number)
          return (
            <button
              key={s.number}
              type="button"
              onClick={() => onToggle(s.number)}
              aria-pressed={on}
              className={`rounded-md px-2 py-1 text-sm font-bold border transition ${
                on
                  ? 'bg-plum text-cream border-plum'
                  : 'bg-tangerine/20 text-plum-dark border-tangerine/60 hover:bg-tangerine/35'
              }`}
            >
              {pad2(s.number)}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-plum-light mt-2">
        {selected.size === 0
          ? 'Toca los que también te pagó.'
          : `Se cobran ${1 + selected.size} números juntos.`}
      </p>
    </div>
  )
}

/**
 * Cuánto entregó la persona. Viene con el precio puesto para que el caso
 * normal sea un solo toque; si entrega de más, la diferencia se avisa aquí
 * y se guarda sola como aporte.
 */
function PaidAmount({
  label,
  digits,
  onChange,
  exact,
  extra,
  missing,
  who,
}: {
  label: string
  digits: string
  onChange: (v: string) => void
  /** Lo que costaría justo: a esto vuelve el botón «Exacto». */
  exact: number
  extra: number
  missing: number
  who: string
}) {
  return (
    <div className="bg-white rounded-xl border border-plum/15 px-3 py-2.5 mb-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-plum">{label}</span>
        <div className="flex items-center rounded-lg border-2 border-plum/25 px-2 focus-within:border-plum">
          <span className="font-black text-plum-light">$</span>
          <input
            value={formatThousands(digits)}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
            inputMode="numeric"
            aria-label={label}
            className="w-24 bg-transparent px-1 py-1 text-right text-lg font-black text-ink outline-none"
          />
        </div>
      </div>

      {/* Solo el atajo para volver a lo que cuesta: los montos se escriben. */}
      {Number(digits || 0) !== exact && (
        <button
          type="button"
          onClick={() => onChange(String(exact))}
          className="mt-2 rounded-full px-2.5 py-0.5 text-xs font-bold text-plum-light hover:text-plum"
        >
          Volver a {formatCOP(exact)}
        </button>
      )}

      {extra > 0 && (
        <p className="text-xs font-semibold text-blush mt-2">
          ♥ {formatCOP(extra)} de más: se guardan como aporte
          {who ? ` de ${who}` : ''}.
        </p>
      )}
      {missing > 0 && (
        <p className="text-xs font-semibold text-tangerine mt-2">
          Faltan {formatCOP(missing)} para completar. Se marcará pagado igual.
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-sm font-semibold text-plum-light">{label}</span>
      <span className="font-bold text-ink text-right">{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: RaffleNumber['status'] }) {
  const paid = status === 'paid'
  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-sm font-bold ${
        paid ? 'bg-plum text-cream' : 'bg-tangerine text-plum-dark'
      }`}
    >
      {paid ? 'Pagado' : 'Apartado (debe)'}
    </span>
  )
}
