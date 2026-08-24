<script setup lang="ts">
import type { UserSummary } from "@/types/domain";

defineProps<{
  user: UserSummary;
}>();
</script>

<template>
  <header class="topbar">
    <div class="brand" aria-label="Marelle">
      <span class="brand-mark" aria-hidden="true">M</span>
      <span class="brand-copy">
        <span class="brand-name">marelle</span>
        <small>cahier de révisions</small>
      </span>
    </div>

    <div class="topbar-stats" aria-label="Résumé de progression">
      <span class="stat-pill stat-pill--fire" :title="`${user.currentStreak} jours de série`">
        <span aria-hidden="true">🔥</span>
        <strong>{{ user.currentStreak }}</strong>
      </span>
      <span class="stat-pill" :title="`${user.lives} vies restantes`">
        <span aria-hidden="true">💜</span>
        <strong>{{ user.lives }}</strong>
      </span>
      <span class="avatar" :title="user.displayName" aria-hidden="true">{{ user.avatarEmoji }}</span>
    </div>
  </header>
</template>
