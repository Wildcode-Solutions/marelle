<script setup lang="ts">
import { onMounted, ref } from "vue";

import AdminContentPanel from "@/components/admin/AdminContentPanel.vue";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel.vue";
import ViewHeader from "@/components/ViewHeader.vue";
import { api } from "@/services/api";
import type { AdminOverview } from "@/types/domain";

type AdminTab = "overview" | "users" | "content";

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
</script>

<template>
  <div class="page inner-page admin-page">
    <ViewHeader
      eyebrow="Administration"
      title="Espace administrateur"
      description="Gère les comptes et construis le contenu pédagogique de Marelle."
    />

    <nav class="admin-tabs" aria-label="Sections d’administration">
      <button
        type="button"
        :class="{ 'admin-tabs__button--active': activeTab === 'overview' }"
        @click="activeTab = 'overview'"
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
      </button>
      <button
        type="button"
        :class="{ 'admin-tabs__button--active': activeTab === 'content' }"
        @click="activeTab = 'content'"
      >
        <span aria-hidden="true">🧩</span>
        Contenu
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
            <span aria-hidden="true">📚</span>
            <strong>{{ overview.activeSubjects }}</strong>
            <p>matières actives</p>
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
      </template>
    </section>

    <AdminUsersPanel v-else-if="activeTab === 'users'" />
    <AdminContentPanel v-else />
  </div>
</template>
