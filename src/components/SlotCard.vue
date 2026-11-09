<script setup lang="ts">
import { computed } from 'vue'
import { monsterLabel, pieceMap, seriesMap, seriesMonster, setSkillMap, stageFor } from '../data'
import { useBuild } from '../composables/useBuild'
import type { PartId } from '../types'
import MonsterIcon from './MonsterIcon.vue'

const props = defineProps<{ part: PartId; label: string }>()
const { slots, openPicker, unequip, setRarity } = useBuild()

const piece = computed(() => {
  const id = slots[props.part].pieceId
  return id ? pieceMap.get(id) : undefined
})
const stage = computed(() => (piece.value ? stageFor(piece.value, slots[props.part].rarity ?? 'max') : undefined))
const series = computed(() => (piece.value ? seriesMap.get(piece.value.series) : undefined))
const setSkill = computed(() => (piece.value?.setSkill ? setSkillMap.get(piece.value.setSkill) : undefined))

function onRarity(e: Event) {
  setRarity(props.part, Number((e.target as HTMLSelectElement).value))
}
</script>

<template>
  <div
    class="slot"
    :class="{ empty: !piece }"
    role="button"
    tabindex="0"
    :aria-label="piece ? `更換${label}：${stage?.name}` : `選擇${label}`"
    @click="openPicker(part)"
    @keydown.enter.self="openPicker(part)"
  >
    <div class="slot-head">
      <span class="part">{{ label }}</span>
      <template v-if="piece && stage">
        <select class="rarity" :value="stage.rarity" aria-label="稀有度" @click.stop @change="onRarity">
          <option v-for="st in piece.stages" :key="st.rarity" :value="st.rarity">R{{ st.rarity }}</option>
        </select>
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
.slot:hover {
  border-color: var(--accent-border);
}
.slot:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
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
.rarity {
  font-size: 12px;
  padding: 1px 4px;
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
</style>
