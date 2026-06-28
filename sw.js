const CACHE_NAME = "puspa-gudang-v31";
const APP_SHELL = [
  "./",
  "./styles.css?v=15",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/logo.jpeg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/bootstrap-icons/font/bootstrap-icons.min.css",
  "./assets/bootstrap-icons/font/fonts/bootstrap-icons.woff2",
  "./assets/bootstrap-icons/font/fonts/bootstrap-icons.woff"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Hanya tangani request GET untuk aset statis internal dari origin yang sama.
  // Jangan meng-cache request API internal (/api/) atau request eksternal (Firebase, Supabase, dll).
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Hanya cache response yang valid/sukses
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // Abaikan error koneksi agar browser menangani secara normal jika tidak ada di cache
      });
    })
  );
});
