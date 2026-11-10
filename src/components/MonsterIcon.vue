<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Monster } from '../types'

const props = withDefaults(defineProps<{ monster?: Monster; size?: number }>(), { size: 28 })

/**
 * 圖示來源依序嘗試：繪影圖示 → 魔物列表的圖示 → 名稱第一個字。
 * 繪影圖示只有列表圖示錯的魔物才有（融光種大凶豺龍）；它畫在一張紙上，要放大裁掉紙的邊緣。
 */
const sources = computed(() => {
  const m = props.monster
  if (!m) return []
  return [
    ...(m.visage ? [{ src: m.visage, visage: true }] : []),
    { src: m.image, visage: false },
  ]
})
const failed = ref(0)
watch(
  () => props.monster?.id,
  () => (failed.value = 0),
)
const current = computed(() => sources.value[failed.value])
</script>

<template>
  <span
    class="micon"
    :class="{ visage: current?.visage }"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.45)}px` }"
  >
    <img
      v-if="monster && current"
      :key="current.src"
      :src="current.src"
      :alt="monster.name"
      :width="size"
      :height="size"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="failed++"
    />
    <span v-else aria-hidden="true">{{ monster ? monster.name.replace('融光種', '')[0] : '—' }}</span>
  </span>
</template>

<style scoped>
.micon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--chip);
  color: var(--muted);
  overflow: hidden;
  font-weight: 700;
}
.micon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
/* 繪影圖：放大裁掉紙的邊緣，只留中間的圖示 */
.micon.visage img {
  object-fit: cover;
  transform: scale(1.6);
}
</style>
