<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import HopscotchProgress from "@/components/HopscotchProgress.vue";
import QuestionExercise from "@/components/QuestionExercise.vue";
import { api, ApiError } from "@/services/api";
import type {
  DailyChallenge,
  DailyChallengeAnswerInput,
  DailyChallengeAnswerResponse,
  DailyChallengeQuestion,
} from "@/types/domain";

const route = useRoute();
const challenge = ref<DailyChallenge | null>(null);
const answers = ref<Record<string, boolean>>({});
const currentIndex = ref(0);
const feedback = ref<DailyChallengeAnswerResponse["feedback"] | null>(null);
const isLoading = ref(true);
const isStarting = ref(false);
const isAnswering = ref(false);
const isFinishing = ref(false);
const errorMessage = ref("");
let questionStartedAt = performance.now();

const currentQuestion = computed<DailyChallengeQuestion | null>(() =>
  challenge.value?.questions[currentIndex.value] ?? null,
);
const isCompleted = computed(() => challenge.value?.participation.status === "completed");

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? error.message : "Une erreur inattendue est survenue.";
}

function initializeProgress(value: DailyChallenge): void {
  answers.value = Object.fromEntries(
    value.participation.answers.map((answer) => [answer.questionId, answer.isCorrect]),
  );
  const unansweredIndex = value.questions.findIndex(
    (question) => !Object.prototype.hasOwnProperty.call(answers.value, question.id),
  );
  currentIndex.value = unansweredIndex >= 0 ? unansweredIndex : Math.max(0, value.questions.length - 1);
  feedback.value = null;
  questionStartedAt = performance.now();
}

async function loadChallenge(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    challenge.value = (await api.dailyChallenge.current()).challenge;
    if (challenge.value) initializeProgress(challenge.value);
    if (
      challenge.value?.participation.status === "available" &&
      route.query.start === "1"
    ) {
      await startChallenge();
    }
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isLoading.value = false;
  }
}

async function startChallenge(): Promise<void> {
  isStarting.value = true;
  errorMessage.value = "";
  try {
    challenge.value = (await api.dailyChallenge.start()).challenge;
    if (!challenge.value) throw new Error("La Marelle publiée est introuvable.");
    initializeProgress(challenge.value);
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isStarting.value = false;
  }
}

async function submitAnswer(
  answer: Omit<DailyChallengeAnswerInput, "attemptId" | "questionId" | "responseTimeMs">,
): Promise<void> {
  if (!challenge.value?.participation.attemptId || !currentQuestion.value) return;
  isAnswering.value = true;
  errorMessage.value = "";
  try {
    const response = await api.dailyChallenge.answer({
      attemptId: challenge.value.participation.attemptId,
      questionId: currentQuestion.value.id,
      ...answer,
      responseTimeMs: Math.max(0, Math.round(performance.now() - questionStartedAt)),
    });
    feedback.value = response.feedback;
    answers.value = {
      ...answers.value,
      [currentQuestion.value.id]: response.feedback.isCorrect,
    };
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isAnswering.value = false;
  }
}

async function finishChallenge(): Promise<void> {
  const attemptId = challenge.value?.participation.attemptId;
  if (!attemptId) return;
  isFinishing.value = true;
  errorMessage.value = "";
  try {
    challenge.value = (await api.dailyChallenge.finish(attemptId)).challenge;
    if (challenge.value) initializeProgress(challenge.value);
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isFinishing.value = false;
  }
}

async function continueChallenge(): Promise<void> {
  if (!challenge.value || !currentQuestion.value) return;
  const nextIndex = challenge.value.questions.findIndex(
    (question, index) =>
      index > currentIndex.value &&
      !Object.prototype.hasOwnProperty.call(answers.value, question.id),
  );
  if (nextIndex < 0) {
    await finishChallenge();
    return;
  }
  currentIndex.value = nextIndex;
  feedback.value = null;
  questionStartedAt = performance.now();
}

function durationLabel(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes} min ${remainingSeconds.toString().padStart(2, "0")}` : `${remainingSeconds} s`;
}

onMounted(loadChallenge);
</script>

<template>
  <div class="page daily-challenge-page">
    <header class="daily-play-header">
      <RouterLink to="/" aria-label="Retour à l’accueil">←</RouterLink>
      <div>
        <p class="eyebrow">Défi commun</p>
        <strong>La Marelle du jour</strong>
      </div>
      <span aria-hidden="true">▦</span>
    </header>

    <div v-if="isLoading" class="daily-play-state" aria-live="polite">
      <div class="skeleton skeleton--hero"></div>
      <p>On trace les cases…</p>
    </div>

    <div v-else-if="errorMessage && !challenge" class="error-state">
      <span class="error-state__icon" aria-hidden="true">🛠️</span>
      <h1>Petit contretemps</h1>
      <p>{{ errorMessage }}</p>
      <button class="primary-button" type="button" @click="loadChallenge">Réessayer</button>
    </div>

    <section v-else-if="!challenge" class="daily-play-state daily-play-state--empty">
      <span aria-hidden="true">☀️</span>
      <h1>Pas encore de Marelle aujourd’hui</h1>
      <p>Reviens un peu plus tard pour découvrir le défi commun.</p>
      <RouterLink class="secondary-button" to="/">Retour à l’accueil</RouterLink>
    </section>

    <section v-else-if="isCompleted" class="daily-result" aria-labelledby="daily-result-title">
      <p class="eyebrow">Parcours validé</p>
      <h1 id="daily-result-title">Marelle terminée</h1>
      <strong class="daily-result__score">
        {{ challenge.participation.score }} <small>/ {{ challenge.participation.totalQuestions }}</small>
      </strong>
      <div class="daily-result__answers" aria-label="Résultat de chaque question">
        <span
          v-for="question in challenge.questions"
          :key="question.id"
          :class="answers[question.id] ? 'daily-result__answer--correct' : 'daily-result__answer--wrong'"
        >{{ answers[question.id] ? "✓" : "×" }}</span>
      </div>
      <dl class="daily-result__details">
        <div>
          <dt>Temps</dt>
          <dd>{{ durationLabel(challenge.participation.durationSeconds) }}</dd>
        </div>
        <div>
          <dt>Série</dt>
          <dd>🔥 {{ challenge.participation.currentStreak ?? 0 }} jour{{ (challenge.participation.currentStreak ?? 0) > 1 ? "s" : "" }}</dd>
        </div>
      </dl>
      <RouterLink class="primary-button" to="/">Continuer</RouterLink>
    </section>

    <section v-else-if="challenge.participation.status === 'available'" class="daily-intro">
      <div class="daily-intro__mark" aria-hidden="true">▦</div>
      <p class="eyebrow">{{ challenge.date }}</p>
      <h1>{{ challenge.title }}</h1>
      <p>
        {{ challenge.questionCount }} questions partagées par tous les joueurs aujourd’hui.
        Une fois terminée, cette Marelle ne pourra pas être rejouée.
      </p>
      <button class="primary-button" type="button" :disabled="isStarting" @click="startChallenge">
        {{ isStarting ? "Préparation…" : "Commencer la Marelle" }}
      </button>
    </section>

    <template v-else-if="currentQuestion">
      <HopscotchProgress
        :answers="answers"
        :current-index="currentIndex"
        :questions="challenge.questions"
      />

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

      <QuestionExercise
        v-if="!feedback"
        :question="currentQuestion"
        :disabled="isAnswering"
        @submit="submitAnswer"
      />

      <section
        v-else
        class="answer-feedback"
        :class="feedback.isCorrect ? 'answer-feedback--correct' : 'answer-feedback--wrong'"
        aria-live="polite"
      >
        <span class="answer-feedback__icon" aria-hidden="true">{{ feedback.isCorrect ? "✓" : "×" }}</span>
        <div>
          <h2>{{ feedback.isCorrect ? "Bien joué !" : "Pas cette fois." }}</h2>
          <p v-if="feedback.isCorrect">Bonne réponse. Tu avances d’une case.</p>
          <template v-else>
            <p>La bonne réponse était : <strong>{{ feedback.correctAnswer }}</strong></p>
            <p v-if="feedback.explanation">{{ feedback.explanation }}</p>
          </template>
        </div>
        <button class="primary-button" type="button" :disabled="isFinishing" @click="continueChallenge">
          {{ isFinishing ? "Calcul du résultat…" : "Continuer" }}
        </button>
      </section>
    </template>
  </div>
</template>
