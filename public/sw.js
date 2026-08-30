// Service worker mínimo para que la app sea instalable.
//
// A propósito no intercepta nada: antes hacía e.respondWith(fetch(e.request)),
// que no aportaba nada (ni caché ni modo sin conexión) y metía cada petición
// dentro del worker, un punto extra donde tropezar en redes de celular.
// Sin respondWith, el navegador resuelve todo como siempre.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
