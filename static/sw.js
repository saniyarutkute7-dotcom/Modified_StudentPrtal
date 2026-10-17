const CACHE_NAME = "student-portal-v4";

const FILES_TO_CACHE = [
  "index.html",
  "login.html",
  "home.html",
  "dashboard.html",
  "profile.html",
  "attendance.html",
  "result.html",
  "subject.html",
  "performance.html",
  "assignments.html",
  "notes.html",
  "projects.html",
  "timetable.html",
  "portal.js",
  "icon.png",
  "manifest.json"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network first (always the latest files), cache only when offline
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
