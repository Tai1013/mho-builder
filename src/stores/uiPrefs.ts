import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

// 這個 key 和 theme 欄位，index.html 開頭的小腳本也會讀（頁面一載入就套用主題，避免先閃一下）
const KEY = 'mho-ui-prefs'

/** 自動＝跟著手機／電腦的深淺色設定 */
export type Theme = 'auto' | 'light' | 'dark'
const THEMES: Theme[] = ['auto', 'light', 'dark']

type SavedPrefs = { compactSlots?: boolean; theme?: Theme }

function load(): SavedPrefs {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as SavedPrefs) ?? {}
  } catch {
    return {}
  }
}

/** 套用到 html 的 data-theme（自動時拿掉，交給 CSS 的 prefers-color-scheme） */
function applyTheme(theme: Theme) {
  const el = document.documentElement
  if (theme === 'auto') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', theme)
}

/**
 * 介面偏好（存在瀏覽器裡，重新整理後保留）。
 * compactSlots：簡易排版。配裝欄位只顯示魔物圖、稀有度、技能；套裝技能只顯示名稱、加成、件數、是否發動；技能合計只顯示技能、格子、等級。
 * theme：主題，右上角的按鈕在 自動 → 淺色 → 深色 之間輪流切換。
 */
export const useUiPrefs = defineStore('uiPrefs', () => {
  const saved = load()
  const compactSlots = ref(saved.compactSlots === true)
  const theme = ref<Theme>(THEMES.includes(saved.theme as Theme) ? (saved.theme as Theme) : 'auto')

  function cycleTheme() {
    theme.value = THEMES[(THEMES.indexOf(theme.value) + 1) % THEMES.length]
  }

  watch(theme, applyTheme, { immediate: true })
  watch([compactSlots, theme], () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ compactSlots: compactSlots.value, theme: theme.value } satisfies SavedPrefs))
    } catch {
      // 無痕模式等情況存不了也沒關係，只是下次會回到預設
    }
  })

  return { compactSlots, theme, cycleTheme }
})
