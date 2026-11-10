import { ref } from 'vue'

/** 背景已經把新版本下載好，等使用者按「更新」 */
export const updateReady = ref(false)
let waiting: ServiceWorker | null = null

/**
 * 註冊 service worker（離線用，程式在 src/sw.js）。只在正式建置時註冊，開發時不用，免得改了程式還看到舊的。
 * 網站檔案存在手機裡，打開時直接用；瀏覽器在背景比對版本，有新版本就先下載好，再顯示更新提示。
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then((reg) => {
      const check = () => {
        // 第一次安裝時還沒有舊版本在管這個頁面（controller 是空的），不用提示
        if (reg.waiting && navigator.serviceWorker.controller) {
          waiting = reg.waiting
          updateReady.value = true
        }
      }
      const track = (w: ServiceWorker | null) =>
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed') check()
        })
      check()
      track(reg.installing)
      reg.addEventListener('updatefound', () => track(reg.installing))
      // App 放在背景很久再切回來時，也比對一次有沒有新版本
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {})
      })
    })
    .catch(() => {
      // 註冊失敗（例如瀏覽器關掉了這個功能）就照一般網頁使用
    })
}

/** 換成新版本：讓下載好的新版本接手，再重新載入頁面 */
export function applyUpdate() {
  if (!waiting) return
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
  waiting.postMessage('skip-waiting')
}

/** 先不更新：關掉提示，下次重新打開 App 時就會是新版 */
export function dismissUpdate() {
  updateReady.value = false
}
