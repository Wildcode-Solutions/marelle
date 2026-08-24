<template>
  <div class="league-view">
    <!-- Loading skeleton -->
    <div v-if="loading" class="league-skeleton">
      <div v-for="i in 10" :key="i" class="league-skeleton__row">
        <div class="skeleton-avatar" />
        <div class="skeleton-block">
          <div class="skeleton-line" />
          <div class="skeleton-line skeleton-line--short" />
        </div>
        <div class="skeleton-xp" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="league-error">
      <p>😕 Impossible de charger le classement.</p>
      <button class="btn btn--secondary" @click="reload">Réessayer</button>
    </div>

    <!-- Not active -->
    <div v-else-if="!activeMember" class="league-inactive">
      <div class="league-inactive__illustration">🏁</div>
      <h2>Pas encore inscrit cette semaine</h2>
      <p>
        Termine la <strong>Marelle du jour</strong> pour rejoindre ta ligue et intégrer le classement.
      </p>
      <button class="btn btn--primary" @click="$router.push('/marelle-du-jour')">
        Démarrer la Marelle du jour
      </button>
    </div>

    <!-- Leaderboard -->
    <div v-else class="league-board">
      <!-- Zone legends -->
      <div class="league-zones">
        <div class="league-zones__item league-zones__item--promo">
          <span class="league-zones__dot" />
          <span>{{ data!.promotionCount }} promotion{{ data!.promotionCount > 1 ? "s" : "" }}</span>
        </div>
        <div class="league-zones__item league-zones__item--stay">
          <span class="league-zones__dot" />
          <span>Maintien</span>
        </div>
        <div class="league-zones__item league-zones__item--relegate">
          <span class="league-zones__dot" />
          <span>{{ data!.relegationCount }} relégation{{ data!.relegationCount > 1 ? "s" : "" }}</span>
        </div>
      </div>

      <!-- XP gap -->
      <div
        v-if="data!.xpToPromotionZone !== null && myZone !== 'promotion'"
        class="league-gap-banner"
      >
        ⚡ <strong>{{ data!.xpToPromotionZone }} XP</strong> avant la zone de promotion
      </div>
      <div v-else-if="myZone === 'promotion'" class="league-gap-banner league-gap-banner--promo">
        🎯 Tu es en zone de promotion — continue sur ta lancée !
      </div>

      <!-- Rows -->
      <ol class="league-list" aria-label="Classement de la ligue">
        <li
          v-for="user in data!.users"
          :key="user.userId"
          class="league-row"
          :class="{
            'league-row--me': user.isCurrentUser,
            [`league-row--${user.zone}`]: true,
          }"
        >
          <!-- Zone marker -->
          <div class="league-row__zone-bar" />

          <!-- Rank -->
          <span class="league-row__rank" :class="rankClass(user.rank)">
            {{ user.rank === 1 ? "🥇" : user.rank === 2 ? "🥈" : user.rank === 3 ? "🥉" : user.rank }}
          </span>

          <!-- Avatar -->
          <div
            class="league-row__avatar"
            :style="{ background: `${user.profileColor}22`, borderColor: user.profileColor }"
          >
            {{ user.avatarEmoji }}
          </div>

          <!-- Name -->
          <div class="league-row__name-block">
            <span class="league-row__name">
              {{ user.displayName }}
              <span v-if="user.isCurrentUser" class="league-row__you">Toi</span>
            </span>
          </div>

          <!-- XP -->
          <span class="league-row__xp">{{ user.weeklyXp }} <small>XP</small></span>
        </li>
      </ol>

      <!-- History link -->
      <button class="league-history-link" @click="showHistory = !showHistory">
        {{ showHistory ? "Masquer" : "Voir" }} l'historique
      </button>

      <div v-if="showHistory" class="league-history">
        <div v-if="historyLoading" class="league-history__loading">Chargement…</div>
        <div v-else-if="history.length === 0" class="league-history__empty">
          Pas encore d'historique.
        </div>
        <div
          v-for="entry in history"
          :key="entry.weekId"
          class="league-history__entry"
          :class="`league-history__entry--${entry.result}`"
        >
          <span class="league-history__icon">{{ entry.leagueIcon }}</span>
          <div class="league-history__details">
            <strong>Ligue {{ entry.leagueName }}</strong>
            <span>{{ formatWeek(entry.weekStart) }} · {{ entry.weeklyXp }} XP · #{{ entry.finalRank }}</span>
          </div>
          <span class="league-history__result">{{ resultLabel(entry.result) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api } from "@/services/api";
import type { LeagueHistoryEntry, LeagueLeaderboard } from "@/types/domain";

const data = ref<LeagueLeaderboard | null>(null);
const loading = ref(true);
const error = ref(false);
const activeMember = ref(false);

const showHistory = ref(false);
const history = ref<LeagueHistoryEntry[]>([]);
const historyLoading = ref(false);

async function reload() {
  loading.value = true;
  error.value = false;
  try {
    const resp = await api.league.leaderboard();
    data.value = resp.leaderboard;
    activeMember.value = resp.leaderboard !== null;
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(reload);

watch(showHistory, async (val) => {
  if (val && history.value.length === 0) {
    historyLoading.value = true;
    try {
      const resp = await api.league.history();
      history.value = resp.history;
    } finally {
      historyLoading.value = false;
    }
  }
});

const myZone = computed(() => {
  if (!data.value) return null;
  return data.value.users.find((u) => u.isCurrentUser)?.zone ?? null;
});

function rankClass(rank: number): string {
  if (rank === 1) return "league-row__rank--gold";
  if (rank === 2) return "league-row__rank--silver";
  if (rank === 3) return "league-row__rank--bronze";
  return "";
}

function resultLabel(result: "promoted" | "stayed" | "relegated"): string {
  switch (result) {
    case "promoted": return "↑ Promu";
    case "relegated": return "↓ Relégué";
    default: return "= Maintien";
  }
}

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
</script>
