import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/composables/damageSummary.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { calculateDamageSummary } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const skills = JSON.parse(await readFile(new URL('../src/data/skills.json', import.meta.url), 'utf8'))
function skill(key, level) {
  const entry = skills.find((s) => s.id === key)
  assert.ok(entry, `找不到技能 ${key}`)
  const effect = entry.levels.find((s) => s.level === level)?.effect
  assert.ok(effect, `找不到 ${key} Lv${level}`)
  return { key, effect }
}

test('拔刀與堅定按照實際生效等級直接加總', () => {
  const result = calculateDamageSummary([skill('flash-draw', 7), skill('unshaken-resolve', 3), skill('critical-element', 3)])
  assert.equal(result.attack, 50)
  assert.equal(result.damage, 43)
  assert.equal(result.radiantDamage, 43)
  assert.equal(result.elementalDamage, 15)
})

test('融光加成取代原屬性加成，融光感應僅計入融光種，各屬性不混算', () => {
  const result = calculateDamageSummary([
    skill('flash-draw', 7), skill('fire-damage-up', 7), skill('water-damage-up', 1), skill('radiant-sense', 1),
  ])
  assert.deepEqual(result.elements, [
    { element: '火', attack: 100, damage: 59, radiantDamage: 105 },
    { element: '水', attack: 50, damage: 34, radiantDamage: 43 },
  ])
  assert.equal(result.damage, 31)
  assert.equal(result.radiantDamage, 35)
})

test('會心、追擊分開顯示，不把不屈、防禦、部位或隨從傷害算成傷害加成', () => {
  const result = calculateDamageSummary([
    skill('insight', 7), skill('unleashed', 5), skill('weakspot-follow-up', 5), skill('adversity', 1),
    skill('breaker', 3), skill('buddy-boost', 1), skill('blessing', 3),
  ])
  assert.equal(result.affinity, 31)
  assert.equal(result.followUp, 25)
  assert.equal(result.damage, 0)
})

test('僅計入融光活性的正面效果及技能等級已合計的套裝加成', () => {
  const result = calculateDamageSummary([skill('gamewith-set-615ec22b68d3', 1), skill('hunting-instinct', 3)])
  assert.equal(result.damage, 22)
  assert.equal(result.radiantDamage, 22)
})

test('沒有可辨識的輸出效果時不顯示加總', () => {
  assert.equal(calculateDamageSummary([{ key: 'unknown', effect: '受到傷害時，傷害+99%。' }]).hasValues, false)
  assert.equal(calculateDamageSummary([{ key: 'flash-draw', effect: null }]).hasValues, false)
  assert.equal(calculateDamageSummary([skill('adversity', 1)]).hasValues, false)
})