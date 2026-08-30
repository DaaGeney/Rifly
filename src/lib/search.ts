import type { Donation, RaffleNumber } from './types'
import { normalize } from './types'

/**
 * Búsqueda de personas en el tablero. Todo se compara sin tildes ni
 * mayúsculas, porque los nombres se escriben distinto cada vez: quien buscó
 * "sofia" tiene que encontrar a "Sofía".
 */

/** ¿El texto contiene todas las palabras buscadas? "maria res" halla "María Restrepo". */
export function matches(text: string | null | undefined, query: string): boolean {
  if (!text) return false
  const haystack = normalize(text)
  return tokens(query).every((t) => haystack.includes(t))
}

const tokens = (query: string) => normalize(query).split(/\s+/).filter(Boolean)

/** Todo lo que se sabe de una persona: sus números, lo que vendió y lo que aportó. */
export interface PersonHit {
  /** Nombre normalizado: agrupa "Sofia" y "Sofía" en una sola tarjeta. */
  key: string
  name: string
  phone: string | null
  /** Números que tiene a su nombre. */
  owned: RaffleNumber[]
  /** Números que vendió a otras personas. */
  soldByThem: RaffleNumber[]
  donations: Donation[]
}

/**
 * Junta en una sola tarjeta por persona todo lo que coincide con la búsqueda:
 * los números que tiene, los que vendió y los aportes que hizo.
 */
export function findPeople(
  numbers: RaffleNumber[],
  donations: Donation[],
  query: string
): PersonHit[] {
  if (!query.trim()) return []
  const hits = new Map<string, PersonHit>()

  const hit = (name: string, phone: string | null) => {
    const key = normalize(name)
    const found = hits.get(key)
    if (found) {
      if (!found.phone && phone) found.phone = phone
      return found
    }
    const fresh: PersonHit = {
      key,
      name: name.trim(),
      phone,
      owned: [],
      soldByThem: [],
      donations: [],
    }
    hits.set(key, fresh)
    return fresh
  }

  for (const n of numbers) {
    const esSuyo = matches(n.buyer_name, query)
    if (esSuyo) hit(n.buyer_name!, n.buyer_phone).owned.push(n)

    if (matches(n.sold_by, query)) {
      // Quien se vende un número a sí mismo no lo tiene dos veces: sin esto el
      // mismo número salía en «Sus números» y en «Vendió», y parecían dos.
      const seLoVendioASiMismo =
        esSuyo && normalize(n.sold_by!) === normalize(n.buyer_name ?? '')
      if (!seLoVendioASiMismo) hit(n.sold_by!, null).soldByThem.push(n)
    }
  }
  for (const d of donations) {
    if (matches(d.name, query)) hit(d.name, d.phone).donations.push(d)
  }

  return [...hits.values()].sort(
    (a, b) =>
      b.owned.length - a.owned.length ||
      b.soldByThem.length - a.soldByThem.length ||
      a.name.localeCompare(b.name, 'es')
  )
}

/** Los números que hay que resaltar en el tablero para estos resultados. */
export const hitNumbers = (people: PersonHit[]) =>
  new Set(people.flatMap((p) => [...p.owned, ...p.soldByThem]).map((n) => n.number))

/** Cuántos cambios (letras) separan dos palabras. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = row
  }
  return prev[b.length]
}

/** Cuántas letras se le perdonan a una búsqueda de este largo. */
const tolerance = (len: number) => (len <= 4 ? 1 : len <= 7 ? 2 : 3)

/**
 * Nombres parecidos a lo buscado, para ofrecerlos cuando no hubo ninguna
 * coincidencia: escribir "restrepo" con una letra de más no debería dejar
 * a nadie sin encontrar a "Restrepo".
 */
export function didYouMean(query: string, names: string[], max = 3): string[] {
  const q = normalize(query).replace(/\s+/g, ' ').trim()
  if (q.length < 3) return []
  const limit = tolerance(q.length)

  const scored = new Map<string, { name: string; distance: number }>()
  for (const name of names) {
    const full = normalize(name)
    // Se mide contra el nombre completo y contra cada palabra suelta, para que
    // buscar solo el apellido también funcione.
    const distance = Math.min(
      editDistance(q, full),
      ...full.split(/\s+/).filter(Boolean).map((word) => editDistance(q, word))
    )
    if (distance > limit) continue
    const prev = scored.get(full)
    if (!prev || distance < prev.distance) scored.set(full, { name, distance })
  }

  return [...scored.values()]
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, 'es'))
    .slice(0, max)
    .map((s) => s.name)
}
