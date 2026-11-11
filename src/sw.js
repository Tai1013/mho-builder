/*
 * Service worker（離線用）的樣板。建置完成時 vite.config.ts 會把下面的 VERSION、FILES 換成這次的版本號和檔案清單，
 * 輸出成 dist/sw.js；開發時不會用到。
 *
 * 作法：網站檔案全部先存在手機裡，打開時直接用存好的，不等網路。
 * 瀏覽器會在背景比對 sw.js 有沒有變（版本號由檔案內容算出，沒改東西就完全一樣）。
 * 有變就是新版本：先在背景把新檔案下載好，再自動切換並重新載入已開啟的頁面。
 */

const VERSION = __VERSION__
const FILES = __FILES__

// 同一個網域（github.io）可能還有別的專案，快取名稱帶上網址範圍，清舊版本時才不會刪到別人的
const PREFIX = `mho:${self.registration.scope}:`
const CACHE = PREFIX + VERSION
const INDEX = new URL('./', self.registration.scope).href

self.addEventListener('install', (event) => {
  // cache: 'reload'：不用瀏覽器暫存的舊檔，一定向網站拿這一版的檔案
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      const hadPreviousVersion = keys.some((key) => key.startsWith(PREFIX) && key !== CACHE)
      await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
      if (hadPreviousVersion) {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        await Promise.all(
          clients
            .filter((client) => client.url.startsWith(self.registration.scope))
            .map((client) => client.navigate(client.url).catch(() => null)),
        )
      }
    })(),
  )
})

// 讓新版本立即接手，不等待舊版用戶端關閉。
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // 只管這個網站自己的檔案；魔物圖示在別的網站，照瀏覽器原本的方式載入
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // 打開網頁一律給存好的 index.html（配裝代碼在網址 # 後面，不影響）。
      // ignoreVary：JS、CSS 是帶 crossorigin 載入的，伺服器若回 Vary: Origin，不忽略會對不到存好的檔案
      const hit = await cache.match(req.mode === 'navigate' ? INDEX : req, { ignoreVary: true })
      return hit ?? fetch(req)
    }),
  )
})
