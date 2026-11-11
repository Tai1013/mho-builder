import skillsJson from './skills.json'
import setSkillsJson from './set-skills.json'
import armorJson from './armor.json'
import monstersJson from './monsters.json'
import metaJson from './meta.json'
import adventurersJson from './adventurers.json'
import buddiesJson from './buddies.json'
import type { Adventurer, ArmorPiece, ArmorSeries, Buddy, Monster, PartId, SetSkill, Skill, Stage } from '../types'

export const PARTS: { id: PartId; label: string }[] = [
  { id: 'head', label: '頭部' },
  { id: 'chest', label: '胸部' },
  { id: 'arms', label: '腕部' },
  { id: 'waist', label: '腰部' },
  { id: 'legs', label: '腿部' },
]
export const PART_IDS = PARTS.map((p) => p.id)

/** 資料來源與更新時間（parse_pages.py 產生；時間是抓資料的時間，台灣時間） */
export const DATA_SOURCES: { name: string; url: string }[] = metaJson.sources
/** 例：2026/11/10 16:27:42 */
export const DATA_UPDATED_AT = metaJson.updatedAt.slice(0, 19).replace('T', ' ').replace(/-/g, '/')

export const skills = skillsJson as unknown as Skill[]
export const setSkills = setSkillsJson as unknown as SetSkill[]
export const seriesList = armorJson as unknown as ArmorSeries[]

export const skillMap = new Map(skills.map((s) => [s.id, s]))
export const setSkillMap = new Map(setSkills.map((s) => [s.id, s]))
export const seriesMap = new Map(seriesList.map((s) => [s.id, s]))

export const pieceMap = new Map<string, ArmorPiece>()
export const piecesByPart = Object.fromEntries(PART_IDS.map((p) => [p, [] as ArmorPiece[]])) as Record<
  PartId,
  ArmorPiece[]
>
for (const series of seriesList) {
  for (const id of PART_IDS) {
    const piece = series.pieces[id]
    if (!piece) continue
    pieceMap.set(piece.id, piece)
    piecesByPart[id].push(piece)
  }
}

/** 可在防具上出現的技能（給篩選用） */
export const armorSkills = skills.filter((s) => s.sources.includes('armor'))

/**
 * 這一階的技能等級都確定。來源網站沒寫等級的技能是 null（畫面顯示「?」），
 * 有「?」的階不能拿來配裝，只能在選防具清單裡看。
 */
export function isStageKnown(st: Stage): boolean {
  return st.skills.every((k) => k.level != null)
}
const selectableCache = new Map<string, Stage[]>()
/** 可以拿來配裝的階（技能等級都確定） */
export function selectableStages(piece: ArmorPiece): Stage[] {
  let list = selectableCache.get(piece.id)
  if (!list) {
    list = piece.stages.filter(isStageKnown)
    selectableCache.set(piece.id, list)
  }
  return list
}
/** 至少有一階可以配裝 */
export function isPieceSelectable(piece: ArmorPiece): boolean {
  return selectableStages(piece).length > 0
}
/**
 * 右上角的目標稀有度是上限：部件要能在上限以內配裝（最低階不超過上限）。
 * 目標是「各部位最高」時沒有上限。
 */
export function fitsTarget(piece: ArmorPiece, target: number | 'max'): boolean {
  const known = selectableStages(piece)
  return known.length > 0 && (target === 'max' || known[0].rarity <= target)
}
/** 在目標稀有度以內、可以配裝的階（裝備欄的稀有度選單用） */
export function stagesWithin(piece: ArmorPiece, target: number | 'max'): Stage[] {
  const known = selectableStages(piece)
  return target === 'max' ? known : known.filter((st) => st.rarity <= target)
}

export const RARITIES = Array.from(
  new Set(seriesList.flatMap((s) => Object.values(s.pieces).flatMap((p) => selectableStages(p!).map((st) => st.rarity)))),
).sort((a, b) => a - b)

/**
 * 取得某稀有度的技能；沒有剛好的稀有度時取「不超過目標的最高稀有度」，再不行就取最低階。
 * 只從可以配裝的階裡選；整件都不能配裝時（只用來在清單顯示）才用全部的階。
 */
export function stageFor(piece: ArmorPiece, rarity: number | 'max'): Stage {
  const known = selectableStages(piece)
  const stages = known.length ? known : piece.stages
  if (rarity === 'max') return stages[stages.length - 1]
  let best: Stage | undefined
  for (const st of stages) if (st.rarity <= rarity) best = st
  return best ?? stages[0]
}

export const monsters = monstersJson as unknown as Monster[]
export const monsterMap = new Map(monsters.map((m) => [m.id, m]))

/** 冒險者、隨從（順序：主角冒險者 → SSR → SR → R） */
export const adventurers = adventurersJson as unknown as Adventurer[]
export const adventurerMap = new Map(adventurers.map((a) => [a.id, a]))
export const buddies = buddiesJson as unknown as Buddy[]
export const buddyMap = new Map(buddies.map((b) => [b.id, b]))

export type CrewKind = 'adventurer' | 'buddy'
export const CREW_LABEL: Record<CrewKind, string> = { adventurer: '冒險者', buddy: '隨從' }
/**
 * 名稱下面的小字：冒險者是「武器種類・屬性」＋「類型」（例：大劍・龍屬性、進擊），隨從只有類型。
 * 選擇視窗格子小，一個元素一行；裝備格和配裝清單用「・」接成一行。
 */
export function crewMeta(c: Adventurer | Buddy): string[] {
  if (!('weapon' in c)) return [c.type]
  const element = c.element.endsWith('屬性') ? c.element : `${c.element}屬性`
  return [`${c.weapon}・${element}`, c.type]
}

/** 系列對應的魔物：優先用來源標示的魔物，沒有的話用素材推得的魔物 */
export function seriesMonsterIds(series: ArmorSeries | undefined): string[] {
  if (!series) return []
  return series.monster ? [series.monster.id] : series.materialMonsters
}

export function seriesMonster(series: ArmorSeries | undefined): Monster | undefined {
  const id = seriesMonsterIds(series)[0]
  return id ? monsterMap.get(id) : undefined
}

export function monsterLabel(series: ArmorSeries | undefined): string {
  if (!series) return ''
  if (series.monster) return series.monster.name
  const names = series.materialMonsters.map((id) => monsterMap.get(id)?.name ?? id)
  return names.length ? `${names.join('、')}素材` : '無魔物素材'
}

/** 魔物篩選的選項：有防具可對應的魔物，大型在前 */
export const NO_MONSTER = '__none'
export const monsterOptions = monsters
  .map((m, order) => ({
    monster: m,
    order,
    seriesCount: seriesList.filter((s) => seriesMonsterIds(s).includes(m.id)).length,
  }))
  .filter((o) => o.seriesCount > 0)
  .sort((a, b) => Number(a.monster.size !== '大型') - Number(b.monster.size !== '大型') || a.order - b.order)
export const noMonsterSeriesCount = seriesList.filter((s) => !seriesMonsterIds(s).length).length

/** 系列在魔物下拉選單的位置（大型 → 小型），無魔物素材的系列排最後 */
const monsterRank = new Map(monsterOptions.map((o, i) => [o.monster.id, i]))
export function seriesRank(series: ArmorSeries | undefined): number {
  const id = seriesMonsterIds(series)[0]
  const rank = id ? monsterRank.get(id) : undefined
  return rank ?? monsterOptions.length
}
// 選防具清單的預設排序跟魔物下拉選單一樣；同一隻魔物的多個系列維持來源網站的順序（sort 是穩定排序）
for (const part of PART_IDS) {
  piecesByPart[part].sort((a, b) => seriesRank(seriesMap.get(a.series)) - seriesRank(seriesMap.get(b.series)))
}

export function seriesMatchesMonster(series: ArmorSeries | undefined, filter: string): boolean {
  if (!filter) return true
  const ids = seriesMonsterIds(series)
  return filter === NO_MONSTER ? ids.length === 0 : ids.includes(filter)
}
