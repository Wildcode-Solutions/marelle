<script setup lang="ts">
import { computed } from "vue";

import { auth } from "@/services/auth";

const items = computed(() => [
  { to: "/", label: "Accueil", icon: "⌂" },
  { to: "/ligue", label: "Ligue", icon: "trophy" },
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
      <span class="bottom-nav__icon" aria-hidden="true">
        <svg
          v-if="item.icon === 'trophy'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
          <path d="M7 6H5a2 2 0 0 0 2 4" />
          <path d="M17 6h2a2 2 0 0 1-2 4" />
        </svg>
        <template v-else>{{ item.icon }}</template>
      </span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
