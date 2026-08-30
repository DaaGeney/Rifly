import { toPng } from 'html-to-image'

/**
 * Genera el PNG de la tarjeta y lo comparte con la hoja nativa del sistema
 * (WhatsApp, etc.) cuando el navegador lo soporta — típico en celular.
 * Si no hay soporte (computador), lo descarga.
 */
export async function shareCardPng(node: HTMLElement): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true })
  const blob = await (await fetch(dataUrl)).blob()
  const file = new File([blob], 'rifa-pro-fondos.png', { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Rifa Pro Fondos',
        text: '¡Apoya la Rifa Pro Fondos! 💰 Mira los números disponibles:',
      })
      return 'shared'
    } catch (e) {
      // usuario cerró la hoja de compartir: no descargamos encima
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }

  const link = document.createElement('a')
  link.download = 'rifa-pro-fondos.png'
  link.href = dataUrl
  link.click()
  return 'downloaded'
}
