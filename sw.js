const CACHE_NAME = "spm-watch-serian-v28";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/sarawak-flag.png",
  "./assets/fonts/orbitron-medium.ttf",
  "./assets/fonts/orbitron-bold.ttf",
  "./assets/fonts/OFL-Orbitron.md"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
