import { useState } from 'react'
import type { Donation, DonationInput, DonationKind, RaffleNumber } from '../lib/types'
import { pad2, formatCOP, formatThousands } from '../lib/types'
import AutocompleteInput, { type Suggestion } from './AutocompleteInput'

interface Props {
  /** Si viene, el modal edita ese aporte en vez de crear uno nuevo. */
  donation?: Donation
  numbers: RaffleNumber[]
  nameOptions: Suggestion[]
  onSave: (input: DonationInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000]

export default function DonationModal({
  donation,
  numbers,
  nameOptions,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [kind, setKind] = useState<DonationKind>(donation?.kind ?? 'donation')
  const [name, setName] = useState(donation?.name ?? '')
  const [phone, setPhone] = useState(donation?.phone ?? '')
  // Se guarda como dígitos y se muestra con puntos de mil mientras se escribe
  const [digits, setDigits] = useState(donation ? String(donation.amount) : '')
  const [number, setNumber] = useState<string>(
    donation?.number != null ? String(donation.number) : ''
  )
  const [note, setNote] = useState(donation?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const amount = Number(digits || 0)
  const sold = numbers.filter((n) => n.status !== 'available')

  const bump = (value: number) => setDigits(String(amount + value))

  /** Al elegir un número, se traen el nombre y el teléfono de quien lo tiene. */
  const pickNumber = (value: string) => {
    setNumber(value)
    const owner = numbers.find((n) => n.number === Number(value))
    if (!owner?.buyer_name) return
    if (!name.trim()) setName(owner.buyer_name)
    if (!phone.trim() && owner.buyer_phone) setPhone(owner.buyer_phone)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Escribe de quién es el aporte.')
      return
    }
    if (amount <= 0) {
      setError('Escribe cuánto aportó.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim() || null,
        amount,
        kind,
        number: kind === 'extra' && number !== '' ? Number(number) : null,
        note: note.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar. Intenta de nuevo.')
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!onDelete) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onDelete()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.')
      setSaving(false)
    }
  }

  return (
    <div
      data-modal
      className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="bg-cream rounded-2xl shadow-xl w-full max-w-sm p-5 max-h-[90svh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-plum flex items-center gap-2">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-blush text-white text-base">
              ♥
            </span>
            {donation ? 'Editar aporte' : 'Nuevo aporte'}
          </h2>
        </div>

        {/* Tipo de aporte */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-xl border border-plum/15 mb-4">
          {(['donation', 'extra'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={`rounded-lg py-2 text-sm font-bold transition ${
                kind === k
                  ? 'bg-blush text-white shadow-sm'
                  : 'text-plum-light hover:bg-cream'
              }`}
            >
              {k === 'donation' ? '♥ Donación' : '➕ Pago extra'}
            </button>
          ))}
        </div>
        <p className="text-xs text-plum-light -mt-3 mb-4 px-1">
          {kind === 'donation'
            ? 'Aporta sin llevar número.'
            : 'Pagó de más sobre un número que ya tiene.'}
        </p>

        {/* Monto */}
        <label className="block mb-2">
          <span className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-plum">Monto</span>
            {amount > 0 && (
              <button
                type="button"
                onClick={() => setDigits('')}
                className="text-xs font-semibold text-plum-light hover:text-plum"
              >
                Borrar
              </button>
            )}
          </span>
          <div className="mt-1 flex items-center rounded-xl border-2 border-plum/25 bg-white px-3 focus-within:border-plum">
            <span className="text-2xl font-black text-plum-light">$</span>
            <input
              value={formatThousands(digits)}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="0"
              inputMode="numeric"
              autoFocus={!donation}
              className="w-full bg-transparent px-2 py-2.5 text-2xl font-black text-ink outline-none"
            />
          </div>
        </label>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {QUICK_AMOUNTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => bump(v)}
              className="rounded-full border border-plum/25 bg-white px-1 py-1.5 text-xs font-bold text-plum hover:bg-blush/15 hover:border-blush"
            >
              +{formatThousands(String(v))}
            </button>
          ))}
        </div>

        <AutocompleteInput
          label="¿De quién?"
          value={name}
          onChange={setName}
          onPick={(s) => {
            // Solo rellena el teléfono si la sugerencia trae uno
            if (s.hint) setPhone(s.hint)
          }}
          suggestions={nameOptions}
          placeholder="Nombre de quien aporta"
          autoFocus={false}
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

        {kind === 'extra' && (
          <label className="block mb-3">
            <span className="text-sm font-semibold text-plum">Sobre el número (opcional)</span>
            <select
              value={number}
              onChange={(e) => pickNumber(e.target.value)}
              className="mt-1 w-full rounded-lg border border-plum/30 bg-white px-3 py-2 outline-none focus:border-plum"
            >
              <option value="">Sin número</option>
              {sold.map((n) => (
                <option key={n.number} value={n.number}>
                  {pad2(n.number)} · {n.buyer_name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block mb-4">
          <span className="text-sm font-semibold text-plum">Nota (opcional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: no quiso boleta"
            className="mt-1 w-full rounded-lg border border-plum/30 bg-white px-3 py-2 outline-none focus:border-plum"
          />
        </label>

        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-plum/30 text-plum font-semibold py-2.5 hover:bg-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-plum text-cream font-bold py-2.5 hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : amount > 0 ? `Guardar ${formatCOP(amount)}` : 'Guardar'}
          </button>
        </div>

        {onDelete && (
          <button
            type="button"
            disabled={saving}
            onClick={remove}
            className="w-full mt-2 rounded-lg py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {confirmDelete ? '¿Seguro? Toca de nuevo para borrar' : '🗑️ Borrar aporte'}
          </button>
        )}
      </form>
    </div>
  )
}
