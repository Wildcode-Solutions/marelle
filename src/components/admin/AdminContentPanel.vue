<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import { api, ApiError } from "@/services/api";
import type {
  AdminAnswerChoice,
  AdminCatalog,
  AdminQuestion,
  AdminQuestionInput,
  AdminTheme,
  AdminThemeInput,
  QuestionKind,
  QuestionStatus,
} from "@/types/domain";

const catalog = ref<AdminCatalog>({ schoolLevels: [], subjects: [] });
const themes = ref<AdminTheme[]>([]);
const questions = ref<AdminQuestion[]>([]);
const selectedTheme = ref<AdminTheme | null>(null);
const editingThemeId = ref<string | null>(null);
const editingQuestionId = ref<string | null>(null);
const showThemeForm = ref(false);
const showQuestionForm = ref(false);
const isLoading = ref(true);
const isLoadingQuestions = ref(false);
const isSaving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const themeForm = reactive<AdminThemeInput>({
  title: "",
  summary: "",
  subjectId: "",
  schoolLevelId: "",
  position: 0,
  isActive: true,
});

const questionForm = reactive<Omit<AdminQuestionInput, "choices">>({
  themeId: "",
  kind: "multiple_choice",
  prompt: "",
  explanation: "",
  expectedAnswer: "",
  difficulty: 1,
  xpReward: 10,
  status: "draft",
});
const choices = ref<AdminAnswerChoice[]>([]);

const kindLabels: Record<QuestionKind, string> = {
  multiple_choice: "QCM",
  true_false: "Vrai / faux",
  short_answer: "Réponse libre",
};

const statusLabels: Record<QuestionStatus, string> = {
  draft: "Brouillon",
  published: "Publiée",
  archived: "Archivée",
};

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? error.message : "Une erreur inattendue est survenue.";
}

function clearMessages(): void {
  errorMessage.value = "";
  successMessage.value = "";
}

async function loadWorkspace(): Promise<void> {
  isLoading.value = true;
  clearMessages();
  try {
    const [catalogResponse, themesResponse] = await Promise.all([
      api.admin.catalog(),
      api.admin.themes(),
    ]);
    catalog.value = catalogResponse;
    themes.value = themesResponse.themes;
    if (selectedTheme.value) {
      selectedTheme.value = themes.value.find((theme) => theme.id === selectedTheme.value?.id) ?? null;
    }
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isLoading.value = false;
  }
}

function newTheme(): void {
  clearMessages();
  editingThemeId.value = null;
  themeForm.title = "";
  themeForm.summary = "";
  themeForm.subjectId = catalog.value.subjects[0]?.id ?? "";
  themeForm.schoolLevelId = catalog.value.schoolLevels[0]?.id ?? "";
  themeForm.position = themes.value.length;
  themeForm.isActive = true;
  showThemeForm.value = true;
}

function editTheme(theme: AdminTheme): void {
  clearMessages();
  editingThemeId.value = theme.id;
  themeForm.title = theme.title;
  themeForm.summary = theme.summary;
  themeForm.subjectId = theme.subject.id;
  themeForm.schoolLevelId = theme.schoolLevel.id;
  themeForm.position = theme.position;
  themeForm.isActive = theme.isActive;
  showThemeForm.value = true;
}

async function saveTheme(): Promise<void> {
  isSaving.value = true;
  clearMessages();
  try {
    const input: AdminThemeInput = { ...themeForm };
    const response = editingThemeId.value
      ? await api.admin.updateTheme(editingThemeId.value, input)
      : await api.admin.createTheme(input);
    const savedMessage = `Le thème « ${response.theme.title} » a été enregistré.`;
    showThemeForm.value = false;
    await loadWorkspace();
    successMessage.value = savedMessage;
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isSaving.value = false;
  }
}

async function selectTheme(theme: AdminTheme): Promise<void> {
  selectedTheme.value = theme;
  questions.value = [];
  showQuestionForm.value = false;
  isLoadingQuestions.value = true;
  clearMessages();
  try {
    questions.value = (await api.admin.questions(theme.id)).questions;
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isLoadingQuestions.value = false;
  }
}

function defaultChoices(kind: QuestionKind): AdminAnswerChoice[] {
  if (kind === "true_false") {
    return [
      { label: "Vrai", isCorrect: true },
      { label: "Faux", isCorrect: false },
    ];
  }
  if (kind === "multiple_choice") {
    return [
      { label: "", isCorrect: true },
      { label: "", isCorrect: false },
    ];
  }
  return [];
}

function newQuestion(): void {
  if (!selectedTheme.value) return;
  clearMessages();
  editingQuestionId.value = null;
  questionForm.themeId = selectedTheme.value.id;
  questionForm.kind = "multiple_choice";
  questionForm.prompt = "";
  questionForm.explanation = "";
  questionForm.expectedAnswer = "";
  questionForm.difficulty = 1;
  questionForm.xpReward = 10;
  questionForm.status = "draft";
  choices.value = defaultChoices("multiple_choice");
  showQuestionForm.value = true;
}

function editQuestion(question: AdminQuestion): void {
  clearMessages();
  editingQuestionId.value = question.id;
  questionForm.themeId = question.themeId;
  questionForm.kind = question.kind;
  questionForm.prompt = question.prompt;
  questionForm.explanation = question.explanation;
  questionForm.expectedAnswer = question.expectedAnswer ?? "";
  questionForm.difficulty = question.difficulty;
  questionForm.xpReward = question.xpReward;
  questionForm.status = question.status;
  choices.value = question.choices.map((choice) => ({
    label: choice.label,
    isCorrect: choice.isCorrect,
  }));
  showQuestionForm.value = true;
}

function changeQuestionKind(): void {
  choices.value = defaultChoices(questionForm.kind);
  questionForm.expectedAnswer = "";
}

function markCorrect(index: number): void {
  choices.value.forEach((choice, choiceIndex) => {
    choice.isCorrect = choiceIndex === index;
  });
}

function addChoice(): void {
  if (choices.value.length < 6) choices.value.push({ label: "", isCorrect: false });
}

function removeChoice(index: number): void {
  if (choices.value.length <= 2) return;
  const removedWasCorrect = choices.value[index]?.isCorrect;
  choices.value.splice(index, 1);
  if (removedWasCorrect && choices.value[0]) choices.value[0].isCorrect = true;
}

async function saveQuestion(): Promise<void> {
  if (!selectedTheme.value) return;
  isSaving.value = true;
  clearMessages();
  try {
    const input: AdminQuestionInput = {
      ...questionForm,
      themeId: selectedTheme.value.id,
      expectedAnswer: questionForm.kind === "short_answer"
        ? questionForm.expectedAnswer
        : null,
      choices: questionForm.kind === "short_answer"
        ? []
        : choices.value.map((choice) => ({
            label: choice.label,
            isCorrect: choice.isCorrect,
          })),
    };
    const response = editingQuestionId.value
      ? await api.admin.updateQuestion(editingQuestionId.value, input)
      : await api.admin.createQuestion(input);
    successMessage.value = `La question « ${response.question.prompt} » a été enregistrée.`;
    showQuestionForm.value = false;
    await selectTheme(selectedTheme.value);
    successMessage.value = `La question « ${response.question.prompt} » a été enregistrée.`;
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isSaving.value = false;
  }
}

onMounted(loadWorkspace);
</script>

<template>
  <section class="admin-workspace" aria-labelledby="content-title">
    <div class="admin-section-heading">
      <div>
        <p class="eyebrow">Studio pédagogique</p>
        <h2 id="content-title">Thèmes et questions</h2>
        <p>Construis les exercices proposés aux élèves, comme des petites unités Duolingo.</p>
      </div>
      <button class="compact-button compact-button--primary" type="button" @click="newTheme">
        + Nouveau thème
      </button>
    </div>

    <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage" class="admin-success" aria-live="polite">{{ successMessage }}</p>
    <p v-if="isLoading" class="notice" aria-live="polite">Chargement du contenu…</p>

    <div v-else class="admin-content-layout">
      <section class="admin-theme-column" aria-labelledby="themes-title">
        <div class="admin-list-title">
          <h3 id="themes-title">Thèmes</h3>
          <span>{{ themes.length }}</span>
        </div>
        <p v-if="themes.length === 0" class="admin-empty">
          Aucun thème. Crée le premier pour commencer.
        </p>
        <div v-else class="admin-theme-list">
          <article
            v-for="theme in themes"
            :key="theme.id"
            class="admin-theme-card"
            :class="{ 'admin-theme-card--selected': selectedTheme?.id === theme.id }"
          >
            <button class="admin-theme-select" type="button" @click="selectTheme(theme)">
              <span class="admin-theme-icon" aria-hidden="true">{{ theme.subject.icon }}</span>
              <span>
                <strong>{{ theme.title }}</strong>
                <small>
                  {{ theme.subject.name }} · {{ theme.schoolLevel.label }} ·
                  {{ theme.questionCount }} question{{ theme.questionCount > 1 ? "s" : "" }}
                </small>
              </span>
            </button>
            <div class="admin-theme-meta">
              <span :class="theme.isActive ? 'status-pill--active' : 'status-pill--muted'">
                {{ theme.isActive ? "Actif" : "Masqué" }}
              </span>
              <button class="text-button" type="button" @click="editTheme(theme)">Éditer</button>
            </div>
          </article>
        </div>
      </section>

      <section class="admin-question-column" aria-labelledby="questions-title">
        <template v-if="selectedTheme">
          <div class="admin-list-title admin-list-title--actions">
            <div>
              <p class="eyebrow">{{ selectedTheme.subject.name }} · {{ selectedTheme.schoolLevel.label }}</p>
              <h3 id="questions-title">{{ selectedTheme.title }}</h3>
            </div>
            <button class="compact-button compact-button--primary" type="button" @click="newQuestion">
              + Question
            </button>
          </div>
          <p v-if="isLoadingQuestions" class="notice">Chargement des questions…</p>
          <p v-else-if="questions.length === 0" class="admin-empty">
            Ce thème ne contient pas encore de question.
          </p>
          <div v-else class="admin-question-list">
            <article v-for="question in questions" :key="question.id" class="admin-question-card">
              <div class="admin-question-badges">
                <span>{{ kindLabels[question.kind] }}</span>
                <span :class="`question-status--${question.status}`">
                  {{ statusLabels[question.status] }}
                </span>
              </div>
              <strong>{{ question.prompt }}</strong>
              <p>
                Difficulté {{ question.difficulty }}/5 · {{ question.xpReward }} XP
                <template v-if="question.kind !== 'short_answer'">
                  · {{ question.choices.length }} choix
                </template>
              </p>
              <button class="text-button" type="button" @click="editQuestion(question)">
                Modifier la question
              </button>
            </article>
          </div>
        </template>
        <div v-else class="admin-empty admin-empty--large">
          <span aria-hidden="true">🧩</span>
          <strong>Sélectionne un thème</strong>
          <p>Ses questions apparaîtront ici.</p>
        </div>
      </section>
    </div>

    <div v-if="showThemeForm" class="admin-editor-overlay" @click.self="showThemeForm = false">
      <form class="admin-editor" @submit.prevent="saveTheme">
        <div class="admin-editor-heading">
          <div>
            <p class="eyebrow">Studio pédagogique</p>
            <h2>{{ editingThemeId ? "Modifier le thème" : "Nouveau thème" }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="Fermer" @click="showThemeForm = false">×</button>
        </div>
        <label class="form-field">
          <span>Titre</span>
          <input v-model="themeForm.title" required minlength="3" maxlength="120" placeholder="Les fractions" />
        </label>
        <label class="form-field">
          <span>Résumé</span>
          <textarea v-model="themeForm.summary" maxlength="500" rows="3" placeholder="Ce que l’élève va apprendre…"></textarea>
        </label>
        <div class="admin-form-grid">
          <label class="form-field">
            <span>Matière</span>
            <select v-model="themeForm.subjectId" required>
              <option v-for="subject in catalog.subjects" :key="subject.id" :value="subject.id">
                {{ subject.icon }} {{ subject.name }}
              </option>
            </select>
          </label>
          <label class="form-field">
            <span>Niveau</span>
            <select v-model="themeForm.schoolLevelId" required>
              <option v-for="level in catalog.schoolLevels" :key="level.id" :value="level.id">
                {{ level.label }}
              </option>
            </select>
          </label>
        </div>
        <div class="admin-form-grid">
          <label class="form-field">
            <span>Position</span>
            <input v-model.number="themeForm.position" type="number" min="0" max="10000" required />
          </label>
          <label class="admin-check-field">
            <input v-model="themeForm.isActive" type="checkbox" />
            <span>Thème visible par les élèves</span>
          </label>
        </div>
        <div class="admin-form-actions">
          <button class="secondary-button" type="button" @click="showThemeForm = false">Annuler</button>
          <button class="primary-button admin-primary-button" type="submit" :disabled="isSaving">
            {{ isSaving ? "Enregistrement…" : "Enregistrer le thème" }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="showQuestionForm" class="admin-editor-overlay" @click.self="showQuestionForm = false">
      <form class="admin-editor admin-editor--wide" @submit.prevent="saveQuestion">
        <div class="admin-editor-heading">
          <div>
            <p class="eyebrow">{{ selectedTheme?.title }}</p>
            <h2>{{ editingQuestionId ? "Modifier la question" : "Nouvelle question" }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="Fermer" @click="showQuestionForm = false">×</button>
        </div>
        <label class="form-field">
          <span>Type d’exercice</span>
          <select v-model="questionForm.kind" @change="changeQuestionKind">
            <option value="multiple_choice">QCM</option>
            <option value="true_false">Vrai / faux</option>
            <option value="short_answer">Réponse libre</option>
          </select>
        </label>
        <label class="form-field">
          <span>Question</span>
          <textarea v-model="questionForm.prompt" required minlength="3" maxlength="500" rows="3" placeholder="Écris la consigne ou la question…"></textarea>
        </label>

        <fieldset v-if="questionForm.kind !== 'short_answer'" class="choice-editor">
          <legend>Réponses <small>— coche la bonne réponse</small></legend>
          <div v-for="(choice, index) in choices" :key="index" class="choice-editor-row">
            <input
              :checked="choice.isCorrect"
              type="radio"
              name="correct-choice"
              :aria-label="`Marquer la réponse ${index + 1} comme correcte`"
              @change="markCorrect(index)"
            />
            <input
              v-model="choice.label"
              required
              maxlength="120"
              :readonly="questionForm.kind === 'true_false'"
              :placeholder="`Réponse ${index + 1}`"
            />
            <button
              v-if="questionForm.kind === 'multiple_choice'"
              class="icon-button icon-button--small"
              type="button"
              :disabled="choices.length <= 2"
              :aria-label="`Supprimer la réponse ${index + 1}`"
              @click="removeChoice(index)"
            >
              ×
            </button>
          </div>
          <button
            v-if="questionForm.kind === 'multiple_choice' && choices.length < 6"
            class="compact-button"
            type="button"
            @click="addChoice"
          >
            + Ajouter une réponse
          </button>
        </fieldset>

        <label v-else class="form-field">
          <span>Réponse attendue</span>
          <input v-model="questionForm.expectedAnswer" required maxlength="200" placeholder="La réponse à comparer" />
        </label>

        <label class="form-field">
          <span>Explication après la réponse</span>
          <textarea v-model="questionForm.explanation" maxlength="1000" rows="3" placeholder="Pourquoi cette réponse est correcte…"></textarea>
        </label>
        <div class="admin-form-grid admin-form-grid--three">
          <label class="form-field">
            <span>Difficulté</span>
            <select v-model.number="questionForm.difficulty">
              <option v-for="value in 5" :key="value" :value="value">{{ value }}/5</option>
            </select>
          </label>
          <label class="form-field">
            <span>Récompense XP</span>
            <input v-model.number="questionForm.xpReward" type="number" min="1" max="100" required />
          </label>
          <label class="form-field">
            <span>Statut</span>
            <select v-model="questionForm.status">
              <option value="draft">Brouillon</option>
              <option value="published">Publiée</option>
              <option value="archived">Archivée</option>
            </select>
          </label>
        </div>
        <div class="admin-form-actions">
          <button class="secondary-button" type="button" @click="showQuestionForm = false">Annuler</button>
          <button class="primary-button admin-primary-button" type="submit" :disabled="isSaving">
            {{ isSaving ? "Enregistrement…" : "Enregistrer la question" }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
