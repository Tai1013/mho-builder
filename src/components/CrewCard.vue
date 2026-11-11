<script setup lang="ts">
import { computed } from 'vue'
import { CREW_LABEL, type CrewKind, adventurerMap, buddyMap, crewMeta } from '../data'
import { useBuild } from '../composables/useBuild'
import CrewImage from './CrewImage.vue'

/** 裝備最上面的左右兩格：冒險者、隨從。點一下打開選擇視窗 */
const props = defineProps<{ kind: CrewKind; compact?: boolean }>()
const emit = defineEmits<{ open: [] }>()
const { adventurer, buddy, setAdventurer, setBuddy } = useBuild()

const label = computed(() => CREW_LABEL[props.kind])
const picked = computed(() =>
  props.kind === 'adventurer'
    ? adventurer.value
      ? adventurerMap.get(adventurer.value)
      : undefined
    : buddy.value
      ? buddyMap.get(buddy.value)
      : undefined,
)
function clear() {
  if (props.kind === 'adventurer') setAdventurer(null)
  else setBuddy(null)
}
</script>

<template>
  <div
    class="crew"
    :class="{ empty: !picked, compact }"
    role="button"
    tabindex="0"
    :aria-label="picked ? `更換${label}：${picked.name}` : `選擇${label}`"
    @click="emit('open')"
    @keydown.enter.self="emit('open')"
  >
    <div v-if="!compact" class="head">
      <span class="kind">{{ label }}</span>
      <button v-if="picked" class="icon-btn" type="button" title="移除" :aria-label="`移除${label}`" @click.stop="clear">
        ×
      </button>
    </div>
    <div v-if="picked" class="ident">
      <CrewImage :src="picked.image" :name="picked.name" :width="compact ? 28 : 36" />
      <div class="ident-text">
        <div class="name">{{ picked.name }}</div>
        <div class="meta">{{ crewMeta(picked).join('・') }}</div>
      </div>
    </div>
    <div v-else class="placeholder"><span class="plus" aria-hidden="true">＋</span>選擇{{ label }}</div>
  </div>
</template>

<style scoped>
.crew {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  min-width: 0;
}
@media (hover: hover) {
  .crew:hover {
    border-color: var(--accent-border);
  }
}
.crew.empty {
  border-style: dashed;
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
}
.kind {
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
  min-width: 0;
}
.ident-text {
  min-width: 0;
}
.name {
  font-weight: 700;
  font-size: 15px;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta {
  font-size: 12px;
  line-height: 1.35;
  color: var(--muted);
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
.crew.compact {
  padding: 6px 10px;
}
.crew.compact .ident {
  margin-top: 0;
}
.crew.compact .name {
  font-size: 14px;
}
.crew.compact .placeholder {
  padding: 4px 0;
}
</style>
