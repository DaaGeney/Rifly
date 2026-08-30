import { useState } from 'react'
import type { NumberRequest } from '../lib/types'
import { pad2, whatsappLink, formatCOP, TICKET_PRICE, formatDateTime } from '../lib/types'

interface Props {
  requests: NumberRequest[]
  onApprove: (reqs: NumberRequest[]) => Promise<void>
  onReject: (reqs: NumberRequest[]) => Promise<void>
}

interface Group {
  key: string
  name: string
  phone: string
  requests: NumberRequest[]
}

/** Una tarjeta por persona: varios números del mismo teléfono van juntos. */
function groupByPerson(requests: NumberRequest[]): Group[] {
  const groups = new Map<string, Group>()
  for (const req of requests) {
    const key = req.phone.replace(/\D/g, '')
    const g = groups.get(key)
    if (g) g.requests.push(req)
    else groups.set(key, { key, name: req.name, phone: req.phone, requests: [req] })
  }
  return [...groups.values()]
}

export default function PendingRequests({ requests, onApprove, onReject }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState<string | null>(null)

  if (requests.length === 0) return null
  const groups = groupByPerson(requests)

  const run = async (g: Group, fn: (reqs: NumberRequest[]) => Promise<void>) => {
    setBusy(g.key)
    try {
      await fn(g.requests)
    } finally {
      setBusy(null)
      setConfirmReject(null)
    }
  }

  return (
    <div className="border-2 border-tangerine bg-tangerine/10 rounded-xl overflow-hidden mb-4">
      <div className="px-3 py-2 bg-tangerine text-plum-dark font-bold text-sm">
        🙋 {requests.length} número{requests.length === 1 ? '' : 's'} por confirmar ·{' '}
        {groups.length} persona{groups.length === 1 ? '' : 's'}
      </div>

      {/* Una tarjeta por persona. En pantalla ancha se reparten en varias
          columnas: estiradas a todo lo ancho, los botones quedaban enormes. */}
      <div className="grid gap-2 p-2 sm:gap-3 sm:p-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const nums = g.requests.map((r) => r.number).sort((a, b) => a - b)
          const latest = g.requests.reduce((a, b) =>
            a.created_at > b.created_at ? a : b
          )
          return (
            <div
              key={g.key}
              className="rounded-lg border border-tangerine/40 bg-cream/70 px-3 py-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="min-w-0 flex-1 font-bold text-ink truncate">
                  {g.name}
                </span>
                <span className="shrink-0 text-xs text-plum-light">
                  {formatDateTime(latest.created_at)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {nums.map((n) => (
                  <span
                    key={n}
                    className="bg-plum text-cream rounded-md px-2 py-0.5 font-bold text-sm"
                  >
                    {pad2(n)}
                  </span>
                ))}
                <span className="text-sm text-plum ml-1">
                  {formatCOP(nums.length * TICKET_PRICE)}
                </span>
              </div>
              <p className="text-sm text-plum mb-2">{g.phone}</p>

              <div className="grid grid-cols-3 gap-2">
                <a
                  href={whatsappLink(g.phone, nums, g.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[#25D366] text-white font-bold py-2 text-center text-sm hover:brightness-105"
                >
                  WhatsApp
                </a>
                <button
                  type="button"
                  disabled={busy === g.key}
                  onClick={() => run(g, onApprove)}
                  className="rounded-lg bg-plum text-cream font-bold py-2 text-sm hover:brightness-110 disabled:opacity-50"
                >
                  ✅ Aprobar
                </button>
                <button
                  type="button"
                  disabled={busy === g.key}
                  onClick={() =>
                    confirmReject === g.key ? run(g, onReject) : setConfirmReject(g.key)
                  }
                  className="rounded-lg border border-plum/30 text-plum font-semibold py-2 text-sm hover:bg-white disabled:opacity-50"
                >
                  {confirmReject === g.key ? '¿Seguro?' : '❌ Rechazar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
