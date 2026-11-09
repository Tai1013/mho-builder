export type PartId = 'head' | 'chest' | 'arms' | 'waist' | 'legs'

export interface SkillLevel {
  level: number
  effect: string
}

export interface Skill {
  id: string
  name: string
  nameEn: string | null
  description: string | null
  maxLevel: number
  sources: ('armor' | 'weapon' | 'set')[]
  armorCount: number
  weaponCount: number
  levels: SkillLevel[]
}

export interface SetSkillGrant {
  /** null 表示來源網站沒有這個技能的頁面（例如「泥耐性」） */
  skillId: string | null
  skillName: string
  level: number | null
}

export interface SetSkill {
  id: string
  name: string
  requiredPieces: number
  bonusLabel: string
  bonusEffect: string | null
  grants: SetSkillGrant[]
  series: string[]
}

export interface StageSkill {
  skillId: string
  name: string
  /** null 表示來源網站沒有標示等級 */
  level: number | null
}

export interface MaterialItem {
  itemId: string
  name: string
  qty: number
}

export interface Stage {
  rarity: number
  name: string
  defense: number
  skills: StageSkill[]
  materials: { type: 'craft' | 'upgrade'; items: MaterialItem[] } | null
}

export interface ArmorPiece {
  id: string
  name: string
  nameEn: string | null
  part: PartId
  partLabel: string
  series: string
  rarityMin: number
  rarityMax: number
  maxDefense: number
  /** 最高稀有度時的技能 */
  skills: StageSkill[]
  setSkill: string | null
  image: string
  stages: Stage[]
}

export interface Monster {
  id: string
  name: string
  nameEn: string | null
  image: string
  size: '大型' | '小型'
  species: string
  habitats: string[]
  weakness: { element: string; stars: number }[]
  ailments: { ailment: string; stars: number }[]
  hitzones: { label: string; cut: number; blunt: number; ammo: number }[]
}

export interface ArmorSeries {
  id: string
  name: string
  /** 來源網站標示的魔物；鎖甲、巨蜂等非魔物系列為 null */
  monster: { id: string; name: string } | null
  /** 從製作素材名稱推得的魔物 id（例如巨蜂套裝 → vespoid） */
  materialMonsters: string[]
  setSkill: string | null
  rarityMin: number
  rarityMax: number
  pieces: Partial<Record<PartId, ArmorPiece>>
}
