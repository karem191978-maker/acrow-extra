// كشف الإضافي - Service Worker (نسخة مضبوطة للعمل بدون نت)
// لو عدلت أي ملف في التطبيق: غيّر رقم VERSION بس.
const VERSION = 'v10';
const CACHE = 'extra-calc-pwa-' + VERSION;
const INDEX = './index.html';
const OPTIONAL = ['./manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // الصفحة الأساسية إجبارية: لو فشلت التثبيت يتلغي ويحاول تاني (بدل ما يتثبت ناقص)
    const res = await fetch(INDEX, {cache: 'reload'});
    if (!res.ok) throw new Error('index.html not reachable');
    await cache.put(INDEX, res.clone());
    await cache.put('./', res.clone());
    // باقي الملفات: لو واحد ناقص ما يوقفش التثبيت
    await Promise.allSettled(OPTIONAL.map(async u => {
      const r = await fetch(u, {cache: 'reload'});
      if (r.ok) await cache.put(u, r);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('extra-calc-pwa-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // فتح التطبيق (من الأيقونة أو الرابط): دايماً من الكاش فوراً، حتى لو النت واقع أو ضعيف
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(INDEX);
      const refresh = fetch(INDEX, {cache: 'no-store'}).then(async r => {
        if (r && r.ok && !r.redirected) { await cache.put(INDEX, r.clone()); await cache.put('./', r.clone()); }
        return r;
      }).catch(() => null);
      if (cached) { event.waitUntil(refresh); return cached; }
      const fresh = await refresh;
      if (fresh && fresh.ok) return fresh;
      return new Response('<meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding:40px">افتح التطبيق مرة واحدة وإنت متصل بالنت عشان يشتغل بعد كده بدون نت.</body>', {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}});
    })());
    return;
  }

  // باقي الملفات: من الكاش الأول، والتحديث في الخلفية
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, {ignoreSearch: true});
    const refresh = fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()).catch(() => {}); return r; }).catch(() => null);
    if (cached) { event.waitUntil(refresh); return cached; }
    const fresh = await refresh;
    return fresh || new Response('', {status: 503, statusText: 'Offline'});
  })());
});
