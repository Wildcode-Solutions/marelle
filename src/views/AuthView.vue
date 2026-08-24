<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { ApiError } from "@/services/api";
import { auth } from "@/services/auth";

const route = useRoute();
const router = useRouter();
const isRegister = computed(() => route.name === "register");
const displayName = ref("");
const email = ref("");
const password = ref("");
const passwordConfirmation = ref("");
const errorMessage = ref("");
const isSubmitting = ref(false);

watch(isRegister, () => {
  errorMessage.value = "";
  password.value = "";
  passwordConfirmation.value = "";
});

function destinationAfterLogin(): string {
  const redirect = route.query.redirect;
  return typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//")
    ? redirect
    : "/";
}

async function submit(): Promise<void> {
  errorMessage.value = "";

  if (isRegister.value && password.value !== passwordConfirmation.value) {
    errorMessage.value = "Les deux mots de passe ne correspondent pas.";
    return;
  }

  isSubmitting.value = true;
  try {
    if (isRegister.value) {
      await auth.register({
        displayName: displayName.value,
        email: email.value,
        password: password.value,
      });
    } else {
      await auth.login({ email: email.value, password: password.value });
    }

    await router.replace(destinationAfterLogin());
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError
        ? error.message
        : "Impossible de contacter Marelle pour le moment.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <section class="auth-card" aria-labelledby="auth-title">
      <div class="auth-brand" aria-label="Marelle">
        <span class="brand-mark" aria-hidden="true">M</span>
        <span class="brand-copy">
          <span class="brand-name">marelle</span>
          <small>mon cahier de révisions</small>
        </span>
      </div>

      <div class="auth-heading">
        <p class="eyebrow">Première page du cahier</p>
        <h1 id="auth-title">{{ isRegister ? "Crée ton compte" : "Heureux de te revoir !" }}</h1>
        <p>
          {{
            isRegister
              ? "Quelques informations et tu pourras commencer à progresser."
              : "Connecte-toi pour retrouver ta progression."
          }}
        </p>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label v-if="isRegister" class="form-field">
          <span>Prénom ou pseudo</span>
          <input
            v-model="displayName"
            name="displayName"
            autocomplete="nickname"
            minlength="2"
            maxlength="40"
            placeholder="Camille"
            required
          />
        </label>

        <label class="form-field">
          <span>Adresse e-mail</span>
          <input
            v-model="email"
            name="email"
            type="email"
            autocomplete="email"
            maxlength="254"
            placeholder="toi@exemple.fr"
            required
          />
        </label>

        <label class="form-field">
          <span>Mot de passe</span>
          <input
            v-model="password"
            name="password"
            type="password"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
            minlength="8"
            maxlength="128"
            placeholder="8 caractères minimum"
            required
          />
        </label>

        <label v-if="isRegister" class="form-field">
          <span>Confirme le mot de passe</span>
          <input
            v-model="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            autocomplete="new-password"
            minlength="8"
            maxlength="128"
            placeholder="Saisis-le une seconde fois"
            required
          />
        </label>

        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

        <button class="primary-button auth-submit" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? "Un instant…" : isRegister ? "Créer mon compte" : "Me connecter" }}
        </button>
      </form>

      <p class="auth-switch">
        {{ isRegister ? "Tu as déjà un compte ?" : "Tu découvres Marelle ?" }}
        <RouterLink :to="isRegister ? '/connexion' : '/inscription'">
          {{ isRegister ? "Se connecter" : "Créer un compte" }}
        </RouterLink>
      </p>
    </section>
  </div>
</template>
