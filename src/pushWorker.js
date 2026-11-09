self.addEventListener('push', event => {
  let payload = {};
  try { const parsed = event.data.json(); if (parsed && typeof parsed === 'object') payload = parsed; } catch { /* Every received push still displays a visible notification. */ }
  event.waitUntil(self.registration.showNotification(String(payload.title || 'Class reminder').slice(0, 160), {
    body: String(payload.body || 'Open your timetable for class details.').slice(0, 500),
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    tag: String(payload.tag || 'class-reminder').slice(0, 200),
    data: { url: typeof payload.url === 'string' ? payload.url : '/?view=schedule' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    let url;
    try { url = new URL(event.notification.data?.url || '/?view=schedule', self.location.origin); } catch { url = new URL('/?view=schedule', self.location.origin); }
    if (url.origin !== self.location.origin || url.pathname !== '/') url = new URL('/?view=schedule', self.location.origin);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find(item => new URL(item.url).origin === self.location.origin);
    if (client) {
      try { const navigated = await client.navigate(url.href); if (navigated) return navigated.focus(); } catch { /* Open a fresh app window if the old one cannot navigate. */ }
    }
    return self.clients.openWindow(url.href);
  })());
});
