<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";

import { api, ApiError } from "@/services/api";
import type {
  AdminCatalog,
  AdminDailyChallenge,
  AdminDailyChallengeInput,
  AdminDailyQuestion,
  DailyChallengeEffectiveStatus,
  QuestionKind,
} from "@/types/domain";

const challenges = ref<AdminDailyChallenge[]>([]);
const questionLibrary = ref<AdminDailyQuestion[]>([]);
const catalog = ref<AdminCatalog>({ schoolLevels: [], subjects: [] });
const editingId = ref<string | null>(null);
const selectedQuestionIds = ref<string[]>([]);
const showForm = ref(false);
const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

function todayInParis(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Europe/Paris",
      year: "numeric",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const form = reactive({
  publicationDate: todayInParis(),
  title: "Marelle du jour",
  status: "draft" as "draft" | "published",
});

const filters = reactive({
  search: "",
  subjectId: "",
  schoolLevelId: "",
  kind: "" as "" | QuestionKind,
  difficulty: "",
});

const statusLabels: Record<DailyChallengeEffectiveStatus, string> = {
  draft: "Brouillon",
  scheduled: "Programmée",
  active: "Active",
  finished: "Terminée",
};

const kindLabels: Record<QuestionKind, string> = {
  multiple_choice: "QCM",
  true_false: "Vrai / faux",
  short_answer: "Réponse libre",
  numeric: "Réponse numérique",
  fill_in_blank: "Texte à trous",
  ordering: "Mise en ordre",
  matching: "Association",
};

const filteredQuestions = computed(() => {
  const search = filters.search.trim().toLocaleLowerCase("fr-FR");
  return questionLibrary.value.filter((question) => {
    if (filters.subjectId && question.subject.id !== filters.subjectId) return false;
    if (filters.schoolLevelId && question.schoolLevel.id !== filters.schoolLevelId) return false;
    if (filters.kind && question.kind !== filters.kind) return false;
    if (filters.difficulty && question.difficulty !== Number(filters.difficulty)) return false;
    return !search || question.prompt.toLocaleLowerCase("fr-FR").includes(search);
  });
});

const selectedQuestions = computed(() =>
  selectedQuestionIds.value
    .map((id) => questionLibrary.value.find((question) => question.id === id))
    .filter((question): question is AdminDailyQuestion => Boolean(question)),
);

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? error.message : "Une erreur inattendue est survenue.";
}

function clearMessages(): void {
  errorMessage.value = "";
  successMessage.value = "";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

async function loadWorkspace(): Promise<void> {
  isLoading.value = true;
  clearMessages();
  try {
    const [challengeResponse, libraryResponse, catalogResponse] = await Promise.all([
      api.admin.dailyChallenges(),
      api.admin.dailyQuestionLibrary(),
      api.admin.catalog(),
    ]);
    challenges.value = challengeResponse.challenges;
    questionLibrary.value = libraryResponse.questions;
    catalog.value = catalogResponse;
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isLoading.value = false;
  }
}

function newChallenge(): void {
  clearMessages();
  editingId.value = null;
  form.publicationDate = todayInParis();
  form.title = "Marelle du jour";
  form.status = "draft";
  selectedQuestionIds.value = [];
  showForm.value = true;
}

function editChallenge(challenge: AdminDailyChallenge): void {
  clearMessages();
  editingId.value = challenge.id;
  form.publicationDate = challenge.date;
  form.title = challenge.title;
  form.status = challenge.status;
  selectedQuestionIds.value = [...challenge.questions]
    .sort((left, right) => left.position - right.position)
    .map((question) => question.id);
  showForm.value = true;
}

function toggleQuestion(questionId: string): void {
  const index = selectedQuestionIds.value.indexOf(questionId);
  if (index >= 0) {
    selectedQuestionIds.value.splice(index, 1);
  } else if (selectedQuestionIds.value.length < 5) {
    selectedQuestionIds.value.push(questionId);
  }
}

function moveQuestion(index: number, direction: -1 | 1): void {
  const target = index + direction;
  if (target < 0 || target >= selectedQuestionIds.value.length) return;
  const reordered = [...selectedQuestionIds.value];
  [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
  selectedQuestionIds.value = reordered;
}

function inputFromForm(status = form.status): AdminDailyChallengeInput {
  return {
    publicationDate: form.publicationDate,
    title: form.title,
    status,
    questionIds: [...selectedQuestionIds.value],
  };
}

async function saveChallenge(): Promise<void> {
  if (selectedQuestionIds.value.length < 3 || selectedQuestionIds.value.length > 5) {
    errorMessage.value = "Sélectionne entre 3 et 5 questions.";
    return;
  }
  isSaving.value = true;
  clearMessages();
  try {
    const response = editingId.value
      ? await api.admin.updateDailyChallenge(editingId.value, inputFromForm())
      : await api.admin.createDailyChallenge(inputFromForm());
    showForm.value = false;
    await loadWorkspace();
    successMessage.value = `La Marelle du ${formatDate(response.challenge.date)} a été enregistrée.`;
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isSaving.value = false;
  }
}

async function togglePublication(challenge: AdminDailyChallenge): Promise<void> {
  clearMessages();
  try {
    const status = challenge.status === "published" ? "draft" : "published";
    await api.admin.updateDailyChallenge(challenge.id, {
      publicationDate: challenge.date,
      title: challenge.title,
      status,
      questionIds: [...challenge.questions]
        .sort((left, right) => left.position - right.position)
        .map((question) => question.id),
    });
    await loadWorkspace();
    successMessage.value = status === "published" ? "La Marelle est publiée." : "La Marelle est dépubliée.";
  } catch (error) {
    errorMessage.value = messageFrom(error);
  }
}

async function deleteChallenge(challenge: AdminDailyChallenge): Promise<void> {
  if (!window.confirm(`Supprimer la Marelle du ${formatDate(challenge.date)} ?`)) return;
  clearMessages();
  try {
    await api.admin.deleteDailyChallenge(challenge.id);
    await loadWorkspace();
    successMessage.value = "La Marelle a été supprimée.";
  } catch (error) {
    errorMessage.value = messageFrom(error);
  }
}

onMounted(loadWorkspace);
</script>

<template>
  <section class="admin-workspace" aria-labelledby="daily-challenges-title">
    <div class="admin-section-heading">
      <div>
        <p class="eyebrow">Défi commun</p>
        <h2 id="daily-challenges-title">Marelles du jour</h2>
        <p>Programme de 3 à 5 questions identiques pour tous les élèves.</p>
      </div>
      <button class="compact-button compact-button--primary" type="button" @click="newChallenge">
        + Nouvelle Marelle
      </button>
    </div>

    <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage" class="admin-success" aria-live="polite">{{ successMessage }}</p>
    <p v-if="isLoading" class="notice" aria-live="polite">Chargement des Marelles…</p>

    <p v-else-if="challenges.length === 0" class="admin-empty">
      Aucune Marelle programmée. Crée la première édition quotidienne.
    </p>

    <div v-else class="admin-daily-list">
      <article v-for="challenge in challenges" :key="challenge.id" class="admin-daily-card">
        <div class="admin-daily-card__heading">
          <div>
            <span :class="`daily-status daily-status--${challenge.effectiveStatus}`">
              {{ statusLabels[challenge.effectiveStatus] }}
            </span>
            <h3>{{ formatDate(challenge.date) }}</h3>
            <p>{{ challenge.title }}</p>
          </div>
          <dl>
            <div>
              <dt>Questions</dt>
              <dd>{{ challenge.questionCount }}</dd>
            </div>
            <div>
              <dt>Participants</dt>
              <dd>{{ challenge.participantCount }}</dd>
            </div>
          </dl>
        </div>

        <ol class="admin-daily-question-preview">
          <li v-for="question in challenge.questions" :key="question.id">
            <span>{{ question.position }}</span>
            <p>{{ question.prompt }}</p>
            <small>{{ question.subject.icon }} {{ question.subject.name }}</small>
          </li>
        </ol>

        <div class="admin-daily-actions">
          <button
            class="compact-button"
            type="button"
            :disabled="challenge.participantCount > 0"
            @click="editChallenge(challenge)"
          >
            Modifier
          </button>
          <button
            class="compact-button"
            type="button"
            :disabled="challenge.participantCount > 0"
            @click="togglePublication(challenge)"
          >
            {{ challenge.status === "published" ? "Dépublier" : "Publier" }}
          </button>
          <button
            class="text-button text-button--danger"
            type="button"
            :disabled="challenge.participantCount > 0"
            @click="deleteChallenge(challenge)"
          >
            Supprimer
          </button>
        </div>
      </article>
    </div>

    <div v-if="showForm" class="admin-editor-overlay" @click.self="showForm = false">
      <form class="admin-editor admin-editor--wide daily-editor" @submit.prevent="saveChallenge">
        <div class="admin-editor-heading">
          <div>
            <p class="eyebrow">Marelle du jour</p>
            <h2>{{ editingId ? "Modifier l’édition" : "Nouvelle édition" }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="Fermer" @click="showForm = false">×</button>
        </div>

        <div class="admin-form-grid admin-form-grid--three">
          <label class="form-field">
            <span>Date de publication</span>
            <input v-model="form.publicationDate" type="date" required />
          </label>
          <label class="form-field daily-editor__title">
            <span>Titre</span>
            <input v-model="form.title" required minlength="3" maxlength="120" />
          </label>
          <label class="form-field">
            <span>Statut</span>
            <select v-model="form.status">
              <option value="draft">Brouillon</option>
              <option value="published">Publié</option>
            </select>
          </label>
        </div>

        <section class="daily-selection" aria-labelledby="selected-questions-title">
          <div class="admin-list-title">
            <h3 id="selected-questions-title">Ordre des questions</h3>
            <span>{{ selectedQuestionIds.length }}/5</span>
          </div>
          <p v-if="selectedQuestions.length === 0" class="admin-empty">
            Sélectionne au moins trois questions dans la bibliothèque.
          </p>
          <ol v-else class="daily-selected-questions">
            <li v-for="(question, index) in selectedQuestions" :key="question.id">
              <span class="daily-position">{{ index + 1 }}</span>
              <p>{{ question.prompt }}</p>
              <div>
                <button
                  class="icon-button icon-button--small"
                  type="button"
                  :disabled="index === 0"
                  :aria-label="`Monter la question ${index + 1}`"
                  @click="moveQuestion(index, -1)"
                >↑</button>
                <button
                  class="icon-button icon-button--small"
                  type="button"
                  :disabled="index === selectedQuestions.length - 1"
                  :aria-label="`Descendre la question ${index + 1}`"
                  @click="moveQuestion(index, 1)"
                >↓</button>
                <button
                  class="icon-button icon-button--small"
                  type="button"
                  :aria-label="`Retirer la question ${index + 1}`"
                  @click="toggleQuestion(question.id)"
                >×</button>
              </div>
            </li>
          </ol>
        </section>

        <section class="daily-library" aria-labelledby="question-library-title">
          <div class="admin-list-title">
            <h3 id="question-library-title">Bibliothèque de questions publiées</h3>
            <span>{{ filteredQuestions.length }}</span>
          </div>
          <div class="daily-library-filters">
            <label class="form-field daily-library-search">
              <span>Rechercher</span>
              <input v-model="filters.search" type="search" placeholder="Texte de la question…" />
            </label>
            <label class="form-field">
              <span>Matière</span>
              <select v-model="filters.subjectId">
                <option value="">Toutes</option>
                <option v-for="subject in catalog.subjects" :key="subject.id" :value="subject.id">
                  {{ subject.icon }} {{ subject.name }}
                </option>
              </select>
            </label>
            <label class="form-field">
              <span>Niveau</span>
              <select v-model="filters.schoolLevelId">
                <option value="">Tous</option>
                <option v-for="level in catalog.schoolLevels" :key="level.id" :value="level.id">
                  {{ level.label }}
                </option>
              </select>
            </label>
            <label class="form-field">
              <span>Type</span>
              <select v-model="filters.kind">
                <option value="">Tous</option>
                <option value="multiple_choice">QCM</option>
                <option value="true_false">Vrai / faux</option>
                <option value="short_answer">Réponse libre</option>
                <option value="numeric">Réponse numérique</option>
                <option value="fill_in_blank">Texte à trous</option>
                <option value="ordering">Mise en ordre</option>
                <option value="matching">Association</option>
              </select>
            </label>
            <label class="form-field">
              <span>Difficulté</span>
              <select v-model="filters.difficulty">
                <option value="">Toutes</option>
                <option v-for="value in 5" :key="value" :value="String(value)">{{ value }}/5</option>
              </select>
            </label>
          </div>

          <p v-if="filteredQuestions.length === 0" class="admin-empty">
            Aucune question ne correspond à ces filtres.
          </p>
          <div v-else class="daily-library-list">
            <label
              v-for="question in filteredQuestions"
              :key="question.id"
              class="daily-library-question"
              :class="{ 'daily-library-question--selected': selectedQuestionIds.includes(question.id) }"
            >
              <input
                type="checkbox"
                :checked="selectedQuestionIds.includes(question.id)"
                :disabled="selectedQuestionIds.length >= 5 && !selectedQuestionIds.includes(question.id)"
                @change="toggleQuestion(question.id)"
              />
              <span>
                <strong>{{ question.prompt }}</strong>
                <small>
                  {{ question.subject.icon }} {{ question.subject.name }} ·
                  {{ question.schoolLevel.label }} · {{ kindLabels[question.kind] }} ·
                  difficulté {{ question.difficulty }}/5
                </small>
              </span>
            </label>
          </div>
        </section>

        <p class="admin-help">Une Marelle doit contenir 3 à 5 questions publiées et sans doublon.</p>
        <div class="admin-form-actions">
          <button class="secondary-button" type="button" @click="showForm = false">Annuler</button>
          <button
            class="primary-button admin-primary-button"
            type="submit"
            :disabled="isSaving || selectedQuestionIds.length < 3"
          >
            {{ isSaving ? "Enregistrement…" : "Enregistrer la Marelle" }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
