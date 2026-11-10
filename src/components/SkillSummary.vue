<script setup lang="ts">
import { useBuild } from '../composables/useBuild'

defineProps<{ compact?: boolean }>()
const { setStatuses, aggregatedSkills } = useBuild()
</script>

<template>
  <section class="summary">
    <h3>套裝技能</h3>
    <!-- 簡易排版：套裝名稱、加成、件數、是否發動 -->
    <ul v-if="setStatuses.length && compact" class="compact-list sets-compact">
      <li v-for="s in setStatuses" :key="s.set.id" :class="{ on: s.active }">
        <span class="set-name">{{ s.set.name }}<small>{{ s.set.bonusLabel }}</small></span>
        <span class="set-count">{{ s.count }}/{{ s.set.requiredPieces }}</span>
        <span class="state">{{ s.active ? '發動' : '未發動' }}</span>
      </li>
    </ul>
    <ul v-else-if="setStatuses.length" class="sets">
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

    <h3>技能合計</h3>
    <!-- 簡易排版：只顯示技能名稱、格子、等級 -->
    <ul v-if="aggregatedSkills.length && compact" class="compact-list skills-compact">
      <li v-for="s in aggregatedSkills" :key="s.key">
        <span class="sk-name">{{ s.name }}</span>
        <span class="pips" :aria-label="`Lv${s.level} / ${s.maxLevel ?? '?'}`">
          <i v-for="n in s.maxLevel ?? s.level" :key="n" :class="{ f: n <= s.level }" />
        </span>
        <span class="sk-lv">
          Lv{{ s.level }}<template v-if="s.maxLevel">/{{ s.maxLevel }}</template>
          <span v-if="s.uncertain" class="warn" title="來源資料未標示等級，暫以 Lv1 計算">?</span>
        </span>
      </li>
    </ul>
    <ul v-else-if="aggregatedSkills.length" class="skills">
      <li v-for="s in aggregatedSkills" :key="s.key">
        <div class="sk-top">
          <span class="sk-name">{{ s.name }}</span>
          <span class="pips" :aria-label="`Lv${s.level} / ${s.maxLevel ?? '?'}`">
            <i v-for="n in s.maxLevel ?? s.level" :key="n" :class="{ f: n <= s.level }" />
          </span>
          <span class="sk-lv">
            Lv{{ s.level }}<template v-if="s.maxLevel">/{{ s.maxLevel }}</template>
            <span v-if="s.uncertain" class="warn" title="來源資料未標示等級，暫以 Lv1 計算">?</span>
          </span>
        </div>
        <div v-if="s.raw > s.level" class="over">超出上限 +{{ s.raw - s.level }}</div>
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
.over {
  font-size: 11px;
  color: var(--warn);
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
.sets-compact li:not(.on) {
  opacity: 0.65;
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
