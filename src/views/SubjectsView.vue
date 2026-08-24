<script setup lang="ts">
import { onMounted, ref } from "vue";

import SubjectGrid from "@/components/SubjectGrid.vue";
import ViewHeader from "@/components/ViewHeader.vue";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import type { SubjectSummary } from "@/types/domain";

const subjects = ref<SubjectSummary[]>([]);
const isLoading = ref(true);
const hasError = ref(false);

onMounted(async () => {
  try {
    subjects.value = await api.subjects(auth.user.value?.schoolLevel.id);
  } catch {
    hasError.value = true;
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="page inner-page">
    <ViewHeader
      :eyebrow="`Sommaire · ${auth.user.value?.schoolLevel.label ?? '6e'}`"
      title="Quel cahier ouvre-t-on ?"
      description="Choisis une matière et avance exercice après exercice, à ton rythme."
    />

    <p v-if="isLoading" class="notice">Chargement des matières…</p>
    <p v-else-if="hasError" class="notice notice--error">Les matières ne sont pas disponibles pour le moment.</p>
    <SubjectGrid v-else :subjects="subjects" />
  </div>
</template>
