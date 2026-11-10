import { onBeforeUnmount, onMounted } from 'vue'
import { useBuild } from './useBuild'

/**
 * 全螢幕視窗（選防具、配裝清單）共用：
 * 開啟時多推一筆歷史紀錄，手機按返回鍵是關閉視窗而不是離開頁面；開著的時候鎖住背景捲動。
 */
export function useModalHistory(close: () => void) {
  const { suppressHashRead } = useBuild()
  let closedByHistory = false

  function onPopState() {
    closedByHistory = true
    suppressHashRead()
    close()
  }

  onMounted(() => {
    history.pushState({ ...(history.state ?? {}), mhoModal: true }, '')
    window.addEventListener('popstate', onPopState)
    document.documentElement.classList.add('modal-open')
  })
  onBeforeUnmount(() => {
    window.removeEventListener('popstate', onPopState)
    document.documentElement.classList.remove('modal-open')
    // 用 × 或選完關閉時，把剛剛推的那筆歷史紀錄退掉
    if (!closedByHistory && history.state?.mhoModal) {
      suppressHashRead()
      history.back()
    }
  })
}
