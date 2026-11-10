import { computed, reactive, ref, watch } from 'vue'
import { PART_IDS, isPieceSelectable, pieceMap, setSkillMap, seriesMap, skillMap, stageFor } from '../data'
import type { ArmorPiece, PartId, SetSkill, Skill, Stage } from '../types'

export interface SlotState {
  pieceId: string | null
  rarity: number | null
}

export type BuildSlots = Record<PartId, SlotState>

export interface EquippedSlot {
  part: PartId
  piece: ArmorPiece
  stage: Stage
}

export interface SkillSource {
  label: string
  level: number
  /** 來源資料沒有標等級，暫以 Lv1 計算 */
  uncertain?: boolean
  fromSet?: boolean
}

export interface AggregatedSkill {
  key: string
  skill: Skill | null
  name: string
  /** 未封頂的合計等級 */
  raw: number
  /** 實際生效等級（以最高 Lv 封頂） */
  level: number
  maxLevel: number | null
  effect: string | null
  sources: SkillSource[]
  uncertain: boolean
}

export interface SetStatus {
  set: SetSkill
  count: number
  active: boolean
}

// ---------- 配裝代碼（網址 hash、瀏覽器儲存、配裝清單共用同一種格式） ----------
// 例：r=9&head=great-jagras.9&legs=kulu-ya-ku.7

function emptySlots(): BuildSlots {
  return Object.fromEntries(PART_IDS.map((p) => [p, { pieceId: null, rarity: null }])) as BuildSlots
}

export function encodeBuild(slots: BuildSlots, targetRarity: number | 'max'): string {
  const params = new URLSearchParams()
  if (targetRarity !== 'max') params.set('r', String(targetRarity))
  for (const part of PART_IDS) {
    const s = slots[part]
    const piece = s.pieceId ? pieceMap.get(s.pieceId) : undefined
    if (piece) params.set(part, `${piece.series}.${s.rarity ?? ''}`)
  }
  return params.toString()
}

export function decodeBuild(code: string): { slots: BuildSlots; targetRarity: number | 'max' } {
  const params = new URLSearchParams(code)
  const t = params.get('r')
  const slots = emptySlots()
  for (const part of PART_IDS) {
    const [seriesId, rarity] = (params.get(part) ?? '').split('.')
    const piece = seriesId ? pieceMap.get(`${seriesId}/${part}`) : undefined
    // 技能等級還不確定（只有「?」的階）的部件不能配裝
    if (!piece || !isPieceSelectable(piece)) continue
    slots[part].pieceId = piece.id
    slots[part].rarity = rarity && /^\d+$/.test(rarity) ? Number(rarity) : stageFor(piece, 'max').rarity
  }
  return { slots, targetRarity: t && /^\d+$/.test(t) ? Number(t) : 'max' }
}

/** 代碼裡有沒有任何配裝資料（部位或目標稀有度） */
function hasBuildData(code: string): boolean {
  const params = new URLSearchParams(code)
  return params.has('r') || PART_IDS.some((p) => params.has(p))
}

// ---------- 計算（給目前配裝和配裝清單共用） ----------
export function computeEquipped(slots: BuildSlots): EquippedSlot[] {
  const out: EquippedSlot[] = []
  for (const part of PART_IDS) {
    const s = slots[part]
    const piece = s.pieceId ? pieceMap.get(s.pieceId) : undefined
    if (piece) out.push({ part, piece, stage: stageFor(piece, s.rarity ?? 'max') })
  }
  return out
}

export function computeSetStatuses(equipped: EquippedSlot[]): SetStatus[] {
  const counts = new Map<string, number>()
  for (const e of equipped) {
    if (e.piece.setSkill) counts.set(e.piece.setSkill, (counts.get(e.piece.setSkill) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([id, count]) => {
      const set = setSkillMap.get(id)!
      return { set, count, active: count >= set.requiredPieces }
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || b.count - a.count)
}

export function computeSkills(equipped: EquippedSlot[], setStatuses: SetStatus[]): AggregatedSkill[] {
  const map = new Map<string, AggregatedSkill>()
  const add = (key: string, name: string, src: SkillSource) => {
    let entry = map.get(key)
    if (!entry) {
      const skill = skillMap.get(key) ?? null
      entry = {
        key,
        skill,
        name: skill?.name ?? name,
        raw: 0,
        level: 0,
        maxLevel: skill?.maxLevel ?? null,
        effect: null,
        sources: [],
        uncertain: false,
      }
      map.set(key, entry)
    }
    entry.raw += src.level
    entry.sources.push(src)
    if (src.uncertain) entry.uncertain = true
  }
  for (const e of equipped) {
    for (const sk of e.stage.skills) {
      add(sk.skillId, sk.name, {
        label: `${e.piece.partLabel}・${e.stage.name}`,
        level: sk.level ?? 1,
        uncertain: sk.level == null,
      })
    }
  }
  for (const st of setStatuses) {
    if (!st.active) continue
    for (const g of st.set.grants) {
      add(g.skillId ?? `set:${g.skillName}`, g.skillName, {
        label: `套裝：${st.set.name}`,
        level: g.level ?? 1,
        uncertain: g.level == null,
        fromSet: true,
      })
    }
  }
  for (const entry of map.values()) {
    entry.level = entry.maxLevel ? Math.min(entry.raw, entry.maxLevel) : entry.raw
    entry.effect = entry.skill?.levels.find((l) => l.level === entry.level)?.effect ?? null
  }
  return [...map.values()].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'zh-Hant'))
}

/** 把一組配裝代碼算成清單要顯示的內容 */
export function summarizeBuild(code: string) {
  const { slots } = decodeBuild(code)
  const equipped = computeEquipped(slots)
  const setStatuses = computeSetStatuses(equipped)
  return {
    slots,
    equipped,
    setStatuses,
    skills: computeSkills(equipped, setStatuses),
  }
}

// ---------- 目前配裝 ----------
const slots = reactive(emptySlots())
const targetRarity = ref<number | 'max'>('max')
const activePart = ref<PartId>('head')
const pickerOpen = ref(false)

function applyCode(code: string) {
  const decoded = decodeBuild(code)
  targetRarity.value = decoded.targetRarity
  for (const part of PART_IDS) Object.assign(slots[part], decoded.slots[part])
}

// 目前配裝也存一份在瀏覽器：從書籤、主畫面捷徑或不帶 # 的網址開啟時，還能接著上次的配裝
const STORAGE_KEY = 'mho-current-build'
function loadStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}
function store(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // 無痕模式等情況存不了，至少網址還有
  }
}

// ---------- URL hash 同步（方便分享配裝） ----------
function readHash() {
  applyCode(location.hash.slice(1))
}
function writeHash() {
  const code = encodeBuild(slots, targetRarity.value)
  store(code)
  // 保留 history.state（選擇視窗用它來支援手機返回鍵）
  history.replaceState(history.state, '', code ? `#${code}` : location.pathname + location.search)
}

// 網址有配裝（例如別人分享的連結）就用網址的；沒有就接著用瀏覽器存的
if (hasBuildData(location.hash.slice(1))) readHash()
else applyCode(loadStored())
writeHash()

// 返回鍵關閉選擇視窗時，瀏覽器會回到舊網址；這段期間不要從網址讀回配裝，改把目前配裝寫回網址
let ignoreHashUntil = 0
function suppressHashRead() {
  ignoreHashUntil = performance.now() + 600
}
window.addEventListener('hashchange', () => {
  if (performance.now() < ignoreHashUntil) writeHash()
  else readHash()
})
watch([slots, targetRarity], writeHash, { deep: true })

// ---------- 動作 ----------
function equip(pieceId: string) {
  const piece = pieceMap.get(pieceId)
  if (!piece || !isPieceSelectable(piece)) return
  slots[piece.part].pieceId = piece.id
  slots[piece.part].rarity = stageFor(piece, targetRarity.value).rarity
}
function unequip(part: PartId) {
  slots[part].pieceId = null
  slots[part].rarity = null
}
function clearAll() {
  for (const part of PART_IDS) unequip(part)
}
function setRarity(part: PartId, rarity: number) {
  slots[part].rarity = rarity
}
function equipSeries(seriesId: string) {
  const series = seriesMap.get(seriesId)
  if (!series) return
  for (const part of PART_IDS) {
    const piece = series.pieces[part]
    if (piece) equip(piece.id)
  }
}
function openPicker(part: PartId) {
  activePart.value = part
  pickerOpen.value = true
}
function closePicker() {
  pickerOpen.value = false
}
function setTargetRarity(r: number | 'max') {
  targetRarity.value = r
  for (const part of PART_IDS) {
    const piece = slots[part].pieceId ? pieceMap.get(slots[part].pieceId!) : undefined
    if (piece) slots[part].rarity = stageFor(piece, r).rarity
  }
}
/** 載入一組配裝代碼（配裝清單用） */
function loadBuild(code: string) {
  applyCode(code)
}

// ---------- 計算 ----------
const equipped = computed(() => computeEquipped(slots))
const setStatuses = computed(() => computeSetStatuses(equipped.value))
const aggregatedSkills = computed(() => computeSkills(equipped.value, setStatuses.value))
/** 目前配裝的代碼（跟網址 # 後面一樣），用來比對清單裡哪一組是目前的配裝 */
const currentCode = computed(() => encodeBuild(slots, targetRarity.value))

export function useBuild() {
  return {
    slots,
    targetRarity,
    activePart,
    pickerOpen,
    openPicker,
    closePicker,
    suppressHashRead,
    equipped,
    setStatuses,
    aggregatedSkills,
    currentCode,
    equip,
    unequip,
    clearAll,
    setRarity,
    equipSeries,
    setTargetRarity,
    loadBuild,
  }
}
