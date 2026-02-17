const CACHE_NAME = "task-reminder-v2";
const urlsToCache = ["./", "./index.html", "./style.css", "./script.js"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  self.clients.claim();
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const taskId = e.notification.data?.taskId;
  if (e.action === "snooze") {
    // Kirim pesan ke halaman untuk membuka snooze
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "SNOOZE", taskId });
      });
    });
  } else {
    // Buka aplikasi
    e.waitUntil(self.clients.openWindow("./"));
  }
});

self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : {};
  self.registration.showNotification(data.title || "Task Reminder", {
    body: data.body || "You have a task!",
    icon: "icon-192.png",
    badge: "icon-192.png",
    actions: [{ action: "snooze", title: "Tunda 5 menit" }],
    data: { taskId: data.taskId }
  });
});
