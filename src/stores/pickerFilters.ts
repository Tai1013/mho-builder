import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type SortKey = 'default' | 'defense' | 'rarity'

/**
 * 防具選擇視窗的篩選條件。
 * 存在 store 裡，關掉視窗、切換或點選其他部位時都會保留（例如頭部篩了「火龍」，點胸部時一樣是火龍）。
 */
export const usePickerFilters = defineStore('pickerFilters', () => {
  const query = ref('')
  /** 技能 id，空字串＝全部 */
  const skill = ref('')
  /** 魔物 id、NO_MONSTER，空字串＝全部 */
  const monster = ref('')
  const sort = ref<SortKey>('default')

  const hasFilters = computed(() => !!(query.value || skill.value || monster.value))

  function reset() {
    query.value = ''
    skill.value = ''
    monster.value = ''
  }

  return { query, skill, monster, sort, hasFilters, reset }
})
