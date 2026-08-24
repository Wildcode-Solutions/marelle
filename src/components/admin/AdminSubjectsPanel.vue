<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import { api, ApiError } from "@/services/api";
import type { AdminSubject, AdminSubjectInput } from "@/types/domain";

const subjects = ref<AdminSubject[]>([]);
const editingSubject = ref<AdminSubject | null>(null);
const showForm = ref(false);
const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const form = reactive<AdminSubjectInput>({
  name: "",
  shortName: "",
  icon: "📘",
  color: "#6C5CE7",
  isActive: true,
});

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? error.message : "Une erreur inattendue est survenue.";
}

async function loadSubjects(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    subjects.value = (await api.admin.subjects()).subjects;
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isLoading.value = false;
  }
}

function newSubject(): void {
  editingSubject.value = null;
  form.name = "";
  form.shortName = "";
  form.icon = "📘";
  form.color = "#6C5CE7";
  form.isActive = true;
  errorMessage.value = "";
  successMessage.value = "";
  showForm.value = true;
}

function editSubject(subject: AdminSubject): void {
  editingSubject.value = subject;
  form.name = subject.name;
  form.shortName = subject.shortName;
  form.icon = subject.icon;
  form.color = subject.color;
  form.isActive = subject.isActive;
  errorMessage.value = "";
  successMessage.value = "";
  showForm.value = true;
}

function closeForm(): void {
  showForm.value = false;
  editingSubject.value = null;
}

async function saveSubject(): Promise<void> {
  isSaving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const input: AdminSubjectInput = { ...form };
    const response = editingSubject.value
      ? await api.admin.updateSubject(editingSubject.value.id, input)
      : await api.admin.createSubject(input);
    const savedMessage = `La matière « ${response.subject.name} » a été enregistrée.`;
    closeForm();
    await loadSubjects();
    successMessage.value = savedMessage;
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isSaving.value = false;
  }
}

onMounted(loadSubjects);
</script>

<template>
  <section class="admin-workspace" aria-labelledby="subjects-title">
    <div class="admin-section-heading">
      <div>
        <p class="eyebrow">Catalogue</p>
        <h2 id="subjects-title">Liste des matières</h2>
        <p>Consulte, crée et modifie les matières proposées aux élèves.</p>
      </div>
      <button class="compact-button compact-button--primary" type="button" @click="newSubject">
        + Nouvelle matière
      </button>
    </div>

    <p v-if="errorMessage && !showForm" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="admin-success" aria-live="polite">{{ successMessage }}</p>
    <p v-if="isLoading" class="notice" aria-live="polite">Chargement des matières…</p>

    <template v-else>
      <div class="admin-list-title">
        <h3>Toutes les matières</h3>
        <span>{{ subjects.length }}</span>
      </div>

      <div v-if="subjects.length" class="admin-subject-list">
        <article
          v-for="subject in subjects"
          :key="subject.id"
          class="admin-subject-row"
          :style="{ '--subject-color': subject.color }"
        >
          <div class="admin-subject-icon" aria-hidden="true">{{ subject.icon }}</div>
          <div class="admin-subject-copy">
            <strong>{{ subject.name }}</strong>
            <span>
              {{ subject.shortName }} · {{ subject.slug }} ·
              {{ subject.themeCount }} thème{{ subject.themeCount !== 1 ? "s" : "" }}
            </span>
          </div>
          <span
            class="admin-subject-status"
            :class="{ 'admin-subject-status--inactive': !subject.isActive }"
          >
            {{ subject.isActive ? "Visible" : "Masquée" }}
          </span>
          <button class="compact-button" type="button" @click="editSubject(subject)">
            Modifier
          </button>
        </article>
      </div>
      <p v-else class="admin-empty">Aucune matière n’a encore été créée.</p>
    </template>

    <Teleport to="body">
      <div v-if="showForm" class="admin-editor-overlay" @click.self="closeForm">
        <form class="admin-editor" @submit.prevent="saveSubject">
        <div class="admin-editor-heading">
          <div>
            <p class="eyebrow">Catalogue</p>
            <h2>{{ editingSubject ? "Modifier la matière" : "Nouvelle matière" }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="Fermer" @click="closeForm">×</button>
        </div>

        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

        <label class="form-field">
          <span>Nom complet</span>
          <input
            v-model="form.name"
            required
            minlength="2"
            maxlength="80"
            placeholder="Mathématiques"
          />
        </label>
        <label class="form-field">
          <span>Nom court</span>
          <input v-model="form.shortName" required maxlength="30" placeholder="Maths" />
        </label>
        <div class="admin-form-grid">
          <label class="form-field">
            <span>Icône</span>
            <input v-model="form.icon" required maxlength="32" placeholder="➗" />
          </label>
          <label class="form-field admin-color-field">
            <span>Couleur</span>
            <span class="admin-color-control">
              <input v-model="form.color" type="color" aria-label="Couleur de la matière" />
              <output>{{ form.color.toUpperCase() }}</output>
            </span>
          </label>
        </div>
        <label class="admin-check-field">
          <input v-model="form.isActive" type="checkbox" />
          <span>Matière visible par les élèves</span>
        </label>

        <div class="admin-form-actions">
          <button class="secondary-button" type="button" @click="closeForm">Annuler</button>
          <button class="primary-button admin-primary-button" type="submit" :disabled="isSaving">
            {{ isSaving ? "Enregistrement…" : "Enregistrer la matière" }}
          </button>
        </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>
