/* EcoNova · Service worker (notificaciones push + caché de imágenes)
   IMPORTANTE: sube SIEMPRE sw.js junto con index.html, la carpeta assets/ y los icon-*.png. */
const VAPID_PUBLIC = 'BCNvt9EYFTcxvXW7lWBLBhBsQHzXq787uBBNkqyuBajCUSudYqLAe6LUFy93_VdhzmxNIK5HONPHikSV4CIyv7c';
const IMG_CACHE = 'eco-img-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== IMG_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Imágenes de la app (assets/) y de Supabase Storage: primero caché, así cargan al instante y sin trabarse. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const isImg = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(u.pathname);
  const ours = u.pathname.includes('/assets/') || u.pathname.includes('/storage/v1/object/public/');
  if (!(isImg && ours)) return;
  e.respondWith(caches.open(IMG_CACHE).then(async c => {
    const hit = await c.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(() => {});
      return res;
    } catch (err) { return hit || Response.error(); }
  }));
});

function b64ToBytes(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (_) { d = { title: 'EcoNova', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'EcoNova', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || './index.html#/notificaciones' }
  }));
});

self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    try {
      const old = e.oldSubscription;
      const key = (old && old.options && old.options.applicationServerKey) || b64ToBytes(VAPID_PUBLIC);
      const sub = e.newSubscription || await self.registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: key
      });
      const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      list.forEach(c => c.postMessage({ type: 'push-resubscribed', endpoint: sub && sub.endpoint }));
    } catch (_) { /* se reintentará al abrir la app */ }
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './index.html#/notificaciones';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) { if (c.navigate) c.navigate(url); return c.focus(); }
    }
    return clients.openWindow(url);
  }));
});
