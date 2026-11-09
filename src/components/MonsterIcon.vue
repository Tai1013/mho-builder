<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Monster } from '../types'

const props = withDefaults(defineProps<{ monster?: Monster; size?: number }>(), { size: 28 })
const failed = ref(false)
watch(
  () => props.monster?.id,
  () => (failed.value = false),
)
</script>

<template>
  <span class="micon" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.45)}px` }">
    <img
      v-if="monster && !failed"
      :src="monster.image"
      :alt="monster.name"
      :width="size"
      :height="size"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="failed = true"
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
</style>
