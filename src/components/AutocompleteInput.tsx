import { useId, useMemo, useState } from 'react'
import { normalize } from '../lib/types'

export interface Suggestion {
  value: string
  /** Dato extra a la derecha (el teléfono, en el caso de compradores). */
  hint?: string
}

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  /** Se llama además de onChange cuando se elige una sugerencia. */
  onPick?: (s: Suggestion) => void
  suggestions: Suggestion[]
  placeholder?: string
  autoFocus?: boolean
  /** El label queda solo para lectores de pantalla (buscador, que ya se explica solo). */
  hideLabel?: boolean
  /** Reemplaza el ancho y el margen por defecto cuando el campo va en una barra. */
  className?: string
  /** Muestra una ✕ para vaciar el campo de un toque. */
  clearable?: boolean
}

const MAX = 6

/**
 * Campo de texto con sugerencias. Nunca sustituye lo que se escribe:
 * la lista solo se ofrece, así escribir un nombre nuevo no tiene fricción.
 */
export default function AutocompleteInput({
  label,
  value,
  onChange,
  onPick,
  suggestions,
  placeholder,
  autoFocus,
  hideLabel,
  className,
  clearable,
}: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()

  const matches = useMemo(() => {
    const nq = normalize(value)
    if (!nq) return suggestions.slice(0, MAX)
    const hits = suggestions.filter((s) => normalize(s.value).includes(nq))
    // Si lo escrito ya coincide exactamente con la única opción, no estorbar
    if (hits.length === 1 && normalize(hits[0].value) === nq) return []
    return hits.slice(0, MAX)
  }, [suggestions, value])

  const show = open && matches.length > 0

  const pick = (s: Suggestion) => {
    onChange(s.value)
    onPick?.(s)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      // Cierra la lista sin cerrar el modal que la contiene
      e.stopPropagation()
      setOpen(false)
      setActive(-1)
      return
    }
    if (!show) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      pick(matches[active])
    }
  }

  const showClear = clearable && value !== ''

  return (
    <label className={`relative ${className ?? 'block mb-3'}`}>
      <span className={hideLabel ? 'sr-only' : 'text-sm font-semibold text-plum'}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        className={`w-full border border-plum/30 bg-white py-2 pl-3 outline-none focus:border-plum ${
          hideLabel ? 'rounded-xl' : 'mt-1 rounded-lg'
        } ${showClear ? 'pr-9' : 'pr-3'}`}
      />

      {showClear && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-1 bottom-1 grid place-items-center w-8 h-8 rounded-lg text-plum-light hover:text-plum hover:bg-cream"
        >
          ✕
        </button>
      )}

      {show && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 left-0 right-0 mt-1 bg-white border border-plum/25 rounded-lg shadow-lg max-h-52 overflow-y-auto overscroll-contain divide-y divide-plum/10"
        >
          {matches.map((s, i) => (
            <li key={s.value} role="option" aria-selected={i === active}>
              <button
                type="button"
                // onMouseDown y no onClick: el blur cerraría la lista antes
                // de que el toque se registre en el celular
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(s)
                }}
                className={`w-full min-h-11 text-left px-3 py-2.5 flex items-center gap-2 hover:bg-cream ${
                  i === active ? 'bg-cream' : ''
                }`}
              >
                <span className="font-semibold text-ink truncate">{s.value}</span>
                {s.hint && (
                  <span className="ml-auto shrink-0 text-xs text-plum-light">
                    {s.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}
