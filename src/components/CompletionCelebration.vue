<script setup lang="ts">
const colors = ["#d95652", "#315f9e", "#e5b936", "#5b9a65", "#e69d5a"];
const marks = ["A", "", "+", "", "★", "", "2", ""];

const pieces = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  mark: marks[index % marks.length],
  style: {
    left: `${2 + ((index * 37) % 96)}%`,
    animationDelay: `${(index % 8) * 65}ms`,
    animationDuration: `${1_250 + (index % 5) * 150}ms`,
    "--piece-color": colors[index % colors.length],
    "--piece-turn": `${80 + ((index * 53) % 280)}deg`,
  },
}));
</script>

<template>
  <div class="completion-celebration" aria-hidden="true">
    <div class="completion-celebration__wash"></div>
    <i
      v-for="piece in pieces"
      :key="piece.id"
      class="completion-celebration__piece"
      :class="{ 'completion-celebration__piece--mark': piece.mark }"
      :style="piece.style"
    >{{ piece.mark }}</i>

    <div class="completion-celebration__stamp">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true">
        <circle cx="32" cy="32" r="27" />
        <path d="m19 33 8 8 18-20" />
      </svg>
      <strong>Marelle validée !</strong>
      <small>Très beau travail</small>
    </div>
  </div>
</template>
