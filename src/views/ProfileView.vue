<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";

import ViewHeader from "@/components/ViewHeader.vue";
import { api, ApiError } from "@/services/api";
import { auth } from "@/services/auth";
import type { ProfileResponse, SchoolLevel } from "@/types/domain";

const router = useRouter();

const avatarOptions = ["🧑‍🎓", "🧑‍🚀", "🦊", "🐼", "🐸", "🦁", "🐙", "🦄"];
const colorOptions = [
  { label: "Violet", value: "#6C5CE7" },
  { label: "Bleu", value: "#315F9E" },
  { label: "Rouge", value: "#D95652" },
  { label: "Orange", value: "#F59E0B" },
  { label: "Vert", value: "#10B981" },
  { label: "Rose", value: "#F06292" },
];

const levels = ref<SchoolLevel[]>([]);
const profile = ref<ProfileResponse | null>(null);
const isLoadingProfile = ref(true);
const loadError = ref("");

const identityForm = reactive({
  displayName: "",
  avatarEmoji: "🧑‍🎓",
  profileColor: "#6C5CE7",
  schoolLevelId: "",
});
const isSavingIdentity = ref(false);
const identityMessage = ref("");
const identityError = ref("");

const email = ref("");
const emailPassword = ref("");
const isSavingEmail = ref(false);
const emailMessage = ref("");
const emailError = ref("");

const currentPassword = ref("");
const newPassword = ref("");
const newPasswordConfirmation = ref("");
const isSavingPassword = ref(false);
const passwordMessage = ref("");
const passwordError = ref("");

const deletionPassword = ref("");
const deletionConfirmation = ref("");
const isDeletingAccount = ref(false);
const deletionError = ref("");

const isLoggingOut = ref(false);
const logoutError = ref("");

const identityHasChanged = computed(() => {
  const user = auth.user.value;
  if (!user) return false;
  return (
    identityForm.displayName.trim() !== user.displayName ||
    identityForm.avatarEmoji !== user.avatarEmoji ||
    identityForm.profileColor !== user.profileColor ||
    identityForm.schoolLevelId !== user.schoolLevel.id
  );
});

const unlockedBadgeCount = computed(
  () => profile.value?.badges.filter((badge) => badge.unlocked).length ?? 0,
);

const canDeleteAccount = computed(
  () => deletionConfirmation.value === "SUPPRIMER" && deletionPassword.value.length >= 8,
);

watch(
  () => auth.user.value,
  (user) => {
    if (!user) return;
    identityForm.displayName = user.displayName;
    identityForm.avatarEmoji = user.avatarEmoji;
    identityForm.profileColor = user.profileColor;
    identityForm.schoolLevelId = user.schoolLevel.id;
    email.value = user.email;
  },
  { immediate: true },
);

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

async function loadProfile(): Promise<void> {
  loadError.value = "";
  isLoadingProfile.value = true;
  try {
    const [levelsResponse, profileResponse] = await Promise.all([
      api.schoolLevels(),
      api.profile(),
    ]);
    levels.value = levelsResponse.schoolLevels;
    profile.value = profileResponse;
  } catch (error) {
    loadError.value = messageFor(
      error,
      "Impossible de charger les informations du profil pour le moment.",
    );
  } finally {
    isLoadingProfile.value = false;
  }
}

async function saveIdentity(): Promise<void> {
  if (!identityHasChanged.value) return;
  identityMessage.value = "";
  identityError.value = "";
  isSavingIdentity.value = true;
  try {
    await auth.updateProfile({
      displayName: identityForm.displayName,
      avatarEmoji: identityForm.avatarEmoji,
      profileColor: identityForm.profileColor,
      schoolLevelId: identityForm.schoolLevelId,
    });
    identityMessage.value = "Ton profil a bien été personnalisé.";
  } catch (error) {
    identityError.value = messageFor(error, "La mise à jour du profil a échoué.");
  } finally {
    isSavingIdentity.value = false;
  }
}

async function saveEmail(): Promise<void> {
  emailMessage.value = "";
  emailError.value = "";
  isSavingEmail.value = true;
  try {
    await auth.updateEmail({ email: email.value, currentPassword: emailPassword.value });
    emailPassword.value = "";
    emailMessage.value = "Ton adresse e-mail a bien été mise à jour.";
  } catch (error) {
    emailError.value = messageFor(error, "La mise à jour de l’adresse e-mail a échoué.");
  } finally {
    isSavingEmail.value = false;
  }
}

async function savePassword(): Promise<void> {
  passwordMessage.value = "";
  passwordError.value = "";
  if (newPassword.value !== newPasswordConfirmation.value) {
    passwordError.value = "Les deux nouveaux mots de passe ne correspondent pas.";
    return;
  }

  isSavingPassword.value = true;
  try {
    await auth.updatePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });
    currentPassword.value = "";
    newPassword.value = "";
    newPasswordConfirmation.value = "";
    passwordMessage.value = "Ton mot de passe a bien été modifié.";
  } catch (error) {
    passwordError.value = messageFor(error, "La modification du mot de passe a échoué.");
  } finally {
    isSavingPassword.value = false;
  }
}

async function deleteAccount(): Promise<void> {
  if (!canDeleteAccount.value) return;
  const confirmed = window.confirm(
    "Cette action supprimera définitivement ton compte et toute ta progression. Continuer ?",
  );
  if (!confirmed) return;

  deletionError.value = "";
  isDeletingAccount.value = true;
  try {
    await auth.deleteAccount({ currentPassword: deletionPassword.value });
    await router.replace({ name: "login" });
  } catch (error) {
    deletionError.value = messageFor(error, "La suppression du compte a échoué.");
    isDeletingAccount.value = false;
  }
}

async function logout(): Promise<void> {
  logoutError.value = "";
  isLoggingOut.value = true;
  try {
    await auth.logout();
    await router.replace({ name: "login" });
  } catch (error) {
    logoutError.value = messageFor(error, "La déconnexion a échoué.");
  } finally {
    isLoggingOut.value = false;
  }
}

onMounted(loadProfile);
</script>

<template>
  <div class="page inner-page profile-page">
    <ViewHeader
      eyebrow="Sur la première page"
      title="Mon profil"
      description="Personnalise ton cahier, retrouve tes réussites et gère ton compte."
    />

    <section
      v-if="auth.user.value"
      class="profile-card profile-hero"
      :style="{ '--profile-color': auth.user.value.profileColor }"
      aria-labelledby="profile-identity-title"
    >
      <div class="profile-identity">
        <span class="profile-avatar" aria-hidden="true">{{ auth.user.value.avatarEmoji }}</span>
        <div>
          <p class="eyebrow">Mon cahier</p>
          <h2 id="profile-identity-title">{{ auth.user.value.displayName }}</h2>
          <p>{{ auth.user.value.email }}</p>
        </div>
      </div>
      <div class="profile-hero__labels">
        <span>{{ auth.user.value.schoolLevel.label }}</span>
        <span>{{ auth.user.value.role === "admin" ? "Administrateur" : "Élève" }}</span>
      </div>
    </section>

    <p v-if="loadError" class="notice notice--error" role="alert">{{ loadError }}</p>

    <section class="profile-section" aria-labelledby="personalization-title">
      <div class="profile-section__heading">
        <div>
          <p class="eyebrow">À mon image</p>
          <h2 id="personalization-title">Personnalisation</h2>
        </div>
        <span aria-hidden="true">✏️</span>
      </div>

      <form class="profile-form" @submit.prevent="saveIdentity">
        <label class="form-field">
          <span>Prénom ou pseudo</span>
          <input
            v-model="identityForm.displayName"
            name="displayName"
            autocomplete="nickname"
            minlength="2"
            maxlength="40"
            required
          />
        </label>

        <fieldset class="profile-choice-field">
          <legend>Choisis ton avatar</legend>
          <div class="avatar-picker">
            <button
              v-for="avatar in avatarOptions"
              :key="avatar"
              type="button"
              :class="{ 'avatar-picker__option--selected': identityForm.avatarEmoji === avatar }"
              :aria-label="`Choisir l’avatar ${avatar}`"
              :aria-pressed="identityForm.avatarEmoji === avatar"
              @click="identityForm.avatarEmoji = avatar"
            >{{ avatar }}</button>
          </div>
        </fieldset>

        <fieldset class="profile-choice-field">
          <legend>Couleur du profil</legend>
          <div class="color-picker">
            <button
              v-for="color in colorOptions"
              :key="color.value"
              type="button"
              :style="{ '--swatch-color': color.value }"
              :class="{ 'color-picker__option--selected': identityForm.profileColor === color.value }"
              :aria-label="`Choisir la couleur ${color.label}`"
              :aria-pressed="identityForm.profileColor === color.value"
              @click="identityForm.profileColor = color.value"
            ><span class="sr-only">{{ color.label }}</span></button>
          </div>
        </fieldset>

        <label class="form-field">
          <span>Niveau scolaire</span>
          <select
            v-model="identityForm.schoolLevelId"
            name="schoolLevelId"
            :disabled="levels.length === 0"
            required
          >
            <option v-for="level in levels" :key="level.id" :value="level.id">
              {{ level.label }}
            </option>
          </select>
        </label>

        <p v-if="identityMessage" class="form-success" role="status">{{ identityMessage }}</p>
        <p v-if="identityError" class="form-error" role="alert">{{ identityError }}</p>

        <button
          class="primary-button"
          type="submit"
          :disabled="!identityHasChanged || isSavingIdentity"
        >
          {{ isSavingIdentity ? "Enregistrement…" : "Enregistrer mon profil" }}
        </button>
      </form>
    </section>

    <section class="profile-section" aria-labelledby="profile-stats-title">
      <div class="profile-section__heading">
        <div>
          <p class="eyebrow">Mon parcours</p>
          <h2 id="profile-stats-title">Mes progrès</h2>
        </div>
        <span aria-hidden="true">📈</span>
      </div>

      <p v-if="isLoadingProfile" class="notice" aria-live="polite">Chargement des progrès…</p>
      <div v-else-if="profile" class="profile-stats-grid">
        <article>
          <span aria-hidden="true">⭐</span>
          <strong>{{ profile.stats.xp }}</strong>
          <small>XP · niveau {{ profile.stats.level }}</small>
        </article>
        <article>
          <span aria-hidden="true">🔥</span>
          <strong>{{ profile.stats.currentStreak }}</strong>
          <small>jours de série</small>
        </article>
        <article>
          <span aria-hidden="true">🏆</span>
          <strong>{{ profile.stats.longestStreak }}</strong>
          <small>record de série</small>
        </article>
        <article>
          <span aria-hidden="true">🪜</span>
          <strong>{{ profile.stats.completedChallenges }}</strong>
          <small>Marelles terminées</small>
        </article>
        <article>
          <span aria-hidden="true">🎯</span>
          <strong>{{ profile.stats.bestScorePercentage }} %</strong>
          <small>meilleur score</small>
        </article>
      </div>
    </section>

    <section class="profile-section" aria-labelledby="profile-badges-title">
      <div class="profile-section__heading">
        <div>
          <p class="eyebrow">Ma collection</p>
          <h2 id="profile-badges-title">Mes badges</h2>
        </div>
        <span v-if="profile" class="profile-section__count">
          {{ unlockedBadgeCount }}/{{ profile.badges.length }}
        </span>
      </div>

      <p v-if="isLoadingProfile" class="notice" aria-live="polite">Chargement des badges…</p>
      <div v-else-if="profile" class="badge-grid">
        <article
          v-for="badge in profile.badges"
          :key="badge.id"
          class="badge-card"
          :class="{ 'badge-card--locked': !badge.unlocked }"
        >
          <span class="badge-card__icon" aria-hidden="true">{{ badge.unlocked ? badge.icon : "🔒" }}</span>
          <div>
            <strong>{{ badge.name }}</strong>
            <p>{{ badge.description }}</p>
            <small>{{ badge.unlocked ? "Débloqué" : "À débloquer" }}</small>
          </div>
        </article>
      </div>
    </section>

    <section class="profile-section" aria-labelledby="account-title">
      <div class="profile-section__heading">
        <div>
          <p class="eyebrow">Mes réglages</p>
          <h2 id="account-title">Gestion du compte</h2>
        </div>
        <span aria-hidden="true">🔐</span>
      </div>

      <div class="account-settings">
        <form class="account-setting-card" @submit.prevent="saveEmail">
          <h3>Adresse e-mail</h3>
          <p>Ton mot de passe actuel est demandé pour confirmer le changement.</p>
          <label class="form-field">
            <span>Nouvelle adresse e-mail</span>
            <input v-model="email" name="email" type="email" autocomplete="email" maxlength="254" required />
          </label>
          <label class="form-field">
            <span>Mot de passe actuel</span>
            <input
              v-model="emailPassword"
              name="currentPassword"
              type="password"
              autocomplete="current-password"
              minlength="8"
              maxlength="128"
              required
            />
          </label>
          <p v-if="emailMessage" class="form-success" role="status">{{ emailMessage }}</p>
          <p v-if="emailError" class="form-error" role="alert">{{ emailError }}</p>
          <button class="secondary-button" type="submit" :disabled="isSavingEmail">
            {{ isSavingEmail ? "Enregistrement…" : "Modifier mon e-mail" }}
          </button>
        </form>

        <form class="account-setting-card" @submit.prevent="savePassword">
          <h3>Mot de passe</h3>
          <p>Après la modification, les autres appareils seront déconnectés.</p>
          <label class="form-field">
            <span>Mot de passe actuel</span>
            <input
              v-model="currentPassword"
              name="currentPassword"
              type="password"
              autocomplete="current-password"
              minlength="8"
              maxlength="128"
              required
            />
          </label>
          <label class="form-field">
            <span>Nouveau mot de passe</span>
            <input
              v-model="newPassword"
              name="newPassword"
              type="password"
              autocomplete="new-password"
              minlength="8"
              maxlength="128"
              required
            />
          </label>
          <label class="form-field">
            <span>Confirme le nouveau mot de passe</span>
            <input
              v-model="newPasswordConfirmation"
              name="newPasswordConfirmation"
              type="password"
              autocomplete="new-password"
              minlength="8"
              maxlength="128"
              required
            />
          </label>
          <p v-if="passwordMessage" class="form-success" role="status">{{ passwordMessage }}</p>
          <p v-if="passwordError" class="form-error" role="alert">{{ passwordError }}</p>
          <button class="secondary-button" type="submit" :disabled="isSavingPassword">
            {{ isSavingPassword ? "Enregistrement…" : "Modifier mon mot de passe" }}
          </button>
        </form>
      </div>

      <div class="profile-session-actions">
        <p v-if="logoutError" class="form-error" role="alert">{{ logoutError }}</p>
        <button class="secondary-button" type="button" :disabled="isLoggingOut" @click="logout">
          {{ isLoggingOut ? "Déconnexion…" : "Se déconnecter" }}
        </button>
      </div>

      <details class="danger-zone">
        <summary>Supprimer mon compte</summary>
        <div class="danger-zone__content">
          <p>Cette action supprime définitivement ton profil, tes scores et tous tes badges.</p>
          <form class="profile-form" @submit.prevent="deleteAccount">
            <label class="form-field">
              <span>Écris SUPPRIMER pour confirmer</span>
              <input
                v-model="deletionConfirmation"
                name="deletionConfirmation"
                autocomplete="off"
                placeholder="SUPPRIMER"
                required
              />
            </label>
            <label class="form-field">
              <span>Mot de passe actuel</span>
              <input
                v-model="deletionPassword"
                name="deletionPassword"
                type="password"
                autocomplete="current-password"
                minlength="8"
                maxlength="128"
                required
              />
            </label>
            <p v-if="deletionError" class="form-error" role="alert">{{ deletionError }}</p>
            <button
              class="danger-button"
              type="submit"
              :disabled="!canDeleteAccount || isDeletingAccount"
            >
              {{ isDeletingAccount ? "Suppression…" : "Supprimer définitivement mon compte" }}
            </button>
          </form>
        </div>
      </details>
    </section>
  </div>
</template>
