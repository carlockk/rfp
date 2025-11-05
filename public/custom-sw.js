self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }
  let payload = {};
  try {
    payload = event.data.json();
  } catch (error) {
    payload = { title: 'Flota QR', body: event.data.text() };
  }

  const title = payload.title || 'Flota QR';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/log.png',
    badge: payload.badge || '/log.png',
    tag: payload.tag || 'flota-alert',
    data: payload.data || {},
    vibrate: payload.vibrate || [100, 50, 100],
    renotify: payload.renotify !== false,
    actions: payload.actions || []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (targetUrl) {
        const url = new URL(targetUrl, self.location.origin).href;
        const matchingClient = allClients.find((client) => client.url === url);
        if (matchingClient) {
          matchingClient.focus();
          return;
        }
        if (self.clients.openWindow) {
          await self.clients.openWindow(url);
          return;
        }
      }
      if (allClients.length > 0) {
        allClients[0].focus();
      } else if (self.clients.openWindow) {
        await self.clients.openWindow('/');
      }
    })()
  );
});
