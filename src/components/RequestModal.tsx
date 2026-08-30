import { useState } from 'react'
import { requestNumber } from '../lib/store'
import {
  pad2,
  formatCOP,
  TICKET_PRICE,
  CONTACT_NAME,
  CONTACT_PHONE,
  readableError,
} from '../lib/types'

interface Props {
  numbers: number[]
  onClose: () => void
  onDone: () => void
}

export default function RequestModal({ numbers, onClose, onDone }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [granted, setGranted] = useState<number[] | null>(null)
  const [missed, setMissed] = useState<number[]>([])

  const list = (nums: number[]) => nums.map(pad2).join(', ')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Escribe tu nombre.')
    if (phone.replace(/\D/g, '').length < 7)
      return setError('Escribe un teléfono válido para poder confirmarte.')

    setSending(true)
    setError(null)

    const ok: number[] = []
    const taken: number[] = []
    let notReady = false
    let failure: string | null = null

    for (const n of numbers) {
      try {
        await requestNumber(n, name, phone)
        ok.push(n)
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        // Backend sin la función/tabla de solicitudes (SQL aún no ejecutado)
        if (/request_number|schema cache|does not exist/i.test(msg)) {
          notReady = true
          break
        }
        // Solo estos dos mensajes vienen de la base y significan «ya no está
        // libre». Cualquier otro fallo (sin señal, servidor caído) NO se puede
        // hacer pasar por número tomado: mandaba a la gente a elegir otro
        // número cuando el suyo seguía disponible.
        if (/ya está vendido|ya tiene una solicitud/i.test(msg)) {
          taken.push(n)
        } else {
          failure = readableError(err, 'No se pudo enviar la solicitud.')
          break
        }
      }
    }

    if (notReady) {
      setError(
        `Las solicitudes en línea aún no están activas. Escríbele a ${CONTACT_NAME} al WhatsApp ${CONTACT_PHONE} para apartar tus números.`
      )
      setSending(false)
      return
    }
    if (failure) {
      setError(`${failure} Tu número sigue disponible, vuelve a intentarlo.`)
      setSending(false)
      onDone()
      return
    }
    if (ok.length === 0) {
      setError(
        numbers.length === 1
          ? 'Ese número ya fue tomado por alguien más. Elige otro.'
          : 'Esos números ya fueron tomados por alguien más. Elige otros.'
      )
      setSending(false)
      onDone()
      return
    }
    setGranted(ok)
    setMissed(taken)
    onDone()
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
        {granted ? (
          <div className="text-center">
            <p className="text-5xl mb-3">🐾</p>
            <h2 className="text-xl font-black text-plum mb-2">
              ¡Listo! Apartamos {granted.length === 1 ? 'el' : 'los'} {list(granted)}
            </h2>
            {missed.length > 0 && (
              <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {missed.length === 1 ? 'El' : 'Los'} {list(missed)} ya{' '}
                {missed.length === 1 ? 'estaba tomado' : 'estaban tomados'} por alguien
                más.
              </p>
            )}
            <p className="text-ink mb-5">
              ¡Gracias por la colaboración! 💜 {CONTACT_NAME} te escribirá por WhatsApp
              para confirmar.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-plum text-cream font-bold rounded-xl py-3 hover:brightness-110"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold text-plum">
                {numbers.length === 1 ? 'Pedir el' : 'Pedir los'}{' '}
                <span className="bg-plum text-cream rounded-lg px-2 py-0.5">
                  {list(numbers)}
                </span>
              </h2>
              <span className="shrink-0 ml-2 text-sm text-plum-light font-semibold">
                {formatCOP(numbers.length * TICKET_PRICE)}
              </span>
            </div>
            <p className="text-sm text-plum-light mb-4">
              {numbers.length === 1 ? 'Queda apartado' : 'Quedan apartados'} mientras{' '}
              {CONTACT_NAME} te confirma por WhatsApp.
            </p>

            <form onSubmit={submit}>
              <label className="block mb-3">
                <span className="text-sm font-semibold text-plum">Tu nombre</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="mt-1 w-full rounded-lg border border-plum/30 bg-white px-3 py-2 outline-none focus:border-plum"
                  autoFocus
                />
              </label>
              <label className="block mb-4">
                <span className="text-sm font-semibold text-plum">Tu WhatsApp</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="300 123 4567"
                  inputMode="tel"
                  className="mt-1 w-full rounded-lg border border-plum/30 bg-white px-3 py-2 outline-none focus:border-plum"
                />
              </label>

              {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-lg bg-plum text-cream font-bold py-2.5 hover:brightness-110 disabled:opacity-50"
                >
                  {sending
                    ? 'Enviando…'
                    : numbers.length === 1
                      ? 'Apartar'
                      : `Apartar los ${numbers.length}`}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-plum/30 text-plum font-semibold py-2.5 hover:bg-white"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
