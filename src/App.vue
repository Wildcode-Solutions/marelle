<script setup lang="ts">
import BottomNavigation from "@/components/BottomNavigation.vue";
import { auth } from "@/services/auth";
</script>

<template>
  <div class="app-shell">
    <main class="app-content" :class="{ 'app-content--guest': !auth.isAuthenticated.value }">
      <RouterView v-slot="{ Component, route }">
        <Transition name="page-sheet" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>
    <BottomNavigation v-if="auth.isAuthenticated.value" />
  </div>
</template>
