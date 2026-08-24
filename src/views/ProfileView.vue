<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Capacitor } from "@capacitor/core";

import EmojiPicker from "@/components/EmojiPicker.vue";
import ViewHeader from "@/components/ViewHeader.vue";
import { api, ApiError } from "@/services/api";
import { auth } from "@/services/auth";
import type { ProfileResponse, SchoolLevel } from "@/types/domain";

const router = useRouter();

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
const avatarError = ref("");
const showWebEmojiPicker = ref(false);
const usesWebEmojiPicker = !Capacitor.isNativePlatform()
  && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const currentPassword = ref("");
const newPassword = ref("");
const newPasswordConfirmation = ref("");
const isSavingPassword = ref(false);
const passwordMessage = ref("");
const passwordError = ref("");

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

watch(
  () => auth.user.value,
  (user) => {
    if (!user) return;
    identityForm.displayName = user.displayName;
    identityForm.avatarEmoji = user.avatarEmoji;
    identityForm.profileColor = user.profileColor;
    identityForm.schoolLevelId = user.schoolLevel.id;
  },
  { immediate: true },
);

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const emojiSegmenter = new Intl.Segmenter("fr", { granularity: "grapheme" });
const emojiPattern = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u;

function selectAvatarInput(event: FocusEvent): void {
  (event.currentTarget as HTMLInputElement).select();
  if (usesWebEmojiPicker) showWebEmojiPicker.value = true;
}

function chooseAvatar(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  const emojis = Array.from(
    emojiSegmenter.segment(input.value),
    ({ segment }) => segment,
  ).filter((segment) => emojiPattern.test(segment));
  const avatar = emojis.at(-1);

  if (!avatar) {
    input.value = identityForm.avatarEmoji;
    avatarError.value = "Choisis un emoji depuis le clavier de ton appareil.";
    return;
  }

  identityForm.avatarEmoji = avatar;
  input.value = avatar;
  avatarError.value = "";
}

function chooseWebAvatar(emoji: string): void {
  identityForm.avatarEmoji = emoji;
  avatarError.value = "";
  showWebEmojiPicker.value = false;
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
            <span class="avatar-picker__preview" aria-hidden="true">
              {{ identityForm.avatarEmoji }}
            </span>
            <label class="avatar-picker__control" for="avatarEmoji">
              <span>{{ usesWebEmojiPicker ? "Clique ici pour choisir un emoji" : "Touche ici pour choisir un emoji" }}</span>
              <input
                id="avatarEmoji"
                name="avatarEmoji"
                type="text"
                inputmode="text"
                enterkeyhint="done"
                autocomplete="off"
                autocapitalize="off"
                :spellcheck="false"
                :value="identityForm.avatarEmoji"
                aria-describedby="avatar-help"
                @focus="selectAvatarInput"
                @input="chooseAvatar"
              />
              <small id="avatar-help">
                {{ usesWebEmojiPicker
                  ? "Le sélecteur complet s’ouvre automatiquement."
                  : "Ouvre le clavier emoji de ton téléphone pour accéder à tous tes emojis." }}
              </small>
            </label>
          </div>
          <button
            v-if="usesWebEmojiPicker"
            class="emoji-picker-toggle"
            type="button"
            aria-controls="web-emoji-picker"
            :aria-expanded="showWebEmojiPicker"
            @click="showWebEmojiPicker = !showWebEmojiPicker"
          >
            <span aria-hidden="true">😀</span>
            {{ showWebEmojiPicker ? "Fermer le choix des emojis" : "Afficher tous les emojis" }}
          </button>
          <div v-if="showWebEmojiPicker" id="web-emoji-picker" class="emoji-picker-panel">
            <EmojiPicker @select="chooseWebAvatar" />
          </div>
          <p v-if="avatarError" class="form-error avatar-picker__error" role="alert">
            {{ avatarError }}
          </p>
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
    </section>
  </div>
</template>
