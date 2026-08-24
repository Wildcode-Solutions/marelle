<script setup lang="ts">
import { computed } from "vue";

import type { DailyChallengeQuestion } from "@/types/domain";

const props = defineProps<{
  answers: Record<string, boolean>;
  currentIndex: number;
  questions: DailyChallengeQuestion[];
}>();

const rows = computed(() => {
  const questions = props.questions;
  if (questions.length === 5) return [[questions[4]!], [questions[2]!, questions[3]!], [questions[1]!], [questions[0]!]];
  if (questions.length === 4) return [[questions[2]!, questions[3]!], [questions[1]!], [questions[0]!]];
  return [[questions[2]!], [questions[1]!], [questions[0]!]];
});

function state(question: DailyChallengeQuestion): "correct" | "missed" | "active" | "future" {
  if (Object.prototype.hasOwnProperty.call(props.answers, question.id)) {
    return props.answers[question.id] ? "correct" : "missed";
  }
  return props.questions[props.currentIndex]?.id === question.id ? "active" : "future";
}
</script>

<template>
  <div class="hopscotch-progress" aria-label="Progression dans la Marelle">
    <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="hopscotch-progress__row">
      <div
        v-for="question in row"
        :key="question.id"
        class="hopscotch-tile"
        :class="`hopscotch-tile--${state(question)}`"
        :aria-label="`Case ${question.position} : ${state(question)}`"
      >
        <span>{{ question.position }}</span>
        <small v-if="state(question) === 'correct'">✓</small>
        <small v-else-if="state(question) === 'missed'">×</small>
      </div>
    </div>
  </div>
</template>
