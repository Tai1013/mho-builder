<script setup lang="ts">
import { ref } from 'vue'

/**
 * 看起來 13px、高 32px 的小輸入框（選防具的搜尋框、配裝清單的標題／分享代碼都用這個）。
 * iPhone 點到字體小於 16px 的輸入框會自動放大畫面，所以輸入框本身維持 16px，
 * 再用 transform 等比縮小；外層固定 32px 高，版面算的是縮小後的大小。
 */
const model = defineModel<string>({ required: true })
withDefaults(
  defineProps<{
    label: string
    placeholder?: string
    type?: 'search' | 'text'
    maxlength?: number
    disabled?: boolean
    enterkeyhint?: 'done' | 'go' | 'search' | 'send'
  }>(),
  { type: 'search' },
)
const emit = defineEmits<{ blur: [] }>()

const el = ref<HTMLInputElement | null>(null)
defineExpose({
  focus: () => el.value?.focus(),
  select: () => el.value?.select(),
})
</script>

<template>
  <span class="compact-input" :class="{ disabled }">
    <input
      ref="el"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :aria-label="label"
      :maxlength="maxlength"
      :disabled="disabled"
      :enterkeyhint="enterkeyhint"
      autocomplete="off"
      spellcheck="false"
      @blur="emit('blur')"
    />
  </span>
</template>

<style scoped>
.compact-input {
  /* 13 / 16：縮小比例 */
  --k: 0.8125;
  position: relative;
  display: block;
  height: 32px;
  min-width: 0;
}
.compact-input input {
  position: absolute;
  top: 0;
  left: 0;
  /* 先放大到 1/k 再縮回來，縮完剛好填滿外層 */
  width: calc(100% / var(--k));
  height: calc(32px / var(--k));
  margin: 0;
  padding: 0 calc(8px / var(--k));
  border: calc(1px / var(--k)) solid var(--border);
  border-radius: calc(8px / var(--k));
  background: var(--surface);
  color: var(--text);
  font-size: 16px;
  transform: scale(var(--k));
  transform-origin: 0 0;
}
.compact-input input:focus {
  outline: calc(2px / var(--k)) solid var(--accent-border);
  outline-offset: 0;
}
.compact-input.disabled {
  opacity: 0.55;
}
</style>
