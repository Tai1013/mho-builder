<script setup lang="ts">
import { useBuild } from '../composables/useBuild'

const { equipped, totalDefense, aggregatedSkills } = useBuild()
</script>

<template>
  <div class="stats">
    <div class="stat">
      <span class="stat-label">總防禦力</span>
      <span class="stat-value">{{ totalDefense }}</span>
    </div>
    <div class="stat">
      <span class="stat-label">已裝備</span>
      <span class="stat-value">{{ equipped.length }}<small> / 5</small></span>
    </div>
    <div class="stat">
      <span class="stat-label">技能數</span>
      <span class="stat-value">{{ aggregatedSkills.length }}</span>
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.stat {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 12px;
  color: var(--muted);
}
.stat-value {
  font-size: 22px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
}
.stat-value small {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
}
</style>
