<script setup lang="ts">
import { computed } from 'vue'
import { monsterLabel, pieceMap, seriesMap, seriesMonster, setSkillMap, stageFor } from '../data'
import { useBuild } from '../composables/useBuild'
import type { PartId } from '../types'
import MonsterIcon from './MonsterIcon.vue'
import SelectChip from './SelectChip.vue'

const props = defineProps<{ part: PartId; label: string; compact?: boolean }>()
const { slots, openPicker, unequip, setRarity } = useBuild()

const piece = computed(() => {
  const id = slots[props.part].pieceId
  return id ? pieceMap.get(id) : undefined
})
const stage = computed(() => (piece.value ? stageFor(piece.value, slots[props.part].rarity ?? 'max') : undefined))
const series = computed(() => (piece.value ? seriesMap.get(piece.value.series) : undefined))
const setSkill = computed(() => (piece.value?.setSkill ? setSkillMap.get(piece.value.setSkill) : undefined))

const rarityOptions = computed(() => piece.value?.stages.map((st) => ({ value: st.rarity, label: `R${st.rarity}` })) ?? [])
function onRarity(v: string) {
  setRarity(props.part, Number(v))
}
</script>

<template>
  <div
    class="slot"
    :class="{ empty: !piece, compact }"
    role="button"
    tabindex="0"
    :aria-label="piece ? `更換${label}：${stage?.name}` : `選擇${label}`"
    @click="openPicker(part)"
    @keydown.enter.self="openPicker(part)"
  >
    <!-- 簡易排版：魔物圖、稀有度、技能（套裝看下方「套裝技能」） -->
    <template v-if="compact">
      <template v-if="piece && stage">
        <MonsterIcon class="c-icon" :monster="seriesMonster(series)" :size="36" />
        <div class="c-line">
          <SelectChip :value="stage.rarity" :options="rarityOptions" :label="`${label}稀有度`" @change="onRarity" />
          <span v-for="sk in stage.skills" :key="sk.skillId" class="c-skill">
            {{ sk.name }}<span class="lv">{{ sk.level ?? '?' }}</span>
          </span>
          <span v-if="!stage.skills.length" class="muted">無技能</span>
        </div>
      </template>
      <div v-else class="placeholder c-placeholder"><span class="plus" aria-hidden="true">＋</span>{{ label }}</div>
    </template>

    <template v-else>
    <div class="slot-head">
      <span class="part">{{ label }}</span>
      <template v-if="piece && stage">
        <SelectChip :value="stage.rarity" :options="rarityOptions" :label="`${label}稀有度`" @change="onRarity" />
        <button class="icon-btn" type="button" title="移除" aria-label="移除" @click.stop="unequip(part)">×</button>
      </template>
    </div>

    <template v-if="piece && stage">
      <div class="ident">
        <MonsterIcon :monster="seriesMonster(series)" :size="36" />
        <div class="ident-text">
          <div class="name">{{ stage.name }}</div>
          <div class="meta">
            <span class="monster">{{ monsterLabel(series) }}</span>
            <span class="dot">·</span>
            <span>防禦 <b class="num">{{ stage.defense }}</b></span>
          </div>
        </div>
      </div>
      <ul class="skills">
        <li v-for="sk in stage.skills" :key="sk.skillId">
          {{ sk.name }} <span class="lv">Lv{{ sk.level ?? '?' }}</span>
        </li>
        <li v-if="!stage.skills.length" class="muted">無技能</li>
      </ul>
      <div v-if="setSkill" class="set">套裝：{{ setSkill.name }}</div>
    </template>
    <div v-else class="placeholder"><span class="plus" aria-hidden="true">＋</span>選擇{{ label }}防具</div>
    </template>
  </div>
</template>

<style scoped>
.slot {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  min-width: 0;
}
@media (hover: hover) {
  .slot:hover {
    border-color: var(--accent-border);
  }
}
.slot.empty {
  border-style: dashed;
}
.slot-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.part {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.08em;
  margin-right: auto;
}
.ident {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.ident-text {
  min-width: 0;
}
.name {
  font-weight: 700;
  font-size: 15px;
  color: var(--text-strong);
}
.meta {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: baseline;
}
.monster {
  color: var(--text);
  font-weight: 600;
}
.dot {
  opacity: 0.6;
}
.skills {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  font-size: 13px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.skills li {
  background: var(--chip);
  border-radius: 6px;
  padding: 1px 6px;
}
.skills li.muted {
  background: none;
  color: var(--muted);
  padding: 0;
}
.lv {
  color: var(--accent);
  font-weight: 700;
  font-size: 12px;
}
.set {
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
}
.placeholder {
  font-size: 14px;
  color: var(--muted);
  padding: 8px 0 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.plus {
  color: var(--accent);
  font-weight: 700;
}

/* ---------- 簡易排版 ---------- */
.slot.compact {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
}
.c-icon {
  flex-shrink: 0;
}
.c-line {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}
.c-skill {
  background: var(--chip);
  border-radius: 6px;
  padding: 1px 6px;
  white-space: nowrap;
}
.c-skill .lv {
  margin-left: 3px;
}
.c-placeholder {
  padding: 4px 0;
}
.muted {
  font-size: 12px;
  color: var(--muted);
}
</style>
