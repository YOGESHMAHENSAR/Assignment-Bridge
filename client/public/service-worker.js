self.addEventListener('push', (event) => {
  let notification = {};
  try {
    notification = event.data ? event.data.json() : {};
  } catch {
    notification = { title: 'Assignment Bridge', body: 'You have an update.' };
  }

  event.waitUntil(
    self.registration.showNotification(notification.title || 'Assignment Bridge', {
      body: notification.body || 'You have an update.',
      icon: '/notification-icon.svg',
      badge: '/notification-icon.svg',
      tag: notification.tag,
      data: { url: notification.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) target.href = self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find((candidate) => new URL(candidate.url).origin === self.location.origin);
      if (client) {
        client.navigate(target.href);
        return client.focus();
      }
      return self.clients.openWindow(target.href);
    })
  );
});
