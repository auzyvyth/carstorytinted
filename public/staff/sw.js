// Staff app service worker: web push + an offline app shell.
// Scope is /staff/ only; the public site is never cached by this.
const CACHE = 'carstory-staff-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/staff/'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Pages: network first (always fresh), cached copy when offline.
// Built assets are content-hashed, so cache-first is safe for them.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate' && url.pathname.startsWith('/staff')) {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/staff/', copy)); return res;
    }).catch(() => caches.match('/staff/')));
  } else if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    })));
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Tempahan baru', {
    body: d.body || '',
    tag: d.tag || 'booking',
    renotify: true,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { job: d.job || null },
  }));
});

// Tap: focus an open app window and open the job there, or launch the app on it.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const job = e.notification.data?.job;
  const url = job ? `/staff/?job=${encodeURIComponent(job)}` : '/staff/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const w = wins.find((c) => new URL(c.url).pathname.startsWith('/staff'));
    if (w) { w.postMessage({ type: 'open-job', job }); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
