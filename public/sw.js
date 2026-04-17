self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('ls-verify-v1').then((cache) => cache.addAll(['/verify']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Cache-first for verify page (offline gate)
  if (req.method === 'GET' && url.pathname === '/verify') {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone()
        caches.open('ls-verify-v1').then((cache) => cache.put(req, copy))
        return res
      }))
    )
  }
})

