import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isDemo, ADMIN_EMAIL } from '../lib/supabase'
import {
  fetchNumbers,
  updateNumber,
  fetchHistory,
  fetchPendingRequests,
  approveRequest,
  rejectRequest,
  fetchDonations,
  addDonation,
  updateDonation,
  deleteDonation,
  type HistoryEntry,
} from '../lib/store'
import { shareCardPng } from '../lib/exportImage'
import type { RaffleNumber, NumberRequest, Donation, DonationInput } from '../lib/types'
import { normalize, sumDonations, formatCOP, readableError } from '../lib/types'
import { findPeople, hitNumbers, didYouMean } from '../lib/search'
import NumberGrid from '../components/NumberGrid'
import NumberModal from '../components/NumberModal'
import StatsBar from '../components/StatsBar'
import ExportCard from '../components/ExportCard'
import BuyersList from '../components/BuyersList'
import PendingRequests from '../components/PendingRequests'
import SearchResults from '../components/SearchResults'
import DonationsPanel from '../components/DonationsPanel'
import DonationModal from '../components/DonationModal'
import HistoryModal from '../components/HistoryModal'
import AutocompleteInput from '../components/AutocompleteInput'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

const REFRESH_MS = 30_000

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(isDemo)
  const [numbers, setNumbers] = useState<RaffleNumber[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(false)
  const [requests, setRequests] = useState<NumberRequest[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  // null = cerrado · 'new' = registrando · Donation = editando ese aporte
  const [donationForm, setDonationForm] = useState<Donation | 'new' | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isDemo) return
    supabase!.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase!.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const isAdmin = isDemo || session?.user.email === ADMIN_EMAIL

  const load = useCallback(async () => {
    try {
      // Solicitudes y aportes no tumban el tablero: si su tabla aún no existe
      // en Supabase, el resto de la administración sigue funcionando.
      const [board, pending, contributions] = await Promise.all([
        fetchNumbers(),
        fetchPendingRequests().catch(() => []),
        fetchDonations().catch(() => []),
      ])
      setNumbers(board)
      setRequests(pending)
      setDonations(contributions)
      setLoadError(null)
    } catch (e) {
      setLoadError(readableError(e, 'No se pudo cargar el tablero.'))
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    load()
    const interval = setInterval(load, REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isAdmin, load])

  const { pulling, refreshing } = usePullToRefresh(load)

  // Una sola pasada por lo buscado: de aquí salen el resaltado del tablero,
  // la lista de resultados y los nombres parecidos si no hubo ninguno.
  const results = useMemo(
    () => findPeople(numbers, donations, search),
    [numbers, donations, search]
  )

  const highlight = useMemo(
    () => (search.trim() ? hitNumbers(results) : undefined),
    [search, results]
  )

  // Sugerencias del buscador: toda la gente conocida, con lo que tiene cada uno.
  const searchOptions = useMemo(() => {
    interface Entry {
      value: string
      owned: number
      sold: number
      donated: boolean
    }
    const map = new Map<string, Entry>()
    const entry = (name: string) => {
      const key = normalize(name)
      let found = map.get(key)
      if (!found) map.set(key, (found = { value: name.trim(), owned: 0, sold: 0, donated: false }))
      return found
    }
    for (const n of numbers) {
      if (n.buyer_name?.trim()) entry(n.buyer_name).owned++
      if (n.sold_by?.trim()) entry(n.sold_by).sold++
    }
    for (const d of donations) if (d.name.trim()) entry(d.name).donated = true

    return [...map.values()]
      .sort((a, b) => b.owned - a.owned || a.value.localeCompare(b.value, 'es'))
      .map((e) => ({
        value: e.value,
        hint:
          e.owned > 0
            ? `${e.owned} número${e.owned === 1 ? '' : 's'}`
            : e.sold > 0
              ? `vendió ${e.sold}`
              : e.donated
                ? 'aporte'
                : undefined,
      }))
  }, [numbers, donations])

  const nameSuggestions = useMemo(
    () =>
      search.trim() && results.length === 0
        ? didYouMean(search, searchOptions.map((o) => o.value))
        : [],
    [search, results, searchOptions]
  )

  // Sugerencias para el formulario de venta, derivadas del tablero ya cargado.
  // Se ordenan por frecuencia: quien más números tiene aparece primero.
  const buyerOptions = useMemo(() => {
    const map = new Map<string, { value: string; hint?: string; count: number }>()
    for (const n of numbers) {
      const name = n.buyer_name?.trim()
      if (!name) continue
      const key = normalize(name)
      const phone = n.buyer_phone?.trim() || undefined
      const prev = map.get(key)
      if (!prev) map.set(key, { value: name, hint: phone, count: 1 })
      else {
        prev.count++
        if (!prev.hint) prev.hint = phone
      }
    }
    return [...map.values()]
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'))
      .map(({ value, hint }) => ({ value, hint }))
  }, [numbers])

  const sellerOptions = useMemo(() => {
    const map = new Map<string, { value: string; count: number }>()
    for (const n of numbers) {
      const seller = n.sold_by?.trim()
      if (!seller) continue
      const key = normalize(seller)
      const prev = map.get(key)
      if (!prev) map.set(key, { value: seller, count: 1 })
      else prev.count++
    }
    return [...map.values()]
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'))
      .map(({ value }) => ({ value }))
  }, [numbers])

  // Para el formulario de aportes: quienes ya tienen números y quienes ya
  // aportaron antes, sin repetir a nadie.
  const donorOptions = useMemo(() => {
    const map = new Map<string, { value: string; hint?: string }>()
    for (const { value, hint } of buyerOptions) map.set(normalize(value), { value, hint })
    for (const d of donations) {
      const key = normalize(d.name)
      const prev = map.get(key)
      if (!prev) map.set(key, { value: d.name, hint: d.phone ?? undefined })
      else if (!prev.hint && d.phone) prev.hint = d.phone
    }
    return [...map.values()].sort((a, b) => a.value.localeCompare(b.value, 'es'))
  }, [buyerOptions, donations])

  const totalDonations = useMemo(() => sumDonations(donations), [donations])

  const saveDonation = async (input: DonationInput) => {
    if (donationForm && donationForm !== 'new') await updateDonation(donationForm.id, input)
    else await addDonation(input)
    setDonations(await fetchDonations().catch(() => donations))
  }

  const removeDonation = async () => {
    if (!donationForm || donationForm === 'new') return
    await deleteDonation(donationForm.id)
    setDonations(await fetchDonations().catch(() => donations))
  }

  const save = async (updated: RaffleNumber, extra = 0, alsoPaid: number[] = []) => {
    await updateNumber(updated)

    // Los demás números que pagó de una: solo cambian de estado, sus datos
    // (nombre, teléfono, quién los vendió) quedan como están.
    const companions = numbers
      .filter((n) => alsoPaid.includes(n.number))
      .map((n) => ({ ...n, status: 'paid' as const }))
    for (const c of companions) await updateNumber(c)

    setNumbers((prev) =>
      prev.map((n) => {
        if (n.number === updated.number) return updated
        return companions.find((c) => c.number === n.number) ?? n
      })
    )

    // Lo que pagó de más queda como aporte ligado a ese número. Va después de
    // guardar el número: si falla, se avisa que el número sí quedó guardado.
    if (extra > 0) {
      try {
        await addDonation({
          name: updated.buyer_name ?? 'Sin nombre',
          phone: updated.buyer_phone,
          amount: extra,
          kind: 'extra',
          number: updated.number,
          note: null,
        })
        setDonations(await fetchDonations().catch(() => donations))
      } catch (e) {
        const detalle = e instanceof Error ? e.message : 'error desconocido'
        throw new Error(
          `El número quedó guardado, pero no se pudo registrar el aporte de ${formatCOP(
            extra
          )}: ${detalle}`
        )
      }
    }

    if (showHistory) setHistory(await fetchHistory().catch(() => []))
  }

  const exportImage = async () => {
    if (!exportRef.current) return
    setExporting(true)
    try {
      await shareCardPng(exportRef.current)
    } finally {
      setExporting(false)
    }
  }

  // Abre primero y carga después, para que el popup no se sienta trabado
  const openHistory = async () => {
    setShowHistory(true)
    setHistoryLoading(true)
    setHistoryError(false)
    try {
      setHistory(await fetchHistory())
    } catch {
      setHistoryError(true)
    } finally {
      setHistoryLoading(false)
    }
  }

  const closeHistory = useCallback(() => setShowHistory(false), [])

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/tablero`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!authReady) {
    return <Centered>Cargando…</Centered>
  }

  if (!isDemo && !session) {
    return <LoginScreen />
  }

  if (!isAdmin) {
    return (
      <Centered>
        <p className="text-plum font-semibold mb-4">
          Esta cuenta ({session?.user.email}) no tiene acceso a la administración.
        </p>
        <button
          type="button"
          onClick={() => supabase!.auth.signOut()}
          className="border border-plum/30 text-plum font-semibold rounded-xl px-5 py-2 hover:bg-white"
        >
          Cerrar sesión
        </button>
      </Centered>
    )
  }

  const selectedEntry = selected !== null ? numbers.find((n) => n.number === selected) : undefined

  // Lo que la misma persona todavía debe, para poder cobrarlo todo de una.
  // Se agrupa por nombre sin tildes, igual que en el resto de la app.
  const pendingSiblings = selectedEntry?.buyer_name
    ? numbers.filter(
        (n) =>
          n.number !== selectedEntry.number &&
          n.status === 'reserved' &&
          n.buyer_name &&
          normalize(n.buyer_name) === normalize(selectedEntry.buyer_name!)
      )
    : []

  return (
    <div className="max-w-2xl lg:max-w-6xl xl:max-w-[88rem] mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-black text-plum">Rifa Oreo y Panda 🐾</h1>
        {!isDemo && (
          <button
            type="button"
            onClick={() => supabase!.auth.signOut()}
            className="text-sm text-plum-light hover:text-plum font-semibold"
          >
            Salir
          </button>
        )}
      </header>

      <PullToRefreshIndicator pulling={pulling} refreshing={refreshing} />

      {isDemo && (
        <div className="bg-tangerine/20 border border-tangerine rounded-xl px-3 py-2 text-sm text-plum-dark mb-4">
          <strong>Modo demo:</strong> los datos se guardan solo en este navegador. Configura
          Supabase en <code>.env</code> para tener login y datos en la nube.
        </div>
      )}

      {/* Con el tablero ya en pantalla, un refresco fallido es un aviso: lo que
          se ve sigue siendo válido. Solo alarma si no se pudo cargar nada. */}
      {loadError &&
        (numbers.length > 0 ? (
          <div className="bg-tangerine/15 border border-tangerine/50 rounded-xl px-3 py-2 text-sm text-plum-dark mb-4">
            No se pudo actualizar: {loadError} Se ven los últimos datos cargados.
          </div>
        ) : (
          <div className="bg-red-100 border border-red-300 rounded-xl px-3 py-2 text-sm text-red-800 mb-4">
            {loadError}
          </div>
        ))}

      {/* Lo urgente va arriba y a todo lo ancho, antes de repartir las columnas */}
      <PendingRequests
        requests={requests}
        onApprove={async (reqs) => {
          for (const r of reqs) await approveRequest(r)
          await load()
        }}
        onReject={async (reqs) => {
          for (const r of reqs) await rejectRequest(r)
          await load()
        }}
      />

      {/*
        Tres zonas en pantalla ancha: la plata a la izquierda, el tablero en el
        centro y la gente a la derecha. En pantalla mediana la contabilidad pasa
        arriba a todo lo ancho, y en celular se apila: plata, aportes, tablero.
      */}
      <div
        className="flex flex-col gap-4 lg:grid lg:gap-5 lg:items-start
          lg:grid-cols-[minmax(0,1fr)_20rem]
          xl:grid-cols-[16.5rem_minmax(0,1fr)_21rem]"
      >
        <section className="lg:col-start-1 lg:row-start-1 lg:col-span-2 xl:col-span-1 xl:row-start-1">
          <h2 className="hidden xl:block text-xs uppercase tracking-wide text-plum-light font-bold mb-2">
            Contabilidad
          </h2>
          <StatsBar numbers={numbers} extra={totalDonations} />
        </section>

        <main className="min-w-0 order-last lg:order-none lg:col-start-1 lg:row-start-2 xl:col-start-2 xl:row-start-1">

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <AutocompleteInput
          label="Buscar por nombre"
          hideLabel
          clearable
          className="flex-1 min-w-0 block"
          value={search}
          onChange={setSearch}
          suggestions={searchOptions}
          placeholder="Buscar por nombre…"
        />
        {/* En celular: dos arriba y movimientos abajo. En pantalla ancha: los tres en línea. */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
          <button
            type="button"
            onClick={exportImage}
            disabled={exporting}
            className="whitespace-nowrap bg-plum text-cream font-bold rounded-xl px-4 py-2 hover:brightness-110 disabled:opacity-50"
          >
            {exporting ? 'Generando…' : '📲 Compartir'}
          </button>
          <button
            type="button"
            onClick={copyPublicLink}
            className="whitespace-nowrap border-2 border-plum text-plum font-bold rounded-xl px-4 py-2 hover:bg-white"
          >
            {copied ? '✅ Copiado' : '🔗 Link'}
          </button>
          <button
            type="button"
            onClick={openHistory}
            aria-haspopup="dialog"
            className="col-span-2 sm:col-auto whitespace-nowrap border border-plum/30 text-plum font-semibold rounded-xl px-4 py-2 hover:bg-white"
          >
            🕘 Movimientos
          </button>
        </div>
      </div>

      <SearchResults
        query={search}
        people={results}
        suggestions={nameSuggestions}
        onSelectNumber={setSelected}
        onPickSuggestion={setSearch}
      />

          <NumberGrid numbers={numbers} onSelect={setSelected} highlight={highlight} />

          <div className="flex items-center justify-center gap-4 text-xs sm:text-sm font-semibold text-plum mt-3">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-white border border-plum/30" /> Libre
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-tangerine" /> Apartado (debe)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-plum" /> Pagado
            </span>
          </div>
        </main>

        <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1">
          <DonationsPanel
            donations={donations}
            onAdd={() => setDonationForm('new')}
            onEdit={setDonationForm}
          />

          <BuyersList numbers={numbers} onSelect={setSelected} highlight={highlight} />
        </aside>
      </div>

      {showHistory && (
        <HistoryModal
          entries={history}
          numbers={numbers}
          onSelectNumber={setSelected}
          loading={historyLoading}
          error={historyError}
          onClose={closeHistory}
        />
      )}

      {donationForm && (
        <DonationModal
          donation={donationForm === 'new' ? undefined : donationForm}
          numbers={numbers}
          nameOptions={donorOptions}
          onSave={saveDonation}
          onDelete={donationForm === 'new' ? undefined : removeDonation}
          onClose={() => setDonationForm(null)}
        />
      )}

      {selectedEntry && (
        <NumberModal
          entry={selectedEntry}
          pendingSiblings={pendingSiblings}
          onSave={save}
          onClose={() => setSelected(null)}
          buyerOptions={buyerOptions}
          sellerOptions={sellerOptions}
        />
      )}

      {/* Tarjeta off-screen para la exportación PNG */}
      <div className="fixed -left-[3000px] top-0" aria-hidden="true">
        <ExportCard ref={exportRef} numbers={numbers} />
      </div>
    </div>
  )
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: err } = await supabase!.auth.signInWithPassword({ email, password })
    if (err) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
    }
    // con éxito, onAuthStateChange actualiza la sesión y desmonta esta pantalla
  }

  return (
    <Centered>
      <h1 className="text-3xl font-black text-plum mb-2">Rifa Oreo y Panda 🐾</h1>
      <p className="text-plum-light mb-6">Inicia sesión para administrar la rifa</p>
      <form onSubmit={login} className="w-full max-w-xs text-left">
        <label className="block mb-3">
          <span className="text-sm font-semibold text-plum">Correo</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-plum/30 bg-white px-3 py-2 outline-none focus:border-plum"
          />
        </label>
        <label className="block mb-4">
          <span className="text-sm font-semibold text-plum">Contraseña</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-plum/30 bg-white px-3 py-2 outline-none focus:border-plum"
          />
        </label>
        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-plum text-cream font-bold rounded-xl py-3 hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center text-center px-6">
      {children}
    </div>
  )
}
