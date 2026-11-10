<script setup lang="ts">
/** 技能合計超過最高等級時，接在格子右邊的紅色 ✕ 方塊，大小跟格子一樣（超出幾級看 Lv4/3） */
defineProps<{ extra: number }>()
</script>

<template>
  <svg
    class="over-cap"
    viewBox="0 0 8 8"
    width="8"
    height="8"
    role="img"
    :aria-label="`超過上限 ${extra} 級`"
  >
    <title>超過上限 +{{ extra }}</title>
    <rect width="8" height="8" rx="2" />
    <path d="M2.4 2.4 5.6 5.6M5.6 2.4 2.4 5.6" />
  </svg>
</template>

<style scoped>
.over-cap {
  flex-shrink: 0;
  display: block;
}
.over-cap rect {
  fill: var(--over);
}
.over-cap path {
  stroke: var(--on-over);
  stroke-width: 1.2;
  stroke-linecap: round;
}
</style>
