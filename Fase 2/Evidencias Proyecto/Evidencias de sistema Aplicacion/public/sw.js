// ============================================================
// public/sw.js
// Service worker mínimo de E-Match (RF-23). Solo hace una cosa: si la
// persona abre o recarga una página sin internet, muestra /offline.html.
// NO guarda respuestas de la base de datos, de la sesión ni de las acciones
// del servidor, y no responde desde caché mientras haya conexión: así un
// despliegue nuevo se ve de inmediato y no queda nada privado en el
// dispositivo. Para forzar una actualización, cambiar el número de CACHE.
// ============================================================
const CACHE = "ematch-offline-v1";
const PAGINA_SIN_CONEXION = "/offline.html";

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.add(PAGINA_SIN_CONEXION)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  // Solo navegaciones (abrir o recargar una página); todo lo demás sigue su curso normal.
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(fetch(evento.request).catch(() => caches.match(PAGINA_SIN_CONEXION)));
});
