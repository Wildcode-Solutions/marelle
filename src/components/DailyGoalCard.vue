<script setup lang="ts">
import { computed } from "vue";

import type { TodayProgress } from "@/types/domain";

const props = defineProps<{
  progress: TodayProgress;
}>();

const progressPercentage = computed(() => {
  if (props.progress.goalXp === 0) return 0;
  return Math.min(100, Math.round((props.progress.earnedXp / props.progress.goalXp) * 100));
});
</script>

<template>
  <section class="goal-card" aria-labelledby="daily-goal-title">
    <div class="goal-copy">
      <p class="eyebrow">Le petit défi du jour</p>
      <h2 id="daily-goal-title">Quelques minutes, puis c’est les vacances !</h2>
      <p>
        {{ progress.answeredQuestions > 0 ? `${progress.answeredQuestions} questions déjà tentées.` : "Ta série commence ici." }}
      </p>
    </div>

    <div class="goal-progress" aria-label="Progression de l’objectif quotidien">
      <div class="goal-progress__label">
        <strong>{{ progress.earnedXp }} / {{ progress.goalXp }} XP</strong>
        <span>{{ progressPercentage }} %</span>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        :aria-valuenow="progress.earnedXp"
        aria-valuemin="0"
        :aria-valuemax="progress.goalXp"
      >
        <span :style="{ width: `${progressPercentage}%` }"></span>
      </div>
    </div>

    <RouterLink class="primary-button" to="/matieres">
      Continuer ma session
      <span aria-hidden="true">→</span>
    </RouterLink>
  </section>
</template>
