<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import { api, ApiError } from "@/services/api";
import { auth } from "@/services/auth";
import type { AdminUser, SchoolLevel, UserRole } from "@/types/domain";

const students = ref<AdminUser[]>([]);
const admins = ref<AdminUser[]>([]);
const schoolLevels = ref<SchoolLevel[]>([]);
const hasMoreStudents = ref(false);
const hasMoreAdmins = ref(false);
const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const editingUser = ref<AdminUser | null>(null);

const form = reactive({
  displayName: "",
  email: "",
  schoolLevelId: "",
  role: "student" as UserRole,
});

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? error.message : "Une erreur inattendue est survenue.";
}

async function loadUsers(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    const [studentResponse, adminResponse, catalog] = await Promise.all([
      api.admin.users("student"),
      api.admin.users("admin"),
      api.admin.catalog(),
    ]);
    students.value = studentResponse.users;
    admins.value = adminResponse.users;
    schoolLevels.value = catalog.schoolLevels;
    hasMoreStudents.value = studentResponse.pagination.hasMore;
    hasMoreAdmins.value = adminResponse.pagination.hasMore;
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isLoading.value = false;
  }
}

async function loadMore(role: UserRole): Promise<void> {
  errorMessage.value = "";
  try {
    const target = role === "admin" ? admins : students;
    const response = await api.admin.users(role, target.value.length);
    target.value.push(...response.users);
    if (role === "admin") hasMoreAdmins.value = response.pagination.hasMore;
    else hasMoreStudents.value = response.pagination.hasMore;
  } catch (error) {
    errorMessage.value = messageFrom(error);
  }
}

function startEditing(user: AdminUser): void {
  editingUser.value = user;
  form.displayName = user.displayName;
  form.email = user.email;
  form.schoolLevelId = user.schoolLevel.id;
  form.role = user.role;
  errorMessage.value = "";
  successMessage.value = "";
}

function cancelEditing(): void {
  editingUser.value = null;
}

async function saveUser(): Promise<void> {
  if (!editingUser.value) return;
  isSaving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const response = await api.admin.updateUser(editingUser.value.id, {
      displayName: form.displayName,
      email: form.email,
      schoolLevelId: form.schoolLevelId,
      role: form.role,
    });
    successMessage.value = `Le compte de ${response.user.displayName} a été enregistré.`;
    editingUser.value = null;
    await loadUsers();
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isSaving.value = false;
  }
}

async function promote(user: AdminUser): Promise<void> {
  if (!window.confirm(`Donner les droits administrateur à ${user.displayName} ?`)) return;
  isSaving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await api.admin.updateUser(user.id, { role: "admin" });
    successMessage.value = `${user.displayName} est maintenant administrateur.`;
    await loadUsers();
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    isSaving.value = false;
  }
}

onMounted(loadUsers);
</script>

<template>
  <section class="admin-workspace" aria-labelledby="users-title">
    <div class="admin-section-heading">
      <div>
        <p class="eyebrow">Comptes</p>
        <h2 id="users-title">Utilisateurs et administrateurs</h2>
        <p>Modifie les profils et attribue les droits d’administration.</p>
      </div>
      <button class="compact-button" type="button" :disabled="isLoading" @click="loadUsers">
        Actualiser
      </button>
    </div>

    <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage" class="admin-success" aria-live="polite">{{ successMessage }}</p>
    <p v-if="isLoading" class="notice" aria-live="polite">Chargement des comptes…</p>

    <template v-else>
      <section class="admin-list-block" aria-labelledby="admins-title">
        <div class="admin-list-title">
          <h3 id="admins-title">Administrateurs</h3>
          <span>{{ admins.length }}</span>
        </div>
        <div class="admin-user-list">
          <article v-for="user in admins" :key="user.id" class="admin-user-row">
            <div class="admin-user-avatar" aria-hidden="true">{{ user.avatarEmoji }}</div>
            <div class="admin-user-copy">
              <strong>
                {{ user.displayName }}
                <small v-if="user.id === auth.user.value?.id">(toi)</small>
              </strong>
              <span>{{ user.email }} · {{ user.schoolLevel.label }} · {{ user.xp }} XP</span>
            </div>
            <button class="compact-button" type="button" @click="startEditing(user)">
              Éditer
            </button>
          </article>
        </div>
        <button
          v-if="hasMoreAdmins"
          class="secondary-button admin-load-more"
          type="button"
          @click="loadMore('admin')"
        >
          Charger plus
        </button>
      </section>

      <section class="admin-list-block" aria-labelledby="students-title">
        <div class="admin-list-title">
          <h3 id="students-title">Utilisateurs</h3>
          <span>{{ students.length }}</span>
        </div>
        <div class="admin-user-list">
          <article v-for="user in students" :key="user.id" class="admin-user-row">
            <div class="admin-user-avatar" aria-hidden="true">{{ user.avatarEmoji }}</div>
            <div class="admin-user-copy">
              <strong>{{ user.displayName }}</strong>
              <span>{{ user.email }} · {{ user.schoolLevel.label }} · {{ user.xp }} XP</span>
            </div>
            <div class="admin-row-actions">
              <button class="compact-button" type="button" @click="startEditing(user)">
                Éditer
              </button>
              <button
                class="compact-button compact-button--primary"
                type="button"
                :disabled="isSaving"
                @click="promote(user)"
              >
                Passer admin
              </button>
            </div>
          </article>
        </div>
        <button
          v-if="hasMoreStudents"
          class="secondary-button admin-load-more"
          type="button"
          @click="loadMore('student')"
        >
          Charger plus
        </button>
      </section>
    </template>

    <Teleport to="body">
      <div v-if="editingUser" class="admin-editor-overlay" @click.self="cancelEditing">
        <form class="admin-editor" @submit.prevent="saveUser">
        <div class="admin-editor-heading">
          <div>
            <p class="eyebrow">Modifier le compte</p>
            <h2>{{ editingUser.displayName }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="Fermer" @click="cancelEditing">×</button>
        </div>

        <label class="form-field">
          <span>Nom affiché</span>
          <input v-model="form.displayName" required minlength="2" maxlength="40" />
        </label>
        <label class="form-field">
          <span>Adresse e-mail</span>
          <input v-model="form.email" required type="email" maxlength="254" />
        </label>
        <label class="form-field">
          <span>Niveau scolaire</span>
          <select v-model="form.schoolLevelId" required>
            <option v-for="level in schoolLevels" :key="level.id" :value="level.id">
              {{ level.label }}
            </option>
          </select>
        </label>
        <label class="form-field">
          <span>Rôle</span>
          <select v-model="form.role" :disabled="editingUser.id === auth.user.value?.id">
            <option value="student">Utilisateur</option>
            <option value="admin">Administrateur</option>
          </select>
        </label>
        <p v-if="editingUser.id === auth.user.value?.id" class="admin-help">
          Tu ne peux pas retirer ton propre rôle administrateur.
        </p>

        <div class="admin-form-actions">
          <button class="secondary-button" type="button" @click="cancelEditing">Annuler</button>
          <button class="primary-button admin-primary-button" type="submit" :disabled="isSaving">
            {{ isSaving ? "Enregistrement…" : "Enregistrer" }}
          </button>
        </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>
