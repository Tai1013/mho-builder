<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CREW_LABEL, type CrewKind, adventurers, buddies, crewMeta } from '../data'
import { useBuild } from '../composables/useBuild'
import { useModalHistory } from '../composables/useModalHistory'
import type { Adventurer, Buddy } from '../types'
import CrewImage from './CrewImage.vue'

/** 選冒險者／隨從的視窗：上面可切換兩種，選好就關閉；再點一次目前選的會取消 */
const props = defineProps<{ kind: CrewKind }>()
const emit = defineEmits<{ close: [] }>()
const { adventurer, buddy, setAdventurer, setBuddy } = useBuild()

const kind = ref<CrewKind>(props.kind)
const KINDS: CrewKind[] = ['adventurer', 'buddy']
const selectedId = computed(() => (kind.value === 'adventurer' ? adventurer.value : buddy.value))

/** 順序照資料（主角冒險者在前，再來依稀有度） */
const items = computed<(Adventurer | Buddy)[]>(() => (kind.value === 'adventurer' ? adventurers : buddies))

function close() {
  emit('close')
}
function choose(id: string) {
  const next = selectedId.value === id ? null : id
  if (kind.value === 'adventurer') setAdventurer(next)
  else setBuddy(next)
  close()
}

// 打開、切換種類時：有選的就捲到那一格，沒有就回到最上面
const listEl = ref<HTMLElement | null>(null)
function scrollToSelected() {
  const list = listEl.value
  if (!list) return
  const el = list.querySelector<HTMLElement>('.item.on')
  if (!el) {
    list.scrollTo({ top: 0 })
    return
  }
  const offset = el.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
  list.scrollTo({ top: Math.max(0, offset - (list.clientHeight - el.offsetHeight) / 2) })
}
watch(kind, () => nextTick(scrollToSelected))

const sheetEl = ref<HTMLElement | null>(null)
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
useModalHistory(close)
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  nextTick(() => {
    sheetEl.value?.focus({ preventScroll: true })
    scrollToSelected()
  })
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="close">
      <div ref="sheetEl" class="sheet" role="dialog" aria-modal="true" aria-labelledby="crew-title" tabindex="-1">
        <header class="sheet-head">
          <div class="title-row">
            <h2 id="crew-title">選擇{{ CREW_LABEL[kind] }}</h2>
            <span class="count">{{ items.length }} {{ kind === 'adventurer' ? '位' : '隻' }}</span>
            <button type="button" class="close-btn" aria-label="關閉" @click="close">×</button>
          </div>
          <div class="tabs" role="tablist" aria-label="種類">
            <button
              v-for="k in KINDS"
              :key="k"
              type="button"
              role="tab"
              :aria-selected="kind === k"
              :class="{ on: kind === k }"
              @click="kind = k"
            >
              {{ CREW_LABEL[k] }}
            </button>
          </div>
        </header>

        <div ref="listEl" class="list">
          <div class="grid">
            <button
              v-for="c in items"
              :key="c.id"
              type="button"
              class="item"
              :class="{ on: selectedId === c.id }"
              :aria-pressed="selectedId === c.id"
              @click="choose(c.id)"
            >
              <CrewImage :src="c.image" :name="c.name" :width="56" />
              <span class="item-name">{{ c.name }}</span>
              <span v-for="line in crewMeta(c)" :key="line" class="item-meta">{{ line }}</span>
            </button>
          </div>
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
@media (hover: hover) {
  .close-btn:hover {
    color: var(--accent);
  }
}
.tabs {
  display: flex;
  gap: 4px;
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

.list {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 16px 24px;
  padding-bottom: max(24px, env(safe-area-inset-bottom));
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 6px;
}
.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 8px 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
}
@media (hover: hover) {
  .item:hover {
    background: var(--hover);
  }
}
.item.on {
  border-color: var(--accent);
  background: var(--accent-bg);
  box-shadow: 0 0 0 1px var(--accent);
}
.item-name {
  max-width: 100%;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-meta {
  max-width: 100%;
  font-size: 11px;
  line-height: 1.35;
  color: var(--muted);
  text-align: center;
}
/* 武器・屬性、類型兩行靠在一起，不吃 .item 的間距 */
.item-meta + .item-meta {
  margin-top: -4px;
}
</style>
