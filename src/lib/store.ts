import { supabase, isDemo } from './supabase'
import type {
  RaffleNumber,
  NumberStatus,
  BoardStatus,
  NumberRequest,
  Donation,
  DonationInput,
} from './types'

const DEMO_KEY = 'rifa-demo-numbers'
const DEMO_HISTORY_KEY = 'rifa-demo-history'
const DEMO_REQUESTS_KEY = 'rifa-demo-requests'
const DEMO_DONATIONS_KEY = 'rifa-demo-donations'

// Date.now() se repite si ocurren varios registros en el mismo milisegundo,
// y los ids duplicados rompen el renderizado de las listas. El sufijo los
// hace únicos (en Supabase de esto se encarga la propia base de datos).
let demoSeq = 0
const demoId = () => Date.now() * 1000 + (demoSeq++ % 1000)

export interface HistoryEntry {
  id: number
  number: number
  old_status: NumberStatus | null
  new_status: NumberStatus | null
  old_buyer: string | null
  new_buyer: string | null
  changed_at: string
}

/**
 * Supabase devuelve objetos planos, no Error: al lanzarlos tal cual, quien los
 * atrapa se queda sin el mensaje y solo puede mostrar un texto genérico.
 */
function asError(error: { message?: string }, fallback: string): Error {
  return new Error(error.message || fallback)
}

const emptyBoard = (): RaffleNumber[] =>
  Array.from({ length: 100 }, (_, i) => ({
    number: i,
    buyer_name: null,
    buyer_phone: null,
    sold_by: null,
    status: 'available' as NumberStatus,
  }))

function loadDemo(): RaffleNumber[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) return JSON.parse(raw) as RaffleNumber[]
  } catch {
    // datos corruptos: se reinicia el tablero
  }
  const board = emptyBoard()
  localStorage.setItem(DEMO_KEY, JSON.stringify(board))
  return board
}

function saveDemo(board: RaffleNumber[]) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(board))
}

/** Tablero completo para el admin (nombres y teléfonos incluidos). */
export async function fetchNumbers(): Promise<RaffleNumber[]> {
  if (isDemo) return loadDemo()
  const { data, error } = await supabase!
    .from('raffle_numbers')
    .select('number, buyer_name, buyer_phone, sold_by, status')
    .order('number')
  if (error) throw asError(error, 'No se pudo cargar el tablero.')
  return data as RaffleNumber[]
}

export interface BoardCell {
  number: number
  status: BoardStatus
}

/** Tablero público: solo número y estado, vía la vista public_board. */
export async function fetchPublicBoard(): Promise<BoardCell[]> {
  if (isDemo) {
    const pending = new Set(loadDemoRequests().map((r) => r.number))
    return loadDemo().map(({ number, status }) => ({
      number,
      status: status === 'available' && pending.has(number) ? 'pending' : status,
    }))
  }
  const { data, error } = await supabase!
    .from('public_board')
    .select('number, status')
    .order('number')
  if (error) throw asError(error, 'No se pudo cargar el tablero.')
  return data as BoardCell[]
}

export async function updateNumber(entry: RaffleNumber): Promise<void> {
  if (isDemo) {
    const board = loadDemo()
    const prev = board[entry.number]
    board[entry.number] = entry
    saveDemo(board)
    logDemoHistory(prev, entry)
    return
  }
  const { error } = await supabase!
    .from('raffle_numbers')
    .update({
      buyer_name: entry.buyer_name,
      buyer_phone: entry.buyer_phone,
      sold_by: entry.sold_by,
      status: entry.status,
      updated_at: new Date().toISOString(),
    })
    .eq('number', entry.number)
  if (error) throw asError(error, 'No se pudo guardar el número.')
}

function logDemoHistory(prev: RaffleNumber, next: RaffleNumber) {
  if (
    prev.status === next.status &&
    prev.buyer_name === next.buyer_name &&
    prev.buyer_phone === next.buyer_phone
  )
    return
  let history: HistoryEntry[] = []
  try {
    history = JSON.parse(localStorage.getItem(DEMO_HISTORY_KEY) ?? '[]')
  } catch {
    // historial corrupto: se reinicia
  }
  history.unshift({
    id: demoId(),
    number: next.number,
    old_status: prev.status,
    new_status: next.status,
    old_buyer: prev.buyer_name,
    new_buyer: next.buyer_name,
    changed_at: new Date().toISOString(),
  })
  localStorage.setItem(DEMO_HISTORY_KEY, JSON.stringify(history.slice(0, 300)))
}

/** Últimos cambios, del más reciente al más antiguo. */
export async function fetchHistory(): Promise<HistoryEntry[]> {
  if (isDemo) {
    try {
      return JSON.parse(localStorage.getItem(DEMO_HISTORY_KEY) ?? '[]')
    } catch {
      return []
    }
  }
  const { data, error } = await supabase!
    .from('raffle_history')
    .select('id, number, old_status, new_status, old_buyer, new_buyer, changed_at')
    .order('changed_at', { ascending: false })
    .limit(300)
  if (error) throw asError(error, 'No se pudo cargar el historial.')
  return data as HistoryEntry[]
}

// ---------- Solicitudes desde el tablero público ----------

function loadDemoRequests(): NumberRequest[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_REQUESTS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveDemoRequests(reqs: NumberRequest[]) {
  localStorage.setItem(DEMO_REQUESTS_KEY, JSON.stringify(reqs))
}


/** Crea una solicitud desde el tablero público (el número queda bloqueado). */
export async function requestNumber(
  number: number,
  name: string,
  phone: string
): Promise<void> {
  if (isDemo) {
    const board = loadDemo()
    if (board[number].status !== 'available') throw new Error('Ese número ya está vendido')
    const reqs = loadDemoRequests()
    if (reqs.some((r) => r.number === number))
      throw new Error('Ese número ya tiene una solicitud pendiente')
    reqs.push({
      id: demoId(),
      number,
      name: name.trim(),
      phone: phone.trim(),
      created_at: new Date().toISOString(),
    })
    saveDemoRequests(reqs)
    return
  }
  const { error } = await supabase!.rpc('request_number', {
    p_number: number,
    p_name: name.trim(),
    p_phone: phone.trim(),
  })
  if (error) throw new Error(error.message)
}

/** Solicitudes pendientes, de la más reciente a la más antigua (solo admin). */
export async function fetchPendingRequests(): Promise<NumberRequest[]> {
  if (isDemo)
    return loadDemoRequests().sort((a, b) => b.created_at.localeCompare(a.created_at))
  const { data, error } = await supabase!
    .from('number_requests')
    .select('id, number, name, phone, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw asError(error, 'No se pudieron cargar las solicitudes.')
  return data as NumberRequest[]
}

/** Aprueba la solicitud: el número pasa a apartado con esos datos. */
export async function approveRequest(req: NumberRequest): Promise<void> {
  await updateNumber({
    number: req.number,
    buyer_name: req.name,
    buyer_phone: req.phone,
    sold_by: null,
    status: 'reserved',
  })
  await closeRequest(req.id, 'approved')
}

/** Rechaza la solicitud y libera el número. */
export async function rejectRequest(req: NumberRequest): Promise<void> {
  await closeRequest(req.id, 'rejected')
}

async function closeRequest(id: number, status: 'approved' | 'rejected') {
  if (isDemo) {
    saveDemoRequests(loadDemoRequests().filter((r) => r.id !== id))
    return
  }
  const { error } = await supabase!
    .from('number_requests')
    .update({ status })
    .eq('id', id)
  if (error) throw asError(error, 'No se pudo cerrar la solicitud.')
}

// ---------- Aportes: donaciones y pagos extra ----------

const DONATION_COLUMNS = 'id, name, phone, amount, kind, number, note, created_at'

/**
 * Traduce el error de «la tabla no existe» a algo accionable: pasa cuando se
 * publica la app sin haber corrido todavía las migraciones.
 */
function donationError(error: { message?: string }): Error {
  const message = error.message ?? 'No se pudo guardar el aporte.'
  return /donations/i.test(message) &&
    /does not exist|schema cache|no existe/i.test(message)
    ? new Error('Falta la tabla de aportes: corre las migraciones (npm run migrate).')
    : new Error(message)
}

function loadDemoDonations(): Donation[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_DONATIONS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveDemoDonations(donations: Donation[]) {
  localStorage.setItem(DEMO_DONATIONS_KEY, JSON.stringify(donations))
}

/** Aportes registrados, del más reciente al más antiguo (solo admin). */
export async function fetchDonations(): Promise<Donation[]> {
  if (isDemo)
    return loadDemoDonations().sort((a, b) => b.created_at.localeCompare(a.created_at))
  const { data, error } = await supabase!
    .from('donations')
    .select(DONATION_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw donationError(error)
  return data as Donation[]
}

export async function addDonation(input: DonationInput): Promise<void> {
  if (isDemo) {
    saveDemoDonations([
      { ...input, id: demoId(), created_at: new Date().toISOString() },
      ...loadDemoDonations(),
    ])
    return
  }
  const { error } = await supabase!.from('donations').insert(input)
  if (error) throw donationError(error)
}

export async function updateDonation(id: number, input: DonationInput): Promise<void> {
  if (isDemo) {
    saveDemoDonations(
      loadDemoDonations().map((d) => (d.id === id ? { ...d, ...input } : d))
    )
    return
  }
  const { error } = await supabase!.from('donations').update(input).eq('id', id)
  if (error) throw donationError(error)
}

export async function deleteDonation(id: number): Promise<void> {
  if (isDemo) {
    saveDemoDonations(loadDemoDonations().filter((d) => d.id !== id))
    return
  }
  const { error } = await supabase!.from('donations').delete().eq('id', id)
  if (error) throw donationError(error)
}
