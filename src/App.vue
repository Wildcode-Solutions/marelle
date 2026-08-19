<script setup lang="ts">
import BottomNavigation from "@/components/BottomNavigation.vue";
import { auth } from "@/services/auth";
</script>

<template>
  <div class="app-shell">
    <main class="app-content" :class="{ 'app-content--guest': !auth.isAuthenticated.value }">
      <RouterView />
    </main>
    <BottomNavigation v-if="auth.isAuthenticated.value" />
  </div>
</template>
