/* EcoNova · Service worker (notificaciones push)
   IMPORTANTE: sube SIEMPRE sw.js junto con index.html (y los icon-*.png).
   Si un despliegue deja sin sw.js al sitio, el navegador da de baja el service worker
   y los usuarios dejan de recibir push con la app cerrada. */
const VAPID_PUBLIC = 'BCNvt9EYFTcxvXW7lWBLBhBsQHzXq787uBBNkqyuBajCUSudYqLAe6LUFy93_VdhzmxNIK5HONPHikSV4CIyv7c';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
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

/* El navegador puede rotar/expirar la suscripción (p. ej. tras actualizar la app o el sistema).
   Se vuelve a crear aquí y se avisa a la app para que la guarde de nuevo en la base de datos. */
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
