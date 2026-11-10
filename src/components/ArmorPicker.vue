<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePickerFilters, type SortKey } from '../stores/pickerFilters'
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
  skillMap,
  stageFor,
} from '../data'
import { useBuild } from '../composables/useBuild'
import { useModalHistory } from '../composables/useModalHistory'
import type { ArmorPiece, Stage } from '../types'
import MonsterIcon from './MonsterIcon.vue'
import SelectChip from './SelectChip.vue'
import SearchInput from './SearchInput.vue'

const { slots, activePart, targetRarity, equip, equipSeries, closePicker } = useBuild()

// 篩選條件放在 Pinia：關掉視窗或換部位都會保留
const filters = usePickerFilters()
const {
  query,
  skills: skillFilter,
  skillMode,
  monsters: monsterFilter,
  sort: sortKey,
  hasFilters,
} = storeToRefs(filters)

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'default', label: '預設排序' },
  { value: 'defense', label: '防禦力高→低' },
  { value: 'rarity', label: '稀有度高→低' },
]
function onSort(v: string) {
  sortKey.value = v as SortKey
}

/** 目前展開的下拉面板（魔物／技能），一次只開一個 */
type Panel = 'monster' | 'skill'
const openPanel = ref<Panel | null>(null)
function togglePanel(p: Panel) {
  openPanel.value = openPanel.value === p ? null : p
}

const partLabel = computed(() => PARTS.find((p) => p.id === activePart.value)?.label ?? '')

// ---------- 魔物 ----------
const selectedMonsters = computed(() =>
  monsterFilter.value.map((id) =>
    id === NO_MONSTER
      ? { id, monster: undefined, name: '無魔物素材' }
      : { id, monster: monsterMap.get(id), name: monsterMap.get(id)?.name ?? id },
  ),
)
const monsterBtnLabel = computed(() => {
  const n = selectedMonsters.value.length
  if (!n) return '全部魔物'
  return n === 1 ? selectedMonsters.value[0].name : `${n} 隻`
})
const largeOptions = monsterOptions.filter((o) => o.monster.size === '大型')
const smallOptions = monsterOptions.filter((o) => o.monster.size !== '大型')

// ---------- 技能 ----------
const selectedSkillSet = computed(() => new Set(skillFilter.value))
const skillBtnLabel = computed(() => {
  const n = skillFilter.value.length
  if (!n) return '全部技能'
  return n === 1 ? (skillMap.get(skillFilter.value[0])?.name ?? '') : `技能 ×${n}`
})

/** 每件防具在任一稀有度或套裝效果中可取得的技能 */
const pieceSkillIds = new Map<string, Set<string>>()
function skillIdsOf(piece: ArmorPiece): Set<string> {
  let ids = pieceSkillIds.get(piece.id)
  if (!ids) {
    ids = new Set(piece.stages.flatMap((st) => st.skills.map((k) => k.skillId)))
    const set = piece.setSkill ? setSkillMap.get(piece.setSkill) : undefined
    set?.grants.forEach((g) => g.skillId && ids!.add(g.skillId))
    pieceSkillIds.set(piece.id, ids)
  }
  return ids
}

/** 技能面板的選項（可用面板內的搜尋框過濾） */
const skillQuery = ref('')
const skillOptions = computed(() => {
  const q = skillQuery.value.trim().toLowerCase()
  return armorSkills.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.nameEn ?? '').toLowerCase().includes(q))
})

// ---------- 清單 ----------
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
function filterNotes(piece: ArmorPiece, stage: Stage): string[] {
  const notes: string[] = []
  for (const id of skillFilter.value) {
    if (stage.skills.some((k) => k.skillId === id)) continue
    const other = piece.stages.find((st) => st.skills.some((k) => k.skillId === id))
    if (!other) continue
    const k = other.skills.find((x) => x.skillId === id)!
    notes.push(`${k.name} Lv${k.level ?? '?'}：R${other.rarity} 起`)
  }
  return notes
}

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  const wanted = skillFilter.value
  let list = piecesByPart[activePart.value].map((piece) => {
    const stage = stageFor(piece, targetRarity.value)
    const series = seriesMap.get(piece.series)
    const set = piece.setSkill ? setSkillMap.get(piece.setSkill) : undefined
    const ids = skillIdsOf(piece)
    return {
      piece,
      stage,
      series,
      set,
      monster: seriesMonster(series),
      notes: filterNotes(piece, stage),
      /** 符合幾個篩選技能（含其他稀有度、套裝） */
      matched: wanted.filter((id) => ids.has(id)).length,
      /** 目前稀有度下，篩選技能的等級合計 */
      matchedLevels: stage.skills.reduce((n, k) => n + (selectedSkillSet.value.has(k.skillId) ? (k.level ?? 1) : 0), 0),
      setHit: !!set?.grants.some((g) => g.skillId && selectedSkillSet.value.has(g.skillId)),
    }
  })
  if (monsterFilter.value.length) {
    list = list.filter((r) => monsterFilter.value.some((id) => seriesMatchesMonster(r.series, id)))
  }
  if (q) list = list.filter((r) => searchText(r.piece).includes(q))
  if (wanted.length) {
    list = list.filter((r) => (skillMode.value === 'all' ? r.matched === wanted.length : r.matched > 0))
    // 預設排序時，符合越多技能、等級越高的排越前面
    if (sortKey.value === 'default') {
      list = [...list].sort((a, b) => b.matched - a.matched || b.matchedLevels - a.matchedLevels)
    }
  }
  if (sortKey.value === 'defense') list = [...list].sort((a, b) => b.stage.defense - a.stage.defense)
  if (sortKey.value === 'rarity') list = [...list].sort((a, b) => b.piece.rarityMax - a.piece.rarityMax || b.stage.defense - a.stage.defense)
  return list
})

const equippedId = computed(() => slots[activePart.value].pieceId)
function resetFilters() {
  filters.reset()
  openPanel.value = null
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

// ---------- 視窗行為：點外面收合面板、Esc、返回鍵、鎖住背景捲動 ----------
const filterWrap = ref<HTMLElement | null>(null)
const sheetEl = ref<HTMLElement | null>(null)

function onPointerDown(e: PointerEvent) {
  const t = e.target as Element
  // 清單上的遮罩自己處理 click，避免收合面板的同時點到底下的防具
  if (!openPanel.value || t.closest?.('.scrim')) return
  if (filterWrap.value && !filterWrap.value.contains(t)) openPanel.value = null
}
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (openPanel.value) openPanel.value = null
  else closePicker()
}
// 手機返回鍵關閉視窗、鎖背景捲動
useModalHistory(closePicker)
onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
  nextTick(() => sheetEl.value?.focus({ preventScroll: true }))
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
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
            <SearchInput v-model="query" placeholder="搜尋防具／魔物／技能名稱" label="搜尋" />

            <div class="filters">
              <button
                type="button"
                class="fbtn"
                :class="{ set: monsterFilter.length, open: openPanel === 'monster' }"
                :aria-expanded="openPanel === 'monster'"
                aria-controls="monster-panel"
                @click="togglePanel('monster')"
              >
                <span v-if="selectedMonsters.length" class="stack">
                  <MonsterIcon v-for="m in selectedMonsters.slice(0, 2)" :key="m.id" :monster="m.monster" :size="20" />
                </span>
                <span class="lbl">{{ monsterBtnLabel }}</span>
                <span class="caret" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="fbtn"
                :class="{ set: skillFilter.length, open: openPanel === 'skill' }"
                :aria-expanded="openPanel === 'skill'"
                aria-controls="skill-panel"
                @click="togglePanel('skill')"
              >
                <span class="lbl">{{ skillBtnLabel }}</span>
                <span class="caret" aria-hidden="true" />
              </button>
              <SelectChip class="sort-chip" :value="sortKey" :options="sortOptions" label="排序" @change="onSort" />

              <!-- 魔物面板：可多選，符合任一隻就列出 -->
              <div v-if="openPanel === 'monster'" id="monster-panel" class="panel">
                <div class="panel-body">
                  <div class="panel-top">
                    <span class="hint">可多選，符合任一隻就列出</span>
                    <button v-if="monsterFilter.length" type="button" class="link-btn" @click="monsterFilter = []">
                      清除魔物
                    </button>
                  </div>
                  <h4>大型魔物</h4>
                  <div class="mp-grid">
                    <button
                      v-for="o in largeOptions"
                      :key="o.monster.id"
                      type="button"
                      class="mchip"
                      :class="{ on: monsterFilter.includes(o.monster.id) }"
                      :aria-pressed="monsterFilter.includes(o.monster.id)"
                      :title="o.monster.nameEn ?? o.monster.name"
                      @click="filters.toggleMonster(o.monster.id)"
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
                      :class="{ on: monsterFilter.includes(o.monster.id) }"
                      :aria-pressed="monsterFilter.includes(o.monster.id)"
                      @click="filters.toggleMonster(o.monster.id)"
                    >
                      <MonsterIcon :monster="o.monster" :size="28" />
                      <span class="mchip-name">{{ o.monster.name }}<small> ×{{ o.seriesCount }}套</small></span>
                    </button>
                    <button
                      v-if="noMonsterSeriesCount"
                      type="button"
                      class="mchip"
                      :class="{ on: monsterFilter.includes(NO_MONSTER) }"
                      :aria-pressed="monsterFilter.includes(NO_MONSTER)"
                      @click="filters.toggleMonster(NO_MONSTER)"
                    >
                      <MonsterIcon :size="28" />
                      <span class="mchip-name">無魔物素材<small> ×{{ noMonsterSeriesCount }}套</small></span>
                    </button>
                  </div>
                </div>
                <div class="panel-foot">
                  <button type="button" class="done-btn" @click="openPanel = null">完成（{{ rows.length }} 件）</button>
                </div>
              </div>

              <!-- 技能面板：可多選，可切換「任一／全部」 -->
              <div v-if="openPanel === 'skill'" id="skill-panel" class="panel">
                <div class="panel-body">
                  <div class="panel-top">
                    <SearchInput v-model="skillQuery" class="skill-search" placeholder="搜尋技能" label="搜尋技能" />
                    <button v-if="skillFilter.length" type="button" class="link-btn" @click="skillFilter = []">清除技能</button>
                  </div>
                  <div v-if="skillFilter.length > 1" class="mode" role="group" aria-label="多個技能的比對方式">
                    <span>比對方式</span>
                    <button type="button" :class="{ on: skillMode === 'any' }" :aria-pressed="skillMode === 'any'" @click="skillMode = 'any'">
                      有任一個
                    </button>
                    <button type="button" :class="{ on: skillMode === 'all' }" :aria-pressed="skillMode === 'all'" @click="skillMode = 'all'">
                      全部都有
                    </button>
                  </div>
                  <div class="sk-grid">
                    <button
                      v-for="s in skillOptions"
                      :key="s.id"
                      type="button"
                      class="schip"
                      :class="{ on: selectedSkillSet.has(s.id) }"
                      :aria-pressed="selectedSkillSet.has(s.id)"
                      @click="filters.toggleSkill(s.id)"
                    >
                      {{ s.name }}
                    </button>
                    <p v-if="!skillOptions.length" class="hint">找不到技能</p>
                  </div>
                </div>
                <div class="panel-foot">
                  <button type="button" class="done-btn" @click="openPanel = null">完成（{{ rows.length }} 件）</button>
                </div>
              </div>
            </div>

            <!-- 已選的魔物／技能，點一下移除 -->
            <div v-if="selectedMonsters.length || skillFilter.length" class="active-row">
              <button
                v-for="m in selectedMonsters"
                :key="m.id"
                type="button"
                class="achip"
                :aria-label="`移除魔物 ${m.name}`"
                @click="filters.toggleMonster(m.id)"
              >
                <MonsterIcon :monster="m.monster" :size="18" />
                {{ m.name }}<span class="x" aria-hidden="true">×</span>
              </button>
              <button
                v-for="id in skillFilter"
                :key="id"
                type="button"
                class="achip skill"
                :aria-label="`移除技能 ${skillMap.get(id)?.name}`"
                @click="filters.toggleSkill(id)"
              >
                {{ skillMap.get(id)?.name }}<span class="x" aria-hidden="true">×</span>
              </button>
              <button
                v-if="skillFilter.length > 1"
                type="button"
                class="achip mode-chip"
                :title="skillMode === 'all' ? '目前：技能全部都要有' : '目前：有任一個技能就列出'"
                @click="skillMode = skillMode === 'all' ? 'any' : 'all'"
              >
                {{ skillMode === 'all' ? '技能：全部都有' : '技能：有任一個' }} ⇄
              </button>
            </div>
          </div>
        </header>

        <!-- 面板打開時蓋住清單：點一下只收合面板，不會誤選到防具 -->
        <div v-if="openPanel" class="scrim" @click="openPanel = null" />

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
                    :class="{ hit: selectedSkillSet.has(k.skillId) }"
                  >
                    {{ k.name }} Lv{{ k.level ?? '?' }}
                  </span>
                  <span v-if="!r.stage.skills.length" class="muted">此稀有度無技能</span>
                  <span v-for="n in r.notes" :key="n" class="chip hit later">{{ n }}</span>
                </div>
                <div v-if="r.set" class="row-set" :class="{ hit: r.setHit }">
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
  position: relative;
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
  white-space: nowrap;
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
@media (hover: hover) {
  .close-btn:hover {
    color: var(--accent);
  }
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
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.filters {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
/* 魔物、技能、排序三顆一樣大，字級跟主畫面的稀有度選單一致（13px） */
.fbtn,
.filters .sort-chip {
  height: 32px;
  min-width: 0;
  padding: 0 8px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1;
}
.fbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
}
.fbtn .lbl {
  overflow: hidden;
  text-overflow: ellipsis;
}
.sort-chip :deep(.face) {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}
.sort-chip :deep(.caret) {
  margin-left: auto;
}
.fbtn.set {
  border-color: var(--accent-border);
  color: var(--accent);
  font-weight: 600;
}
.fbtn.open {
  border-color: var(--accent);
}
.stack {
  display: inline-flex;
  flex-shrink: 0;
}
.stack > * + * {
  margin-left: -8px;
}
/* 跟稀有度選單同一個三角形，展開時翻轉 */
.caret {
  flex-shrink: 0;
  margin-left: auto;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--muted);
  transition: transform 0.15s;
}
.fbtn.open .caret {
  transform: rotate(180deg);
}
.panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: min(62vh, 460px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}
.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-top .link-btn {
  margin-left: auto;
}
.skill-search {
  flex: 1;
  min-width: 0;
}
.hint {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
.panel h4 {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.panel-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.done-btn {
  margin-left: auto;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 700;
  padding: 7px 16px;
  cursor: pointer;
  white-space: nowrap;
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
  color: var(--text);
  border-radius: 8px;
  padding: 3px 6px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  min-width: 0;
}
@media (hover: hover) {
  .mchip:hover,
  .schip:hover {
    background: var(--hover);
  }
}
.mchip.on,
.schip.on {
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
.mode {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}
.mode span {
  margin-right: 4px;
}
.mode button {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
}
.mode button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
.sk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 4px;
}
.schip {
  border: 1px solid var(--border);
  background: none;
  color: var(--text);
  border-radius: 8px;
  padding: 5px 8px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  line-height: 1.25;
  word-break: break-all;
  min-width: 0;
}
.active-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  margin: 0 -16px;
  padding: 0 16px;
}
.achip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--accent);
  border-radius: 999px;
  padding: 2px 10px 2px 4px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.achip.skill,
.achip.mode-chip {
  padding-left: 10px;
}
.achip.mode-chip {
  background: none;
  border-style: dashed;
  font-weight: 500;
}
.achip .x {
  font-size: 15px;
  line-height: 1;
  opacity: 0.7;
}
.scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(12, 10, 16, 0.25);
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
@media (hover: hover) {
  .row-main:hover {
    background: var(--hover);
  }
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
@media (hover: hover) {
  .series-btn:hover {
    background: var(--hover);
    color: var(--accent);
  }
}
.empty {
  color: var(--muted);
  font-size: 14px;
  padding: 16px;
  text-align: center;
}
</style>
