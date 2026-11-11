<script setup lang="ts">
import { ref, watch } from 'vue'

/** 冒險者／隨從的頭像（來源圖是 180×215 的直式卡片）；載不到圖時顯示名稱第一個字 */
const props = withDefaults(defineProps<{ src?: string; name?: string; width?: number }>(), { width: 36 })
const failed = ref(false)
watch(
  () => props.src,
  () => (failed.value = false),
)
</script>

<template>
  <span class="cimg" :style="{ width: `${width}px`, height: `${Math.round((width * 215) / 180)}px` }">
    <img
      v-if="src && !failed"
      :src="src"
      :alt="name ?? ''"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <span v-else class="fallback" aria-hidden="true">{{ name?.slice(0, 1) }}</span>
  </span>
</template>

<style scoped>
.cimg {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
  background: var(--chip);
}
.cimg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.fallback {
  color: var(--muted);
  font-weight: 700;
}
</style>
