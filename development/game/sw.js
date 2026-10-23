const CACHE_NAME = "echo-town-desktop-v9-8";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./journey.css", "./content.js", "./strategy.js", "./projects.js", "./journey.js", "./save.js", "./engine.js", "./modes.js", "./audio.js", "./scene.js", "./journey-card.js", "./journey-ui.js", "./ui.js", "./game.js", "./manifest.webmanifest", "./favicon.svg", "./icon-192.svg", "./icon-512.svg"];
const MEDIA = ["./assets/stage-childhood.webp", "./assets/stage-adolescence.webp", "./assets/stage-youth.webp", "./assets/stage-middle.webp", "./assets/stage-later.webp", "./assets/scene-school.webp", "./assets/scene-festival.webp", "./assets/scene-station.webp", "./assets/scene-flood.webp", "./assets/scene-cinema.webp"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(APP_SHELL);
    await Promise.allSettled(MEDIA.map((url) => cache.add(url)));
  }));
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then(async (keys) => {
    await Promise.all(keys.filter((key) => key.startsWith("echo-town-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  }));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type !== "opaque") await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      if (event.request.mode === "navigate") {
        const page = await cache.match("./index.html");
        if (page) return page;
      }
      return new Response("", { status: 503, statusText: "Offline" });
    }
  }));
});
