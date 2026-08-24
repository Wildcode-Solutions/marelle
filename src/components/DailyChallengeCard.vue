<script setup lang="ts">
import type { DailyChallenge } from "@/types/domain";

defineProps<{
  challenge: DailyChallenge;
  currentStreak: number;
}>();
</script>

<template>
  <section class="daily-challenge-card" aria-labelledby="daily-challenge-card-title">
    <div class="daily-challenge-card__copy">
      <p class="eyebrow">Marelle du jour</p>
      <h2 id="daily-challenge-card-title">{{ challenge.title }}</h2>
      <p v-if="challenge.participation.status === 'completed'" class="daily-challenge-card__done">
        <span aria-hidden="true">✓</span>
        Terminée · score {{ challenge.participation.score }} / {{ challenge.participation.totalQuestions }}
      </p>
      <p v-else>
        {{ challenge.questionCount }} questions · environ {{ challenge.estimatedMinutes }} min
      </p>
      <strong class="daily-challenge-card__streak">🔥 Série : {{ currentStreak }} jour{{ currentStreak > 1 ? "s" : "" }}</strong>
    </div>

    <div class="daily-challenge-card__sketch" aria-hidden="true">
      <span>5</span>
      <span>3</span><span>4</span>
      <span>2</span>
      <span>1</span>
    </div>

    <RouterLink
      class="primary-button daily-challenge-card__button"
      :to="challenge.participation.status === 'available'
        ? { name: 'daily-challenge', query: { start: '1' } }
        : { name: 'daily-challenge' }"
    >
      <template v-if="challenge.participation.status === 'completed'">Voir mon résultat</template>
      <template v-else-if="challenge.participation.status === 'in_progress'">Reprendre</template>
      <template v-else>Commencer</template>
    </RouterLink>
  </section>
</template>
