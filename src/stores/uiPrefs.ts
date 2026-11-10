import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const KEY = 'mho-ui-prefs'

type SavedPrefs = { compactSlots?: boolean }

function load(): SavedPrefs {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as SavedPrefs) ?? {}
  } catch {
    return {}
  }
}

/**
 * 介面偏好（存在瀏覽器裡，重新整理後保留）。
 * compactSlots：簡易排版。配裝欄位只顯示魔物圖、稀有度、技能；套裝技能只顯示名稱、加成、件數、是否發動；技能合計只顯示技能、格子、等級。
 */
export const useUiPrefs = defineStore('uiPrefs', () => {
  const compactSlots = ref(load().compactSlots === true)

  watch(compactSlots, (v) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ compactSlots: v } satisfies SavedPrefs))
    } catch {
      // 無痕模式等情況存不了也沒關係，只是下次會回到預設
    }
  })

  return { compactSlots }
})
