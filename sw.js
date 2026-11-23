/* Service Worker — المتابعة التربوية. يُولَّد الإصدار وقائمة الملفات أثناء البناء. */
const VERSION = '801ae231abf6';
const PREFIX = 'mutabaa-beta-'; // النسخة الأصلية والتجريبية على الموقع نفسه: لكل منهما ذاكرتها
const CACHE = `${PREFIX}${VERSION}`;
const mine = (k) => k.startsWith(PREFIX) && (PREFIX !== 'mutabaa-' || !k.startsWith('mutabaa-beta-'));
const FILES = ["./","app.css","app.js","bg.js","fonts/OFL.txt","fonts/amiri.woff","fonts/noto-naskh.woff","icon-192.png","icon-512-maskable.png","icon-512.png","index.html","issuer.html","manifest.webmanifest","pdf.worker.min.js","privacy.html"];

self.addEventListener('install', (event) => {
  // تحديث تلقائي: الإصدار الجديد يتولى فور تخزينه (البيانات في IndexedDB لا تتأثر)
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE && mine(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // روابط blob:/data: (تنزيل Excel والنسخ الاحتياطية) لها أصل الصفحة نفسه: يجب ألا يعترضها SW
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== self.location.origin) return; // لا نخزن طلبات Microsoft/Google
  if (req.mode === 'navigate') {
    // الشبكة أولا للصفحة، ثم النسخة المخزنة عند انقطاع الإنترنت
    event.respondWith(fetch(req).catch(() => caches.match('./index.html').then((r) => r ?? caches.match('./'))));
    return;
  }
  // الملفات مُصدَرة بالبصمة: المخزن أولا
  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});

// جاهزية الإشعارات (تُفعَّل في المرحلة الخامسة)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? './';
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) { c.navigate(target); return c.focus(); }
    return self.clients.openWindow(target);
  }));
});

// تنبيه تلاميذ اليوم في الخلفية: يوقظ Chrome التطبيق المثبت دوريا (توقيته بيد المتصفح)
try { importScripts('./bg.js'); } catch { /* نسخة دون تنبيهات الخلفية */ }
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'digest' && self.mutabaaBg) event.waitUntil(self.mutabaaBg.run().catch(() => undefined));
});
