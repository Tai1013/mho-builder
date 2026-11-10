<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { PARTS, RARITIES } from './data'
import { useBuild } from './composables/useBuild'
import { useUiPrefs } from './stores/uiPrefs'
import { useSavedBuilds } from './stores/savedBuilds'
import SlotCard from './components/SlotCard.vue'
import ArmorPicker from './components/ArmorPicker.vue'
import SkillSummary from './components/SkillSummary.vue'
import BuildStats from './components/BuildStats.vue'
import SelectChip from './components/SelectChip.vue'
import SavedBuilds from './components/SavedBuilds.vue'

const { targetRarity, setTargetRarity, clearAll, pickerOpen } = useBuild()
const { compactSlots } = storeToRefs(useUiPrefs())
const { builds } = storeToRefs(useSavedBuilds())
const listOpen = ref(false)

const targetOptions = [
  { value: 'max', label: '各部位最高' },
  ...RARITIES.map((r) => ({ value: r, label: `R${r}` })),
]
function onTarget(v: string) {
  setTargetRarity(v === 'max' ? 'max' : Number(v))
}
</script>

<template>
  <header class="topbar">
    <h1>MHO 自由配裝</h1>
    <div class="controls">
      <span class="target">
        <span class="label-text" aria-hidden="true">稀有度</span>
        <SelectChip class="target-chip" :value="targetRarity" :options="targetOptions" label="目標稀有度" @change="onTarget" />
      </span>
      <button type="button" class="ghost list-btn" @click="listOpen = true">
        配裝清單<span v-if="builds.length" class="list-count">{{ builds.length }}</span>
      </button>
    </div>
  </header>

  <main class="layout">
    <!-- 總防禦力／已裝備／技能數放最上面，讓下面的裝備和技能連在一起 -->
    <BuildStats class="top-stats" />
    <section class="slots" :class="{ compact: compactSlots }" aria-label="裝備欄位">
      <div class="slots-bar">
        <h2>裝備</h2>
        <button
          type="button"
          role="switch"
          class="switch"
          :aria-checked="compactSlots"
          @click="compactSlots = !compactSlots"
        >
          <span class="track" aria-hidden="true"><span class="knob" /></span>
          簡易排版
        </button>
        <button type="button" class="ghost clear-btn" aria-label="清除全部裝備" @click="clearAll">清除</button>
      </div>
      <SlotCard v-for="p in PARTS" :key="p.id" :part="p.id" :label="p.label" :compact="compactSlots" />
    </section>
    <SkillSummary :compact="compactSlots" />
  </main>

  <footer class="foot">
    資料來源：gamewith.ai《魔物獵人：旅人》。目前配裝會自動存在這台裝置，也會記錄在網址，可直接複製分享。
  </footer>

  <ArmorPicker v-if="pickerOpen" />
  <SavedBuilds v-if="listOpen" @close="listOpen = false" />
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 16px;
  padding-top: max(10px, env(safe-area-inset-top));
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 5;
}
h1 {
  margin: 0 auto 0 0;
  font-size: 17px;
  color: var(--text-strong);
  white-space: nowrap;
}
.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.target {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* 稀有度選單和「配裝清單」按鈕同高、同字重 */
.target .target-chip,
.controls .ghost {
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1;
}
.controls .ghost {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
.list-btn {
  gap: 5px;
}
.list-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
  max-width: 1080px;
  margin: 0 auto;
  align-items: start;
}
.top-stats {
  grid-column: 1 / -1;
}
.slots {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.slots.compact {
  gap: 6px;
}
.slots-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.clear-btn {
  height: 28px;
  padding: 0 10px;
  font-size: 13px;
  line-height: 1;
}
.slots-bar h2 {
  margin: 0 auto 0 0;
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
}
.switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: none;
  color: var(--text);
  font-size: 13px;
  padding: 2px 0;
  cursor: pointer;
}
.track {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--border);
  transition: background 0.15s;
  flex-shrink: 0;
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s;
}
.switch[aria-checked='true'] .track {
  background: var(--accent);
}
.switch[aria-checked='true'] .knob {
  transform: translateX(14px);
}
@media (max-width: 760px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
    padding: 12px;
    gap: 14px;
  }
}
@media (max-width: 420px) {
  .label-text {
    display: none;
  }
  .topbar {
    padding-left: 12px;
    padding-right: 12px;
  }
}
.foot {
  padding: 8px 16px 24px;
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
</style>
