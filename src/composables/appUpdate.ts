/** 新版已下載完成時立即切換，並在新 service worker 接手後重載頁面。 */
function activateUpdate(worker: ServiceWorker) {
  worker.postMessage('skip-waiting')
}

/**
 * 註冊 service worker（離線用，程式在 src/sw.js）。有網路時檢查新版，下載完成後自動切換。
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
    .then((reg) => {
      const check = () => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          activateUpdate(reg.waiting)
        }
      }
      const track = (w: ServiceWorker | null) =>
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed') check()
        })
      check()
      track(reg.installing)
      reg.addEventListener('updatefound', () => track(reg.installing))
      const checkOnline = () => {
        if (navigator.onLine) reg.update().catch(() => {})
      }
      // 啟動、恢復前景或網路重新連線時都檢查新版。
      checkOnline()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkOnline()
      })
      window.addEventListener('online', checkOnline)
    })
    .catch(() => {
      // 註冊失敗（例如瀏覽器關掉了這個功能）就照一般網頁使用
    })
}
