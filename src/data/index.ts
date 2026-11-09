import skillsJson from './skills.json'
import setSkillsJson from './set-skills.json'
import armorJson from './armor.json'
import monstersJson from './monsters.json'
import type { ArmorPiece, ArmorSeries, Monster, PartId, SetSkill, Skill, Stage } from '../types'

export const PARTS: { id: PartId; label: string }[] = [
  { id: 'head', label: '頭部' },
  { id: 'chest', label: '胸部' },
  { id: 'arms', label: '腕部' },
  { id: 'waist', label: '腰部' },
  { id: 'legs', label: '腿部' },
]
export const PART_IDS = PARTS.map((p) => p.id)

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

export const RARITIES = Array.from(
  new Set(seriesList.flatMap((s) => Object.values(s.pieces).flatMap((p) => p!.stages.map((st) => st.rarity)))),
).sort((a, b) => a - b)

/** 取得某稀有度的性能；沒有剛好的稀有度時取「不超過目標的最高稀有度」，再不行就取最低階。 */
export function stageFor(piece: ArmorPiece, rarity: number | 'max'): Stage {
  const stages = piece.stages
  if (rarity === 'max') return stages[stages.length - 1]
  let best: Stage | undefined
  for (const st of stages) if (st.rarity <= rarity) best = st
  return best ?? stages[0]
}

export const monsters = monstersJson as unknown as Monster[]
export const monsterMap = new Map(monsters.map((m) => [m.id, m]))

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

export function seriesMatchesMonster(series: ArmorSeries | undefined, filter: string): boolean {
  if (!filter) return true
  const ids = seriesMonsterIds(series)
  return filter === NO_MONSTER ? ids.length === 0 : ids.includes(filter)
}
