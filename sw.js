// PERBAIKAN: nama cache dinaikkan versinya (v1 -> v2) supaya cache lama yang
// menyimpan index.html versi sebelumnya (masih pakai carousel-*.jpg) langsung
// dibuang saat Service Worker baru ini aktif, tanpa perlu Unregister manual
// lewat DevTools.
const CACHE = "portal-girimulyo1-v2";
const assets = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(assets))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE) return caches.delete(key);
      }))
    ).then(() => self.clients.claim()) // PERBAIKAN: langsung ambil alih tab yang sudah terbuka
  );
});

/**
 * PERBAIKAN UTAMA: sebelumnya SEMUA request (termasuk index.html) pakai
 * strategi cache-first ("caches.match(request) || fetch(...)"). Akibatnya,
 * setelah index.html ter-cache sekali, ia akan SELALU disajikan dari cache
 * selama nama CACHE tidak berubah -- update apa pun di GitHub tidak akan
 * pernah terlihat oleh pengunjung yang sudah pernah membuka portal ini.
 *
 * Sekarang dipisah jadi 2 strategi:
 * 1. Untuk NAVIGASI (membuka/refresh halaman -> index.html): network-first.
 *    Selalu coba ambil versi terbaru dari server dulu; cache cuma dipakai
 *    sebagai cadangan kalau sedang offline / server tidak terjangkau.
 * 2. Untuk aset lain (gambar, ikon, manifest, dst.): tetap cache-first,
 *    supaya tetap cepat dan hemat kuota/offline-friendly seperti sebelumnya.
 */
self.addEventListener("fetch", event => {
  const req = event.request;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then(res => res || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(res => res || fetch(req))
  );
});
