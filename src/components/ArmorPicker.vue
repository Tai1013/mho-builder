<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePickerFilters } from '../stores/pickerFilters'
import {
  NO_MONSTER,
  PARTS,
  armorSkills,
  monsterLabel,
  monsterMap,
  monsterOptions,
  noMonsterSeriesCount,
  piecesByPart,
  seriesMap,
  seriesMatchesMonster,
  seriesMonster,
  setSkillMap,
  stageFor,
} from '../data'
import { useBuild } from '../composables/useBuild'
import type { ArmorPiece, Stage } from '../types'
import MonsterIcon from './MonsterIcon.vue'

const { slots, activePart, targetRarity, equip, equipSeries, closePicker, suppressHashRead } = useBuild()

// 篩選條件放在 Pinia：關掉視窗或換部位都會保留
const filters = usePickerFilters()
const { query, skill: skillFilter, monster: monsterFilter, sort: sortKey, hasFilters } = storeToRefs(filters)
const monsterOpen = ref(false)

const partLabel = computed(() => PARTS.find((p) => p.id === activePart.value)?.label ?? '')
const selectedMonster = computed(() =>
  monsterFilter.value && monsterFilter.value !== NO_MONSTER ? monsterMap.get(monsterFilter.value) : undefined,
)
const monsterFilterLabel = computed(() => {
  if (!monsterFilter.value) return '全部魔物'
  if (monsterFilter.value === NO_MONSTER) return '無魔物素材'
  return selectedMonster.value?.name ?? ''
})
const largeOptions = monsterOptions.filter((o) => o.monster.size === '大型')
const smallOptions = monsterOptions.filter((o) => o.monster.size !== '大型')

function pickMonster(id: string) {
  monsterFilter.value = monsterFilter.value === id ? '' : id
  monsterOpen.value = false
}

function searchText(p: ArmorPiece): string {
  const s = seriesMap.get(p.series)
  const set = p.setSkill ? setSkillMap.get(p.setSkill) : undefined
  return [
    p.name,
    p.nameEn ?? '',
    s?.name ?? '',
    monsterLabel(s),
    seriesMonster(s)?.nameEn ?? '',
    set?.name ?? '',
    ...p.stages.flatMap((st) => [st.name, ...st.skills.map((k) => k.name)]),
  ]
    .join(' ')
    .toLowerCase()
}

/** 篩選的技能不在目前稀有度時，提示從哪個稀有度開始才有 */
function filterNote(piece: ArmorPiece, stage: Stage): string | null {
  const id = skillFilter.value
  if (!id || stage.skills.some((k) => k.skillId === id)) return null
  const other = piece.stages.find((st) => st.skills.some((k) => k.skillId === id))
  if (!other) return null
  const k = other.skills.find((x) => x.skillId === id)!
  return `${k.name} Lv${k.level ?? '?'}：R${other.rarity} 起`
}

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = piecesByPart[activePart.value].map((piece) => {
    const stage = stageFor(piece, targetRarity.value)
    const series = seriesMap.get(piece.series)
    const set = piece.setSkill ? setSkillMap.get(piece.setSkill) : undefined
    return { piece, stage, series, set, monster: seriesMonster(series), note: filterNote(piece, stage) }
  })
  if (monsterFilter.value) list = list.filter((r) => seriesMatchesMonster(r.series, monsterFilter.value))
  if (q) list = list.filter((r) => searchText(r.piece).includes(q))
  if (skillFilter.value) {
    list = list.filter(
      (r) =>
        r.piece.stages.some((st) => st.skills.some((k) => k.skillId === skillFilter.value)) ||
        r.set?.grants.some((g) => g.skillId === skillFilter.value),
    )
  }
  if (sortKey.value === 'defense') list = [...list].sort((a, b) => b.stage.defense - a.stage.defense)
  if (sortKey.value === 'rarity') list = [...list].sort((a, b) => b.piece.rarityMax - a.piece.rarityMax || b.stage.defense - a.stage.defense)
  return list
})

const equippedId = computed(() => slots[activePart.value].pieceId)
function resetFilters() {
  filters.reset()
  monsterOpen.value = false
}

function choose(pieceId: string) {
  equip(pieceId)
  closePicker()
}
function chooseSeries(seriesId: string) {
  equipSeries(seriesId)
  closePicker()
}

// 換部位時清單回到最上面
const listEl = ref<HTMLElement | null>(null)
watch(activePart, () => nextTick(() => listEl.value?.scrollTo({ top: 0 })))

// ---------- 視窗行為：點外面收合魔物選單、Esc、返回鍵、鎖住背景捲動 ----------
const filterWrap = ref<HTMLElement | null>(null)
const sheetEl = ref<HTMLElement | null>(null)
let closedByHistory = false

function onPointerDown(e: PointerEvent) {
  if (monsterOpen.value && filterWrap.value && !filterWrap.value.contains(e.target as Node)) monsterOpen.value = false
}
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (monsterOpen.value) monsterOpen.value = false
  else closePicker()
}
function onPopState() {
  closedByHistory = true
  suppressHashRead()
  closePicker()
}
onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
  // 多推一筆歷史紀錄，手機按返回鍵時是關閉視窗而不是離開頁面
  history.pushState({ ...(history.state ?? {}), mhoPicker: true }, '')
  window.addEventListener('popstate', onPopState)
  document.documentElement.classList.add('modal-open')
  nextTick(() => sheetEl.value?.focus({ preventScroll: true }))
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('popstate', onPopState)
  document.documentElement.classList.remove('modal-open')
  if (!closedByHistory && history.state?.mhoPicker) {
    suppressHashRead()
    history.back()
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="closePicker">
      <div ref="sheetEl" class="sheet" role="dialog" aria-modal="true" aria-labelledby="picker-title" tabindex="-1">
        <header class="sheet-head">
          <div class="title-row">
            <h2 id="picker-title">選擇{{ partLabel }}</h2>
            <span class="count">{{ rows.length }} 件</span>
            <button v-if="hasFilters" type="button" class="link-btn" @click="resetFilters">清除篩選</button>
            <button type="button" class="close-btn" aria-label="關閉" @click="closePicker">×</button>
          </div>

          <div class="tabs" role="tablist" aria-label="部位">
            <button
              v-for="p in PARTS"
              :key="p.id"
              type="button"
              role="tab"
              :aria-selected="activePart === p.id"
              :class="{ on: activePart === p.id }"
              @click="activePart = p.id"
            >
              {{ p.label }}
            </button>
          </div>

          <div ref="filterWrap" class="filter-wrap">
            <div class="filters">
              <input v-model="query" type="search" placeholder="搜尋防具／魔物／技能名稱" aria-label="搜尋" />
              <button
                type="button"
                class="monster-btn"
                :class="{ set: monsterFilter }"
                :aria-expanded="monsterOpen"
                aria-controls="monster-grid"
                @click="monsterOpen = !monsterOpen"
              >
                <MonsterIcon v-if="selectedMonster" :monster="selectedMonster" :size="20" />
                <span>{{ monsterFilterLabel }}</span>
                <span class="caret" aria-hidden="true">{{ monsterOpen ? '▴' : '▾' }}</span>
              </button>
              <select v-model="skillFilter" aria-label="依技能篩選">
                <option value="">全部技能</option>
                <option v-for="s in armorSkills" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
              <select v-model="sortKey" aria-label="排序">
                <option value="default">預設排序</option>
                <option value="defense">防禦力高→低</option>
                <option value="rarity">稀有度高→低</option>
              </select>
            </div>

            <div v-if="monsterOpen" id="monster-grid" class="monster-panel">
              <div>
                <button type="button" class="mchip" :class="{ on: !monsterFilter }" @click="pickMonster('')">
                  <span class="mchip-name">全部魔物</span>
                </button>
              </div>
              <h4>大型魔物</h4>
              <div class="mp-grid">
                <button
                  v-for="o in largeOptions"
                  :key="o.monster.id"
                  type="button"
                  class="mchip"
                  :class="{ on: monsterFilter === o.monster.id }"
                  :title="o.monster.nameEn ?? o.monster.name"
                  @click="pickMonster(o.monster.id)"
                >
                  <MonsterIcon :monster="o.monster" :size="28" />
                  <span class="mchip-name">{{ o.monster.name }}</span>
                </button>
              </div>
              <h4>小型魔物素材</h4>
              <div class="mp-grid">
                <button
                  v-for="o in smallOptions"
                  :key="o.monster.id"
                  type="button"
                  class="mchip"
                  :class="{ on: monsterFilter === o.monster.id }"
                  @click="pickMonster(o.monster.id)"
                >
                  <MonsterIcon :monster="o.monster" :size="28" />
                  <span class="mchip-name">{{ o.monster.name }}<small> ×{{ o.seriesCount }}套</small></span>
                </button>
                <button
                  v-if="noMonsterSeriesCount"
                  type="button"
                  class="mchip"
                  :class="{ on: monsterFilter === NO_MONSTER }"
                  @click="pickMonster(NO_MONSTER)"
                >
                  <MonsterIcon :size="28" />
                  <span class="mchip-name">無魔物素材<small> ×{{ noMonsterSeriesCount }}套</small></span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <ul ref="listEl" class="list">
          <li
            v-for="r in rows"
            :key="r.piece.id"
            class="row"
            :class="{ equipped: equippedId === r.piece.id }"
          >
            <button type="button" class="row-main" @click="choose(r.piece.id)">
              <MonsterIcon class="row-icon" :monster="r.monster" :size="40" />
              <div class="row-body">
                <div class="row-top">
                  <span class="row-name">{{ r.stage.name }}</span>
                  <span v-if="equippedId === r.piece.id" class="now">裝備中</span>
                  <span class="badge">R{{ r.stage.rarity }}</span>
                  <span class="def">防 {{ r.stage.defense }}</span>
                </div>
                <div class="row-sub">
                  <span class="monster">{{ monsterLabel(r.series) }}</span>
                  <span>{{ r.series?.name }}</span>
                  <span>R{{ r.piece.rarityMin }}–{{ r.piece.rarityMax }}</span>
                </div>
                <div class="row-skills">
                  <span
                    v-for="k in r.stage.skills"
                    :key="k.skillId"
                    class="chip"
                    :class="{ hit: k.skillId === skillFilter }"
                  >
                    {{ k.name }} Lv{{ k.level ?? '?' }}
                  </span>
                  <span v-if="!r.stage.skills.length" class="muted">此稀有度無技能</span>
                  <span v-if="r.note" class="chip hit later">{{ r.note }}</span>
                </div>
                <div v-if="r.set" class="row-set" :class="{ hit: r.set.grants.some((g) => g.skillId === skillFilter) }">
                  套裝 {{ r.set.name }}（{{ r.set.requiredPieces }} 件：{{ r.set.bonusLabel }}）
                </div>
              </div>
            </button>
            <button type="button" class="series-btn" title="一次裝上整套" @click="chooseSeries(r.piece.series)">整套</button>
          </li>
          <li v-if="!rows.length" class="empty">沒有符合條件的防具</li>
        </ul>
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
.sheet {
  width: min(760px, 100%);
  height: min(88vh, 920px);
  background: var(--bg);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none;
}
/* 手機：全螢幕 */
@media (max-width: 720px) {
  .backdrop {
    padding: 0;
  }
  .sheet {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }
}
.sheet-head {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  padding-top: max(12px, env(safe-area-inset-top));
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-row h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-strong);
}
.count {
  color: var(--muted);
  font-size: 13px;
}
.link-btn {
  margin-left: auto;
  border: 0;
  background: none;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
  padding: 4px;
}
.close-btn {
  margin-left: auto;
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
.link-btn + .close-btn {
  margin-left: 4px;
}
.close-btn:hover {
  color: var(--accent);
}
.tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs button {
  flex-shrink: 0;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 14px;
  cursor: pointer;
}
.tabs button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
.filter-wrap {
  position: relative;
}
.filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.filters input {
  min-width: 0;
  grid-column: 1 / -1;
}
.filters select {
  min-width: 0;
}
.monster-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  padding: 3px 8px;
  cursor: pointer;
  white-space: nowrap;
  min-width: 0;
}
.monster-btn span:not(.caret) {
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 跟旁邊的下拉選單同樣大小（觸控裝置上下拉選單是 16px） */
@media (pointer: coarse), (max-width: 720px) {
  .monster-btn {
    font-size: 16px;
  }
}
.monster-btn.set {
  border-color: var(--accent-border);
  color: var(--accent);
  font-weight: 600;
}
.caret {
  font-size: 10px;
  color: var(--muted);
  margin-left: auto;
}
.monster-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: min(60vh, 420px);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.monster-panel h4 {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.mp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px;
}
.mchip {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid transparent;
  background: none;
  border-radius: 8px;
  padding: 3px 6px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  min-width: 0;
}
.mchip:hover {
  background: var(--hover);
}
.mchip.on {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 700;
}
.mchip-name {
  line-height: 1.25;
  word-break: break-all;
}
.mchip-name small {
  color: var(--muted);
  font-weight: 400;
}
.list {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
  margin: 0;
  padding: 10px 16px 24px;
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: flex;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  overflow: hidden;
}
.row.equipped {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-bg);
}
.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  text-align: left;
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  padding: 8px 10px;
  cursor: pointer;
}
.row-main:hover {
  background: var(--hover);
}
.row-icon {
  margin-top: 2px;
}
.row-body {
  flex: 1;
  min-width: 0;
}
.row-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.row-name {
  font-weight: 700;
  color: var(--text-strong);
  margin-right: auto;
  min-width: 0;
}
.now {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  white-space: nowrap;
}
.badge {
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
  padding: 0 5px;
  background: var(--chip);
}
.def {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  white-space: nowrap;
}
.row-sub {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  flex-wrap: wrap;
}
.row-sub .monster {
  color: var(--text);
  font-weight: 600;
}
.row-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.chip {
  font-size: 12px;
  background: var(--chip);
  border-radius: 6px;
  padding: 1px 6px;
}
.chip.hit,
.row-set.hit {
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 700;
}
.chip.later {
  background: none;
  border: 1px dashed var(--accent-border);
  font-weight: 600;
}
.row-set {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
  border-radius: 6px;
  display: inline-block;
  padding: 0 4px;
  margin-left: -4px;
}
.muted {
  font-size: 12px;
  color: var(--muted);
}
.series-btn {
  border: 0;
  border-left: 1px solid var(--border);
  background: none;
  color: var(--muted);
  font-size: 12px;
  padding: 0 10px;
  cursor: pointer;
  writing-mode: vertical-rl;
  letter-spacing: 0.2em;
}
.series-btn:hover {
  background: var(--hover);
  color: var(--accent);
}
.empty {
  color: var(--muted);
  font-size: 14px;
  padding: 16px;
  text-align: center;
}
</style>
