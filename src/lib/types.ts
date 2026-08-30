export type NumberStatus = 'available' | 'reserved' | 'paid'

/** El tablero público suma 'pending': solicitado y a la espera de confirmación. */
export type BoardStatus = NumberStatus | 'pending'

export interface RaffleNumber {
  number: number
  buyer_name: string | null
  buyer_phone: string | null
  sold_by: string | null
  status: NumberStatus
}

export interface NumberRequest {
  id: number
  number: number
  name: string
  phone: string
  created_at: string
}

/**
 * Plata que entra por fuera del precio de los números:
 * - 'donation': aporta sin llevar boleta.
 * - 'extra': pagó de más sobre un número que ya tiene.
 */
export type DonationKind = 'donation' | 'extra'

export interface Donation {
  id: number
  name: string
  phone: string | null
  amount: number
  kind: DonationKind
  /** Número al que se le abonó el extra (solo para kind 'extra'). */
  number: number | null
  note: string | null
  created_at: string
}

/** Lo que se guarda al crear o editar un aporte (el id y la fecha los pone la base). */
export type DonationInput = Omit<Donation, 'id' | 'created_at'>

export const DONATION_LABEL: Record<DonationKind, string> = {
  donation: 'Donación',
  extra: 'Pago extra',
}

export const sumDonations = (donations: Donation[]) =>
  donations.reduce((total, d) => total + d.amount, 0)

/**
 * Negrita de WhatsApp: se escribe entre asteriscos y la app la aplica al
 * enviar. Los asteriscos sobreviven a encodeURIComponent, que no los toca.
 */
const bold = (text: string) => `*${text}*`

/**
 * Arma el link con el mensaje ya escrito. En Colombia los números se guardan
 * a 10 dígitos, sin el indicativo que WhatsApp sí exige.
 *
 * Los mensajes van sin emojis a propósito: WhatsApp Web los corrompe cuando
 * llegan por el link (salen como "?").
 */
function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, '')
  const full = digits.length === 10 ? `57${digits}` : digits
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`
}

/** "07", o "03, 12 y 44" cuando son varios. */
const listNumbers = (numbers: number[]) => {
  const nums = numbers.map(pad2)
  return nums.length === 1 ? nums[0] : `${nums.slice(0, -1).join(', ')} y ${nums.at(-1)}`
}

/** Confirmación con la llave para cobrar: para números apartados, que aún deben. */
export function whatsappLink(phone: string, numbers: number[], name: string) {
  const one = numbers.length === 1
  const text = `Hola ${name}, te confirmo ${one ? 'tu número' : 'tus números'} ${bold(
    listNumbers(numbers)
  )} en la ${RAFFLE_TITLE}. ¡Gracias por la colaboración! Esta es mi llave Bre-B: ${bold(
    BREB_KEY
  )}. Recuerda cancelar antes del sorteo para que ${
    one ? 'tu número juegue' : 'tus números jueguen'
  }. ¡Mucha suerte!`
  return waLink(phone, text)
}

/**
 * Mensaje para quien ya pagó. Va aparte porque el de arriba pide el pago, y
 * cobrarle a quien ya pagó queda muy mal.
 */
export function paidLink(phone: string, numbers: number[], name: string) {
  const one = numbers.length === 1
  const text = `Hola ${name}, ya recibí tu pago. ${
    one ? 'Tu número' : 'Tus números'
  } ${bold(listNumbers(numbers))} ${
    one ? 'queda confirmado' : 'quedan confirmados'
  } en la ${RAFFLE_TITLE}. ¡Mucha suerte y gracias por la colaboración!`
  return waLink(phone, text)
}

/** Link de WhatsApp para agradecer un aporte o una donación. */
export function thanksLink(phone: string, name: string, amount: number) {
  const text = `Hola ${name}, mil gracias por tu aporte de ${bold(
    formatCOP(amount)
  )} a la ${RAFFLE_TITLE}. De corazon, gracias por ayudarnos a seguir a su lado.`
  return waLink(phone, text)
}

export const TICKET_PRICE = 20000
export const PRIZE = 1000000
export const RAFFLE_TITLE = 'Rifa Solidaria Oreo y Panda'
export const DRAW_DATE = 'Viernes 4 de septiembre · Lotería de Medellín · 11:00 p.m.'
export const CONTACT_PHONE = '3008827856'
export const CONTACT_NAME = 'Diego Assia'
export const CONTACT_LABEL = `Responsable: ${CONTACT_NAME} · ${CONTACT_PHONE}`
export const BREB_KEY = '@assia951'
export const BREB_LABEL = `Paga con Bre-B: ${BREB_KEY}`

export const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)

export const pad2 = (n: number) => n.toString().padStart(2, '0')

/**
 * Los fallos de red salen en inglés y desde el navegador ("Failed to fetch",
 * "Load failed"…). En celular pasan seguido, así que se traducen.
 */
export function readableError(error: unknown, fallback: string): string {
  // Supabase devuelve objetos planos, no Error: sin esto el mensaje se pierde
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : ''
  if (!message) return fallback
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(
    message
  )
    ? 'No se pudo conectar. Revisa tu internet e inténtalo de nuevo.'
    : message
}

/** Separa los miles mientras se escribe un monto: "20000" → "20.000". */
export const formatThousands = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Fecha corta para historial y solicitudes: "14 ago, 3:20 p. m." */
export const formatDateTime = (iso: string) =>
  new Date(iso)
    .toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
    // es-CO intercala "de" ("14 de ago"), que solo ocupa espacio
    .replace(' de ', ' ')

/** Fecha sin hora, para listas apretadas: "14 ago". */
export const formatDate = (iso: string) =>
  new Date(iso)
    .toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    .replace(' de ', ' ')

/**
 * ¿Vale la pena decir quién vendió el número? Si se lo vendió a sí mismo, no:
 * repetir su nombre debajo de su nombre solo confunde.
 */
export const otherSeller = (buyer: string | null, seller: string | null) =>
  seller?.trim() && normalize(seller) !== normalize(buyer ?? '') ? seller : null

/** Minúsculas sin tildes, para buscar y deduplicar: "Sofía" coincide con "sofia". */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
