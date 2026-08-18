<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import AppHeader from "@/components/AppHeader.vue";
import DailyGoalCard from "@/components/DailyGoalCard.vue";
import SubjectGrid from "@/components/SubjectGrid.vue";
import { api } from "@/services/api";
import type { DashboardData } from "@/types/domain";

const dashboard = ref<DashboardData | null>(null);
const isLoading = ref(true);
const errorMessage = ref("");

const accuracy = computed(() => {
  const today = dashboard.value?.today;
  if (!today || today.answeredQuestions === 0) return 0;
  return Math.round((today.correctAnswers / today.answeredQuestions) * 100);
});

async function loadDashboard(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    dashboard.value = await api.dashboard();
  } catch {
    errorMessage.value = "Impossible de charger ta progression. Vérifie que l’API et la base locale sont démarrées.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <div v-if="isLoading" class="page page--loading" aria-live="polite">
    <div class="skeleton skeleton--header"></div>
    <div class="skeleton skeleton--hero"></div>
    <div class="skeleton-grid">
      <div v-for="index in 4" :key="index" class="skeleton skeleton--card"></div>
    </div>
    <span class="sr-only">Chargement de la progression</span>
  </div>

  <div v-else-if="errorMessage" class="page error-state">
    <span class="error-state__icon" aria-hidden="true">🛠️</span>
    <h1>Petit contretemps</h1>
    <p>{{ errorMessage }}</p>
    <button class="primary-button" type="button" @click="loadDashboard">Réessayer</button>
  </div>

  <div v-else-if="dashboard" class="page">
    <AppHeader :user="dashboard.user" />

    <section class="welcome-block">
      <div>
        <p class="eyebrow">Bonjour {{ dashboard.user.displayName }} 👋</p>
        <h1>Prêt·e à faire un petit pas&nbsp;?</h1>
      </div>
      <span class="level-badge">Niveau {{ dashboard.user.level }}</span>
    </section>

    <DailyGoalCard :progress="dashboard.today" />

    <section class="quick-stats" aria-label="Statistiques du jour">
      <div>
        <span aria-hidden="true">✓</span>
        <strong>{{ dashboard.today.completedSessions }}</strong>
        <small>session</small>
      </div>
      <div>
        <span aria-hidden="true">◎</span>
        <strong>{{ accuracy }} %</strong>
        <small>réussite</small>
      </div>
      <div>
        <span aria-hidden="true">★</span>
        <strong>{{ dashboard.user.xp }}</strong>
        <small>XP total</small>
      </div>
    </section>

    <section class="section-block" aria-labelledby="subjects-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">À toi de choisir</p>
          <h2 id="subjects-title">Tes matières</h2>
        </div>
        <RouterLink to="/matieres">Tout voir</RouterLink>
      </div>
      <SubjectGrid :subjects="dashboard.subjects.slice(0, 4)" />
    </section>

    <aside class="streak-card">
      <span class="streak-card__icon" aria-hidden="true">🔥</span>
      <div>
        <strong>{{ dashboard.user.currentStreak }} jours d’affilée !</strong>
        <p>Une courte session aujourd’hui protège ta série.</p>
      </div>
    </aside>
  </div>
</template>
