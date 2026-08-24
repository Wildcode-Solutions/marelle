<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { DailyChallengeAnswerInput, DailyChallengeQuestion } from "@/types/domain";

type QuestionSubmission = Omit<
  DailyChallengeAnswerInput,
  "attemptId" | "questionId" | "responseTimeMs"
>;

const props = defineProps<{
  disabled?: boolean;
  question: DailyChallengeQuestion;
}>();

const emit = defineEmits<{
  submit: [answer: QuestionSubmission];
}>();

const selectedChoiceId = ref<string | null>(null);
const answerText = ref("");
const blankAnswers = ref<string[]>([]);
const orderedItemIds = ref<string[]>([]);
const matchingAnswers = ref<Record<number, string>>({});

const visiblePrompt = computed(() =>
  props.question.kind === "fill_in_blank"
    ? props.question.prompt.replace(/\{\{\d+\}\}/g, "_____")
    : props.question.prompt,
);

const canSubmit = computed(() => {
  if (props.question.kind === "multiple_choice" || props.question.kind === "true_false") {
    return selectedChoiceId.value !== null;
  }
  if (props.question.kind === "short_answer" || props.question.kind === "numeric") {
    return answerText.value.trim().length > 0;
  }
  if (props.question.kind === "fill_in_blank") {
    return (
      blankAnswers.value.length === props.question.blankCount &&
      blankAnswers.value.every((answer) => answer.trim().length > 0)
    );
  }
  if (props.question.kind === "ordering") {
    return orderedItemIds.value.length === props.question.orderingItems.length;
  }
  return props.question.matchingPrompts.every(
    (prompt) => Boolean(matchingAnswers.value[prompt.position]),
  );
});

watch(
  () => props.question.id,
  () => {
    selectedChoiceId.value = null;
    answerText.value = "";
    blankAnswers.value = Array.from({ length: props.question.blankCount }, () => "");
    orderedItemIds.value = props.question.orderingItems.map((item) => item.id);
    matchingAnswers.value = Object.fromEntries(
      props.question.matchingPrompts.map((prompt) => [prompt.position, ""]),
    );
  },
  { immediate: true },
);

function submit(): void {
  if (props.disabled || !canSubmit.value) return;
  const emptySubmission: QuestionSubmission = {
    answerChoiceId: null,
    answerText: null,
    blankAnswers: null,
    matches: null,
    orderedItemIds: null,
  };

  if (props.question.kind === "multiple_choice" || props.question.kind === "true_false") {
    emit("submit", { ...emptySubmission, answerChoiceId: selectedChoiceId.value });
    return;
  }
  if (props.question.kind === "short_answer" || props.question.kind === "numeric") {
    emit("submit", { ...emptySubmission, answerText: answerText.value.trim() });
    return;
  }
  if (props.question.kind === "fill_in_blank") {
    emit("submit", {
      ...emptySubmission,
      blankAnswers: blankAnswers.value.map((answer) => answer.trim()),
    });
    return;
  }
  if (props.question.kind === "ordering") {
    emit("submit", { ...emptySubmission, orderedItemIds: orderedItemIds.value });
    return;
  }
  emit("submit", {
    ...emptySubmission,
    matches: props.question.matchingPrompts.map((prompt) => ({
      promptPosition: prompt.position,
      answerItemId: matchingAnswers.value[prompt.position]!,
    })),
  });
}

function moveOrderedItem(index: number, direction: -1 | 1): void {
  const target = index + direction;
  if (target < 0 || target >= orderedItemIds.value.length) return;
  [orderedItemIds.value[index], orderedItemIds.value[target]] = [
    orderedItemIds.value[target]!,
    orderedItemIds.value[index]!,
  ];
}

function orderingLabel(itemId: string): string {
  return props.question.orderingItems.find((item) => item.id === itemId)?.label ?? "";
}

function optionUsedElsewhere(optionId: string, promptPosition: number): boolean {
  return Object.entries(matchingAnswers.value).some(
    ([position, answerId]) => Number(position) !== promptPosition && answerId === optionId,
  );
}
</script>

<template>
  <form class="question-exercise" @submit.prevent="submit">
    <div class="question-exercise__heading">
      <span>Question {{ question.position }}</span>
      <small>Difficulté {{ question.difficulty }}/5</small>
    </div>
    <h1>{{ visiblePrompt }}</h1>

    <fieldset
      v-if="question.kind === 'multiple_choice' || question.kind === 'true_false'"
      class="question-options"
      :disabled="disabled"
    >
      <legend class="sr-only">Choisis une réponse</legend>
      <label
        v-for="(choice, index) in question.choices"
        :key="choice.id"
        :class="{ 'question-option--selected': selectedChoiceId === choice.id }"
      >
        <input v-model="selectedChoiceId" type="radio" :value="choice.id" name="answer" />
        <span>{{ String.fromCharCode(65 + index) }}</span>
        <strong>{{ choice.label }}</strong>
      </label>
    </fieldset>

    <label
      v-else-if="question.kind === 'short_answer' || question.kind === 'numeric'"
      class="form-field question-free-answer"
    >
      <span>Ta réponse</span>
      <span class="question-input-with-unit">
        <input
          v-model="answerText"
          type="text"
          maxlength="300"
          autocomplete="off"
          :inputmode="question.kind === 'numeric' ? 'decimal' : 'text'"
          :disabled="disabled"
          :placeholder="question.kind === 'numeric' ? 'Ex. 12,5' : 'Écris ta réponse…'"
        />
        <strong v-if="question.kind === 'numeric' && question.answerUnit">
          {{ question.answerUnit }}
        </strong>
      </span>
    </label>

    <fieldset v-else-if="question.kind === 'fill_in_blank'" class="question-structured">
      <legend>Complète {{ question.blankCount > 1 ? "les blancs" : "le blanc" }}</legend>
      <label v-for="(_, index) in blankAnswers" :key="index" class="form-field">
        <span>Réponse {{ index + 1 }}</span>
        <input
          v-model="blankAnswers[index]"
          type="text"
          maxlength="200"
          autocomplete="off"
          :disabled="disabled"
        />
      </label>
    </fieldset>

    <fieldset v-else-if="question.kind === 'ordering'" class="question-structured">
      <legend>Replace les éléments dans le bon ordre</legend>
      <ol class="question-ordering">
        <li v-for="(itemId, index) in orderedItemIds" :key="itemId">
          <span>{{ orderingLabel(itemId) }}</span>
          <span class="question-ordering__actions">
            <button
              type="button"
              :disabled="disabled || index === 0"
              :aria-label="`Monter ${orderingLabel(itemId)}`"
              @click="moveOrderedItem(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              :disabled="disabled || index === orderedItemIds.length - 1"
              :aria-label="`Descendre ${orderingLabel(itemId)}`"
              @click="moveOrderedItem(index, 1)"
            >
              ↓
            </button>
          </span>
        </li>
      </ol>
    </fieldset>

    <fieldset v-else class="question-structured">
      <legend>Associe chaque élément à la bonne réponse</legend>
      <label
        v-for="prompt in question.matchingPrompts"
        :key="prompt.position"
        class="question-matching"
      >
        <strong>{{ prompt.label }}</strong>
        <select v-model="matchingAnswers[prompt.position]" :disabled="disabled">
          <option value="" disabled>Choisir…</option>
          <option
            v-for="option in question.matchingOptions"
            :key="option.id"
            :value="option.id"
            :disabled="optionUsedElsewhere(option.id, prompt.position)"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
    </fieldset>

    <button
      class="primary-button question-submit"
      type="submit"
      :disabled="disabled || !canSubmit"
    >
      {{ disabled ? "Vérification…" : "Valider ma réponse" }}
    </button>
  </form>
</template>
