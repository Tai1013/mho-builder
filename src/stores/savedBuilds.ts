import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const KEY = 'mho-saved-builds'

export interface SavedBuild {
  id: string
  /** 使用者取的標題 */
  name: string
  /** 配裝代碼，跟網址 # 後面的格式一樣（例：head=great-jagras.9&legs=kulu-ya-ku.7） */
  code: string
  savedAt: number
}

function load(): SavedBuild[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(
      (b): b is SavedBuild =>
        b && typeof b.id === 'string' && typeof b.name === 'string' && typeof b.code === 'string',
    )
  } catch {
    return []
  }
}

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * 配裝清單（存在瀏覽器裡，重新整理後保留）。
 * 最新存的放最上面。
 */
export const useSavedBuilds = defineStore('savedBuilds', () => {
  const builds = ref<SavedBuild[]>(load())

  watch(
    builds,
    (v) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(v))
      } catch {
        // 無痕模式等情況存不了，清單只會留到關掉分頁為止
      }
    },
    { deep: true },
  )

  /** 預設標題：配裝 1、配裝 2…（跳過已經用掉的號碼） */
  function nextDefaultName() {
    const used = new Set(builds.value.map((b) => b.name))
    let n = builds.value.length + 1
    while (used.has(`配裝 ${n}`)) n++
    return `配裝 ${n}`
  }

  function add(name: string, code: string) {
    const build: SavedBuild = { id: newId(), name: name.trim() || nextDefaultName(), code, savedAt: Date.now() }
    builds.value.unshift(build)
    return build
  }

  function find(id: string) {
    return builds.value.find((b) => b.id === id)
  }

  function rename(id: string, name: string) {
    const b = find(id)
    if (b && name.trim()) b.name = name.trim()
  }

  /** 用目前的配裝覆蓋這一組 */
  function overwrite(id: string, code: string) {
    const b = find(id)
    if (!b) return
    b.code = code
    b.savedAt = Date.now()
  }

  function remove(id: string) {
    builds.value = builds.value.filter((b) => b.id !== id)
  }

  return { builds, nextDefaultName, add, rename, overwrite, remove }
})
