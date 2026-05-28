// Service Worker to satisfy PWA requirements and handle Web Push Notifications
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Let browser fetch normally
});

// Handle incoming Push Notification events
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'New Message';
  const options = {
    body: data.body || 'You received a new message.',
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo.png',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle user clicking on the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Look for an existing open window under our domain
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to URL and focus
          return client.navigate(targetUrl).then(c => c.focus());
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
