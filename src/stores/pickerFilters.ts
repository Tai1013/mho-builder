import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type SortKey = 'default' | 'defense' | 'rarity'
/** 多個技能時：any＝有其中任一個就列出，all＝全部都要有 */
export type SkillMode = 'any' | 'all'

/**
 * 防具選擇視窗的篩選條件。
 * 存在 store 裡，關掉視窗、切換或點選其他部位時都會保留（例如頭部篩了「火龍」，點胸部時一樣是火龍）。
 */
export const usePickerFilters = defineStore('pickerFilters', () => {
  const query = ref('')
  /** 技能 id，可多選；空陣列＝全部 */
  const skills = ref<string[]>([])
  const skillMode = ref<SkillMode>('any')
  /** 魔物 id 或 NO_MONSTER，可多選（符合任一隻就列出）；空陣列＝全部 */
  const monsters = ref<string[]>([])
  const sort = ref<SortKey>('default')

  const hasFilters = computed(() => !!(query.value || skills.value.length || monsters.value.length))

  function toggle(list: typeof skills, id: string) {
    list.value = list.value.includes(id) ? list.value.filter((x) => x !== id) : [...list.value, id]
  }
  const toggleSkill = (id: string) => toggle(skills, id)
  const toggleMonster = (id: string) => toggle(monsters, id)

  function reset() {
    query.value = ''
    skills.value = []
    monsters.value = []
  }

  return { query, skills, skillMode, monsters, sort, hasFilters, toggleSkill, toggleMonster, reset }
})
