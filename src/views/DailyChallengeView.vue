<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import CompletionCelebration from "@/components/CompletionCelebration.vue";
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
const isAdvancing = ref(false);
const isAutoContinuePending = ref(false);
const displayedScore = ref(0);
const showCompletionCelebration = ref(false);
const errorMessage = ref("");
let questionStartedAt = performance.now();
let celebrationTimer: number | undefined;
let scoreAnimationFrame: number | undefined;
let autoContinueTimer: number | undefined;

const AUTO_CONTINUE_DELAY = 3_000;

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
    if (challenge.value) {
      initializeProgress(challenge.value);
      displayedScore.value = challenge.value.participation.score ?? 0;
    }
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

function animateScore(target: number): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    displayedScore.value = target;
    return;
  }

  const duration = 1_000;
  const delay = 350;
  const startedAt = performance.now();
  const tick = (now: number): void => {
    const elapsed = Math.max(0, now - startedAt - delay);
    const progress = Math.min(1, elapsed / duration);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    displayedScore.value = Math.round(target * easedProgress);
    if (progress < 1) scoreAnimationFrame = window.requestAnimationFrame(tick);
  };

  scoreAnimationFrame = window.requestAnimationFrame(tick);
}

async function celebrateCompletion(value: DailyChallenge): Promise<void> {
  window.clearTimeout(celebrationTimer);
  if (scoreAnimationFrame !== undefined) window.cancelAnimationFrame(scoreAnimationFrame);
  displayedScore.value = 0;
  showCompletionCelebration.value = true;
  await nextTick();
  animateScore(value.participation.score ?? 0);
  celebrationTimer = window.setTimeout(() => {
    showCompletionCelebration.value = false;
  }, 2_600);
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

function cancelAutoContinue(): void {
  window.clearTimeout(autoContinueTimer);
  autoContinueTimer = undefined;
  isAutoContinuePending.value = false;
}

function scheduleAutoContinue(): void {
  cancelAutoContinue();
  isAutoContinuePending.value = true;
  autoContinueTimer = window.setTimeout(() => {
    void continueChallenge();
  }, AUTO_CONTINUE_DELAY);
}

function handleExerciseTransitionEntered(): void {
  if (feedback.value?.isCorrect) scheduleAutoContinue();
}

async function finishChallenge(): Promise<void> {
  const attemptId = challenge.value?.participation.attemptId;
  if (!attemptId) return;
  isFinishing.value = true;
  errorMessage.value = "";
  try {
    const completedChallenge = (await api.dailyChallenge.finish(attemptId)).challenge;
    challenge.value = completedChallenge;
    if (completedChallenge) {
      initializeProgress(completedChallenge);
      await celebrateCompletion(completedChallenge);
    }
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isFinishing.value = false;
  }
}

async function continueChallenge(): Promise<void> {
  cancelAutoContinue();
  if (isAdvancing.value || !challenge.value || !currentQuestion.value) return;
  isAdvancing.value = true;
  const nextIndex = challenge.value.questions.findIndex(
    (question, index) =>
      index > currentIndex.value &&
      !Object.prototype.hasOwnProperty.call(answers.value, question.id),
  );
  if (nextIndex < 0) {
    await finishChallenge();
    isAdvancing.value = false;
    return;
  }
  currentIndex.value = nextIndex;
  feedback.value = null;
  questionStartedAt = performance.now();
  await nextTick();
  isAdvancing.value = false;
}

function durationLabel(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes} min ${remainingSeconds.toString().padStart(2, "0")}` : `${remainingSeconds} s`;
}

onMounted(loadChallenge);
onBeforeUnmount(() => {
  cancelAutoContinue();
  window.clearTimeout(celebrationTimer);
  if (scoreAnimationFrame !== undefined) window.cancelAnimationFrame(scoreAnimationFrame);
});
</script>

<template>
  <div class="page daily-challenge-page">
    <CompletionCelebration v-if="showCompletionCelebration" />
    <p v-if="showCompletionCelebration" class="sr-only" role="status">
      Marelle validée. Bravo, parcours terminé !
    </p>

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

    <section
      v-else-if="isCompleted"
      class="daily-result"
      :class="{ 'daily-result--celebrating': showCompletionCelebration }"
      aria-labelledby="daily-result-title"
    >
      <div class="daily-result__seal" aria-hidden="true">
        <span>✓</span>
        <small>TRAVAIL VALIDÉ</small>
      </div>
      <p class="eyebrow">Parcours validé</p>
      <h1 id="daily-result-title">Bravo, tu as fini !</h1>
      <strong class="daily-result__score">
        {{ displayedScore }} <small>/ {{ challenge.participation.totalQuestions }}</small>
      </strong>
      <div class="daily-result__answers" aria-label="Résultat de chaque question">
        <span
          v-for="(question, index) in challenge.questions"
          :key="question.id"
          :class="answers[question.id] ? 'daily-result__answer--correct' : 'daily-result__answer--wrong'"
          :style="`--answer-index: ${index}`"
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

      <Transition name="exercise-swap" mode="out-in" @after-enter="handleExerciseTransitionEntered">
        <QuestionExercise
          v-if="!feedback"
          :key="currentQuestion.id"
          :question="currentQuestion"
          :disabled="isAnswering"
          @submit="submitAnswer"
        />

        <section
          v-else
          :key="`feedback-${currentQuestion.id}`"
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
          <button
            class="primary-button auto-continue-button"
            type="button"
            :disabled="isFinishing || isAdvancing"
            :aria-label="isAutoContinuePending ? 'Continuer, passage automatique dans 3 secondes' : 'Continuer'"
            @click="continueChallenge"
          >
            <span>{{ isFinishing ? "Calcul du résultat…" : "Continuer" }}</span>
            <span v-if="isAutoContinuePending" class="auto-continue-button__track" aria-hidden="true">
              <span class="auto-continue-button__fill"></span>
            </span>
          </button>
        </section>
      </Transition>
    </template>
  </div>
</template>
