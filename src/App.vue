<script setup lang="ts">
import BottomNavigation from "@/components/BottomNavigation.vue";
</script>

<template>
  <div class="app-shell">
    <main class="app-content">
      <RouterView />
    </main>
    <BottomNavigation />
  </div>
</template>
