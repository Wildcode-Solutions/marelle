<script setup lang="ts">
import { computed } from "vue";

import { auth } from "@/services/auth";

const items = computed(() => [
  { to: "/", label: "Accueil", icon: "⌂" },
  { to: "/matieres", label: "Matières", icon: "▦" },
  { to: "/progression", label: "Progrès", icon: "↗" },
  { to: "/profil", label: "Profil", icon: "☺" },
  ...(auth.user.value?.role === "admin"
    ? [{ to: "/admin", label: "Admin", icon: "⚙" }]
    : []),
]);
</script>

<template>
  <nav
    class="bottom-nav"
    :class="{ 'bottom-nav--admin': auth.user.value?.role === 'admin' }"
    aria-label="Navigation principale"
  >
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
