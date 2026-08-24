<template>
  <div
    v-if="league"
    class="league-card"
    :class="{ 'league-card--active': league.isActive }"
    :style="{ '--league-color': league.leagueColor }"
    role="button"
    tabindex="0"
    @click="$router.push('/ligue')"
    @keydown.enter="$router.push('/ligue')"
  >
    <!-- Header -->
    <div class="league-card__header">
      <div class="league-card__badge">
        <span class="league-card__icon">{{ league.leagueIcon }}</span>
        <div class="league-card__badge-glow" />
      </div>
      <div class="league-card__meta">
        <span class="league-card__label">Ligue</span>
        <span class="league-card__name">{{ league.leagueName }}</span>
      </div>
      <span class="league-card__week">Sem. {{ weekLabel }}</span>
    </div>

    <!-- Inactive state -->
    <div v-if="!league.isActive" class="league-card__inactive">
      <span class="league-card__inactive-icon">🏁</span>
      <p>Termine la Marelle du jour pour rejoindre ta ligue cette semaine !</p>
    </div>

    <!-- Active state -->
    <template v-else>
      <!-- Rank & XP -->
      <div class="league-card__stats">
        <div class="league-card__stat">
          <span class="league-card__stat-value">
            {{ league.rank }}<span class="league-card__stat-total">/{{ league.totalMembers }}</span>
          </span>
          <span class="league-card__stat-label">Classement</span>
        </div>
        <div class="league-card__divider" />
        <div class="league-card__stat">
          <span class="league-card__stat-value league-card__stat-xp">
            {{ league.weeklyXp }} <span class="league-card__stat-unit">XP</span>
          </span>
          <span class="league-card__stat-label">cette semaine</span>
        </div>
      </div>

      <!-- Zone indicator -->
      <div
        class="league-card__zone"
        :class="`league-card__zone--${league.zone ?? 'stay'}`"
      >
        <span class="league-card__zone-dot" />
        <span class="league-card__zone-text">{{ zoneLabel }}</span>
      </div>

      <!-- XP gap to promotion -->
      <p
        v-if="league.xpToPromotionZone !== null && (league.zone === 'stay' || league.zone === 'relegation')"
        class="league-card__gap"
      >
        ⚡ <strong>{{ league.xpToPromotionZone }} XP</strong> te séparent de la zone de promotion
      </p>
      <p v-else-if="league.zone === 'promotion'" class="league-card__gap league-card__gap--promo">
        🎯 Tu es en <strong>zone de promotion</strong> — continue !
      </p>
    </template>

    <!-- Arrow -->
    <div class="league-card__arrow">›</div>
  </div>

  <!-- Skeleton loader -->
  <div v-else-if="loading" class="league-card league-card--skeleton">
    <div class="skeleton-line skeleton-line--short" />
    <div class="skeleton-line" />
    <div class="skeleton-line skeleton-line--medium" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "@/services/api";
import type { LeagueSummary } from "@/types/domain";

const league = ref<LeagueSummary | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const data = await api.league.me();
    league.value = data.league;
  } catch {
    // Silently ignore — la carte ne s'affiche pas en cas d'erreur
  } finally {
    loading.value = false;
  }
});

const weekLabel = computed(() => {
  if (!league.value) return "";
  const start = new Date(league.value.weekStart);
  const end = new Date(league.value.weekEnd);
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
});

const zoneLabel = computed(() => {
  switch (league.value?.zone) {
    case "promotion": return "Zone de promotion 🚀";
    case "relegation": return "Zone de relégation ⚠️";
    default: return "Zone de maintien";
  }
});
</script>
