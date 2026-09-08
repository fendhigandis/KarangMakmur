// Nama cache untuk versi aplikasi ini
// PENTING: Setiap kali index.html/app.js/style.css diperbarui, naikkan versi ini (v2, v3, dst)
// agar pengguna lama otomatis mendapatkan file terbaru, bukan versi cache lama.
const CACHE_NAME = 'siak-bumdes-cache-v3';

// Daftar file yang akan disimpan di memori perangkat pengguna
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './logo.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'
];

// Instalasi Service Worker dan melakukan caching
// Menggunakan penyimpanan satu-per-satu (bukan addAll) agar 1 aset gagal (mis. CDN lambat)
// tidak membatalkan seluruh proses instalasi Service Worker.
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        urlsToCache.map(url =>
          cache.add(url).catch(err => console.warn('Gagal cache:', url, err))
        )
      );
    })
  );
});

// Menangani permintaan jaringan (Network Request)
// Strategi: Cache First untuk aset statis, lalu perbarui cache di latar belakang (stale-while-revalidate)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    })
  );
});

// Membersihkan cache lama jika ada pembaruan versi (v2, v3, dst)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
