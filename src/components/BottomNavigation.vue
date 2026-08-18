<script setup lang="ts">
const items = [
  { to: "/", label: "Accueil", icon: "⌂" },
  { to: "/matieres", label: "Matières", icon: "▦" },
  { to: "/progression", label: "Progrès", icon: "↗" },
  { to: "/profil", label: "Profil", icon: "☺" },
] as const;
</script>

<template>
  <nav class="bottom-nav" aria-label="Navigation principale">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="bottom-nav__item"
      :aria-label="item.label"
    >
      <span class="bottom-nav__icon" aria-hidden="true">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
