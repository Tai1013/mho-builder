<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { PARTS, pieceMap, seriesMap, seriesMonster } from '../data'
import { summarizeBuild, useBuild } from '../composables/useBuild'
import { useModalHistory } from '../composables/useModalHistory'
import { fromShareCode, toShareCode } from '../composables/shareCode'
import { useSavedBuilds, type SavedBuild } from '../stores/savedBuilds'
import MonsterIcon from './MonsterIcon.vue'
import OverCapIcon from './OverCapIcon.vue'
import CompactInput from './CompactInput.vue'

const emit = defineEmits<{ close: [] }>()
const close = () => emit('close')
useModalHistory(close)

const { equipped, currentCode, loadBuild } = useBuild()
const saved = useSavedBuilds()
const { builds } = storeToRefs(saved)

// ---------- 儲存目前配裝 ----------
const title = ref('')
const canSave = computed(() => equipped.value.length > 0)
/** 目前配裝已經存在清單裡的那一組 */
const savedAs = computed(() => builds.value.find((b) => b.code === currentCode.value))
function save() {
  if (!canSave.value) return
  saved.add(title.value, currentCode.value)
  title.value = ''
}

// ---------- 清單 ----------
const rows = computed(() =>
  builds.value.map((build) => {
    const sum = summarizeBuild(build.code)
    return {
      build,
      isCurrent: build.code === currentCode.value,
      icons: PARTS.map((p) => {
        const piece = sum.slots[p.id].pieceId ? pieceMap.get(sum.slots[p.id].pieceId!) : undefined
        const series = piece ? seriesMap.get(piece.series) : undefined
        return {
          part: p.id,
          label: p.label,
          piece,
          monster: seriesMonster(series),
          /** 鎖甲、骨製等沒有魔物的系列，用系列名稱第一個字 */
          seriesChar: series?.name[0] ?? '',
        }
      }),
      activeSets: sum.setStatuses.filter((s) => s.active),
      skills: sum.skills,
      /** 這組配裝用到的最高稀有度＝最低要有幾階才配得出來 */
      needRarity: sum.equipped.length ? Math.max(...sum.equipped.map((e) => e.stage.rarity)) : null,
    }
  }),
)

/** 展開中的配裝（可以同時展開好幾組來比較） */
const expanded = reactive(new Set<string>())
function toggle(id: string) {
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
}

function onLoad(build: SavedBuild) {
  if (build.code !== currentCode.value) {
    // 目前的配裝沒存過就會被蓋掉，先確認
    if (equipped.value.length && !savedAs.value && !confirm(`目前的配裝還沒儲存，載入「${build.name}」後會被取代。要繼續嗎？`)) return
    loadBuild(build.code)
  }
  close()
}

// ---------- 改名／覆蓋／刪除 ----------
const editingId = ref<string | null>(null)
const editName = ref('')
const editInput = ref<InstanceType<typeof CompactInput>[]>([])
function startRename(build: SavedBuild) {
  editingId.value = build.id
  editName.value = build.name
  nextTick(() => editInput.value[0]?.select())
}
function commitRename() {
  if (editingId.value) saved.rename(editingId.value, editName.value)
  editingId.value = null
}
function onOverwrite(build: SavedBuild) {
  if (!canSave.value) return
  if (confirm(`要用目前的配裝覆蓋「${build.name}」嗎？`)) saved.overwrite(build.id, currentCode.value)
}
function onRemove(build: SavedBuild) {
  if (confirm(`要刪除「${build.name}」嗎？刪除後無法復原。`)) {
    saved.remove(build.id)
    expanded.delete(build.id)
  }
}

// ---------- 複製代碼（分享給別人匯入） ----------
// 先把每組的分享代碼算好：手機（尤其 iPhone）只允許在點按的當下複製，不能等壓縮做完才複製
const shareCodes = reactive(new Map<string, string>())
watch(
  builds,
  async (list) => {
    for (const b of list) shareCodes.set(b.id, await toShareCode(b.name, b.code))
  },
  { immediate: true, deep: true },
)
/** 剛複製好的那一組（按鈕暫時顯示「已複製」） */
const copiedId = ref<string | null>(null)
/** 自動複製失敗時，才把代碼顯示出來讓人手動複製 */
const manualCopy = ref<{ id: string; code: string } | null>(null)
let copiedTimer = 0
/** 舊瀏覽器沒有 navigator.clipboard 時的複製方法 */
function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}
function showCopied(id: string) {
  manualCopy.value = null
  copiedId.value = id
  clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copiedId.value = null), 2000)
}
async function onExport(build: SavedBuild) {
  const code = shareCodes.get(build.id) ?? (await toShareCode(build.name, build.code))
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(code)
      showCopied(build.id)
      return
    } catch {
      // 沒有權限（例如不是 https）→ 下面改用舊方法或手動複製
    }
  }
  if (legacyCopy(code)) showCopied(build.id)
  else manualCopy.value = { id: build.id, code }
}

// ---------- 匯入（分享代碼） ----------
const importOpen = ref(false)
const importText = ref('')
const importMsg = ref('')
const importError = ref(false)
const importInput = ref<InstanceType<typeof CompactInput> | null>(null)
function toggleImport() {
  importOpen.value = !importOpen.value
  importMsg.value = ''
  if (importOpen.value) nextTick(() => importInput.value?.focus())
}
async function doImport() {
  const got = await fromShareCode(importText.value)
  if (!got) {
    importError.value = true
    importMsg.value = '看不懂這個代碼，請確認有完整複製。'
    return
  }
  const b = saved.add(got.name, got.code)
  importError.value = false
  importMsg.value =
    `已匯入「${b.name}」` + (got.skipped ? `，有 ${got.skipped} 件目前不能配裝，已略過。` : '。')
  importText.value = ''
  importOpen.value = false
}

// ---------- 視窗 ----------
const sheetEl = ref<HTMLElement | null>(null)
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (editingId.value) editingId.value = null
  else close()
}
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  nextTick(() => sheetEl.value?.focus({ preventScroll: true }))
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="close">
      <div ref="sheetEl" class="sheet" role="dialog" aria-modal="true" aria-labelledby="saved-title" tabindex="-1">
        <header class="sheet-head">
          <div class="title-row">
            <h2 id="saved-title">配裝清單</h2>
            <span class="count">{{ builds.length }} 組</span>
            <button type="button" class="link-btn" :aria-expanded="importOpen" @click="toggleImport">
              {{ importOpen ? '取消匯入' : '匯入代碼' }}
            </button>
            <button type="button" class="close-btn" aria-label="關閉" @click="close">×</button>
          </div>
          <!-- 匯入時先把「儲存目前配裝」藏起來，畫面只留匯入 -->
          <form v-if="!importOpen" class="save" @submit.prevent="save">
            <CompactInput
              v-model="title"
              type="text"
              class="grow"
              :maxlength="30"
              enterkeyhint="done"
              :placeholder="`標題（${saved.nextDefaultName()}）`"
              label="配裝標題"
              :disabled="!canSave"
            />
            <button type="submit" class="primary" :disabled="!canSave">儲存目前配裝</button>
          </form>
          <template v-if="!importOpen">
            <p v-if="!canSave" class="hint">目前沒有裝備，選好防具後再來儲存。</p>
            <p v-else-if="savedAs" class="hint">目前配裝已存為「{{ savedAs.name }}」</p>
          </template>
          <!-- 匯入：貼上別人給的分享代碼 -->
          <form v-if="importOpen" class="save" @submit.prevent="doImport">
            <CompactInput
              ref="importInput"
              v-model="importText"
              type="text"
              class="grow"
              enterkeyhint="done"
              placeholder="貼上分享代碼"
              label="分享代碼"
            />
            <button type="submit" class="primary" :disabled="!importText.trim()">匯入</button>
          </form>
          <p v-if="importMsg" class="hint" :class="{ error: importError }">{{ importMsg }}</p>
        </header>

        <div class="sheet-body">
          <ul v-if="rows.length" class="list">
            <li v-for="r in rows" :key="r.build.id" class="item" :class="{ current: r.isCurrent }">
              <div class="item-head">
                <!-- 改名中：標題換成輸入框 -->
                <form v-if="editingId === r.build.id" class="rename" @submit.prevent="commitRename">
                  <CompactInput
                    ref="editInput"
                    v-model="editName"
                    type="text"
                    class="grow"
                    :maxlength="30"
                    enterkeyhint="done"
                    label="新的標題"
                    @blur="commitRename"
                  />
                </form>
                <!-- 目前的配裝：外框和標題用強調色（不另外加標籤，留空間給標題） -->
                <button
                  v-else
                  type="button"
                  class="load"
                  :aria-label="`載入「${r.build.name}」${r.isCurrent ? '（目前配裝）' : ''}`"
                  :aria-current="r.isCurrent || undefined"
                  @click="onLoad(r.build)"
                >
                  <span class="name">{{ r.build.name }}</span>
                  <span v-if="r.needRarity" class="need" :title="`最低需要 R${r.needRarity}`">R{{ r.needRarity }}</span>
                  <span class="icons" aria-hidden="true">
                    <template v-for="ic in r.icons" :key="ic.part">
                      <MonsterIcon v-if="ic.monster" :monster="ic.monster" :size="24" :title="ic.piece?.name" />
                      <span v-else-if="ic.piece" class="series-char" :title="ic.piece.name">{{ ic.seriesChar }}</span>
                      <span v-else class="no-piece" :title="`${ic.label}：未裝備`" />
                    </template>
                  </span>
                </button>
                <button
                  type="button"
                  class="toggle"
                  :class="{ open: expanded.has(r.build.id) }"
                  :aria-expanded="expanded.has(r.build.id)"
                  :aria-label="`${expanded.has(r.build.id) ? '收合' : '展開'}「${r.build.name}」的技能`"
                  @click="toggle(r.build.id)"
                >
                  <span class="caret" aria-hidden="true" />
                </button>
              </div>

              <!-- 展開：套裝技能、技能合計、管理按鈕 -->
              <div v-if="expanded.has(r.build.id)" class="detail">
                <div class="d-title">套裝技能</div>
                <ul v-if="r.activeSets.length" class="d-list">
                  <li v-for="s in r.activeSets" :key="s.set.id">
                    <span class="d-name">{{ s.set.name }}<small>{{ s.set.bonusLabel }}</small></span>
                    <span class="d-count">{{ s.count }}/{{ s.set.requiredPieces }}</span>
                  </li>
                </ul>
                <p v-else class="d-empty">沒有發動的套裝技能</p>

                <div class="d-title">技能合計</div>
                <ul v-if="r.skills.length" class="d-list">
                  <li v-for="s in r.skills" :key="s.key">
                    <span class="d-name">{{ s.name }}</span>
                    <span class="pips" :aria-label="`Lv${s.raw} / ${s.maxLevel ?? '?'}`">
                      <i v-for="n in s.maxLevel ?? s.level" :key="n" :class="{ f: n <= s.level }" />
                      <OverCapIcon v-if="s.raw > s.level" :extra="s.raw - s.level" />
                    </span>
                    <span class="d-lv" :title="s.raw > s.level ? `超過上限，實際生效 Lv${s.level}` : undefined">
                      Lv{{ s.raw }}<template v-if="s.maxLevel">/{{ s.maxLevel }}</template>
                      <span v-if="s.uncertain" class="warn" title="來源資料未標示等級，暫以 Lv1 計算">?</span>
                    </span>
                  </li>
                </ul>
                <p v-else class="d-empty">沒有技能</p>

                <div class="actions">
                  <button type="button" class="ghost" @click="startRename(r.build)">改名</button>
                  <button
                    type="button"
                    class="ghost"
                    :disabled="!canSave || r.isCurrent"
                    @click="onOverwrite(r.build)"
                  >
                    用目前配裝覆蓋
                  </button>
                  <button
                    type="button"
                    class="ghost share"
                    :class="{ ok: copiedId === r.build.id }"
                    title="複製分享代碼，貼給別人就能在配裝清單匯入"
                    @click="onExport(r.build)"
                  >
                    {{ copiedId === r.build.id ? '已複製' : '複製代碼' }}
                  </button>
                  <button type="button" class="ghost danger" @click="onRemove(r.build)">刪除</button>
                </div>
                <!-- 只有自動複製失敗時才顯示代碼，讓人手動複製 -->
                <div v-if="manualCopy?.id === r.build.id" class="share-box">
                  <div class="share-head">無法自動複製，請全選下面的代碼複製</div>
                  <textarea
                    readonly
                    rows="2"
                    :value="manualCopy.code"
                    aria-label="分享代碼"
                    @focus="($event.target as HTMLTextAreaElement).select()"
                  />
                </div>
              </div>
            </li>
          </ul>
          <p v-else class="empty">
            還沒有儲存任何配裝。配好裝後，在上方取個標題儲存，之後點清單就能載入；<br />
            也可以按右上角「匯入代碼」，貼上別人給的分享代碼。
          </p>
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
  width: min(560px, 100%);
  height: min(88vh, 860px);
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

/* ---------- 儲存 ---------- */
.save {
  display: flex;
  gap: 6px;
}
.grow {
  flex: 1;
  min-width: 0;
}
/* 跟選防具視窗的篩選按鈕一樣：高 32px、13px 字 */
.primary {
  flex-shrink: 0;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.primary:disabled {
  opacity: 0.4;
  cursor: default;
}
.hint {
  margin: -4px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.hint.error {
  color: var(--danger);
}
.link-btn {
  margin-left: auto;
  border: 0;
  background: none;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 8px;
}
.link-btn + .close-btn {
  margin-left: 4px;
}

/* ---------- 清單 ---------- */
.sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  min-width: 0;
}
.item.current {
  border-color: var(--accent);
}
.item-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 4px 0;
}
.load {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: none;
  padding: 6px 2px 6px 12px;
  text-align: left;
  cursor: pointer;
}
.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  color: var(--text-strong);
}
.need + .icons {
  margin-left: 0;
}
.item.current .name {
  color: var(--accent);
}
.need {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--chip);
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.icons {
  margin-left: auto;
  display: inline-flex;
  gap: 2px;
  flex-shrink: 0;
}
.no-piece,
.series-char {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 6px;
}
.no-piece {
  border: 1px dashed var(--border);
}
.series-char {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--chip);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
.rename {
  flex: 1;
  min-width: 0;
  display: flex;
  padding: 3px 4px 3px 8px;
}
.toggle {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
@media (hover: hover) {
  .toggle:hover {
    background: var(--hover);
  }
}
/* 跟稀有度選單同一個三角形，展開時翻轉 */
.caret {
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid var(--muted);
  transition: transform 0.15s;
}
.toggle.open .caret {
  transform: rotate(180deg);
}

/* ---------- 展開內容 ---------- */
.detail {
  border-top: 1px solid var(--border);
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.d-title {
  display: flex;
  align-items: baseline;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  margin-top: 4px;
}
.d-title:first-child {
  margin-top: 0;
}
.d-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.d-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 14px;
}
.d-list li + li {
  border-top: 1px solid var(--border);
}
.d-name {
  min-width: 0;
  margin-right: auto;
  font-weight: 700;
  color: var(--text-strong);
}
.d-name small {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--good);
}
.d-count {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.pips {
  display: inline-flex;
  gap: 2px;
}
.pips i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--chip);
  border: 1px solid var(--border);
}
.pips i.f {
  background: var(--accent);
  border-color: var(--accent);
}
/* 超過最高等級：格子右邊接一個紅色 ✕ 方塊（間距跟格子一樣） */
.pips {
  align-items: center;
}
.d-lv {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
  min-width: 52px;
  text-align: right;
}
.warn {
  color: var(--warn);
  margin-left: 2px;
}
.d-empty {
  margin: 0;
  padding: 2px 0;
  font-size: 13px;
  color: var(--muted);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.actions .ghost {
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
}
.actions .ghost:disabled {
  opacity: 0.4;
  cursor: default;
}
.actions .share {
  margin-left: auto;
}
.actions .danger {
  color: var(--danger);
}
.share-box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.share-head {
  font-size: 12px;
  color: var(--warn);
}
.actions .share.ok {
  border-color: var(--good-border);
  color: var(--good);
}
.share-box textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  word-break: break-all;
  resize: none;
}

.empty {
  margin: 24px 8px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}
</style>
