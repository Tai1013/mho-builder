import { computed, reactive, ref, watch } from 'vue'
import { PART_IDS, pieceMap, setSkillMap, seriesMap, skillMap, stageFor } from '../data'
import type { ArmorPiece, PartId, SetSkill, Skill, Stage } from '../types'

export interface SlotState {
  pieceId: string | null
  rarity: number | null
}

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

const slots = reactive(
  Object.fromEntries(PART_IDS.map((p) => [p, { pieceId: null, rarity: null } as SlotState])) as Record<
    PartId,
    SlotState
  >,
)
const targetRarity = ref<number | 'max'>('max')
const activePart = ref<PartId>('head')
const pickerOpen = ref(false)

// ---------- URL hash 同步（方便分享配裝） ----------
function readHash() {
  const params = new URLSearchParams(location.hash.slice(1))
  const t = params.get('r')
  targetRarity.value = t && /^\d+$/.test(t) ? Number(t) : 'max'
  for (const part of PART_IDS) {
    const v = params.get(part)
    const [seriesId, rarity] = (v ?? '').split('.')
    const piece = seriesId ? pieceMap.get(`${seriesId}/${part}`) : undefined
    slots[part].pieceId = piece ? piece.id : null
    slots[part].rarity = piece ? (rarity && /^\d+$/.test(rarity) ? Number(rarity) : stageFor(piece, 'max').rarity) : null
  }
}
function writeHash() {
  const params = new URLSearchParams()
  if (targetRarity.value !== 'max') params.set('r', String(targetRarity.value))
  for (const part of PART_IDS) {
    const s = slots[part]
    const piece = s.pieceId ? pieceMap.get(s.pieceId) : undefined
    if (piece) params.set(part, `${piece.series}.${s.rarity ?? ''}`)
  }
  const hash = params.toString()
  // 保留 history.state（選擇視窗用它來支援手機返回鍵）
  history.replaceState(history.state, '', hash ? `#${hash}` : location.pathname + location.search)
}
readHash()

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
  if (!piece) return
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

// ---------- 計算 ----------
const equipped = computed<EquippedSlot[]>(() => {
  const out: EquippedSlot[] = []
  for (const part of PART_IDS) {
    const s = slots[part]
    const piece = s.pieceId ? pieceMap.get(s.pieceId) : undefined
    if (piece) out.push({ part, piece, stage: stageFor(piece, s.rarity ?? 'max') })
  }
  return out
})

const totalDefense = computed(() => equipped.value.reduce((sum, e) => sum + e.stage.defense, 0))

const setStatuses = computed<SetStatus[]>(() => {
  const counts = new Map<string, number>()
  for (const e of equipped.value) {
    if (e.piece.setSkill) counts.set(e.piece.setSkill, (counts.get(e.piece.setSkill) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([id, count]) => {
      const set = setSkillMap.get(id)!
      return { set, count, active: count >= set.requiredPieces }
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || b.count - a.count)
})

const aggregatedSkills = computed<AggregatedSkill[]>(() => {
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
  for (const e of equipped.value) {
    for (const sk of e.stage.skills) {
      add(sk.skillId, sk.name, {
        label: `${e.piece.partLabel}・${e.stage.name}`,
        level: sk.level ?? 1,
        uncertain: sk.level == null,
      })
    }
  }
  for (const st of setStatuses.value) {
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
})

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
    totalDefense,
    setStatuses,
    aggregatedSkills,
    equip,
    unequip,
    clearAll,
    setRarity,
    equipSeries,
    setTargetRarity,
  }
}
