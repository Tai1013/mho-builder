<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { AggregatedSkill } from '../composables/useBuild'
import { useModalHistory } from '../composables/useModalHistory'

/** 技能合計點進來的說明視窗：列出每一級的效果，標出目前生效的等級 */
const props = defineProps<{ entry: AggregatedSkill }>()
const emit = defineEmits<{ close: [] }>()
const close = () => emit('close')
useModalHistory(close)

const dialogEl = ref<HTMLElement | null>(null)
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  nextTick(() => dialogEl.value?.focus({ preventScroll: true }))
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

const isOver = () => props.entry.raw > props.entry.level
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="close">
      <div
        ref="dialogEl"
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-detail-title"
        tabindex="-1"
      >
        <header class="head">
          <div class="title">
            <h2 id="skill-detail-title">{{ entry.name }}</h2>
            <span v-if="entry.skill?.nameEn" class="en">{{ entry.skill.nameEn }}</span>
          </div>
          <button type="button" class="close-btn" aria-label="關閉" @click="close">×</button>
        </header>

        <div class="body">
          <div class="now">
            目前
            <b>Lv{{ entry.raw }}<template v-if="entry.maxLevel">/{{ entry.maxLevel }}</template></b>
            <span v-if="isOver()" class="over-note">超過上限，生效 Lv{{ entry.level }}</span>
            <span v-if="entry.uncertain" class="warn-note">部分來源未標示等級，暫以 Lv1 計算</span>
          </div>
          <p v-if="entry.skill?.description" class="desc">{{ entry.skill.description }}</p>

          <ol v-if="entry.skill?.levels.length" class="levels">
            <li v-for="l in entry.skill.levels" :key="l.level" class="lv-row" :class="{ on: l.level === entry.level }">
              <span class="lv">Lv{{ l.level }}</span>
              <span class="effect">{{ l.effect }}</span>
            </li>
          </ol>
          <p v-else class="muted">沒有各等級的說明資料</p>

          <div class="src-title">來源</div>
          <ul class="sources">
            <li v-for="(src, i) in entry.sources" :key="i" :class="{ set: src.fromSet }">
              <span>{{ src.label }}</span>
              <b>+{{ src.level }}<template v-if="src.uncertain">?</template></b>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(12, 10, 16, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.dialog {
  width: min(560px, 100%);
  max-height: min(88vh, 920px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  outline: none;
}
/* 手機：跟選防具視窗一樣全螢幕，內容上下滑動 */
@media (max-width: 720px) {
  .backdrop {
    padding: 0;
  }
  .dialog {
    width: 100%;
    height: 100%;
    max-height: none;
    border-radius: 0;
  }
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 10px 16px;
  padding-top: max(12px, env(safe-area-inset-top));
  border-bottom: 1px solid var(--border);
}
.title {
  min-width: 0;
  margin-right: auto;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px 8px;
}
.title h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-strong);
}
.en {
  font-size: 12px;
  color: var(--muted);
}
.close-btn {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 999px;
  background: var(--chip);
  color: var(--text);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}
@media (hover: hover) {
  .close-btn:hover {
    color: var(--accent);
  }
}
.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* 內容不要被壓縮（等級表有 overflow: hidden，被壓到會把後面的等級切掉），超出時整區上下滑 */
.body > * {
  flex-shrink: 0;
}
.now {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: 13px;
  color: var(--muted);
}
.now b {
  font-size: 16px;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.over-note {
  color: var(--warn);
}
.over-note,
.warn-note {
  font-size: 12px;
}
.warn-note {
  color: var(--warn);
}
.desc {
  margin: 0;
  font-size: 14px;
  color: var(--text);
}
.levels {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.lv-row {
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  font-size: 14px;
}
.lv-row + .lv-row {
  border-top: 1px solid var(--border);
}
.lv-row .lv {
  flex-shrink: 0;
  width: 36px;
  font-weight: 700;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.lv-row.on {
  background: var(--accent-bg);
}
.lv-row.on .lv {
  color: var(--accent);
}
.lv-row.on .effect {
  color: var(--text-strong);
  font-weight: 600;
}
.src-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}
.sources {
  list-style: none;
  margin: -6px 0 0;
  padding: 0;
  font-size: 13px;
}
.sources li {
  display: flex;
  gap: 8px;
  padding: 3px 0;
}
.sources li span {
  margin-right: auto;
}
.sources li.set {
  color: var(--good);
}
.muted {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}
</style>
