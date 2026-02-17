const CACHE_NAME = "task-reminder-v1";
const urlsToCache = ["./", "./index.html", "./style.css", "./script.js"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  self.clients.claim();
});

self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : {};
  self.registration.showNotification(data.title || "Task Reminder", {
    body: data.body || "You have a task!",
    icon: "icon-192.png",
    badge: "icon-192.png",
  });
});
