<script setup lang="ts">
import { PARTS, RARITIES } from './data'
import { useBuild } from './composables/useBuild'
import SlotCard from './components/SlotCard.vue'
import ArmorPicker from './components/ArmorPicker.vue'
import SkillSummary from './components/SkillSummary.vue'

const { targetRarity, setTargetRarity, clearAll, pickerOpen } = useBuild()

function onTarget(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  setTargetRarity(v === 'max' ? 'max' : Number(v))
}
</script>

<template>
  <header class="topbar">
    <h1>MHO 自由配裝</h1>
    <div class="controls">
      <label>
        <span class="label-text">稀有度</span>
        <select :value="targetRarity" aria-label="目標稀有度" @change="onTarget">
          <option value="max">各部位最高</option>
          <option v-for="r in RARITIES" :key="r" :value="r">R{{ r }}</option>
        </select>
      </label>
      <button type="button" class="ghost" @click="clearAll">全部清除</button>
    </div>
  </header>

  <main class="layout">
    <section class="slots" aria-label="裝備欄位">
      <SlotCard v-for="p in PARTS" :key="p.id" :part="p.id" :label="p.label" />
    </section>
    <SkillSummary />
  </main>

  <footer class="foot">
    資料來源：gamewith.ai《魔物獵人：旅人》。配裝會記錄在網址，可直接複製分享。
  </footer>

  <ArmorPicker v-if="pickerOpen" />
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
.controls label {
  display: flex;
  align-items: center;
  gap: 6px;
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
.slots {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
}
.foot {
  padding: 8px 16px 24px;
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
</style>
