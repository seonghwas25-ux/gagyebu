// 오프라인에서도 열리도록 앱 파일을 캐시. 파일을 고치면 VERSION을 올리세요.
const VERSION = 'gagyebu-v3';
const FILES = ['./', 'index.html', 'sync.js', 'firebase-config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 네트워크 우선, 실패하면 캐시 (오프라인 대응)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // 내 파일과 Firebase 라이브러리만 캐시. 로그인·데이터 통신은 건드리지 않음
  const url = new URL(e.request.url);
  if (url.origin !== location.origin && url.hostname !== 'www.gstatic.com') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
