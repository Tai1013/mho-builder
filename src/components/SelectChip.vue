<script setup lang="ts">
/**
 * 外觀是小標籤、點下去是原生下拉選單。
 * 原生 select 透明蓋在上面且維持 16px，iPhone 點選時就不會自動放大畫面；
 * 看得到的文字則跟周圍一樣小，不會特別突出。
 */
const props = defineProps<{
  value: string | number
  options: { value: string | number; label: string }[]
  label: string
}>()
const emit = defineEmits<{ change: [value: string] }>()

function current() {
  return props.options.find((o) => String(o.value) === String(props.value))?.label ?? ''
}
</script>

<template>
  <span class="select-chip" @click.stop>
    <span class="face" aria-hidden="true">{{ current() }}<span class="caret" /></span>
    <select
      class="native"
      :value="value"
      :aria-label="label"
      @change="emit('change', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </span>
</template>

<style scoped>
.select-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  padding: 1px 6px;
  cursor: pointer;
}
@media (hover: hover) {
  .select-chip:hover {
    border-color: var(--accent-border);
  }
}
.face {
  white-space: nowrap;
  pointer-events: none;
}
.caret {
  display: inline-block;
  margin-left: 5px;
  vertical-align: middle;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--muted);
}
.native {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  /* 一定要 16px 以上，iPhone 才不會在點選時放大畫面 */
  font-size: 16px;
  margin: 0;
  padding: 0;
  border: 0;
}
</style>
