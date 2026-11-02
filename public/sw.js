/* Service worker de Relincho (E4): recibe los avisos push y, al tocarlos,
 * abre la app en la pantalla del aviso. El payload solo trae un título
 * genérico y una ruta de la app (src/lib/push-payload.ts): nada clínico.
 * Sin caché offline: eso llega con la PWA offline (E14). */

/** Solo rutas de esta app; cualquier otra cosa abre la portada. */
function appUrl(url) {
  var origin = self.location.origin;
  if (typeof url !== "string" || url.charAt(0) !== "/" || url.charAt(1) === "/") return origin + "/";
  var target = new URL(url, origin);
  return target.origin === origin ? target.href : origin + "/";
}

self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Relincho", {
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = appUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        if (windows[i].url === url && "focus" in windows[i]) return windows[i].focus();
      }
      return clients.openWindow(url);
    }),
  );
});
