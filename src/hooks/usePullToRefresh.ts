import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 70

/**
 * Gesto de "deslizar hacia abajo para recargar", como apps nativas.
 * Necesario porque en modo PWA (standalone) el pull-to-refresh del
 * navegador no está disponible.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)

  useEffect(() => {
    // En iOS el rebote elástico deja scrollY en negativo al arrastrar
    // desde arriba, por eso no se compara contra 0 exacto.
    const atTop = () => window.scrollY <= 0

    const onTouchStart = (e: TouchEvent) => {
      // Con un modal abierto el gesto no aplica: recargar mientras se
      // edita un número borraría lo que se está escribiendo.
      if (document.querySelector('[data-modal]')) return
      if (atTop()) startY.current = e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const delta = e.touches[0].clientY - startY.current
      setPulling(delta > THRESHOLD)
    }
    const onTouchEnd = async () => {
      const shouldRefresh = pulling && !refreshing
      setPulling(false)
      startY.current = null
      if (shouldRefresh) {
        setRefreshing(true)
        await onRefresh()
        setRefreshing(false)
      }
    }
    const onTouchCancel = () => {
      setPulling(false)
      startY.current = null
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchCancel)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [pulling, refreshing, onRefresh])

  return { pulling, refreshing }
}
