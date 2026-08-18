<script setup lang="ts">
import type { SubjectSummary } from "@/types/domain";

defineProps<{
  subjects: SubjectSummary[];
}>();
</script>

<template>
  <div class="subject-grid">
    <RouterLink
      v-for="subject in subjects"
      :key="subject.id"
      class="subject-card"
      :class="{ 'subject-card--empty': subject.chapterCount === 0 }"
      :to="{ name: 'subjects', query: { matiere: subject.slug } }"
      :style="{ '--subject-color': subject.color }"
    >
      <span class="subject-icon" aria-hidden="true">{{ subject.icon }}</span>
      <span class="subject-card__copy">
        <strong>{{ subject.shortName }}</strong>
        <small>
          {{ subject.chapterCount > 0 ? `${subject.chapterCount} chapitre${subject.chapterCount > 1 ? 's' : ''}` : "Bientôt disponible" }}
        </small>
      </span>
      <span class="subject-arrow" aria-hidden="true">›</span>
    </RouterLink>
  </div>
</template>
