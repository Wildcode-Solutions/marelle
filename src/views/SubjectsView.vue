<script setup lang="ts">
import { onMounted, ref } from "vue";

import SubjectGrid from "@/components/SubjectGrid.vue";
import ViewHeader from "@/components/ViewHeader.vue";
import { api } from "@/services/api";
import type { SubjectSummary } from "@/types/domain";

const subjects = ref<SubjectSummary[]>([]);
const isLoading = ref(true);
const hasError = ref(false);

onMounted(async () => {
  try {
    subjects.value = await api.subjects();
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
      eyebrow="Parcours de 6e"
      title="Choisis une matière"
      description="Avance chapitre par chapitre, à ton rythme."
    />

    <p v-if="isLoading" class="notice">Chargement des matières…</p>
    <p v-else-if="hasError" class="notice notice--error">Les matières ne sont pas disponibles pour le moment.</p>
    <SubjectGrid v-else :subjects="subjects" />
  </div>
</template>
