import { toPng } from 'html-to-image'
import { CONTACT_LABEL } from './types'

/**
 * Genera el PNG de la tarjeta y lo comparte con la hoja nativa del sistema
 * (WhatsApp, etc.) cuando el navegador lo soporta — típico en celular.
 * Si no hay soporte (computador), lo descarga.
 */
export async function shareCardPng(node: HTMLElement): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true })
  const blob = await (await fetch(dataUrl)).blob()
  const file = new File([blob], 'rifa-oreo-y-panda.png', { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Rifa Solidaria Oreo y Panda',
        text: `¡Apoya la rifa de Oreo y Panda! 🐾 Mira los números disponibles:\n${CONTACT_LABEL}`,
      })
      return 'shared'
    } catch (e) {
      // usuario cerró la hoja de compartir: no descargamos encima
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }

  const link = document.createElement('a')
  link.download = 'rifa-oreo-y-panda.png'
  link.href = dataUrl
  link.click()
  return 'downloaded'
}
