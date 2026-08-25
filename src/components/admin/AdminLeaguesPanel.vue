<script setup lang="ts">
import { onMounted, ref } from "vue";

import { api, ApiError } from "@/services/api";
import type { AdminLeagueStats } from "@/types/domain";

const stats = ref<AdminLeagueStats | null>(null);
const isLoading = ref(true);
const errorMessage = ref("");

const numberFormatter = new Intl.NumberFormat("fr-FR");

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatWeek(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

async function loadStats(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    stats.value = await api.admin.leagues();
  } catch (error) {
    errorMessage.value = error instanceof ApiError
      ? error.message
      : "Impossible de charger les statistiques des ligues.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadStats);
</script>

<template>
  <section class="admin-workspace" aria-labelledby="leagues-title">
    <div class="admin-section-heading">
      <div>
        <p class="eyebrow">Compétition</p>
        <h2 id="leagues-title">Statistiques des ligues</h2>
        <p>Participation, groupes et XP de la semaine, avec la répartition générale des joueurs.</p>
      </div>
      <button class="compact-button" type="button" :disabled="isLoading" @click="loadStats">
        Actualiser
      </button>
    </div>

    <p v-if="isLoading" class="notice" aria-live="polite">Chargement des ligues…</p>
    <div v-else-if="errorMessage" class="notice notice--error" role="alert">
      <p>{{ errorMessage }}</p>
      <button class="secondary-button" type="button" @click="loadStats">Réessayer</button>
    </div>

    <template v-else-if="stats">
      <p class="admin-league-period">
        Semaine {{ stats.currentWeek.id }} ·
        {{ formatWeek(stats.currentWeek.weekStart, stats.currentWeek.weekEnd) }}
      </p>

      <section class="admin-stats" aria-label="Indicateurs des ligues">
        <article class="admin-stat-card">
          <span aria-hidden="true">🏁</span>
          <strong>{{ formatNumber(stats.totals.activePlayers) }}</strong>
          <p>joueurs actifs cette semaine</p>
        </article>
        <article class="admin-stat-card">
          <span aria-hidden="true">🧩</span>
          <strong>{{ formatNumber(stats.totals.groups) }}</strong>
          <p>groupes cette semaine</p>
        </article>
        <article class="admin-stat-card">
          <span aria-hidden="true">⚡</span>
          <strong>{{ formatNumber(stats.totals.weeklyXp) }}</strong>
          <p>XP gagnés cette semaine</p>
        </article>
        <article class="admin-stat-card">
          <span aria-hidden="true">📈</span>
          <strong>{{ formatNumber(stats.totals.averageXpPerActivePlayer) }}</strong>
          <p>XP moyens par joueur actif</p>
        </article>
      </section>

      <section class="admin-panel" aria-labelledby="league-distribution-title">
        <div class="admin-panel-heading">
          <div>
            <p class="eyebrow">Répartition</p>
            <h2 id="league-distribution-title">{{ formatNumber(stats.totals.players) }} joueurs</h2>
          </div>
          <p>Les comptes sans historique commencent en ligue Fer.</p>
        </div>

        <div class="admin-league-grid">
          <article
            v-for="league in stats.leagues"
            :key="league.key"
            class="admin-league-card"
            :style="{ '--admin-league-color': league.color }"
          >
            <header>
              <span aria-hidden="true">{{ league.icon }}</span>
              <div>
                <strong>{{ league.name }}</strong>
                <small>Rang {{ league.rankOrder }}</small>
              </div>
            </header>
            <dl>
              <div><dt>Joueurs</dt><dd>{{ formatNumber(league.players) }}</dd></div>
              <div><dt>Actifs</dt><dd>{{ formatNumber(league.activePlayers) }}</dd></div>
              <div><dt>Groupes</dt><dd>{{ formatNumber(league.groups) }}</dd></div>
              <div><dt>XP semaine</dt><dd>{{ formatNumber(league.weeklyXp) }}</dd></div>
            </dl>
          </article>
        </div>
      </section>

      <section class="admin-panel" aria-labelledby="league-results-title">
        <div>
          <p class="eyebrow">Historique</p>
          <h2 id="league-results-title">Résultats enregistrés</h2>
        </div>
        <dl class="admin-breakdown admin-breakdown--league-results">
          <div><dt>Promotions</dt><dd>{{ formatNumber(stats.outcomes.promoted) }}</dd></div>
          <div><dt>Maintiens</dt><dd>{{ formatNumber(stats.outcomes.stayed) }}</dd></div>
          <div><dt>Relégations</dt><dd>{{ formatNumber(stats.outcomes.relegated) }}</dd></div>
          <div><dt>Résultats au total</dt><dd>{{ formatNumber(stats.outcomes.total) }}</dd></div>
        </dl>
      </section>

      <section class="admin-panel" aria-labelledby="league-weeks-title">
        <div>
          <p class="eyebrow">Évolution</p>
          <h2 id="league-weeks-title">Semaines récentes</h2>
        </div>
        <p v-if="stats.weeks.length === 0" class="admin-empty-copy">
          Aucune semaine de compétition n’a encore démarré.
        </p>
        <div v-else class="admin-league-weeks">
          <article v-for="week in stats.weeks" :key="week.weekId">
            <div>
              <strong>{{ week.weekId }}</strong>
              <span>{{ formatWeek(week.weekStart, week.weekEnd) }}</span>
            </div>
            <dl>
              <div><dt>Joueurs</dt><dd>{{ formatNumber(week.totalActivePlayers) }}</dd></div>
              <div><dt>Groupes</dt><dd>{{ formatNumber(week.totalGroups) }}</dd></div>
              <div><dt>XP</dt><dd>{{ formatNumber(week.totalWeeklyXp) }}</dd></div>
            </dl>
            <span class="admin-week-status" :class="{ 'admin-week-status--open': !week.processedAt }">
              {{ week.processedAt ? "Traitée" : "En cours" }}
            </span>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>
