<script setup lang="ts">
import { onMounted, ref } from "vue";

import AdminContentPanel from "@/components/admin/AdminContentPanel.vue";
import AdminDailyChallengesPanel from "@/components/admin/AdminDailyChallengesPanel.vue";
import AdminLeaguesPanel from "@/components/admin/AdminLeaguesPanel.vue";
import AdminSubjectsPanel from "@/components/admin/AdminSubjectsPanel.vue";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel.vue";
import ViewHeader from "@/components/ViewHeader.vue";
import { api } from "@/services/api";
import type { AdminOverview } from "@/types/domain";

type AdminTab = "overview" | "leagues" | "users" | "subjects" | "content" | "dailyChallenges";

const activeTab = ref<AdminTab>("overview");
const overview = ref<AdminOverview | null>(null);
const isLoading = ref(true);
const errorMessage = ref("");

async function loadOverview(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    overview.value = await api.admin.overview();
  } catch {
    errorMessage.value = "Impossible de charger les données d’administration.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadOverview);

async function openOverview(): Promise<void> {
  activeTab.value = "overview";
  await loadOverview();
}

function formatDateTime(value: string | null): string {
  if (!value) return "Aucune connexion enregistrée";
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
</script>

<template>
  <div class="page inner-page admin-page">
    <ViewHeader
      eyebrow="Administration"
      title="Espace administrateur"
      description="Gère les comptes, les matières et le contenu pédagogique de Marelle."
    />

    <nav class="admin-tabs" aria-label="Sections d’administration">
      <button
        type="button"
        :class="{ 'admin-tabs__button--active': activeTab === 'leagues' }"
        @click="activeTab = 'leagues'"
      >
        <span aria-hidden="true">🏆</span>
        Ligues
      </button>
      <button
        type="button"
        :class="{ 'admin-tabs__button--active': activeTab === 'dailyChallenges' }"
        @click="activeTab = 'dailyChallenges'"
      >
        <span aria-hidden="true">▦</span>
        Marelles du jour
        <span
          v-if="overview"
          class="admin-tabs__count"
          :aria-label="`${overview.scheduledDailyChallenges} Marelles planifiées`"
        >
          {{ overview.scheduledDailyChallenges }}
        </span>
      </button>
      <button
        type="button"
        :class="{ 'admin-tabs__button--active': activeTab === 'overview' }"
        @click="openOverview"
      >
        <span aria-hidden="true">📊</span>
        Vue d’ensemble
      </button>
      <button
        type="button"
        :class="{ 'admin-tabs__button--active': activeTab === 'users' }"
        @click="activeTab = 'users'"
      >
        <span aria-hidden="true">👥</span>
        Comptes
        <span
          v-if="overview"
          class="admin-tabs__count"
          :aria-label="`${overview.users.total} comptes`"
        >
          {{ overview.users.total }}
        </span>
      </button>
      <button
        type="button"
        :class="{ 'admin-tabs__button--active': activeTab === 'subjects' }"
        @click="activeTab = 'subjects'"
      >
        <span aria-hidden="true">📚</span>
        Matières
        <span
          v-if="overview"
          class="admin-tabs__count"
          :aria-label="`${overview.activeSubjects} matières actives`"
        >
          {{ overview.activeSubjects }}
        </span>
      </button>
      <button
        type="button"
        :class="{ 'admin-tabs__button--active': activeTab === 'content' }"
        @click="activeTab = 'content'"
      >
        <span aria-hidden="true">🧩</span>
        Contenu
        <span
          v-if="overview"
          class="admin-tabs__count"
          :aria-label="`${overview.content.themes} thèmes et ${overview.content.questions} questions`"
        >
          {{ overview.content.themes }} / {{ overview.content.questions }}
        </span>
      </button>
    </nav>

    <section v-if="activeTab === 'overview'">
      <p v-if="isLoading" class="notice" aria-live="polite">Chargement des indicateurs…</p>

      <div v-else-if="errorMessage" class="notice notice--error" role="alert">
        <p>{{ errorMessage }}</p>
        <button class="secondary-button" type="button" @click="loadOverview">Réessayer</button>
      </div>

      <template v-else-if="overview">
        <section class="admin-stats" aria-label="Indicateurs d’administration">
          <article class="admin-stat-card">
            <span aria-hidden="true">👥</span>
            <strong>{{ overview.users.total }}</strong>
            <p>comptes au total</p>
          </article>
          <article class="admin-stat-card">
            <span aria-hidden="true">🛡️</span>
            <strong>{{ overview.users.admins }}</strong>
            <p>administrateurs</p>
          </article>
          <article class="admin-stat-card">
            <span aria-hidden="true">🔑</span>
            <strong>{{ overview.activeSessions }}</strong>
            <p>sessions actives</p>
          </article>
          <article class="admin-stat-card">
            <span aria-hidden="true">↪️</span>
            <strong>{{ overview.connections.last24Hours }}</strong>
            <p>connexions sur 24 h</p>
          </article>
          <article class="admin-stat-card">
            <span aria-hidden="true">📅</span>
            <strong>{{ overview.connections.activeUsersLast7Days }}</strong>
            <p>utilisateurs connectés sur 7 jours</p>
          </article>
          <article class="admin-stat-card">
            <span aria-hidden="true">📚</span>
            <strong>{{ overview.activeSubjects }}</strong>
            <p>matières actives</p>
          </article>
          <article class="admin-stat-card">
            <span aria-hidden="true">❓</span>
            <strong>{{ overview.content.questions }}</strong>
            <p>questions créées</p>
          </article>
          <article class="admin-stat-card">
            <span aria-hidden="true">💬</span>
            <strong>{{ overview.content.answers }}</strong>
            <p>réponses créées</p>
          </article>
        </section>

        <section class="admin-panel">
          <div>
            <p class="eyebrow">Répartition</p>
            <h2>Comptes utilisateurs</h2>
          </div>
          <dl class="admin-breakdown">
            <div>
              <dt>Élèves</dt>
              <dd>{{ overview.users.students }}</dd>
            </div>
            <div>
              <dt>Administrateurs</dt>
              <dd>{{ overview.users.admins }}</dd>
            </div>
          </dl>
        </section>

        <section class="admin-panel" aria-labelledby="connections-title">
          <div class="admin-panel-heading">
            <div>
              <p class="eyebrow">Activité</p>
              <h2 id="connections-title">Connexions utilisateurs</h2>
            </div>
            <p>Dernière : {{ formatDateTime(overview.connections.lastAt) }}</p>
          </div>

          <dl class="admin-breakdown admin-breakdown--connections">
            <div>
              <dt>Sur les 24 dernières heures</dt>
              <dd>{{ overview.connections.last24Hours }}</dd>
            </div>
            <div>
              <dt>Sur les 7 derniers jours</dt>
              <dd>{{ overview.connections.last7Days }}</dd>
            </div>
            <div>
              <dt>Depuis le début du suivi</dt>
              <dd>{{ overview.connections.total }}</dd>
            </div>
          </dl>

          <div class="admin-recent-logins">
            <h3>Connexions récentes</h3>
            <p v-if="overview.connections.recent.length === 0" class="admin-empty-copy">
              Aucune connexion enregistrée pour le moment.
            </p>
            <template v-else>
              <article
                v-for="login in overview.connections.recent"
                :key="login.id"
                class="admin-login-row"
              >
                <span class="admin-user-avatar" aria-hidden="true">{{ login.avatarEmoji }}</span>
                <span>
                  <strong>{{ login.displayName }}</strong>
                  <small>{{ login.email }}</small>
                </span>
                <time :datetime="login.occurredAt">{{ formatDateTime(login.occurredAt) }}</time>
              </article>
            </template>
          </div>
        </section>
      </template>
    </section>

    <AdminLeaguesPanel v-else-if="activeTab === 'leagues'" />
    <AdminUsersPanel v-else-if="activeTab === 'users'" />
    <AdminSubjectsPanel v-else-if="activeTab === 'subjects'" />
    <template v-else-if="activeTab === 'dailyChallenges'">
      <p
        v-if="overview?.scheduledDailyChallenges === 0"
        class="notice admin-schedule-notice"
        role="status"
      >
        <span aria-hidden="true">⚠️</span>
        <span>
          <strong>Aucune Marelle n’est planifiée.</strong>
          Programme la prochaine édition pour assurer la continuité des défis quotidiens.
        </span>
      </p>
      <AdminDailyChallengesPanel @changed="loadOverview" />
    </template>
    <AdminContentPanel v-else />
  </div>
</template>
