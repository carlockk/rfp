const OFFLINE_DB_NAME = 'flota_offline';
const OFFLINE_DB_VERSION = 2;
const EVALUATION_STORE = 'evaluations_queue';

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EVALUATION_STORE)) {
        db.createObjectStore(EVALUATION_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getQueuedEvaluations() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVALUATION_STORE, 'readonly');
    const store = tx.objectStore(EVALUATION_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deleteQueuedEvaluation(id) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVALUATION_STORE, 'readwrite');
    tx.objectStore(EVALUATION_STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function syncEvaluationsInBackground() {
  const endpoint = new URL('/api/evaluations', self.location.origin).href;
  const queued = await getQueuedEvaluations();
  for (const item of queued) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload)
      });
      if (!response.ok) {
        throw new Error('Error enviando evaluación');
      }
      await deleteQueuedEvaluation(item.id);
    } catch (error) {
      console.error('Fallo al sincronizar evaluaciones en background', error);
      throw error;
    }
  }
}

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

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-evaluations') {
    event.waitUntil(syncEvaluationsInBackground());
  }
});
