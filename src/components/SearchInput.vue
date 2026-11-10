<script setup lang="ts">
/**
 * 看起來 13px、高 32px，跟旁邊的篩選按鈕一樣大的搜尋框。
 * iPhone 點到字體小於 16px 的輸入框會自動放大畫面，所以輸入框本身維持 16px，
 * 再用 transform 等比縮小；外層固定 32px 高，版面算的是縮小後的大小。
 */
const model = defineModel<string>({ required: true })
defineProps<{ placeholder?: string; label: string }>()
</script>

<template>
  <span class="search-input">
    <input v-model="model" type="search" :placeholder="placeholder" :aria-label="label" />
  </span>
</template>

<style scoped>
.search-input {
  /* 13 / 16：縮小比例 */
  --k: 0.8125;
  position: relative;
  display: block;
  height: 32px;
  min-width: 0;
}
.search-input input {
  position: absolute;
  top: 0;
  left: 0;
  /* 先放大到 1/k 再縮回來，縮完剛好填滿外層 */
  width: calc(100% / var(--k));
  height: calc(32px / var(--k));
  margin: 0;
  padding: 0 calc(8px / var(--k));
  border-width: calc(1px / var(--k));
  border-radius: calc(8px / var(--k));
  font-size: 16px;
  transform: scale(var(--k));
  transform-origin: 0 0;
}
.search-input input:focus {
  outline-width: calc(2px / var(--k));
}
</style>
