<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import ViewHeader from "@/components/ViewHeader.vue";
import { api, ApiError } from "@/services/api";
import { auth } from "@/services/auth";
import type { SchoolLevel } from "@/types/domain";

const router = useRouter();
const isLoggingOut = ref(false);
const errorMessage = ref("");

const levels = ref<SchoolLevel[]>([]);
const selectedLevelId = ref(auth.user.value?.schoolLevel.id ?? "");
const levelMessage = ref("");
const isSavingLevel = ref(false);

const currentLevelId = computed(() => auth.user.value?.schoolLevel.id ?? "");
const levelHasChanged = computed(
  () => selectedLevelId.value !== "" && selectedLevelId.value !== currentLevelId.value,
);

watch(currentLevelId, (value) => {
  selectedLevelId.value = value;
});

onMounted(async () => {
  try {
    levels.value = (await api.schoolLevels()).schoolLevels;
  } catch (error) {
    levelMessage.value =
      error instanceof ApiError
        ? error.message
        : "Impossible de charger les niveaux scolaires.";
  }
});

async function saveLevel(): Promise<void> {
  if (!levelHasChanged.value) return;

  levelMessage.value = "";
  isSavingLevel.value = true;
  try {
    await auth.updateProfile({ schoolLevelId: selectedLevelId.value });
    levelMessage.value = "Ton niveau a bien été mis à jour.";
  } catch (error) {
    levelMessage.value =
      error instanceof ApiError
        ? error.message
        : "La mise à jour du niveau a échoué. Réessaie dans un instant.";
  } finally {
    isSavingLevel.value = false;
  }
}

async function logout(): Promise<void> {
  errorMessage.value = "";
  isLoggingOut.value = true;
  try {
    await auth.logout();
    await router.replace({ name: "login" });
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError
        ? error.message
        : "La déconnexion a échoué. Réessaie dans un instant.";
  } finally {
    isLoggingOut.value = false;
  }
}
</script>

<template>
  <div class="page inner-page">
    <ViewHeader
      eyebrow="Ton espace"
      title="Profil"
      description="Retrouve les informations liées à ton compte Marelle."
    />

    <section v-if="auth.user.value" class="profile-card">
      <div class="profile-identity">
        <span class="profile-avatar" aria-hidden="true">{{ auth.user.value.avatarEmoji }}</span>
        <div>
          <h2>{{ auth.user.value.displayName }}</h2>
          <p>{{ auth.user.value.email }}</p>
        </div>
      </div>

      <dl class="profile-details">
        <div>
          <dt>Type de compte</dt>
          <dd>{{ auth.user.value.role === "admin" ? "Administrateur" : "Élève" }}</dd>
        </div>
      </dl>

      <form class="profile-level" @submit.prevent="saveLevel">
        <label class="form-field">
          <span>Niveau scolaire</span>
          <select v-model="selectedLevelId" name="schoolLevelId" :disabled="levels.length === 0">
            <option v-for="level in levels" :key="level.id" :value="level.id">
              {{ level.label }}
            </option>
          </select>
        </label>

        <p v-if="levelMessage" class="form-hint" role="status">{{ levelMessage }}</p>

        <button
          class="primary-button"
          type="submit"
          :disabled="!levelHasChanged || isSavingLevel"
        >
          {{ isSavingLevel ? "Enregistrement…" : "Mettre à jour mon niveau" }}
        </button>
      </form>

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

      <button class="secondary-button" type="button" :disabled="isLoggingOut" @click="logout">
        {{ isLoggingOut ? "Déconnexion…" : "Se déconnecter" }}
      </button>
    </section>
  </div>
</template>
