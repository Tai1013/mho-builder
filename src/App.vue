<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { DATA_SOURCES, DATA_UPDATED_AT, PARTS, RARITIES, type CrewKind } from './data'
import { useBuild } from './composables/useBuild'
import { useUiPrefs } from './stores/uiPrefs'
import { useSavedBuilds } from './stores/savedBuilds'
import SlotCard from './components/SlotCard.vue'
import ArmorPicker from './components/ArmorPicker.vue'
import SkillSummary from './components/SkillSummary.vue'
import BuildStats from './components/BuildStats.vue'
import SelectChip from './components/SelectChip.vue'
import SavedBuilds from './components/SavedBuilds.vue'
import CrewCard from './components/CrewCard.vue'
import CrewPicker from './components/CrewPicker.vue'
import { applyUpdate, dismissUpdate, updateReady } from './composables/appUpdate'

const { targetRarity, setTargetRarity, clearAll, pickerOpen } = useBuild()
const uiPrefs = useUiPrefs()
const { compactSlots, theme } = storeToRefs(uiPrefs)
const THEME_LABEL = { auto: '自動', light: '淺色', dark: '深色' } as const
const { builds } = storeToRefs(useSavedBuilds())
const listOpen = ref(false)
/** 冒險者／隨從選擇視窗：打開時是哪一種 */
const crewOpen = ref<CrewKind | null>(null)

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
      <!-- 主題：點一下在 自動 → 淺色 → 深色 之間輪流切換 -->
      <button
        type="button"
        class="ghost theme-btn"
        :aria-label="`主題：${THEME_LABEL[theme]}（點一下切換）`"
        :title="`主題：${THEME_LABEL[theme]}`"
        @click="uiPrefs.cycleTheme()"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <!-- 自動：半黑半白的圓 -->
          <g v-if="theme === 'auto'">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
          </g>
          <!-- 淺色：太陽 -->
          <g v-else-if="theme === 'light'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </g>
          <!-- 深色：月亮 -->
          <path v-else d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </header>

  <main class="layout">
    <!-- 已裝備／技能數放最上面，讓下面的裝備和技能連在一起 -->
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
      <!-- 最上面左右兩格：冒險者、隨從 -->
      <div class="crew-row">
        <CrewCard kind="adventurer" :compact="compactSlots" @open="crewOpen = 'adventurer'" />
        <CrewCard kind="buddy" :compact="compactSlots" @open="crewOpen = 'buddy'" />
      </div>
      <SlotCard v-for="p in PARTS" :key="p.id" :part="p.id" :label="p.label" :compact="compactSlots" />
    </section>
    <SkillSummary :compact="compactSlots" />
  </main>

  <footer class="foot">
    <p>
      資料來源：<template v-for="(s, i) in DATA_SOURCES" :key="s.url"
        ><template v-if="i">、</template><a :href="s.url" target="_blank" rel="noopener">{{ s.name }}</a></template
      >《魔物獵人：旅人》
    </p>
    <p>資料更新：{{ DATA_UPDATED_AT }}</p>
    <p>目前配裝會自動存在這台裝置，也會記錄在網址，可直接複製分享。</p>
    <p class="notice">本站為非官方的配裝工具，僅供個人配裝使用，不放廣告、不做任何營利。</p>
  </footer>

  <ArmorPicker v-if="pickerOpen" />
  <SavedBuilds v-if="listOpen" @close="listOpen = false" />
  <CrewPicker v-if="crewOpen" :kind="crewOpen" @close="crewOpen = null" />

  <!-- 背景已下載好新版本時，從底部浮出 -->
  <div v-if="updateReady" class="update-bar" role="status">
    <span>有新版本</span>
    <button type="button" class="update-btn" @click="applyUpdate">更新</button>
    <button type="button" class="update-later" @click="dismissUpdate">稍後</button>
  </div>
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
.controls .theme-btn {
  width: 32px;
  padding: 0;
  justify-content: center;
  flex-shrink: 0;
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
.crew-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: inherit;
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
  /* 手機寬度：標題、間距、按鈕內距縮一點，主題按鈕才放得下（稀有度選「各部位最高」時最寬） */
  .topbar {
    padding-left: 12px;
    padding-right: 12px;
    gap: 8px;
  }
  h1 {
    font-size: 16px;
  }
  .controls {
    gap: 6px;
  }
  .target .target-chip,
  .controls .list-btn {
    padding: 0 8px;
  }
}
.foot {
  padding: 8px 16px 24px;
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
.foot p {
  margin: 0;
}
.foot p + p {
  margin-top: 2px;
}
.foot a {
  color: inherit;
}
.foot .notice {
  margin-top: 6px;
}

/* 更新提示：在選擇視窗（z-index 100）底下，開著視窗時不會擋到 */
.update-bar {
  position: fixed;
  left: 50%;
  bottom: max(16px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-strong);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  white-space: nowrap;
}
.update-bar span {
  font-weight: 600;
}
.update-btn {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.update-later {
  height: 32px;
  padding: 0 8px;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
</style>
