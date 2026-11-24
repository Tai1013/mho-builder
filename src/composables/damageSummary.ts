import type { AggregatedSkill } from './useBuild'

type Element = '火' | '水' | '雷' | '冰' | '龍'
interface ElementBonus { attack: number; damage: number; radiantDamage: number }

// 只將已確認為冒險者傷害加成的技能相加，避免把受傷、部位或隨從傷害誤算進去。
const damageSkills = new Set([
  'flawless', 'fearless', 'charge-up', 'offensive-defense', 'bow-skill-boost',
  'relentless-pursuit', 'counter-boost', 'unshaken-resolve', 'combo-enhancement',
  'bento-lover', 'airborne', 'charge-enhancement', 'hunting-instinct', 'flash-draw',
  'spirit-bind-blade', 'demonic-strength', 'piercing-strike', 'charged-power-shot',
  'immovable-stance', 'stamina-conversion', 'capacity-boost', 'wrecker', 'pierce',
  'intimidation', 'ammo-enhancement', 'morph-boost', 'gamewith-set-615ec22b68d3',
])
const elements: Element[] = ['火', '水', '雷', '冰', '龍']

export function calculateDamageSummary(skills: Pick<AggregatedSkill, 'key' | 'effect'>[]) {
  let attack = 0
  let damage = 0
  let radiantDamage = 0
  let elementalDamage = 0
  let affinity = 0
  let followUp = 0
  const bonuses = new Map<Element, ElementBonus>()

  for (const { key, effect } of skills) {
    if (!effect) continue
    const element = elements.find((e) => effect.includes(`${e}屬性傷害+`))
    if (element && key.endsWith('-damage-up')) {
      const bonus = bonuses.get(element) ?? { attack: 0, damage: 0, radiantDamage: 0 }
      const normal = Number(effect.match(/屬性傷害\+(\d+)%/)?.[1] ?? 0)
      bonus.attack += Number(effect.match(/屬性攻擊力\+(\d+)/)?.[1] ?? 0)
      bonus.damage += normal
      bonus.radiantDamage += Number(effect.match(/融光種魔物時變為(\d+)%/)?.[1] ?? normal)
      bonuses.set(element, bonus)
    } else if (key === 'radiant-sense') {
      radiantDamage += Number(effect.match(/傷害\+(\d+)%/)?.[1] ?? 0)
    } else if (damageSkills.has(key)) {
      attack += Number(effect.match(/屬性攻擊力\+(\d+)/)?.[1] ?? 0)
      const amount = Number(effect.match(/傷害(?:\+|提升)(\d+)%/)?.[1] ?? 0)
      damage += amount
      radiantDamage += amount
    } else if (key === 'critical-element') {
      elementalDamage += Number(effect.match(/屬性傷害提高(\d+)%/)?.[1] ?? 0)
    } else if (key === 'weakspot-follow-up') {
      followUp += Number(effect.match(/追加相當於(\d+)%/)?.[1] ?? 0)
    }
    if (['insight', 'unleashed', 'battle-spirit', 'weakspot-exploit'].includes(key)) {
      affinity += Number(effect.match(/會心率(?:\+|提升)(\d+)%/)?.[1] ?? 0)
    }
  }

  return {
    attack, damage, radiantDamage, elementalDamage, affinity, followUp,
    elements: elements.flatMap((element) => {
      const bonus = bonuses.get(element)
      return bonus ? [{ element, attack: attack + bonus.attack, damage: damage + bonus.damage, radiantDamage: radiantDamage + bonus.radiantDamage }] : []
    }),
    hasValues: Boolean(attack || damage || radiantDamage || elementalDamage || affinity || followUp || bonuses.size),
  }
}