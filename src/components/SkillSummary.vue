<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBuild } from '../composables/useBuild'
import { calculateDamageSummary } from '../composables/damageSummary'
import SkillDetail from './SkillDetail.vue'
import OverCapIcon from './OverCapIcon.vue'

const props = defineProps<{ compact?: boolean }>()
const { setStatuses, aggregatedSkills } = useBuild()

/** 簡易排版只列出已發動的套裝技能 */
const activeSets = computed(() => setStatuses.value.filter((s) => s.active))
const damageSummary = computed(() => calculateDamageSummary(aggregatedSkills.value))

function damageText(normal: number, radiant: number) {
  return `+${normal}${radiant !== normal ? `(${radiant})` : ''}%`
}

/** 點技能跳出各等級說明 */
const detailKey = ref<string | null>(null)
const detail = computed(() => aggregatedSkills.value.find((s) => s.key === detailKey.value))
</script>

<template>
  <section class="summary">
    <!-- 簡易排版：只顯示已發動的套裝（名稱、加成、件數），一個都沒發動就整段不顯示 -->
    <template v-if="props.compact">
      <template v-if="activeSets.length">
        <h3>套裝技能</h3>
        <ul class="compact-list sets-compact">
          <li v-for="s in activeSets" :key="s.set.id" class="on">
            <span class="set-name">{{ s.set.name }}<small>{{ s.set.bonusLabel }}</small></span>
            <span class="set-count">{{ s.count }}/{{ s.set.requiredPieces }}</span>
          </li>
        </ul>
      </template>
    </template>
    <template v-else>
    <h3>套裝技能</h3>
    <ul v-if="setStatuses.length" class="sets">
      <li v-for="s in setStatuses" :key="s.set.id" :class="{ on: s.active }">
        <div class="set-top">
          <span class="set-name">{{ s.set.name }}</span>
          <span class="set-count">{{ s.count }} 件（需 {{ s.set.requiredPieces }}）</span>
          <span class="state">{{ s.active ? '發動' : '未發動' }}</span>
        </div>
        <div class="set-effect">
          <b>{{ s.set.bonusLabel }}</b> {{ s.set.bonusEffect }}
        </div>
      </li>
    </ul>
    <p v-else class="muted">尚未裝備任何防具</p>
    </template>

    <div class="skill-heading">
      <h3>技能合計</h3>
      <span v-if="damageSummary.hasValues" class="estimate-label">最高理想化</span>
    </div>
    <div v-if="damageSummary.hasValues" class="damage-summary">
      <div class="damage-values" :class="{ 'single-line': damageSummary.elements.length <= 1 }">
        <div v-if="damageSummary.elements.length !== 1 && (damageSummary.attack || damageSummary.damage || damageSummary.radiantDamage)" class="damage-line">
          <span v-if="damageSummary.attack">屬性 <b>+{{ damageSummary.attack }}</b></span>
          <span v-if="damageSummary.damage || damageSummary.radiantDamage">傷害 <b>{{ damageText(damageSummary.damage, damageSummary.radiantDamage) }}</b></span>
        </div>
        <div v-for="e in damageSummary.elements" :key="e.element" class="damage-line">
          <strong v-if="damageSummary.elements.length > 1">{{ e.element }}屬性</strong>
          <span v-if="e.attack">屬性 <b>+{{ e.attack }}</b></span>
          <span>傷害 <b>{{ damageText(e.damage, e.radiantDamage) }}</b></span>
        </div>
        <div v-if="damageSummary.elementalDamage || damageSummary.affinity || damageSummary.followUp" class="damage-line">
          <span v-if="damageSummary.elementalDamage">屬會傷害 <b>+{{ damageSummary.elementalDamage }}%</b></span>
          <span v-if="damageSummary.affinity">會心率 <b>+{{ damageSummary.affinity }}%</b></span>
          <span v-if="damageSummary.followUp">追擊傷害 <b>+{{ damageSummary.followUp }}%</b></span>
        </div>
      </div>
      <p class="estimate-note">假設技能條件均成立，百分比直接相加，非實際傷害；武器、招式與條件可能無法同時成立。<template v-if="damageSummary.elements.length === 1">屬性強化僅適用{{ damageSummary.elements[0]?.element }}屬性。</template>括號內為融光種，倍率與追擊傷害不計入合計。</p>
    </div>
    <!-- 簡易排版：只顯示技能名稱、格子、等級 -->
    <!-- 點技能可看各等級說明 -->
    <ul v-if="aggregatedSkills.length && compact" class="compact-list skills-compact">
      <li
        v-for="s in aggregatedSkills"
        :key="s.key"
        class="clickable"
        role="button"
        tabindex="0"
        aria-haspopup="dialog"
        @click="detailKey = s.key"
        @keydown.enter.prevent="detailKey = s.key"
        @keydown.space.prevent="detailKey = s.key"
      >
        <span class="sk-name">{{ s.name }}</span>
        <span class="pips" :aria-label="`Lv${s.raw} / ${s.maxLevel ?? '?'}`">
          <i v-for="n in s.maxLevel ?? s.level" :key="n" :class="{ f: n <= s.level }" />
          <OverCapIcon v-if="s.raw > s.level" :extra="s.raw - s.level" />
        </span>
        <span class="sk-lv" :title="s.raw > s.level ? `超過上限，實際生效 Lv${s.level}` : undefined">
          Lv{{ s.raw }}<template v-if="s.maxLevel">/{{ s.maxLevel }}</template>
          <span v-if="s.uncertain" class="warn" title="來源資料未標示等級，暫以 Lv1 計算">?</span>
        </span>
      </li>
    </ul>
    <ul v-else-if="aggregatedSkills.length" class="skills">
      <li
        v-for="s in aggregatedSkills"
        :key="s.key"
        class="clickable"
        role="button"
        tabindex="0"
        aria-haspopup="dialog"
        @click="detailKey = s.key"
        @keydown.enter.prevent="detailKey = s.key"
        @keydown.space.prevent="detailKey = s.key"
      >
        <div class="sk-top">
          <span class="sk-name">{{ s.name }}</span>
          <span class="pips" :aria-label="`Lv${s.raw} / ${s.maxLevel ?? '?'}`">
            <i v-for="n in s.maxLevel ?? s.level" :key="n" :class="{ f: n <= s.level }" />
            <OverCapIcon v-if="s.raw > s.level" :extra="s.raw - s.level" />
          </span>
          <span class="sk-lv" :title="s.raw > s.level ? `超過上限，實際生效 Lv${s.level}` : undefined">
            Lv{{ s.raw }}<template v-if="s.maxLevel">/{{ s.maxLevel }}</template>
            <span v-if="s.uncertain" class="warn" title="來源資料未標示等級，暫以 Lv1 計算">?</span>
          </span>
        </div>
        <div v-if="s.effect" class="sk-effect">{{ s.effect }}</div>
        <div v-else-if="s.skill?.description" class="sk-effect">{{ s.skill.description }}</div>
        <div class="sk-src">
          <span v-for="(src, i) in s.sources" :key="i" :class="{ set: src.fromSet }">
            {{ src.label }} +{{ src.level }}<template v-if="src.uncertain">?</template>
          </span>
        </div>
      </li>
    </ul>
    <p v-else class="muted">沒有技能</p>
    <SkillDetail v-if="detail" :entry="detail" @close="detailKey = null" />
  </section>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
h3 {
  margin: 8px 0 0;
  font-size: 15px;
}
h3:first-child {
  margin-top: 0;
}
.skill-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.skill-heading h3 {
  margin: 0;
}
.estimate-label {
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
}
.damage-summary {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.damage-line {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 6px;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.damage-line + .damage-line {
  margin-top: 4px;
}
.single-line {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 6px;
}
.single-line .damage-line {
  display: contents;
}
.damage-line > span {
  background: var(--chip);
  border-radius: 6px;
  padding: 1px 6px;
  white-space: nowrap;
}
.damage-line > span b {
  color: var(--accent);
}
.damage-line strong {
  color: var(--accent);
}
.estimate-note {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.4;
}
.sets,
.skills {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sets li,
.skills li {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 8px 10px;
}
.sets li:not(.on) {
  opacity: 0.65;
}
.sets li.on {
  border-color: var(--good-border);
}
.set-top,
.sk-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.set-name,
.sk-name {
  font-weight: 700;
  color: var(--text-strong);
  margin-right: auto;
}
.set-count {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.state {
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
  padding: 0 5px;
  background: var(--chip);
}
.on .state {
  background: var(--good-bg);
  color: var(--good);
}
.set-effect,
.sk-effect {
  font-size: 12px;
  margin-top: 2px;
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
.sk-lv {
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
/* 可點開看各等級說明 */
.clickable {
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
/* 簡易排版：點擊的底色延伸到卡片左右邊 */
.compact-list li.clickable {
  margin: 0 -10px;
  padding-left: 10px;
  padding-right: 10px;
}
.skills li.clickable:active,
.compact-list li.clickable:active {
  background: var(--hover);
}
@media (hover: hover) {
  .skills li.clickable:hover {
    border-color: var(--accent-border);
  }
  .compact-list li.clickable:hover .sk-name {
    color: var(--accent);
  }
}
.sk-src {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}
.sk-src .set {
  color: var(--good);
}
.muted {
  color: var(--muted);
  font-size: 13px;
  margin: 0;
}

/* ---------- 簡易排版：一張卡片、一行一項 ---------- */
.compact-list {
  list-style: none;
  margin: 0;
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.compact-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 14px;
}
.compact-list li + li {
  border-top: 1px solid var(--border);
}
.compact-list .sk-name,
.compact-list .set-name {
  min-width: 0;
}
.sets-compact .set-name small {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.sets-compact .on .set-name small {
  color: var(--good);
}
</style>
